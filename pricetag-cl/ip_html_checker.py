import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- ⚙️ Konfiguracja ---
# BASE_A = 10
# BASE_B = 10


BASE_A = 192
BASE_B = 168

THIRD_OCTET_START = 1
THIRD_OCTET_END = 255

FOURTH_OCTET_START = 1
FOURTH_OCTET_END = 255

PORT = 80
TIMEOUT = 0.5
MAX_WORKERS = 50


def check_for_html(ip_str: str):
    """
    Próbuje nawiązać połączenie HTTP z podanym IP i sprawdza,
    czy odpowiedź ma nagłówek Content-Type wskazujący na HTML.
    """
    url = f"http://{ip_str}:{PORT}"

    try:
        headers = {'User-Agent': 'Python Scanner', 'Connection': 'close'}
        response = requests.get(
            url,
            timeout=TIMEOUT,
            headers=headers,
            allow_redirects=True,
            stream=True,   # nie ściągaj całego body
        )

        content_type = response.headers.get('Content-Type', '').lower()
        contains_html = response.status_code == 200 and 'text/html' in content_type

        print(f"Przeskanowano IP: {ip_str}, czy zawiera HTML?: {'tak' if contains_html else 'nie'}")
        return ip_str if contains_html else None

    except requests.exceptions.Timeout:
        print(f"Przeskanowano IP: {ip_str}, czy zawiera HTML?: nie (Timeout)")
        return None
    except requests.exceptions.ConnectionError:
        print(f"Przeskanowano IP: {ip_str}, czy zawiera HTML?: nie (Brak połączenia)")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Przeskanowano IP: {ip_str}, czy zawiera HTML?: nie (Błąd: {type(e).__name__})")
        return None


def generate_ips():
    """
    Generuje IP w formacie 192.168.[1..68].[1..255]
    """
    for third in range(THIRD_OCTET_START, THIRD_OCTET_END + 1):
        for fourth in range(FOURTH_OCTET_START, FOURTH_OCTET_END + 1):
            yield f"{BASE_A}.{BASE_B}.{third}.{fourth}"


def scan_network():
    total = (THIRD_OCTET_END - THIRD_OCTET_START + 1) * (FOURTH_OCTET_END - FOURTH_OCTET_START + 1)
    print(f"--- 🚀 Start skanowania: {BASE_A}.{BASE_B}.[{THIRD_OCTET_START}..{THIRD_OCTET_END}].[{FOURTH_OCTET_START}..{FOURTH_OCTET_END}] na porcie {PORT} (łącznie {total} IP) ---")

    found_ips = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(check_for_html, ip) for ip in generate_ips()]

        for fut in as_completed(futures):
            result = fut.result()
            if result:
                found_ips.append(result)

    print("\n--- ✅ Skanowanie zakończone ---")
    if found_ips:
        print("\n🎉 Znalezione adresy IP zwracające HTML:")
        for ip in sorted(found_ips):
            print(f"  - {ip}")
    else:
        print("\n😢 Nie znaleziono żadnych adresów IP zwracających HTML.")


if __name__ == '__main__':
    # pip install requests
    scan_network()