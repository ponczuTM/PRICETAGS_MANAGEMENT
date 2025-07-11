import subprocess
import time
import os
# while True:
os.system("clear")
subprocess.run(["python3", "2_download_devices_files.py"])
subprocess.run(["python3", "3_modify_file_for_upload.py"])
subprocess.run(["python3", "4_send_files_to_devices.py"])
# time.sleep(5)
