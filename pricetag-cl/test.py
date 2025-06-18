import requests
import time
from concurrent.futures import ThreadPoolExecutor

# Ustal id lokalizacji
location_id = "685003cbf071eb1bb4304cd2"

# URL API
base_url = "http://localhost:8000/api/locations"

# Pobieranie aktualnych urządzeń z bazy
def get_devices_from_database():
    try:
        response = requests.get(f"{base_url}/{location_id}/devices")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Błąd pobierania urządzeń z bazy. Status: {response.status_code}")
            return []
    except requests.RequestException as e:
        print(f"Błąd podczas GET: {e}")
        return []

# Dodawanie urządzenia do bazy
def add_device_to_location(device):
    url = f"{base_url}/{location_id}/devices/"
    device_data = {
        "clientId": device["clientid"],
        "clientName": device["name"],
        "photo": "base64_photo",
        "video": "base64_video"
    }
    try:
        response = requests.post(url, json=device_data)
        if response.status_code == 201:
            print(f"✅ Dodano nowe urządzenie: {device['name']}")
        else:
            print(f"❌ Nie udało się dodać {device['name']}. Status: {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ Błąd POST dla {device['name']}: {e}")

# Usuwanie urządzenia z bazy
def delete_device_from_location(device_id):
    url = f"{base_url}/{location_id}/devices/{device_id}"
    try:
        response = requests.delete(url)
        if response.status_code in (200, 204):
            print(f"🗑️ Usunięto urządzenie {device_id} z bazy.")
        else:
            print(f"❌ Błąd usuwania {device_id}. Status: {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ Błąd DELETE dla {device_id}: {e}")


# Sprawdzanie jednego urządzenia w sieci
def check_device(ip):
    url = f"http://192.168.68.{ip}/Iotags"
    try:
        response = requests.get(url, timeout=1)
        if response.status_code == 200:
            data = response.json()
            if "STATE" in data and data["STATE"] == "SUCCEED" and "name" in data:
                return {
                    "ip": f"192.168.68.{ip}",
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

# Wyświetlanie urządzeń
def print_devices(devices):
    if devices:
        print("Znalezione urządzenia w sieci:")
        for d in devices:
            print(f"IP: {d['ip']} | Name: {d['name']} | ClientID: {d['clientid']}")
    else:
        print("Brak urządzeń w sieci.")

# Główna pętla synchronizacji
def main():
    while True:
        print("\n--- Nowa synchronizacja ---")

        # Pobierz urządzenia z bazy
        db_devices = get_devices_from_database()
        db_client_ids = {d["clientId"]: d["_id"] for d in db_devices}

        # Skanuj sieć
        scanned_devices = scan_network()
        scanned_client_ids = {d["clientid"] for d in scanned_devices}

        # Dodaj nowe urządzenia
        for device in scanned_devices:
            if device["clientid"] not in db_client_ids:
                add_device_to_location(device)

        # Usuń urządzenia, które zniknęły z sieci
        for client_id, device_id in db_client_ids.items():
            if client_id not in scanned_client_ids:
                delete_device_from_location(device_id)

        # Podsumowanie
        print_devices(scanned_devices)

        # Odczekaj 60 sekund
        time.sleep(60)

if __name__ == "__main__":
    main()
