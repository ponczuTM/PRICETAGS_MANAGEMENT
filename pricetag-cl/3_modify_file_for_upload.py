from PIL import Image, PngImagePlugin
import os
import subprocess

# Docelowy rozmiar
TARGET_SIZE = (720, 1280)

# Przetwarzanie plików PNG
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

            print(f"✅ Przetworzono PNG: {filename}")
        except Exception as e:
            print(f"❌ Błąd przetwarzania PNG {filename}: {e}")

# Przetwarzanie plików MP4
for filename in os.listdir("."):
    if filename.lower().endswith(".mp4"):
        try:
            input_path = filename
            output_path = f"converted_{filename}"

            ffmpeg_command = [
                'ffmpeg',
                '-i', input_path,
                '-c:v', 'libx264',
                '-profile:v', 'high',
                '-level', '4.2',
                '-pix_fmt', 'yuv420p',
                '-vf', 'scale=720:1280',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart',
                '-y',
                output_path
            ]

            subprocess.run(ffmpeg_command, check=True)
            os.remove(input_path)
            os.rename(output_path, input_path)

            print(f"✅ Przetworzono MP4: {filename}")
        except Exception as e:
            print(f"❌ Błąd przetwarzania MP4 {filename}: {e}")
