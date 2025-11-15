import sys
import re

def calc_ean13_check_digit(twelve_digits: str) -> int:
    """Zwraca cyfrę kontrolną dla 12-cyfrowego numeru EAN-13."""
    if len(twelve_digits) != 12 or not twelve_digits.isdigit():
        raise ValueError("Do wyliczenia checksumy wymagane jest dokładnie 12 cyfr.")
    odd_sum = sum(int(twelve_digits[i]) for i in range(0, 12, 2))
    even_sum = sum(int(twelve_digits[i]) for i in range(1, 12, 2))
    total = odd_sum + 3 * even_sum
    return (10 - (total % 10)) % 10

def normalize_input(raw: str) -> str:
    return re.sub(r"\s+", "", raw or "")

def main():
    user_input = input("Podaj 12 lub 13 cyfr EAN: ").strip()
    digits = normalize_input(user_input)

    if not digits.isdigit() or len(digits) not in (12, 13):
        print("Błąd: wprowadź wyłącznie 12 lub 13 cyfr (bez liter i znaków).")
        sys.exit(1)

    if len(digits) == 12:
        base = digits
        check = calc_ean13_check_digit(base)
        print(f"Policzona cyfra kontrolna: {check}")
    else:  # 13 cyfr
        base, last = digits[:12], int(digits[12])
        expected = calc_ean13_check_digit(base)
        if last != expected:
            print(f"Błąd: cyfra kontrolna nie pasuje. Podano {last}, powinno być {expected}.")
            sys.exit(1)
        check = last

    number_for_barcode_lib = base  # biblioteka oczekuje 12 cyfr; sama doda checksumę

    try:
        from barcode import EAN13
        from barcode.writer import ImageWriter
    except ImportError:
        print(
            "Brak wymaganych pakietów. Zainstaluj:\n"
            "  pip install python-barcode pillow"
        )
        sys.exit(2)

    # Konfiguracja renderingu (czytelny, ale niewielki obraz PNG)
    writer_options = {
        "write_text": True,      # nadruk cyfr pod kodem
        "font_size": 5,
        "text_distance": 2,      # odstęp tekstu od kresek (w px)
        "module_width": 0.2,     # szerokość najcieńszego paska (w mm -> lib konwertuje)
        "module_height": 15.0,   # wysokość kresek (w mm)
        "quiet_zone": 6.5,       # margines (w mm)
        "dpi": 300,
    }

    # Tworzenie obrazu
    ean = EAN13(number_for_barcode_lib, writer=ImageWriter())
    output_path = ean.save("ean", options=writer_options)  # zapisze ean.png

    full_code = base + str(check)
    print(f"Sukces: wygenerowano EAN-13 {full_code} → {output_path}")

if __name__ == "__main__":
    main()
