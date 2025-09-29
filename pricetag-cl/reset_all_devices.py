import requests

def clear_device(ip):
    url = f"http://{ip}/control?action=clearspace&sign=sign"
    try:
        response = requests.get(url, timeout=25)
        if response.status_code == 200:
            return True, "OK"
        else:
            return False, f"Status: {response.status_code}, Odpowiedź: {response.text}"
    except Exception as e:
        return False, str(e)

def main():
    base_ip = "192.168.68."
    results = {}

    for i in range(1, 256):  # od 1 do 255
        ip = f"{base_ip}{i}"
        success, message = clear_device(ip)
        results[ip] = (success, message)
        print(f"{ip}: {'Success' if success else 'Fail'} - {message}")

    # Opcjonalnie: zapis do pliku
    with open("clearspace_results.txt", "w") as f:
        for ip, (success, msg) in results.items():
            f.write(f"{ip}: {'Success' if success else 'Fail'} - {msg}\n")

if __name__ == "__main__":
    main()
