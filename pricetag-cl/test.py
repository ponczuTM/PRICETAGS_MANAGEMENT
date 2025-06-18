import requests
import time
from concurrent.futures import ThreadPoolExecutor

# Ustal id lokalizacji
location_id = "685003cbf071eb1bb4304cd2"  # Zastąp prawidłowym ID lokalizacji

# URL API, do którego będziesz wysyłać dane
base_url = "http://0.0.0.0:8000/api/locations"

# Funkcja do wysyłania urządzenia do lokalizacji w bazie danych
def add_device_to_location(device):
    url = f"{base_url}/{location_id}/devices/"
    
    # Przygotuj dane urządzenia
    device_data = {
        "clientId": device["clientid"],
        "clientName": device["name"],
        "photo": "base64_photo",  # Tutaj możesz dodać faktyczny base64_photo, jeśli jest dostępne
        "video": "base64_video"   # Tutaj możesz dodać faktyczny base64_video, jeśli jest dostępne
    }
    
    try:
        # Wyślij POST request z danymi urządzenia
        response = requests.post(url, json=device_data)
        
        if response.status_code == 201:
            print(f"Urządzenie {device['name']} zostało dodane do lokalizacji.")
        else:
            print(f"Nie udało się dodać urządzenia {device['name']} do lokalizacji. Status: {response.status_code}")
    except requests.RequestException as e:
        print(f"Error during POST request for {device['name']}: {e}")

# Funkcja do sprawdzenia urządzenia
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

# Funkcja skanująca sieć
def scan_network():
    devices = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_device, range(1, 256))
        devices = [device for device in results if device is not None]
    
    return devices

# Funkcja do wyświetlania urządzeń
def print_devices(devices):
    if devices:
        print("Znalezione urządzenia:")
        for device in devices:
            print(f"IP: {device['ip']}, Name: {device['name']}, ClientID: {device['clientid']}, Free Space: {device['free-space']} bytes")
    else:
        print("Nie znaleziono żadnych urządzeń.")

# Funkcja główna
def main():
    while True:
        print(f"Rozpoczynam skanowanie sieci dla lokalizacji o ID {location_id}...")
        
        # Skanuj urządzenia
        devices = scan_network()
        
        # Dla każdego znalezionego urządzenia, wyślij dane do API
        for device in devices:
            add_device_to_location(device)
        
        # Wyświetl urządzenia
        print_devices(devices)
        
        # Czekaj 60 sekund przed kolejnym skanowaniem
        time.sleep(60)

if __name__ == "__main__":
    main()
