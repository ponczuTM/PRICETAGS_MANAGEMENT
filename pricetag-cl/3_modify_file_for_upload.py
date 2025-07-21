from PIL import Image
import os
import subprocess
import glob

# 🧹 Usuń stare pliki tymczasowe (jeśli istnieją z poprzednich uruchomień)
for temp_file in glob.glob("temp_*.png"):
    try:
        os.remove(temp_file)
        print(f"🧹 Usunięto tymczasowy plik: {temp_file}")
    except Exception as e:
        print(f"❌ Błąd usuwania {temp_file}: {e}")

# 📦 Przetwarzanie plików PNG na MP4
for filename in os.listdir("."):
    if filename.lower().endswith(".png"):
        try:
            print(f"➡️ Przetwarzanie PNG na MP4: {filename}")

            input_png_path = filename
            output_mp4_path = f"{os.path.splitext(filename)[0]}.mp4" # Zapisujemy jako .mp4

            # FFmpeg command to create a 3-second MP4 from the PNG
            # -loop 1: Loop the input image indefinitely
            # -t 3: Set the duration to 3 seconds
            # -c:v libx264: Use H.264 video codec
            # -pix_fmt yuv420p: Pixel format for broad compatibility
            # -vf "scale=1080:1920": Scale the video to 1080x1920
            # -y: Overwrite output files without asking
            ffmpeg_command = [
                'ffmpeg',
                '-loop', '1',
                '-i', input_png_path,
                '-t', '3',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-vf', 'scale=1080:1920',
                '-y',
                output_mp4_path
            ]
            subprocess.run(ffmpeg_command, check=True)

            # Usuń oryginalny plik PNG
            os.remove(input_png_path)
            print(f"✅ PNG przekonwertowany na MP4 i usunięty: {output_mp4_path}")

        except Exception as e:
            print(f"❌ Błąd podczas przetwarzania PNG {filename}: {e}")

# 🎥 Przetwarzanie plików MP4 (bez zmian - to jest oddzielna sekcja od przetwarzania PNG)
for filename in os.listdir("."):
    if filename.lower().endswith(".mp4") and not filename.startswith("temp_") and not filename.startswith("converted_"):
        try:
            input_path = filename
            output_path = f"converted_{filename}" # Używamy tymczasowej nazwy

            # Sprawdzamy, czy plik wyjściowy już istnieje, aby uniknąć pętli
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
                '-vf', 'scale=720:1280', # Nadal skalowanie do 720:1280 dla istniejących MP4
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart',
                '-y',
                output_path
            ]
            subprocess.run(ffmpeg_command, check=True)

            os.remove(input_path) # Usuń oryginalny plik
            os.rename(output_path, input_path) # Zmień nazwę skonwertowanego pliku na oryginalną
            print(f"✅ MP4 gotowy: {filename}")
        except Exception as e:
            print(f"❌ Błąd MP4 {filename}: {e}")