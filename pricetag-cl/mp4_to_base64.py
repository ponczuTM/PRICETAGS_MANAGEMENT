import base64

# Funkcja do konwertowania wideo na base64
def video_to_base64(video_path):
    with open(video_path, "rb") as video_file:
        video_data = video_file.read()
        return base64.b64encode(video_data).decode('utf-8')

# Ścieżka do pliku wideo
video_path = "test.mp4"

# Konwersja pliku wideo na base64
encoded_video = video_to_base64(video_path)

# Zapisanie zakodowanego wideo do pliku tekstowego
with open("video.txt", "w") as text_file:
    text_file.write(encoded_video)

print("Plik wideo został przekonwertowany na base64 i zapisany w video.txt.")
