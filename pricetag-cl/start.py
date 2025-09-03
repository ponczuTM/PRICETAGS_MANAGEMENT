# import subprocess
# import time
# import os
# # while True:
# os.system("clear")
# # subprocess.run(["python3", "1_scan_and_save_devices.py"])
# subprocess.run(["python3", "2_download_devices_files.py"])
# subprocess.run(["python3", "3_modify_file_for_upload.py"])
# subprocess.run(["python3", "4_send_files_to_devices.py"])
# # time.sleep(5)


import schedule
import subprocess
import time
import logging
import os

CONFIG_FILE = "config.txt"
LOG_FILE = "pipeline.log"


def create_default_config():
    """Tworzy domyślny config, jeśli nie istnieje"""
    default_config = """# Konfiguracja harmonogramu (w sekundach)
# scan_interval_seconds = co ile sekund wykonywać 1_scan_and_save_devices.py
# pipeline_interval_seconds = co ile sekund wykonywać 2,3,4
scan_interval_seconds=3600
pipeline_interval_seconds=60
"""
    with open(CONFIG_FILE, "w") as f:
        f.write(default_config)
    print("📝 Utworzono domyślny config.txt")


def load_config():
    """Wczytuje konfigurację z pliku config.txt"""
    config = {}
    try:
        if not os.path.exists(CONFIG_FILE):
            create_default_config()

        with open(CONFIG_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    config[key.strip()] = int(val.strip())
    except Exception as e:
        print(f"⚠️ Błąd wczytywania config.txt: {e}")
    return config


def run_script(name, cmd):
    """Uruchamia skrypt Pythona i loguje wynik"""
    try:
        logging.info(f"▶️ Start {name}")
        subprocess.run(["python3", cmd], check=True)
        logging.info(f"✅ Success {name}")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"❌ Failed {name}: {e}")
        return False


def job_scan():
    run_script("Scan devices", "1_scan_and_save_devices.py")


def job_pipeline():
    if run_script("Download", "2_download_devices_files.py"):
        if run_script("Modify", "3_modify_file_for_upload.py"):
            run_script("Send", "4_send_files_to_devices.py")


def main():
    logging.basicConfig(
        filename=LOG_FILE,
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    current_config = load_config()
    scan_interval = current_config.get("scan_interval_seconds", 3600)
    pipeline_interval = current_config.get("pipeline_interval_seconds", 60)

    logging.info(
        f"Scheduler uruchomiony: scan co {scan_interval}s, pipeline co {pipeline_interval}s"
    )

    # ▶️ Wykonaj pierwszy zestaw
    logging.info("▶️ Wykonywanie pierwszego pełnego zestawu (1,2,3,4)")
    job_scan()
    job_pipeline()

    # ➕ Dodaj zadania do harmonogramu
    schedule.every(scan_interval).seconds.do(job_scan).tag("scan")
    schedule.every(pipeline_interval).seconds.do(job_pipeline).tag("pipeline")

    while True:
        # 🔁 Wczytaj nowy config co kilka sekund
        new_config = load_config()
        new_scan = new_config.get("scan_interval_seconds", 3600)
        new_pipeline = new_config.get("pipeline_interval_seconds", 60)

        # 🔄 Jeśli config się zmienił, przestaw harmonogram
        if new_scan != scan_interval or new_pipeline != pipeline_interval:
            logging.info("🔄 Zmiana configu wykryta — przestawianie harmonogramu")

            # Usuń stare zadania
            schedule.clear("scan")
            schedule.clear("pipeline")

            # Zaktualizuj interwały
            scan_interval = new_scan
            pipeline_interval = new_pipeline

            # Ustaw nowe zadania
            schedule.every(scan_interval).seconds.do(job_scan).tag("scan")
            schedule.every(pipeline_interval).seconds.do(job_pipeline).tag("pipeline")

            logging.info(
                f"📅 Nowe interwały: scan co {scan_interval}s, pipeline co {pipeline_interval}s"
            )

        schedule.run_pending()
        time.sleep(1)



if __name__ == "__main__":
    main()
