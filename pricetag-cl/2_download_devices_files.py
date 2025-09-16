import requests
import os
import json
from datetime import datetime
import pytz
from pathlib import Path

# LOCATION_ID = "685003cbf071eb1bb4304cd2"
LOCATION_ID = "68c95e497b40e5d906e1caa7"
API_BASE = "http://localhost:8000/api/locations"
script_dir = os.path.dirname(os.path.abspath(__file__))
LAST_CHECK_PATH = os.path.join(script_dir, "lastHourCheck.txt")

def set_thumbnail_from_schedule(location_id: str, device_id: str, filename: str, media_type: str):
    """
    Ustawia pole 'thumbnail' na SAMĄ nazwę pliku z harmonogramu (np. 'price_tag_konwencja.mp4').
    UWAGA: ignoruje media_type oraz nie generuje żadnych miniaturek.
    """
    try:
        put_url = f"{API_BASE}/{location_id}/devices/{device_id}/thumbnail"
        res = requests.put(put_url, json={"thumbnail": filename})
        res.raise_for_status()
        print(f"🖼️ Ustawiono thumbnail na: {filename}")
    except Exception as e:
        print(f"❌ Błąd aktualizacji thumbnail: {e}")


# Wczytaj zapisane czasy wykonania harmonogramów weekly
if os.path.exists(LAST_CHECK_PATH):
    with open(LAST_CHECK_PATH, "r") as f:
        last_check_map = json.load(f)
else:
    last_check_map = {}

def get_active_schedule(schedules, last_check_time, client_id):
    now = datetime.now(pytz.timezone("Europe/Warsaw"))
    candidates = []

    for schedule in schedules:
        if schedule["type"] == "fixed":
            date = datetime.fromisoformat(schedule["date"]).astimezone(pytz.timezone("Europe/Warsaw"))
            if date <= now:
                print(f"🗓️ [FIXED] {client_id} – dodano jako kandydat (<= teraz)")
                candidates.append((date, schedule))

        elif schedule["type"] == "weekly":
            if now.weekday() == (schedule["dayOfWeek"] - 1) % 7:
                schedule_time = now.replace(hour=schedule["hour"], minute=schedule["minute"], second=0, microsecond=0)
                if last_check_time < schedule_time <= now:
                    print(f"🗓️ [WEEKLY] {client_id} – dodano jako kandydat ({schedule_time.strftime('%H:%M')})")
                    candidates.append((schedule_time, schedule))
                else:
                    print(f"⏩ [WEEKLY] {client_id} – pominięto ({schedule['hour']:02}:{schedule['minute']:02}), poza zakresem {last_check_time.strftime('%H:%M:%S')} - {now.strftime('%H:%M:%S')}")
            else:
                print(f"📆 [WEEKLY] {client_id} – nie ten dzień tygodnia ({now.weekday()} vs {schedule['dayOfWeek']})")

    if not candidates:
        return None

    return max(candidates, key=lambda x: x[0])[1]

now = datetime.now(pytz.timezone("Europe/Warsaw"))
print(f"\n🕒 Obecny czas (Warszawa): {now.strftime('%Y-%m-%d %H:%M:%S')}")

try:
    response = requests.get(f"{API_BASE}/{LOCATION_ID}/devices")
    response.raise_for_status()
    devices = response.json()
except requests.RequestException as e:
    print(f"❌ Błąd podczas pobierania listy urządzeń: {e}")
    exit()

for device in devices:
    device_id = device.get("_id")
    client_id = device.get("clientId")
    changed = device.get("changed")
    skip_standard = False

    last_checked_str = last_check_map.get(client_id)
    if last_checked_str:
        last_checked = datetime.fromisoformat(last_checked_str)
    else:
        last_checked = datetime.min.replace(tzinfo=pytz.timezone("Europe/Warsaw"))

    print(f"\n🔍 Urządzenie {client_id}")
    print(f"🕓 Ostatnie sprawdzenie: {last_checked.strftime('%Y-%m-%d %H:%M:%S')} ({last_checked.strftime('%A')})")

    try:
        schedules_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/schedules"
        schedules_res = requests.get(schedules_url)
        schedules_res.raise_for_status()
        schedules = schedules_res.json()
    except Exception as e:
        print(f"⚠️ Błąd pobierania harmonogramów dla {client_id}: {e}")
        schedules = []

    active_schedule = get_active_schedule(schedules, last_checked, client_id)

    if active_schedule:
        print(f"📌 Aktywny harmonogram znaleziony – rozpoczynam przetwarzanie...")

        media = active_schedule["media"]
        filename = media["filename"]
        media_type = media["mediaType"]
        extension = ".png" if media_type in ["photo", "image"] else ".mp4"
        local_filename = f"{client_id}{extension}"
        local_filepath = os.path.join(script_dir, local_filename)
        file_url = f"{API_BASE}/{LOCATION_ID}/files/{filename}"

        try:
            r = requests.get(file_url, stream=True)
            r.raise_for_status()
            with open(local_filepath, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"📥 ({media_type}) Zapisano wg harmonogramu: {local_filename}")

            # --- NOWE: ustaw miniaturkę w bazie dla pliku z harmonogramu ---
            set_thumbnail_from_schedule(LOCATION_ID, device_id, filename, media_type)

            other_ext = ".mp4" if extension == ".png" else ".png"
            old_path = os.path.join(script_dir, f"{client_id}{other_ext}")
            if os.path.exists(old_path):
                os.remove(old_path)
                print(f"🗑️ Usunięto poprzedni plik {old_path}")

            if active_schedule["type"] == "fixed":
                del_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/schedules"
                del_res = requests.delete(del_url)
                del_res.raise_for_status()
                print(f"🧹 Usunięto harmonogramy fixed dla {client_id}")
            else:
                last_check_map[client_id] = now.isoformat()
                print(f"📝 Zaktualizowano czas ostatniego przetwarzania weekly dla {client_id}")

            skip_standard = True

        except Exception as e:
            print(f"❌ Błąd pobierania pliku wg harmonogramu dla {client_id}: {e}")

    if changed == "true" and not skip_standard:
        print(f"\n⚙️ Przetwarzanie changed: true dla {client_id}...")

        for media_type, ext in [("photo", ".png"), ("video", ".mp4")]:
            filename = device.get(media_type)
            if filename:
                file_url = f"{API_BASE}/{LOCATION_ID}/files/{filename}"
                local_filename = f"{client_id}{ext}"
                local_filepath = os.path.join(script_dir, local_filename)

                try:
                    r = requests.get(file_url, stream=True)
                    r.raise_for_status()
                    with open(local_filepath, "wb") as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                    print(f"✅ Zapisano {media_type} jako {local_filename}")

                    # --- NOWE: ustaw miniaturkę spójną z pobranym plikiem ---
                    set_thumbnail_from_schedule(LOCATION_ID, device_id, filename, media_type)

                    other_path = os.path.join(script_dir, f"{client_id}{'.mp4' if ext == '.png' else '.png'}")
                    if os.path.exists(other_path):
                        os.remove(other_path)
                        print(f"🗑️ Usunięto drugi plik {other_path}")

                except Exception as e:
                    print(f"❌ Błąd pobierania {media_type}: {e}")

        try:
            del_files_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/delete-files"
            del_files_res = requests.delete(del_files_url)
            del_files_res.raise_for_status()
            print(f"🧹 Usunięto photo/video z bazy dla {client_id}")
        except Exception as e:
            print(f"❌ Błąd usuwania plików z bazy: {e}")

        try:
            changed_url = f"{API_BASE}/{LOCATION_ID}/devices/{device_id}/changed-false"
            changed_res = requests.put(changed_url)
            changed_res.raise_for_status()
            print(f"🔄 Ustawiono changed = false dla {client_id}")
        except Exception as e:
            print(f"❌ Błąd zmiany flagi changed: {e}")

    elif not active_schedule:
        print(f"⏭️ {client_id} – brak changed i brak aktywnego harmonogramu.")

with open(LAST_CHECK_PATH, "w") as f:
    json.dump(last_check_map, f, indent=2)

print("\n✅ Zakończono sprawdzanie harmonogramów.")
