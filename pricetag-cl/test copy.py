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
    url = f"{API_BASE}/{LOCATION_ID}/devices/"
    device_data = {
        "clientId": device["clientid"],
        "clientName": device["name"],
        "photo": "",
        "video": ""
    }
    try:
        response = requests.post(url, json=device_data)
        if response.status_code == 201:
            print(f"✅ Dodano nowe urządzenie: {device['name']}")
        else:
            print(f"❌ Nie udało się dodać {device['name']}. Status: {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ Błąd POST dla {device['name']}: {e}")

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
def check_device(ip):
    url = f"http://{BASE_IP}{ip}/Iotags"
    try:
        response = requests.get(url, timeout=1)
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

# Skanowanie całej podsieci
def scan_network():
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_device, range(1, 256))
    return [device for device in results if device is not None]

# Zapis zdjęć i filmów
def save_device_media(device):
    device_id = device.get("_id")
    client_id = device.get("clientId")
    changed = device.get("changed")
    photo = device.get("photo")
    video = device.get("video")

    if changed == "true":
        try:
            if photo and photo.strip():
                if photo.startswith("data:image"):
                    photo = photo.split(",", 1)[1]
                missing_padding = len(photo) % 4
                if missing_padding:
                    photo += "=" * (4 - missing_padding)
                photo_data = base64.b64decode(photo)
                with open(f"{client_id}.png", "wb") as f:
                    f.write(photo_data)
                print(f"📷 Zapisano zdjęcie {client_id}.png")

            if video and video.strip():
                if video.startswith("data:video"):
                    video = video.split(",", 1)[1]
                missing_padding = len(video) % 4
                if missing_padding:
                    video += "=" * (4 - missing_padding)
                video_data = base64.b64decode(video)
                with open(f"{client_id}.mp4", "wb") as f:
                    f.write(video_data)
                print(f"🎞️ Zapisano wideo {client_id}.mp4")

            # Usunięcie plików z bazy
            delete_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/delete-files"
            del_resp = requests.delete(delete_url)
            if del_resp.status_code == 200:
                print(f"🗑️ Usunięto pliki dla {device_id}")
            else:
                print(f"❌ Błąd usuwania plików {device_id}: {del_resp.status_code}")

            # Flaga changed = false
            change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            chg_resp = requests.put(change_url)
            if chg_resp.status_code == 200:
                print(f"✅ Zmieniono flagę 'changed' dla {device_id}")
            else:
                print(f"❌ Błąd zmiany flagi {device_id}: {chg_resp.status_code}")

        except Exception as e:
            print(f"⚠️ Błąd zapisu plików dla {device_id}: {e}")

# Wyświetlanie
def print_devices(devices):
    if devices:
        print("Znalezione urządzenia:")
        for d in devices:
            print(f"IP: {d['ip']} | Name: {d['name']} | ClientID: {d['clientid']}")
    else:
        print("Brak urządzeń w sieci.")

# Główna pętla
def main():
    print("\n--- Nowa synchronizacja ---")

    # Synchronizacja sieci z bazą
    db_devices = get_devices_from_database()
    db_client_ids = {d["clientId"]: d["_id"] for d in db_devices}

    scanned_devices = scan_network()
    scanned_client_ids = {d["clientid"] for d in scanned_devices}

    for device in scanned_devices:
        if device["clientid"] not in db_client_ids:
            add_device_to_location(device)

    for client_id, device_id in db_client_ids.items():
        if client_id not in scanned_client_ids:
            delete_device_from_location(device_id)

    print_devices(scanned_devices)

    # Obsługa zdjęć/wideo
    db_devices = get_devices_from_database()
    for device in db_devices:
        save_device_media(device)


if __name__ == "__main__":
    main()
