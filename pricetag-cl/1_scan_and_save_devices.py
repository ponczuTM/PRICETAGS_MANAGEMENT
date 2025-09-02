import requests
import time
import base64
from concurrent.futures import ThreadPoolExecutor

# Konfiguracja
LOCATION_ID = "685003cbf071eb1bb4304cd2"
API_BASE = "http://localhost:8000/api/locations"
BASE_IP = "192.168.68."

# Pobieranie urządzeń z bazy
def get_devices_from_database():
    try:
        response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Błąd pobierania urządzeń z bazy. Status: {response.status_code}")
            return []
    except requests.RequestException as e:
        print(f"Błąd podczas GET: {e}")
        return []

# Dodawanie urządzenia
def add_device_to_location(device):
    url = f"{API_BASE}/{LOCATION_ID}/devices"
    payload = {
        "clientId": device["clientid"],
        "clientName": device["name"].strip(),
        "ip": device["ip"],
        "photo": "",
        "video": "",
        "thumbnail": ""
    }
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
        if response.status_code == 201:
            print(f"✅ Dodano nowe urządzenie: {device['name']} ({device['ip']})")
            return True
        else:
            print(f"❌ Nie udało się dodać {device['name']} ({device['ip']}). "
                  f"Status: {response.status_code} | Body: {response.text}")
            return False
    except requests.RequestException as e:
        print(f"❌ Błąd POST dla {device['name']} ({device['ip']}): {e}")
        return False


# Usuwanie urządzenia
def delete_device_from_location(device_id):
    url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}"
    try:
        response = requests.delete(url)
        if response.status_code in (200, 204):
            print(f"🗑️ Usunięto urządzenie {device_id} z bazy.")
        else:
            print(f"❌ Błąd usuwania {device_id}. Status: {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ Błąd DELETE dla {device_id}: {e}")

# Sprawdzanie jednego IP
def check_device(args):
    index, ip = args
    print(f"🔍 Próba {index + 1}: Sprawdzam IP {BASE_IP}{ip}")
    url = f"http://{BASE_IP}{ip}/Iotags"
    try:
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            data = response.json()
            if "STATE" in data and data["STATE"] == "SUCCEED" and "name" in data:
                return {
                    "ip": f"{BASE_IP}{ip}",
                    "name": data["name"],
                    "clientid": data["clientid"],
                    "free-space": data["free-space"]
                }
    except requests.RequestException:
        return None


# Skanowanie podsieci
def scan_network():
    ip_range = list(range(1, 256))
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_device, enumerate(ip_range))
    return [device for device in results if device is not None]

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


# Zapisywanie zdjęcia lub filmu jako <clientId>.png / <clientId>.mp4
import re
import base64
from binascii import Error as B64Error

DATA_URL_RE = re.compile(r'^\s*data:(?:image|video)/[^;]+;base64,(.*)$', re.IGNORECASE)

def _maybe_decode_b64(s: str) -> bytes | None:
    if not s:
        return None
    s = s.strip()

    # Jeśli to URL lub ścieżka – nie dekodujemy
    if s.startswith(("http://", "https://", "/", "./", "../")):
        return None

    # Usuń nagłówek data:*;base64,
    m = DATA_URL_RE.match(s)
    if m:
        s = m.group(1).strip()

    # Zamień URL-safe na standardowe
    s = s.replace('-', '+').replace('_', '/')

    # Dopełnienie =
    rem = len(s) % 4
    if rem:
        s += '=' * (4 - rem)

    try:
        return base64.b64decode(s, validate=True)
    except (B64Error, ValueError):
        return None

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

        photo_bytes = _maybe_decode_b64(photo)
        if photo_bytes:
            with open(f"{client_id}.png", "wb") as f:
                f.write(photo_bytes)
            print(f"📷 Zapisano zdjęcie urządzenia {device_id} jako {client_id}.png")

        video_bytes = _maybe_decode_b64(video)
        if video_bytes:
            with open(f"{client_id}.mp4", "wb") as f:
                f.write(video_bytes)
            print(f"🎞️ Zapisano video urządzenia {device_id} jako {client_id}.mp4")

        # Jeżeli nic nie zapisaliśmy, nie kasuj z bazy
        if not (photo_bytes or video_bytes):
            print(f"ℹ️ {device_id}: brak poprawnych danych base64 – pomijam kasowanie.")
            return

        # Kasowanie pól w bazie
        delete_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/delete-files"
        delete_response = requests.delete(delete_url, timeout=10)
        if delete_response.status_code == 200:
            print(f"🗑️ Usunięto pliki photo i video dla {device_id}")
        else:
            print(f"❌ Błąd usuwania plików dla {device_id}: {delete_response.status_code} | {delete_response.text}")

        # Flaga changed=false
        change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
        change_response = requests.put(change_url, timeout=10)
        if change_response.status_code == 200:
            print(f"✅ Flaga 'changed' ustawiona na false dla {device_id}")
        else:
            print(f"❌ Błąd ustawiania flagi 'changed' dla {device_id}: {change_response.status_code} | {change_response.text}")

    except Exception as e:
        print(f"⚠️ Błąd przetwarzania urządzenia {device_id}: {e}")


# Wyświetlanie
def print_devices(devices):
    if devices:
        print("Znalezione urządzenia w sieci:")
        for d in devices:
            print(f"IP: {d['ip']} | Name: {d['name']} | ClientID: {d['clientid']}")
    else:
        print("Brak urządzeń w sieci.")

# Główna pętla
def main():
    print("\n--- Nowa synchronizacja ---")

    # Krok 1: synchronizacja sieci z bazą
    db_devices = get_devices_from_database()
    # Mapy: clientId -> device_id, clientId -> ip_z_bazy
    db_clientid_to_id   = {d["clientId"]: d["_id"] for d in db_devices}
    db_clientid_to_ip   = {d["clientId"]: (d.get("ip") or "") for d in db_devices}

    scanned_devices = scan_network()
    # Mapy: clientid -> ip_ze_skana (i full rekord dla wygody)
    scanned_clientid_to_ip = {d["clientid"]: d["ip"] for d in scanned_devices}
    scanned_client_ids     = set(scanned_clientid_to_ip.keys())

    # Dodaj nieistniejące w bazie (jak dotychczas)
    for device in scanned_devices:
        if device["clientid"] not in db_clientid_to_id:
            add_device_to_location(device)

    # Usuń z bazy te, których nie było w skanie (jak dotychczas)
    for client_id, device_id in db_clientid_to_id.items():
        if client_id not in scanned_client_ids:
            delete_device_from_location(device_id)

    print_devices(scanned_devices)

    # 🔁 Krok 1.1: AKTUALIZACJA IP — jeżeli clientId jest w bazie i zeskanowane IP ≠ IP w bazie
    for client_id, device_id in db_clientid_to_id.items():
        scanned_ip = scanned_clientid_to_ip.get(client_id)
        if not scanned_ip:
            continue  # tego urządzenia nie było w skanie (już wyżej usuwamy), pomiń

        db_ip = db_clientid_to_ip.get(client_id, "")
        if db_ip != scanned_ip:
            # Nadpisz IP w bazie po _id urządzenia
            update_device_ip_in_db(device_id, scanned_ip)

    # Krok 2: zapis zdjęć i filmów (bez zmian)
    db_devices = get_devices_from_database()
    for device in db_devices:
        save_device_media(device)


if __name__ == "__main__":
    main()
