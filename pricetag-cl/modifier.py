from PIL import Image, PngImagePlugin
import os

# Nazwa pliku
filename = "5477874189A3.png"

# Wczytaj obraz
image = Image.open(filename)

# Konwersja do RGBA jeśli potrzebne
if image.mode != "RGBA":
    image = image.convert("RGBA")

# Dodaj metadane (tEXt chunk)
meta = PngImagePlugin.PngInfo()
meta.add_text("Author", "ConvertedByScript")
meta.add_text("Comment", "Fixed RGBA and metadata for compatibility.")

# Zapisz obraz, nadpisując oryginał
image.save(filename, pnginfo=meta)

print(f"✅ Plik '{filename}' został zmodyfikowany: RGBA + metadane dodane.")
