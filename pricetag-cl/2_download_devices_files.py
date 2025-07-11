import requests
import os

# Konfiguracja
LOCATION_ID = "685003cbf071eb1bb4304cd2"
API_BASE = "http://localhost:8000/api/locations"
# Ustawienie UPLOAD_DIR jako pustego stringu, aby pliki były pobierane do bieżącego katalogu
UPLOAD_DIR = "" 

# 1. Pobierz wszystkie urządzenia
try:
    response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices")
    response.raise_for_status()  # Sprawdź, czy wystąpił błąd HTTP
    devices = response.json()
except requests.exceptions.RequestException as e:
    print(f"❌ Błąd podczas pobierania listy urządzeń: {e}")
    exit()

script_dir = os.path.dirname(os.path.abspath(__file__))

for device in devices:
    device_id = device.get("_id")
    client_id = device.get("clientId")
    photo_filename_from_db = device.get("photo")
    video_filename_from_db = device.get("video")
    changed = device.get("changed")

    if changed == "true":
        print(f"\n⚙️ Przetwarzanie urządzenia {device_id} (Client ID: {client_id})...")

        # Pobieranie i zapisywanie zdjęcia
        if photo_filename_from_db and photo_filename_from_db.strip() != "":
            file_url = f"{API_BASE}/{LOCATION_ID}/files/{photo_filename_from_db}"
            local_filename = f"{client_id}.png"
            local_filepath = os.path.join(script_dir, local_filename)

            try:
                file_response = requests.get(file_url, stream=True)
                file_response.raise_for_status()

                with open(local_filepath, "wb") as f:
                    for chunk in file_response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"📷 Zapisano zdjęcie urządzenia {device_id} jako {local_filename}")
                
                # Usuń plik wideo, jeśli istnieje, aby uniknąć kolizji
                video_filepath_to_remove = os.path.join(script_dir, f"{client_id}.mp4")
                if os.path.exists(video_filepath_to_remove):
                    os.remove(video_filepath_to_remove)
                    print(f"🗑️ Usunięto stary plik wideo {video_filepath_to_remove}")

            except requests.exceptions.RequestException as e:
                print(f"❌ Błąd podczas pobierania zdjęcia '{photo_filename_from_db}' dla urządzenia {device_id}: {e}")
            except Exception as e:
                print(f"⚠️ Błąd zapisu zdjęcia dla urządzenia {device_id}: {e}")

        # Pobieranie i zapisywanie wideo
        if video_filename_from_db and video_filename_from_db.strip() != "":
            file_url = f"{API_BASE}/{LOCATION_ID}/files/{video_filename_from_db}"
            local_filename = f"{client_id}.mp4"
            local_filepath = os.path.join(script_dir, local_filename)

            try:
                file_response = requests.get(file_url, stream=True)
                file_response.raise_for_status()

                with open(local_filepath, "wb") as f:
                    for chunk in file_response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"🎞️ Zapisano wideo urządzenia {device_id} jako {local_filename}")

                # Usuń plik zdjęcia, jeśli istnieje, aby uniknąć kolizji
                photo_filepath_to_remove = os.path.join(script_dir, f"{client_id}.png")
                if os.path.exists(photo_filepath_to_remove):
                    os.remove(photo_filepath_to_remove)
                    print(f"🗑️ Usunięto stary plik zdjęcia {photo_filepath_to_remove}")

            except requests.exceptions.RequestException as e:
                print(f"❌ Błąd podczas pobierania wideo '{video_filename_from_db}' dla urządzenia {device_id}: {e}")
            except Exception as e:
                print(f"⚠️ Błąd zapisu wideo dla urządzenia {device_id}: {e}")

        # Usuń nazwy plików photo i video w bazie
        try:
            delete_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/delete-files"
            delete_response = requests.delete(delete_url)
            delete_response.raise_for_status()
            print(f"🗑️ Usunięto nazwy plików photo i video z bazy dla urządzenia {device_id}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Błąd usuwania nazw plików dla urządzenia {device_id}: {e}")

        # Ustaw 'changed' na false
        try:
            change_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            change_response = requests.put(change_url)
            change_response.raise_for_status()
            print(f"✅ Flaga 'changed' ustawiona na false dla urządzenia {device_id}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Błąd przy ustawianiu flagi 'changed' na false dla urządzenia {device_id}: {e}")
    else:
        print(f"\n⏭️ Urządzenie {device_id} (Client ID: {client_id}) - flaga 'changed' nie jest ustawiona na 'true'. Pomijam.")

print("\n--- Zakończono przetwarzanie ---")