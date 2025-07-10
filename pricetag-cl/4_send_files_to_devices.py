import requests
import os
import json
import hashlib
from typing import List
import time

# Konfiguracja
LOCATION_ID = "685003cbf071eb1bb4304cd2"
API_BASE = "http://localhost:8000/api/locations"
IMAGE_FOLDER = "."  # Folder z plikami PNG i JS

# Pobierz urządzenia z bazy
def get_devices_from_database() -> List[dict]:
    try:
        response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Błąd pobierania urządzeń. Status: {response.status_code}")
            return []
    except requests.RequestException as e:
        print(f"❌ Błąd pobierania urządzeń: {e}")
        return []

# Obliczanie MD5
def calculate_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest().upper()

# Czyszczenie pamięci urządzenia
def clear_device_space(ip):
    url = f"http://{ip}/control?action=clearspace&sign=sign"
    try:
        response = requests.get(url, timeout=5)
        return response.status_code == 200
    except:
        return False

# Wysyłanie pliku binarnego z podpisem
def upload_file_to_device(ip, file_path, remote_path):
    md5 = calculate_md5(file_path)
    try:
        with open(file_path, "rb") as f:
            response = requests.post(
                f"http://{ip}/upload?file_path={remote_path}&sign={md5}",
                data=f,
                headers={"Content-Type": "application/octet-stream"}
            )
        return response.status_code == 200
    except:
        return False

# Replay
def trigger_device(ip, js_name):
    js_path = f"files/task/{js_name}"
    sign = calculate_md5(js_name)
    url = f"http://{ip}/replay?task={js_path}&sign={sign}"
    try:
        response = requests.get(url, timeout=5)
        return response.status_code == 200
    except:
        return False

# Główna funkcja
def main():
    devices = get_devices_from_database()
    if not devices:
        print("❌ Brak urządzeń do przetworzenia.")
        return

    for device in devices:
        clientid = device.get("clientId")
        ip = device.get("ip")

        if not clientid or not ip:
            print(f"⚠️ Pominięto urządzenie bez IP lub clientId.")
            continue

        png_path = os.path.join(IMAGE_FOLDER, f"{clientid}.png")
        js_path = os.path.join(IMAGE_FOLDER, f"{clientid}.js")

        if not os.path.exists(png_path):
            print(f"❌ Brak pliku PNG dla {clientid}")
            continue

        # Wyczyść pamięć urządzenia
        if clear_device_space(ip):
            print(f"🧹 Pamięć wyczyszczona dla {clientid} ({ip})")
        else:
            print(f"❌ Nie udało się wyczyścić pamięci dla {clientid} ({ip})")
            continue

        # Generuj plik JS
        md5_hash = calculate_md5(png_path)
        js_data = {
            "Id": clientid,
            "ItemCode": clientid,
            "ItemName": clientid,
            "LabelPicture": {
                "Height": 1280,
                "Width": 800,
                "X": 0,
                "Y": 0,
                "PictureName": f"{clientid}.png",
                "PicturePath": f"files/task/{clientid}.png",
                "PictureMD5": md5_hash
            }
        }

        with open(js_path, "w") as f:
            json.dump(js_data, f, indent=4)

        # Wyślij PNG
        remote_png_path = f"files/task/{clientid}.png"
        if upload_file_to_device(ip, png_path, remote_png_path):
            print(f"✅ PNG wysłany: {clientid}")
        else:
            print(f"❌ Błąd wysyłania PNG: {clientid}")
            continue

        # Wyślij JS
        remote_js_path = f"files/task/{clientid}.js"
        if upload_file_to_device(ip, js_path, remote_js_path):
            print(f"✅ JS wysłany: {clientid}")
        else:
            print(f"❌ Błąd wysyłania JS: {clientid}")
            continue

        # Wywołanie taska
        if trigger_device(ip, f"{clientid}.js"):
            print(f"🚀 Uruchomiono task na {ip}")
            time.sleep(3)

            try:
                if os.path.exists(js_path):
                    os.remove(js_path)
                    print(f"🗑️ Usunięto plik JS: {js_path}")
                if os.path.exists(png_path):
                    os.remove(png_path)
                    print(f"🗑️ Usunięto plik PNG: {png_path}")
            except Exception as e:
                print(f"⚠️ Błąd usuwania plików: {e}")
        else:
            print(f"❌ Błąd uruchamiania taska na {ip}")

if __name__ == "__main__":
    main()
