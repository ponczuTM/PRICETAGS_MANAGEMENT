#!/usr/bin/env bash
set -euo pipefail

# =============================
#  Py -> PyInstaller -> .deb
# =============================

if [[ $# -ne 1 ]]; then
  echo "Użycie: $0 <plik.py>"
  exit 1
fi

PYFILE="$1"
[[ -f "$PYFILE" ]] || { echo "Błąd: nie ma pliku $PYFILE"; exit 1; }

ABS_PYFILE="$(readlink -f "$PYFILE")"
SRC_DIR="$(dirname "$ABS_PYFILE")"
BASE="$(basename "$ABS_PYFILE")"
APP_NAME="${BASE%.*}"

# --- Nazwa pakietu (Debian-safe) ---
PKG_NAME="$APP_NAME"
if [[ "$PKG_NAME" =~ ^[0-9] ]]; then PKG_NAME="py-$PKG_NAME"; fi
PKG_NAME="$(echo "$PKG_NAME" | tr '[:upper:] ' '[:lower:]-' | sed 's/[^a-z0-9+.\-]/-/g')"

# --- Architektura .deb ---
if command -v dpkg >/dev/null 2>&1; then
  ARCH="$(dpkg --print-architecture)"
else
  case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l) ARCH="armhf" ;;
    i386|i686) ARCH="i386" ;;
    *) echo "Nieznana architektura: $(uname -m)"; exit 1 ;;
  esac
fi

# --- Helper do instalacji narzędzi ---
need_pkg() {
  local bin="$1" pkg="$2"
  if ! command -v "$bin" >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y "$pkg"
  fi
}

# --- Wymagane narzędzia systemowe ---
need_pkg dpkg-deb dpkg
need_pkg python3 python3
python3 - <<'PY' || { sudo apt-get install -y python3-venv; }
import venv
PY

# --- Katalog roboczy i cleanup ---
WORKDIR="$(mktemp -d -t py2deb-XXXXXX)"
cleanup(){ rm -rf "$WORKDIR"; }
trap cleanup EXIT

# --- Czysty venv do builda ---
python3 -m venv "$WORKDIR/venv"
source "$WORKDIR/venv/bin/activate"
python -m pip install --upgrade pip >/dev/null
python -m pip install pyinstaller >/dev/null

# --- Zależności: requirements.txt albo fallback ---
REQ_FILE="$SRC_DIR/requirements.txt"
if [[ -f "$REQ_FILE" ]]; then
  echo ">> Instaluję zależności z $REQ_FILE"
  python -m pip install -r "$REQ_FILE"
else
  echo ">> Brak requirements.txt – instaluję fallback (requests, pytz, Pillow, bleak)"
  cat > "$WORKDIR/requirements.fallback.txt" <<'EOF'
requests
pytz
Pillow
bleak
EOF
  python -m pip install -r "$WORKDIR/requirements.fallback.txt"
fi

# --- Ścieżki buildowe PyInstaller ---
DIST_DIR="$WORKDIR/dist"; BUILD_DIR="$WORKDIR/build"; SPEC_DIR="$WORKDIR/spec"
mkdir -p "$DIST_DIR" "$BUILD_DIR" "$SPEC_DIR"

# --- Build binarki (onefile) + wsparcie dla bleak/BlueZ ---
# - collect-all bleak: zbiera dane i podmoduły
# - hidden-import dla backenda BlueZ na Linuksie
python -m PyInstaller \
  --onefile \
  --name "$APP_NAME" \
  --distpath "$DIST_DIR" \
  --workpath "$BUILD_DIR" \
  --specpath "$SPEC_DIR" \
  --collect-all bleak \
  --hidden-import=bleak.backends.bluezdbus \
  --hidden-import=requests \
  "$ABS_PYFILE"

BIN_PATH="$DIST_DIR/$APP_NAME"
[[ -f "$BIN_PATH" ]] || { echo "Błąd: nie zbudowano binarki"; exit 1; }

# --- Struktura .deb ---
PKG_DIR="$WORKDIR/pkg"
mkdir -p "$PKG_DIR/DEBIAN" "$PKG_DIR/usr/local/bin"

VERSION="1.0.0"
MAINTAINER="$(whoami) <$(whoami)@$(hostname -f 2>/dev/null || hostname)>"
DESCRIPTION="${APP_NAME} CLI (PyInstaller onefile)"

cat > "$PKG_DIR/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: ${MAINTAINER}
Description: ${DESCRIPTION}
EOF

install -m 0755 "$BIN_PATH" "$PKG_DIR/usr/local/bin/${APP_NAME}"

# --- Build .deb ---
OUT_DEB="$(pwd)/${APP_NAME}.deb"
dpkg-deb --build "$PKG_DIR" "$OUT_DEB" >/dev/null

echo "✅ Gotowe: $OUT_DEB"
echo "ℹ️ Instalacja: sudo dpkg -i $(basename "$OUT_DEB")"
echo "   Uruchomienie: ${APP_NAME}"