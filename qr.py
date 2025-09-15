import qrcode
from PIL import Image

def generate_qr(data: str, filename: str, size: tuple = (300, 300)):

    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
        img = img.resize(size, Image.LANCZOS)
        img.save(filename)
        
        print(f"Kod QR został pomyślnie wygenerowany i zapisany jako {filename}")
    
    except Exception as e:
        print(f"Wystąpił błąd podczas generowania kodu QR: {e}")

# Przykład użycia
text_to_encode = "685003cbf071eb1bb4304cd2"
output_filename = "qr.png"
image_size = (300, 300)

generate_qr(text_to_encode, output_filename, image_size)