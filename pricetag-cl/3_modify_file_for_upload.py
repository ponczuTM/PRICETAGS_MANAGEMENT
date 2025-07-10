from PIL import Image, PngImagePlugin
import os

# Docelowy rozmiar
TARGET_SIZE = (720, 1280)

# Przetwarzanie wszystkich plików .png w bieżącym katalogu
for filename in os.listdir("."):
    if filename.lower().endswith(".png"):
        try:
            image = Image.open(filename)

            # Konwersja do RGBA jeśli potrzebne
            if image.mode != "RGBA":
                image = image.convert("RGBA")

            # Skalowanie
            image = image.resize(TARGET_SIZE)

            # Dodanie metadanych
            meta = PngImagePlugin.PngInfo()
            meta.add_text("Author", "EXON")
            meta.add_text("Comment", "Fixed RGBA and metadata for compatibility.")

            # Zapis nadpisujący plik
            image.save(filename, pnginfo=meta)

            print(f"✅ Przetworzono: {filename}")
        except Exception as e:
            print(f"❌ Błąd przetwarzania {filename}: {e}")
