from PIL import Image
import os
import subprocess
import glob
import shlex
import json

# ------------------ KONFIG ------------------
TARGET_W, TARGET_H = 720, 1280         # docelowa pionowa rozdzielczość
FPS = 24                               # stałe 24 fps
GOP = FPS * 2                          # keyframe co ~2 sek
VIDEO_BR = "1200k"                     # średni bitrate
MAXRATE = "1200k"                      # max bitrate (VBV)
BUFSIZE = "2400k"                      # bufor (2x maxrate)
AUDIO_BR = "128k"
AUDIO_SR = "44100"
PIX_FMT = "yuv420p"
PROFILE = "high"
LEVEL = "4.1"
KEEP_ORIGINALS = False                 # True => nie usuwaj oryginałów
IMG_DURATION = 3                       # ile sekund ma trwać MP4 z PNG

# Rozszerzenia wideo do przeróbki (możesz dopisać inne)
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".ts"}

# ------------------ POMOCNICZE ------------------

def run(cmd: list):
    # Ładne logowanie
    print("▶", " ".join(shlex.quote(c) for c in cmd))
    return subprocess.run(cmd, check=True)

def ffprobe_json(path: str):
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", path
        ], text=True)
        return json.loads(out)
    except Exception:
        return {}

def has_audio_stream(path: str) -> bool:
    meta = ffprobe_json(path)
    for st in meta.get("streams", []):
        if st.get("codec_type") == "audio":
            return True
    return False

def ensure_dirsafe_name(name: str) -> str:
    # Bez zmian, ale możesz dodać sanitizację jeśli trzeba
    return name

# ------------------ PNG -> MP4 ------------------

def png_to_mp4(png_path: str):
    base = os.path.splitext(png_path)[0]
    out_mp4 = f"{base}.mp4"

    # Przeskaluj PNG w Pillow, żeby usunąć profile, ustawić dokładny rozmiar,
    # a w ffmpeg i tak ustawimy filtr bezpieczeństwa (scale+pad+setsar/setdar).
    try:
        im = Image.open(png_path).convert("RGB")
        im = im.resize((TARGET_W, TARGET_H), Image.LANCZOS)
        temp_png = f"temp_{os.path.basename(png_path)}"
        im.save(temp_png, format="PNG", optimize=True)
    except Exception as e:
        print(f"❌ Błąd obróbki PNG {png_path}: {e}")
        return

    # Dodajemy cichy dźwięk (żeby player się nie wywracał przy braku audio)
    # Wejście 0: PNG loopowane; Wejście 1: anullsrc (audio)
    vf = (
        f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_W}:{TARGET_H}:(ow-iw)/2:(oh-ih)/2,"
        f"setsar=1:1,setdar=9/16"
    )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", str(IMG_DURATION), "-i", temp_png,   # [0] obraz
        "-f", "lavfi", "-t", str(IMG_DURATION),
        "-i", f"anullsrc=channel_layout=stereo:sample_rate={AUDIO_SR}",  # [1] audio
        "-filter:v", vf,
        "-r", str(FPS), "-vsync", "cfr",
        "-c:v", "libx264",
        "-pix_fmt", PIX_FMT,
        "-profile:v", PROFILE, "-level", LEVEL,
        "-b:v", VIDEO_BR, "-maxrate", MAXRATE, "-bufsize", BUFSIZE,
        "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0",
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:a", "aac", "-b:a", AUDIO_BR, "-ar", AUDIO_SR,
        "-movflags", "+faststart",
        "-video_track_timescale", "1000",
        "-metadata:s:v:0", "rotate=0",
        out_mp4
    ]
    try:
        run(cmd)
        print(f"✅ Utworzono MP4 z PNG: {out_mp4}")
    finally:
        # sprzątaj
        try: os.remove(temp_png)
        except: pass
        if not KEEP_ORIGINALS:
            try: os.remove(png_path)
            except: pass

# ------------------ WIDEO -> WIDEO (profil zgodny) ------------------

def transcode_video(input_path: str):
    # Wyjściowy plik tymczasowy
    tmp_out = f"converted_{os.path.basename(input_path)}"
    tmp_out = ensure_dirsafe_name(tmp_out)

    if os.path.exists(tmp_out):
        print(f"⚠️ Pomijam {input_path}, bo {tmp_out} już istnieje.")
        return

    vf = (
        f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_W}:{TARGET_H}:(ow-iw)/2:(oh-ih)/2,"
        f"setsar=1:1,setdar=9/16"
    )

    # Strategia mapowania:
    # - Zawsze bierzemy 0:v:0
    # - Jeśli brak audio → dokładamy anullsrc jako drugie wejście i mapujemy 1:a:0
    # - Jeśli jest audio → mapujemy 0:a:0
    if has_audio_stream(input_path):
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-filter:v", vf,
            "-r", str(FPS), "-vsync", "cfr",
            "-c:v", "libx264",
            "-pix_fmt", PIX_FMT,
            "-profile:v", PROFILE, "-level", LEVEL,
            "-b:v", VIDEO_BR, "-maxrate", MAXRATE, "-bufsize", BUFSIZE,
            "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0",
            "-map", "0:v:0", "-map", "0:a:0",
            "-c:a", "aac", "-b:a", AUDIO_BR, "-ar", AUDIO_SR,
            "-sn", "-dn",                # usuń napisy/dane
            "-movflags", "+faststart",
            "-video_track_timescale", "1000",
            "-metadata:s:v:0", "rotate=0",
            tmp_out
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,                                # [0] video
            "-f", "lavfi", "-t", "9999", "-i",               # [1] audio (długo i tak przytnie -shortest)
            f"anullsrc=channel_layout=stereo:sample_rate={AUDIO_SR}",
            "-filter:v", vf,
            "-r", str(FPS), "-vsync", "cfr",
            "-c:v", "libx264",
            "-pix_fmt", PIX_FMT,
            "-profile:v", PROFILE, "-level", LEVEL,
            "-b:v", VIDEO_BR, "-maxrate", MAXRATE, "-bufsize", BUFSIZE,
            "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0",
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:a", "aac", "-b:a", AUDIO_BR, "-ar", AUDIO_SR,
            "-sn", "-dn",
            "-shortest",                                     # przytnij do długości wideo
            "-movflags", "+faststart",
            "-video_track_timescale", "1000",
            "-metadata:s:v:0", "rotate=0",
            tmp_out
        ]

    try:
        run(cmd)
        # Podmień oryginał
        if not KEEP_ORIGINALS:
            try: os.remove(input_path)
            except: pass
            os.rename(tmp_out, input_path)
            print(f"✅ Zgodne wideo: {input_path}")
        else:
            print(f"✅ Zgodne wideo zapisane jako: {tmp_out}")
    except Exception as e:
        print(f"❌ Błąd transkodowania {input_path}: {e}")
        # posprzątaj tymczasowe
        try:
            if os.path.exists(tmp_out):
                os.remove(tmp_out)
        except:
            pass

# ------------------ MAIN ------------------

if __name__ == "__main__":
    # 1) Sprzątanie po poprzednich biegach
    for temp_file in glob.glob("temp_*.png"):
        try:
            os.remove(temp_file)
            print(f"🧹 Usunięto tymczasowy plik: {temp_file}")
        except Exception as e:
            print(f"❌ Błąd usuwania {temp_file}: {e}")

    # 2) PNG -> MP4
    for filename in os.listdir("."):
        lower = filename.lower()
        if lower.endswith(".png"):
            png_to_mp4(filename)

    # 3) WIDEO -> WIDEO (zgodny profil)
    for filename in os.listdir("."):
        lower = filename.lower()
        ext = os.path.splitext(lower)[1]
        if ext in VIDEO_EXTS:
            # pomiń już „converted_”, jeśli KEEP_ORIGINALS=True
            if not KEEP_ORIGINALS and filename.startswith("converted_"):
                continue
            transcode_video(filename)

    print("🏁 Gotowe.")
