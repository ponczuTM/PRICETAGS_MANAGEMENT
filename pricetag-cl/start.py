import subprocess
import sys

commands = [
    # ["sudo", "python3", "1_scan_and_save_devices.py"],
    ["sudo", "python3", "2_download_devices_files.py"],
    ["sudo", "python3", "3_modify_file_for_upload.py"],
    ["sudo", "python3", "4_send_files_to_devices.py"],
]

for cmd in commands:
    print(f"\n=== Uruchamiam: {' '.join(cmd)} ===")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\n❌ Błąd przy wykonywaniu: {' '.join(cmd)}")
        sys.exit(result.returncode)

print("\n✅ Wszystkie skrypty wykonane pomyślnie.")
