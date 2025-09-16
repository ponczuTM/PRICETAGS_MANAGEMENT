#!/bin/bash
set -euo pipefail

# === Konfiguracja ===
PYTHON_VERSION="3.12.8"
PY_SHORT="3.12"
PY_BIN="/usr/local/bin/python${PY_SHORT}"
PIP_BIN="/usr/local/bin/pip${PY_SHORT}"

# === Helpery ===
err() { echo "❌ $*" >&2; }
log() { echo -e "$*"; }
trap 'err "Błąd w linii $LINENO — przerwano."' ERR

# === Wymagania wstępne ===
if ! command -v apt >/dev/null 2>&1; then
  err "Ten skrypt jest dla Debian/Ubuntu (APT)."
  exit 1
fi

log "🔄 Aktualizacja indeksów pakietów..."
sudo apt update -y

log "🧭 Włączanie repozytoriów universe/multiverse (jeśli jeszcze nieaktywne)..."
sudo apt install -y software-properties-common
sudo add-apt-repository -y universe
sudo add-apt-repository -y multiverse
sudo apt update -y

log "📦 Instalacja narzędzi i bibliotek buildowych (Python/Pillow/FFmpeg)..."
sudo apt install -y \
  build-essential \
  libssl-dev \
  zlib1g-dev \
  libncurses5-dev \
  libncursesw5-dev \
  libreadline-dev \
  libsqlite3-dev \
  libgdbm-dev \
  libbz2-dev \
  libexpat1-dev \
  liblzma-dev \
  tk-dev \
  uuid-dev \
  libffi-dev \
  ca-certificates \
  wget \
  curl \
  git \
  pkg-config \
  yasm \
  nasm \
  libjpeg-dev \
  libpng-dev \
  libtiff5-dev \
  libfreetype6-dev \
  libwebp-dev \
  libopenjp2-7-dev \
  liblcms2-dev \
  libx264-dev \
  libx265-dev \
  libvpx-dev \
  libmp3lame-dev \
  libopus-dev

log "🎧 (Opcjonalnie) Instalacja libfdk-aac-dev..."
FDK_FLAGS=""
if sudo apt install -y libfdk-aac-dev; then
  FDK_FLAGS="--enable-libfdk-aac --enable-nonfree"
else
  log "ℹ️ libfdk-aac-dev niedostępny — FFmpeg będzie bez FDK-AAC (OK do większości zastosowań)."
fi

# === Python 3.12.8 ===
log "⬇️ Pobieranie Python ${PYTHON_VERSION}..."
cd /tmp
wget -q https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz

log "📦 Rozpakowywanie..."
tar -xf Python-${PYTHON_VERSION}.tgz
cd Python-${PYTHON_VERSION}

log "⚙️ Kompilacja Pythona (może potrwać)..."
./configure --enable-optimizations --with-lto
make -j"$(nproc)"

log "🧱 Instalacja Pythona (altinstall, nie nadpisuje systemowego)..."
sudo make altinstall

log "🐍 Konfiguracja pip i instalacja zależności PyPI..."
${PY_BIN} -m ensurepip --upgrade
${PIP_BIN} install --upgrade pip setuptools wheel
${PIP_BIN} install requests Pillow pytz schedule

# === FFmpeg (z gita) ===
log "⬇️ Pobieranie i kompilacja FFmpeg..."
cd /tmp
rm -rf ffmpeg || true
git clone --depth=1 https://git.ffmpeg.org/ffmpeg.git ffmpeg
cd ffmpeg

./configure \
  --enable-gpl \
  --enable-libx264 \
  --enable-libx265 \
  --enable-libvpx \
  --enable-libmp3lame \
  --enable-libopus \
  ${FDK_FLAGS}

make -j"$(nproc)"
sudo make install

# Odświeżenie cache ścieżek w bieżącej powłoce
hash -r || true

# === Weryfikacja ===
log "🧪 Weryfikacja instalacji..."
set +e
${PY_BIN} - <<'PY'
import sys
mods = ["requests", "PIL", "pytz", "schedule", "concurrent.futures", "base64", "binascii", "re", "json", "pathlib", "datetime", "glob", "subprocess", "shlex", "hashlib", "typing", "logging", "os", "time"]
ok = True
for m in mods:
    try:
        __import__(m.split('.')[0])
    except Exception as e:
        ok = False
        print(f"❌ Import failed: {m}: {e}")
print("✅ Python:", sys.version)
sys.exit(0 if ok else 1)
PY
PY_OK=$?

ffmpeg -version >/dev/null 2>&1
FF_OK=$?

set -e
if [ "$PY_OK" -ne 0 ]; then
  err "Błąd: nie wszystkie moduły Pythona dały się zaimportować."
  exit 1
fi
if [ "$FF_OK" -ne 0 ]; then
  err "Błąd: FFmpeg nie jest widoczny w PATH."
  exit 1
fi

log "🎉 GOTOWE!"
log "➡️ Python: $(${PY_BIN} --version)"
log "➡️ pip:    $(${PIP_BIN} --version)"
log "➡️ FFmpeg: $(ffmpeg -version | head -n1)"
# exec "$SHELL" -l  # odkomentuj, jeśli chcesz odświeżyć środowisko w tej samej sesji

#DODAĆ: fastapi, motor, pydantic_settings, pydantic[email], passlib, python-multipart, pyotp, qrcode, uvicorn