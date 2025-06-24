# import requests
# import os
# import json
# import hashlib
# import base64
# from concurrent.futures import ThreadPoolExecutor

# # Konfiguracja
# LOCATION_ID = "685003cbf071eb1bb4304cd2"
# API_BASE = "http://localhost:8000/api/locations"
# BASE_IP = "192.168.68."
# IMAGE_FOLDER = "."  # Folder z PNG

# # Skanowanie urządzeń w sieci
# def check_device(ip):
#     url = f"http://{BASE_IP}{ip}/Iotags"
#     try:
#         response = requests.get(url, timeout=1)
#         if response.status_code == 200:
#             data = response.json()
#             if "STATE" in data and data["STATE"] == "SUCCEED" and "name" in data:
#                 return {
#                     "ip": f"{BASE_IP}{ip}",
#                     "clientid": data["clientid"]
#                 }
#     except:
#         return None

# def scan_network():
#     with ThreadPoolExecutor(max_workers=20) as executor:
#         results = executor.map(check_device, range(1, 256))
#     return [r for r in results if r is not None]

# # Obliczanie MD5
# def calculate_md5(file_path):
#     hash_md5 = hashlib.md5()
#     with open(file_path, "rb") as f:
#         for chunk in iter(lambda: f.read(4096), b""):
#             hash_md5.update(chunk)
#     return hash_md5.hexdigest().upper()

# # Wysyłanie pliku binarnego z podpisem
# def upload_file_to_device(ip, file_path, remote_path):
#     md5 = calculate_md5(file_path)
#     with open(file_path, "rb") as f:
#         response = requests.post(
#             f"http://{ip}/upload?file_path={remote_path}&sign={md5}",
#             data=f,
#             headers={"Content-Type": "application/octet-stream"}
#         )
#     return response.status_code == 200

# # Replay
# def trigger_device(ip, js_name):
#     js_path = f"files/task/{js_name}"
#     sign = calculate_md5(js_name)
#     url = f"http://{ip}/replay?task={js_path}&sign={sign}"
#     response = requests.get(url)
#     return response.status_code == 200

# # Główna funkcja
# def main():
#     devices = scan_network()
#     for device in devices:
#         clientid = device["clientid"]
#         ip = device["ip"]
#         png_path = os.path.join(IMAGE_FOLDER, f"{clientid}.png")
#         js_path = os.path.join(IMAGE_FOLDER, f"{clientid}.js")

#         if not os.path.exists(png_path):
#             print(f"❌ Brak pliku PNG dla {clientid}")
#             continue

#         # Generuj JS
#         md5_hash = calculate_md5(png_path)
#         js_data = {
#             "Id": clientid,
#             "ItemCode": clientid,
#             "ItemName": clientid,
#             "LabelPicture": {
#                 "Height": 1280,
#                 "Width": 800,
#                 "X": 0,
#                 "Y": 0,
#                 "PictureName": f"{clientid}.png",
#                 "PicturePath": f"files/task/{clientid}.png",
#                 "PictureMD5": md5_hash
#             }
#         }
#         with open(js_path, "w") as f:
#             json.dump(js_data, f, indent=4)

#         # Wyślij PNG
#         remote_png_path = f"files/task/{clientid}.png"
#         if upload_file_to_device(ip, png_path, remote_png_path):
#             print(f"✅ PNG wysłany: {clientid}")
#         else:
#             print(f"❌ Błąd wysyłania PNG: {clientid}")

#         # Wyślij JS
#         remote_js_path = f"files/task/{clientid}.js"
#         if upload_file_to_device(ip, js_path, remote_js_path):
#             print(f"✅ JS wysłany: {clientid}")
#         else:
#             print(f"❌ Błąd wysyłania JS: {clientid}")
#             continue

#         # Trigger replay
#         if trigger_device(ip, f"{clientid}.js"):
#             print(f"🚀 Uruchomiono task na {ip}")
#         else:
#             print(f"❌ Błąd uruchamiania taska na {ip}")

# if __name__ == "__main__":
#     main()


import requests
import os
import json
import hashlib
import base64
from concurrent.futures import ThreadPoolExecutor

# Konfiguracja
LOCATION_ID = "685003cbf071eb1bb4304cd2"
API_BASE = "http://localhost:8000/api/locations"
BASE_IP = "192.168.68."
IMAGE_FOLDER = "."  # Folder z PNG

# Skanowanie urządzeń w sieci
def check_device(ip):
    url = f"http://{BASE_IP}{ip}/Iotags"
    try:
        response = requests.get(url, timeout=1)
        if response.status_code == 200:
            data = response.json()
            if "STATE" in data and data["STATE"] == "SUCCEED" and "name" in data:
                return {
                    "ip": f"{BASE_IP}{ip}",
                    "clientid": data["clientid"]
                }
    except:
        return None

def scan_network():
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_device, range(1, 256))
    return [r for r in results if r is not None]

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
    response = requests.get(url, timeout=5)
    return response.status_code == 200

# Wysyłanie pliku binarnego z podpisem
def upload_file_to_device(ip, file_path, remote_path):
    md5 = calculate_md5(file_path)
    with open(file_path, "rb") as f:
        response = requests.post(
            f"http://{ip}/upload?file_path={remote_path}&sign={md5}",
            data=f,
            headers={"Content-Type": "application/octet-stream"}
        )
    return response.status_code == 200

# Replay
def trigger_device(ip, js_name):
    js_path = f"files/task/{js_name}"
    sign = calculate_md5(js_name)
    url = f"http://{ip}/replay?task={js_path}&sign={sign}"
    response = requests.get(url)
    return response.status_code == 200

# Główna funkcja
def main():
    devices = scan_network()
    for device in devices:
        clientid = device["clientid"]
        ip = device["ip"]
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

        # Generuj JS
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

        # Trigger replay
        if trigger_device(ip, f"{clientid}.js"):
            print(f"🚀 Uruchomiono task na {ip}")
        else:
            print(f"❌ Błąd uruchamiania taska na {ip}")

if __name__ == "__main__":
    main()
