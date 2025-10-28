import requests
import os
import json
import hashlib
from typing import List
import time

# ====== KONFIGURACJA ŚCIEŻEK ======
BASE_DIR = "/usr/local/bin"                # katalog główny aplikacji
FILES_DIR = os.path.join(BASE_DIR, "files")  # tu siedzą PNG/MP4/JS
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

os.makedirs(FILES_DIR, exist_ok=True)
os.chdir(FILES_DIR)  # kluczowe: pracujemy wewnątrz /usr/local/bin/files
print(f"📂 Working directory: {os.getcwd()}")

# ====== KONFIG ======
with open(CONFIG_PATH, "r") as f:
    config = json.load(f)

LOCATION_ID = config["locationId"]
API_BASE = "http://localhost:8000/api/locations"

# ====== FUNKCJE POMOCNICZE ======

def get_devices_from_database() -> List[dict]:
    """Pobiera listę urządzeń z bazy."""
    try:
        response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices", timeout=15)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Błąd pobierania urządzeń. Status: {response.status_code}")
            return []
    except requests.RequestException as e:
        print(f"❌ Błąd pobierania urządzeń: {e}")
        return []

def calculate_md5(file_path):
    """Liczy hash MD5 pliku."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest().upper()

def clear_device_space(ip):
    """Czyści pamięć urządzenia przez endpoint HTTP."""
    url = f"http://{ip}/control?action=clearspace&sign=sign"
    try:
        response = requests.get(url, timeout=25)
        if response.status_code == 200:
            return True, "OK"
        else:
            return False, f"Status: {response.status_code}, Odpowiedź: {response.text}"
    except Exception as e:
        return False, str(e)

def upload_file_to_device(ip, file_path, remote_path):
    """Wysyła plik binarny na urządzenie."""
    md5 = calculate_md5(file_path)
    try:
        with open(file_path, "rb") as f:
            response = requests.post(
                f"http://{ip}/upload?file_path={remote_path}&sign={md5}",
                data=f,
                headers={"Content-Type": "application/octet-stream"},
                timeout=60
            )
        return response.status_code == 200
    except Exception as e:
        print(f"❌ upload error {file_path} -> {ip}: {e}")
        return False

def trigger_device(ip, js_name):
    """Uruchamia task (JS) na urządzeniu."""
    js_path = f"files/task/{js_name}"
    sign = calculate_md5(js_name)
    url = f"http://{ip}/replay?task={js_path}&sign={sign}"
    try:
        response = requests.get(url, timeout=25)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ trigger error {ip}: {e}")
        return False

# ====== LOGIKA GŁÓWNA ======

def main():
    devices = get_devices_from_database()
    if not devices:
        print("❌ Brak urządzeń do przetworzenia.")
        return

    for device in devices:
        clientid = device.get("clientId")
        clientname = device.get("clientName")
        ip = device.get("ip")

        if not clientid or not ip or not clientname:
            print("⚠️ Pominięto urządzenie bez IP, clientId lub clientName.")
            continue

        # Ścieżki w /usr/local/bin/files
        png_path = os.path.join(FILES_DIR, f"{clientid}.png")
        mp4_path = os.path.join(FILES_DIR, f"{clientid}.mp4")
        js_path  = os.path.join(FILES_DIR, f"{clientid}.js")

        has_png = os.path.exists(png_path)
        has_mp4 = os.path.exists(mp4_path)

        if not has_png and not has_mp4:
            print(f"❌ Brak plików PNG/MP4 dla {clientid} w {FILES_DIR}")
            continue

        # Czyść pamięć urządzenia
        success, msg = clear_device_space(ip)
        if success:
            print(f"🧹 Pamięć wyczyszczona dla {clientid} ({ip})")
        else:
            print(f"❌ Nie udało się wyczyścić pamięci dla {clientid} ({ip}). Błąd: {msg}")
            continue

        # Generuj plik JS w /usr/local/bin/files
        js_data = {
            "Id": clientid,
            "ItemCode": clientid,
            "ItemName": clientid
        }

        if has_png:
            png_md5 = calculate_md5(png_path)
            js_data["LabelPicture"] = {
                "Height": 1280,
                "Width": 800,
                "X": 0,
                "Y": 0,
                "PictureName": f"{clientid}.png",
                "PicturePath": f"files/task/{clientid}.png",
                "PictureMD5": png_md5
            }

        if has_mp4:
            mp4_md5 = calculate_md5(mp4_path)
            js_data["LabelVideo"] = {
                "Height": 1280,
                "Width": 800,
                "X": 0,
                "Y": 0,
                "VideoList": [{
                    "VideoNo": 1,
                    "VideoName": f"{clientid}.mp4",
                    "VideoPath": f"files/task/{clientid}.mp4",
                    "VideoMD5": mp4_md5
                }]
            }

        with open(js_path, "w") as f:
            json.dump(js_data, f, indent=4)

        # Upload plików z /usr/local/bin/files na urządzenie
        if has_png:
            if upload_file_to_device(ip, png_path, f"files/task/{clientid}.png"):
                print(f"✅ PNG wysłany: {clientid}")
            else:
                print(f"❌ Błąd wysyłania PNG: {clientid}")
                continue

        if has_mp4:
            if upload_file_to_device(ip, mp4_path, f"files/task/{clientid}.mp4"):
                print(f"✅ MP4 wysłany: {clientid}")
            else:
                print(f"❌ Błąd wysyłania MP4: {clientid}")
                continue

        time.sleep(1)

        if upload_file_to_device(ip, js_path, f"files/task/{clientid}.js"):
            print(f"✅ JS wysłany: {clientid}")
        else:
            print(f"❌ Błąd wysyłania JS: {clientid}")
            continue

        # Uruchomienie taska na urządzeniu
        if trigger_device(ip, f"{clientid}.js"):
            print(f"🚀 Uruchomiono task na {ip}")
            time.sleep(5)

            # Sprzątanie po sobie
            try:
                if os.path.exists(js_path):
                    os.remove(js_path)
                    print(f"🗑️ Usunięto JS: {js_path}")
                if has_png and os.path.exists(png_path):
                    os.remove(png_path)
                    print(f"🗑️ Usunięto PNG: {png_path}")
                if has_mp4 and os.path.exists(mp4_path):
                    os.remove(mp4_path)
                    print(f"🗑️ Usunięto MP4: {mp4_path}")
            except Exception as e:
                print(f"⚠️ Błąd usuwania plików: {e}")
        else:
            print(f"❌ Błąd uruchamiania taska na {ip}")

if __name__ == "__main__":
    main()
