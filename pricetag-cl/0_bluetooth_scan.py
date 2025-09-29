# 1_ble_probe.py
# macOS + bleak: bezpieczne sprawdzanie GATT (read/write/notify) bez zapisu
import asyncio
import argparse
from bleak import BleakScanner, BleakClient

def decode_utf8(b: bytes) -> str | None:
    if not b:
        return ""
    try:
        t = b.decode("utf-8", "ignore").strip()
        return t if any(ch.isalnum() for ch in t) else None
    except Exception:
        return None

async def scan_filtered(name_contains: str, scan_seconds: float, require_connectable: bool):
    found = {}
    def on_detect(device, adv):
        name = device.name or adv.local_name
        # na macOS device.address to UUID CoreBluetooth
        if name and name_contains in name:
            # wiele @xxxxxx to beacony -> często nieconnectowalne
            connectable = getattr(adv, "connectable", True)
            if require_connectable and not connectable:
                return
            found[device.address] = {
                "addr": device.address,
                "name": name,
                "rssi": adv.rssi,
                "connectable": connectable,
            }
    scanner = BleakScanner(on_detect)
    await scanner.start()
    await asyncio.sleep(scan_seconds)
    await scanner.stop()
    rows = sorted(
        found.values(),
        key=lambda r: (r["rssi"] is None, r["rssi"] if r["rssi"] is not None else -999),
        reverse=True,
    )
    return rows

async def get_connected_state(client: BleakClient) -> bool:
    """
    Kompatybilność wsteczna: w nowych bleak is_connected to property (bool),
    w starych bywało metodą.
    """
    try:
        attr = getattr(client, "is_connected")
        if isinstance(attr, bool):
            return attr
        if callable(attr):
            res = attr()
            if asyncio.iscoroutine(res):
                return await res
            return bool(res)
    except Exception:
        return False
    return False

async def probe_device(addr: str, read_samples: bool = True, timeout: float = 10.0):
    summary = {
        "addr": addr,
        "connected": False,
        "error": None,
        "services": [],
        "counts": {"read": 0, "write": 0, "notify": 0},
        "device_info": {},
    }
    try:
        async with BleakClient(addr, timeout=timeout) as client:
            summary["connected"] = await get_connected_state(client)
            if not summary["connected"]:
                return summary

            svcs = await client.get_services()

            # Device Information Service (0x180A)
            for svc in svcs:
                if str(svc.uuid).lower().startswith("0000180a-"):
                    for ch in svc.characteristics:
                        cu = str(ch.uuid).lower()
                        if "read" in ch.properties:
                            try:
                                data = await client.read_gatt_char(ch.uuid)
                                text = decode_utf8(data)
                                if cu.startswith("00002a29-"): summary["device_info"]["manufacturer"] = text or data.hex()
                                if cu.startswith("00002a24-"): summary["device_info"]["model"] = text or data.hex()
                                if cu.startswith("00002a25-"): summary["device_info"]["serial"] = text or data.hex()
                                if cu.startswith("00002a26-"): summary["device_info"]["fw"] = text or data.hex()
                                if cu.startswith("00002a27-"): summary["device_info"]["hw"] = text or data.hex()
                                if cu.startswith("00002a28-"): summary["device_info"]["sw"] = text or data.hex()
                            except Exception:
                                pass

            for svc in svcs:
                srec = {"uuid": str(svc.uuid), "chars": []}
                for ch in svc.characteristics:
                    props = set(ch.properties or [])
                    summary["counts"]["read"]   += int("read" in props)
                    summary["counts"]["write"]  += int("write" in props or "write-without-response" in props)
                    summary["counts"]["notify"] += int("notify" in props or "indicate" in props)

                    crec = {"uuid": str(ch.uuid), "props": sorted(list(props))}
                    if read_samples and "read" in props:
                        try:
                            data = await client.read_gatt_char(ch.uuid)
                            crec["sample_hex"] = data[:64].hex()
                            text = decode_utf8(data[:64])
                            if text:
                                crec["sample_text"] = text
                        except Exception as e:
                            crec["read_error"] = str(e)
                    srec["chars"].append(crec)
                summary["services"].append(srec)

    except Exception as e:
        summary["error"] = str(e)
    return summary

def print_scan(rows):
    print(f"{'IDENTIFIER/UUID':<36} {'RSSI':>5}  {'CONN':<5} NAME")
    print("-" * 80)
    for r in rows:
        rssi_txt = "" if r.get("rssi") is None else str(r["rssi"])
        conn = "yes" if r.get("connectable", True) else "no"
        print(f"{r['addr']:<36} {rssi_txt:>5}  {conn:<5} {r['name']}")

def print_probe_summary(row, probe):
    print("\n=== PROBE RESULT ===")
    print(f"Device: {row.get('name','(target)')}  ({row['addr']})")
    if probe["error"]:
        print(f"Status : ERROR -> {probe['error']}")
        return
    print(f"Status : {'CONNECTED' if probe['connected'] else 'NOT CONNECTED'}")
    if probe["device_info"]:
        print("Info   :", ", ".join(f"{k}={v}" for k, v in probe["device_info"].items()))
    c = probe["counts"]
    print(f"Chars  : read={c['read']}  write={c['write']}  notify/indicate={c['notify']}")
    if not probe["services"]:
        print("Services: (none)")
        return
    print("Services/Characteristics:")
    for svc in probe["services"]:
        print(f"  - SVC {svc['uuid']}")
        for ch in svc["chars"]:
            props = ",".join(ch["props"])
            line = f"      * {ch['uuid']} [{props}]"
            if "sample_text" in ch:
                line += f"  text='{ch['sample_text']}'"
            elif "sample_hex" in ch:
                line += f"  hex={ch['sample_hex']}"
            if "read_error" in ch:
                line += f"  !read_error={ch['read_error']}"
            print(line)

async def run():
    ap = argparse.ArgumentParser(description="BLE probe (macOS): skan + GATT-capabilities, bez zapisu.")
    ap.add_argument("--name-contains", default="@", help="Filtr nazwy (default: '@').")
    ap.add_argument("--scan-seconds", type=float, default=8.0, help="Czas skanu.")
    ap.add_argument("--max-probe", type=int, default=3, help="Maks. liczba urządzeń do próby połączenia.")
    ap.add_argument("--target", help="UUID konkretnego urządzenia (pomija skan).")
    ap.add_argument("--include-nonconnectable", action="store_true",
                    help="Uwzględnij urządzenia nieconnectowalne (beacony) — spodziewaj się błędów połączenia.")
    args = ap.parse_args()

    if args.target:
        rows = [{"addr": args.target, "name": "(target)", "rssi": None, "connectable": True}]
    else:
        rows = await scan_filtered(args.name_contains, args.scan_seconds, require_connectable=not args.include_nonconnectable)
        if not rows:
            print("(brak urządzeń spełniających filtr)")
            return
        print_scan(rows)

    for r in rows[: args.max_probe if args.max_probe else None]:
        probe = await probe_device(r["addr"], read_samples=True, timeout=10.0)
        print_probe_summary(r, probe)

if __name__ == "__main__":
    asyncio.run(run())
