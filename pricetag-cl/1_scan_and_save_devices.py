import requests
import time
import base64
from concurrent.futures import ThreadPoolExecutor
import re
from binascii import Error as B64Error
import json

# === KONFIG ===

config_path = "/usr/local/bin/config.json"
with open(config_path, "r") as f:
    config = json.load(f)
LOCATION_ID = config["locationId"]

API_BASE = "http://localhost:8000/api/locations"
BASE_IP = "192.168.77."

# === Normalizacja clientId ===
# Standaryzujemy do: UPPERCASE, tylko [0-9A-F]
CID_KEEP = re.compile(r"[0-9A-F]", re.IGNORECASE)
def norm_clientid(raw: str | None) -> str:
    if not raw:
        return ""
    s = "".join(CID_KEEP.findall(raw)).upper()
    return s

# === API HELPERS ===

def get_devices_from_database():
    try:
        response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices", timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❗ Błąd pobierania urządzeń z bazy. Status: {response.status_code}")
            return []
    except requests.RequestException as e:
        print(f"❗ Błąd podczas GET: {e}")
        return []

def add_device_to_location(device):
    """Dodaje urządzenie. Zwraca True gdy faktycznie dodano, False gdy już istnieje / błąd."""
    url = f"{API_BASE}/{LOCATION_ID}/devices"
    # Normalizujemy ClientID przy dodawaniu, żeby nie tworzyć dubli przez case/format
    client_id_norm = norm_clientid(device["clientid"])
    payload = {
        "clientId": client_id_norm,
        "clientName": (device["name"] or "").strip(),
        "ip": device["ip"],
        "photo": "",
        "video": "",
        "thumbnail": ""
        # isOnline ustawi backend
    }
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
        if response.status_code == 201:
            print(f"✅ Dodano nowe urządzenie: {device['name']} ({device['ip']}) [{client_id_norm}]")
            return True
        # Obsłuż “już istnieje” jako soft-success (backend zawija 400 w 500 w Twoim logu)
        if response.status_code in (400, 409, 422) and "already exists" in response.text.lower():
            print(f"ℹ️ Urządzenie już istnieje w lokalizacji: [{client_id_norm}] – pomijam dodanie.")
            return False
        print(f"❌ Nie udało się dodać {device['name']} ({device['ip']}). "
              f"Status: {response.status_code} | Body: {response.text}")
        return False
    except requests.RequestException as e:
        print(f"❌ Błąd POST dla {device['name']} ({device['ip']}): {e}")
        return False

def set_device_online(device_id: str) -> bool:
    url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/online"
    try:
        resp = requests.put(url, timeout=10)
        if resp.status_code == 200:
            print(f"🟢 isOnline=True dla device_id={device_id}")
            return True
        else:
            print(f"❌ Nie udało się ustawić online dla {device_id}. Status: {resp.status_code} | Body: {resp.text}")
            return False
    except requests.RequestException as e:
        print(f"❌ Błąd PUT (online) dla {device_id}: {e}")
        return False

def set_device_offline(device_id: str) -> bool:
    url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/offline"
    try:
        resp = requests.put(url, timeout=10)
        if resp.status_code == 200:
            print(f"⚫ isOnline=False dla device_id={device_id}")
            return True
        else:
            print(f"❌ Nie udało się ustawić offline dla {device_id}. Status: {resp.status_code} | Body: {resp.text}")
            return False
    except requests.RequestException as e:
        print(f"❌ Błąd PUT (offline) dla {device_id}: {e}")
        return False

def update_device_ip_in_db(device_id: str, new_ip: str) -> bool:
    """Ustawia w bazie pole `ip` dla urządzenia po jego _id (device_id)."""
    url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/ip"
    try:
        resp = requests.put(url, json={"ip": new_ip}, headers={"Content-Type": "application/json"}, timeout=10)
        if resp.status_code == 200:
            print(f"🔧 Zmieniono IP w bazie: device_id={device_id} -> {new_ip}")
            return True
        else:
            print(f"❌ Nie udało się zmienić IP dla {device_id}. Status: {resp.status_code} | Body: {resp.text}")
            return False
    except requests.RequestException as e:
        print(f"❌ Błąd PUT (update IP) dla {device_id}: {e}")
        return False

# === Skan sieci ===

def check_device(args):
    index, ip = args
    # .255 to broadcast – często szum. Pomijamy log (ale można zostawić skan).
    if ip == 255:
        return None
    print(f"🔍 Próba {index + 1}: Sprawdzam IP {BASE_IP}{ip}")
    url = f"http://{BASE_IP}{ip}/Iotags"
    try:
        response = requests.get(url, timeout=20)
        if response.status_code == 200:
            data = response.json()
            if data.get("STATE") == "SUCCEED" and "name" in data and "clientid" in data:
                return {
                    "ip": f"{BASE_IP}{ip}",
                    "name": data["name"],
                    "clientid": data["clientid"],  # surowe – znormalizujemy niżej
                    "free-space": data.get("free-space")
                }
    except requests.RequestException:
        return None

def scan_network():
    # 1..254 – bez .0 i .255
    ip_range = list(range(1, 255))
    with ThreadPoolExecutor(max_workers=24) as executor:
        results = executor.map(check_device, enumerate(ip_range))
    return [device for device in results if device is not None]

# === Media utils (bez zmian) ===
DATA_URL_RE = re.compile(r'^\s*data:(?:image|video)/[^;]+;base64,(.*)$', re.IGNORECASE)

def _maybe_decode_b64(s: str) -> bytes | None:
    if not s:
        return None
    s = s.strip()
    if s.startswith(("http://", "https://", "/", "./", "../")):
        return None
    m = DATA_URL_RE.match(s)
    if m:
        s = m.group(1).strip()
    s = s.replace('-', '+').replace('_', '/')
    rem = len(s) % 4
    if rem:
        s += '=' * (4 - rem)
    try:
        return base64.b64decode(s, validate=True)
    except (B64Error, ValueError):
        return None

def _is_url_or_path(s: str) -> bool:
    if not s:
        return True
    s = s.strip().lower()
    return s.startswith(("http://", "https://", "/", "./", "../"))

def save_device_media(device):
    device_id = device.get("_id")
    client_id = device.get("clientId") or "unknown"

    changed = device.get("changed")
    changed_flag = (changed is True) or (isinstance(changed, str) and changed.strip().lower() == "true")
    if not changed_flag:
        return

    try:
        photo = device.get("photo") or ""
        video = device.get("video") or ""

        # Szybka klasyfikacja: URL/ścieżka/puste -> traktujemy jako "brak base64"
        photo_is_external = _is_url_or_path(photo)
        video_is_external = _is_url_or_path(video)

        photo_bytes = None if photo_is_external else _maybe_decode_b64(photo)
        video_bytes = None if video_is_external else _maybe_decode_b64(video)

        # 1) Mamy base64 -> zapisz i posprzątaj na backendzie
        wrote_any = False
        if photo_bytes:
            with open(f"{client_id}.png", "wb") as f:
                f.write(photo_bytes)
            print(f"📷 Zapisano zdjęcie urządzenia {device_id} jako {client_id}.png")
            wrote_any = True

        if video_bytes:
            with open(f"{client_id}.mp4", "wb") as f:
                f.write(video_bytes)
            print(f"🎞️ Zapisano video urządzenia {device_id} jako {client_id}.mp4")
            wrote_any = True

        if wrote_any:
            delete_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/delete-files"
            delete_response = requests.delete(delete_url, timeout=10)
            if delete_response.status_code == 200:
                print(f"🗑️ Usunięto pliki photo i video dla {device_id}")
            else:
                print(f"❌ Błąd usuwania plików dla {device_id}: {delete_response.status_code} | {delete_response.text}")

            change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            change_response = requests.put(change_url, timeout=10)
            if change_response.status_code == 200:
                print(f"✅ Flaga 'changed' ustawiona na false dla {device_id}")
            else:
                print(f"❌ Błąd ustawiania flagi 'changed' dla {device_id}: {change_response.status_code} | {change_response.text}")
            return

        # 2) Brak base64: (URL/ścieżka/puste/uszkodzone) – nie rób nic z plikami,
        #    ale zgaś 'changed', żeby nie spamować logiem przy każdym przebiegu.
        if photo_is_external or video_is_external or (not photo and not video):
            print(f"ℹ️ {device_id}: dane to URL/ścieżka/puste – oznaczam changed=false bez kasowania.")
            change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            requests.put(change_url, timeout=10)
            return

        # 3) Uszkodzony base64 – zgaś flagę i zaloguj krótko
        print(f"ℹ️ {device_id}: brak poprawnych danych base64 – oznaczam changed=false.")
        change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
        requests.put(change_url, timeout=10)

    except Exception as e:
        print(f"⚠️ Błąd przetwarzania urządzenia {device_id}: {e}")


def print_devices(devices):
    if devices:
        print("Znalezione urządzenia w sieci:")
        for d in devices:
            print(f"IP: {d['ip']} | Name: {d['name']} | ClientID: {norm_clientid(d['clientid'])}")
    else:
        print("Brak urządzeń w sieci.")

# === Główna pętla ===
def main():
    print("\n--- Nowa synchronizacja ---")

    # 1) Pobierz stan bazy
    db_devices = get_devices_from_database()

    # mapy po ZNORMALIZOWANYCH kluczach
    db_clientid_to_id = {norm_clientid(d.get("clientId")): d["_id"] for d in db_devices if d.get("clientId")}
    db_clientid_to_ip = {norm_clientid(d.get("clientId")): (d.get("ip") or "") for d in db_devices if d.get("clientId")}

    # 2) Skan sieci
    scanned_devices = scan_network()
    scanned_clientid_to_ip = {norm_clientid(d["clientid"]): d["ip"] for d in scanned_devices}
    scanned_client_ids = set(scanned_clientid_to_ip.keys())

    # 3) Dodaj nowe urządzenia (po normalizacji)
    for device in scanned_devices:
        cid_norm = norm_clientid(device["clientid"])
        if not cid_norm:
            print(f"⚠️ Pusty/niepoprawny clientId dla {device['ip']} – pomijam.")
            continue
        if cid_norm not in db_clientid_to_id:
            add_device_to_location(device)  # soft-success jeśli już istnieje

    # 4) Ustaw ONLINE dla wszystkich, które odpowiedziały + ewentualnie podmień IP
    #    (refetch może być potrzebny, jeśli coś dopiero co dodaliśmy)
    db_devices = get_devices_from_database()
    db_clientid_to_id = {norm_clientid(d.get("clientId")): d["_id"] for d in db_devices if d.get("clientId")}
    db_clientid_to_ip = {norm_clientid(d.get("clientId")): (d.get("ip") or "") for d in db_devices if d.get("clientId")}

    for device in scanned_devices:
        cid_norm = norm_clientid(device["clientid"])
        new_ip = device["ip"]
        device_id = db_clientid_to_id.get(cid_norm)
        if not device_id:
            # Nie znaleziono po refetch – log informacyjny, ale idziemy dalej
            print(f"⚠️ Nie znaleziono device_id w bazie dla [{cid_norm}] (IP {new_ip}).")
            continue
        # jeśli IP w bazie różni się od zeskanowanego — zaktualizuj
        if db_clientid_to_ip.get(cid_norm, "") != new_ip:
            update_device_ip_in_db(device_id, new_ip)
        # to urządzenie jest dostępne — ustaw online
        set_device_online(device_id)

    # 5) Ustaw OFFLINE tym, których nie było w skanie
    for cid_norm, device_id in db_clientid_to_id.items():
        if cid_norm not in scanned_client_ids:
            set_device_offline(device_id)

    print_devices(scanned_devices)

    # 6) Przetwarzanie ewentualnych mediów (bez zmian)
    db_devices = get_devices_from_database()
    for device in db_devices:
        save_device_media(device)

if __name__ == "__main__":
    main()
