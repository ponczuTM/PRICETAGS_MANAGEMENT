import subprocess
import time
while True:
    subprocess.run(["python3", "downloader.py"])
    # time.sleep(10)
    subprocess.run(["python3", "modifier.py"])
    subprocess.run(["python3", "sender.py"])
