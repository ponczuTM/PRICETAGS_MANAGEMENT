import base64

# Wczytanie zawartości pliku video.txt
with open("video.txt", "r") as file:
    base64_data = file.read()

# Dekodowanie danych base64
video_data = base64.b64decode(base64_data)

# Zapisanie danych do pliku .mp4
with open("video.mp4", "wb") as output_file:
    output_file.write(video_data)

print("Plik video.mp4 został zapisany pomyślnie.")
