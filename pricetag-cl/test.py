import requests
import base64
import os

# Konfiguracja
LOCATION_ID = "685003cbf071eb1bb4304cd2"
API_BASE = "http://localhost:8000/api/locations"
OUTPUT_FILE = "photo_to_upload.png"

# 1. Pobierz wszystkie urządzenia
response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices")
devices = response.json()

for device in devices:
    device_id = device.get("_id")
    changed = device.get("changed")
    photo = device.get("photo")

    # 2. Sprawdź czy urządzenie spełnia warunki
    if changed == "true" and photo and photo.strip() != "":
        try:
            # Usuń prefix jeśli jest
            if photo.startswith("data:image"):
                photo = photo.split(",", 1)[1]

            # Dodaj padding jeśli brakuje
            missing_padding = len(photo) % 4
            if missing_padding:
                photo += "=" * (4 - missing_padding)

            # 3. Zapisz zdjęcie
            photo_data = base64.b64decode(photo)
            with open(OUTPUT_FILE, "wb") as f:
                f.write(photo_data)
            print(f"📷 Zapisano zdjęcie urządzenia {device_id} jako {OUTPUT_FILE}")

            # 4. Usuń pliki photo i video
            delete_url = f"http://0.0.0.0:8000/api/locations/{LOCATION_ID}/devices/{device_id}/delete-files"
            delete_response = requests.delete(delete_url)
            if delete_response.status_code == 200:
                print(f"🗑️ Usunięto pliki photo i video dla {device_id}")
            else:
                print(f"❌ Błąd usuwania plików dla {device_id}: {delete_response.status_code}")

            # 5. Zmień flagę changed na false
            change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            change_response = requests.put(change_url)
            if change_response.status_code == 200:
                print(f"✅ Flaga 'changed' ustawiona na false dla {device_id}")
            else:
                print(f"❌ Błąd przy ustawianiu flagi 'changed' dla {device_id}: {change_response.status_code}")

        except Exception as e:
            print(f"⚠️ Błąd przetwarzania urządzenia {device_id}: {e}")
