import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor

location = "Kraków Starbucks"
street = "orzechowa 1"

def check_device(ip):
    url = f"http://192.168.68.{ip}/Iotags"
    
    try:
        response = requests.get(url, timeout=1)
        if response.status_code == 200:
            data = response.json()
            if "STATE" in data and data["STATE"] == "SUCCEED" and "name" in data:
                return {
                    "ip": f"192.168.68.{ip}",
                    "name": data["name"],
                    "clientid": data["clientid"],
                    "free-space": data["free-space"]
                }
    except requests.RequestException:
        return None

def scan_network():
    devices = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_device, range(1, 256))
        devices = [device for device in results if device is not None]
    
    return devices

def print_devices(devices):
    if devices:
        print("Znalezione urządzenia:")
        for device in devices:
            print(f"IP: {device['ip']}, Name: {device['name']}, ClientID: {device['clientid']}, Free Space: {device['free-space']} bytes")
    else:
        print("Nie znaleziono żadnych urządzeń.")

def main():
    while True:
        print("Rozpoczynam skanowanie sieci...")
        devices = scan_network()
        print_devices(devices)
        time.sleep(60)

if __name__ == "__main__":
    main()
