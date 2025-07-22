from PIL import Image
import os
import subprocess
import glob

TARGET_SIZE = (1080, 1920)

# Usuń stare tymczasowe pliki
for temp_file in glob.glob("temp_*.png"):
    try:
        os.remove(temp_file)
        print(f"🧹 Usunięto tymczasowy plik: {temp_file}")
    except Exception as e:
        print(f"❌ Błąd usuwania {temp_file}: {e}")

# Konwersja PNG do czystych, bezpiecznych obrazów PNG
for filename in os.listdir("."):
    if filename.lower().endswith(".png"):
        try:
            print(f"➡️ Przetwarzanie PNG: {filename}")

            # Otwórz obraz i usuń wszelkie profile, konwertuj do RGB (24-bit)
            image = Image.open(filename).convert("RGB")
            image = image.resize(TARGET_SIZE, Image.LANCZOS)

            temp_filename = f"temp_{filename}"
            image.save(temp_filename, format="PNG", optimize=True)

            # Konwersja do MP4
            output_mp4_path = f"{os.path.splitext(filename)[0]}.mp4"
            ffmpeg_command = [
                'ffmpeg',
                '-loop', '1',
                '-i', temp_filename,
                '-t', '3',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-y',
                output_mp4_path
            ]
            subprocess.run(ffmpeg_command, check=True)

            os.remove(filename)  # Usuń oryginalny PNG
            os.remove(temp_filename)  # Usuń tymczasowy PNG
            print(f"✅ Utworzono MP4: {output_mp4_path}")
        except Exception as e:
            print(f"❌ Błąd PNG {filename}: {e}")

# Obróbka istniejących MP4
for filename in os.listdir("."):
    if filename.lower().endswith(".mp4") and not filename.startswith("converted_"):
        try:
            input_path = filename
            output_path = f"converted_{filename}"

            if os.path.exists(output_path):
                print(f"⚠️ Pomijam {filename}, ponieważ {output_path} już istnieje.")
                continue

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
            print(f"✅ MP4 gotowy: {filename}")
        except Exception as e:
            print(f"❌ Błąd MP4 {filename}: {e}")
