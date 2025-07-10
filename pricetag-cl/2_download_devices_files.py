import requests
import base64
import os

# Konfiguracja
LOCATION_ID = "685003cbf071eb1bb4304cd2"
API_BASE = "http://localhost:8000/api/locations"

# 1. Pobierz wszystkie urządzenia
response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices")
devices = response.json()

for device in devices:
    device_id = device.get("_id")
    client_id = device.get("clientId")
    client_name = device.get("clientName")
    changed = device.get("changed")
    photo = device.get("photo")
    video = device.get("video")

    if changed == "true":
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))

            # Zapisz zdjęcie jeśli istnieje
            if photo and photo.strip() != "":
                if photo.startswith("data:image"):
                    photo = photo.split(",", 1)[1]
                missing_padding = len(photo) % 4
                if missing_padding:
                    photo += "=" * (4 - missing_padding)
                photo_data = base64.b64decode(photo)
                photo_filename = f"{client_id}.png"
                photo_filepath = os.path.join(script_dir, photo_filename)
                with open(photo_filepath, "wb") as f:
                    f.write(photo_data)
                print(f"📷 Zapisano zdjęcie urządzenia {device_id} jako {photo_filename}")

            # Zapisz wideo jeśli istnieje
            if video and video.strip() != "":
                if video.startswith("data:video"):
                    video = video.split(",", 1)[1]
                missing_padding = len(video) % 4
                if missing_padding:
                    video += "=" * (4 - missing_padding)
                video_data = base64.b64decode(video)
                video_filename = f"{client_name}.mp4"
                video_filepath = os.path.join(script_dir, video_filename)
                with open(video_filepath, "wb") as f:
                    f.write(video_data)
                print(f"🎞️ Zapisano wideo urządzenia {device_id} jako {video_filename}")

            # Usuń pliki photo i video
            delete_url = f"http://0.0.0.0:8000/api/locations/{LOCATION_ID}/devices/{device_id}/delete-files"
            delete_response = requests.delete(delete_url)
            if delete_response.status_code == 200:
                print(f"🗑️ Usunięto pliki photo i video dla {device_id}")
            else:
                print(f"❌ Błąd usuwania plików dla {device_id}: {delete_response.status_code}")

            # Ustaw 'changed' na false
            change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            change_response = requests.put(change_url)
            if change_response.status_code == 200:
                print(f"✅ Flaga 'changed' ustawiona na false dla {device_id}")
            else:
                print(f"❌ Błąd przy ustawianiu flagi 'changed' dla {device_id}: {change_response.status_code}")

        except Exception as e:
            print(f"⚠️ Błąd przetwarzania urządzenia {device_id}: {e}")
