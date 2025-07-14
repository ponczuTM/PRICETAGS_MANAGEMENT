#!/bin/bash

set -e

PYTHON_VERSION="3.12.8"

echo "🔄 Aktualizacja systemu..."
sudo apt update && sudo apt upgrade -y

echo "📦 Instalacja zależności dla Pythona..."
sudo apt install -y \
  build-essential \
  libssl-dev \
  zlib1g-dev \
  libncurses5-dev \
  libncursesw5-dev \
  libreadline-dev \
  libsqlite3-dev \
  libgdbm-dev \
  libdb5.3-dev \
  libbz2-dev \
  libexpat1-dev \
  liblzma-dev \
  tk-dev \
  uuid-dev \
  wget \
  curl \
  git \
  yasm \
  pkg-config \
  libx264-dev \
  libx265-dev \
  libfdk-aac-dev \
  libvpx-dev \
  libmp3lame-dev \
  libopus-dev

echo "⬇️ Pobieranie Python $PYTHON_VERSION..."
cd /tmp
wget https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz

echo "📦 Rozpakowywanie..."
tar -xf Python-${PYTHON_VERSION}.tgz
cd Python-${PYTHON_VERSION}

echo "⚙️ Kompilacja Pythona (może potrwać kilka minut)..."
./configure --enable-optimizations
make -j$(nproc)

echo "🧱 Instalacja Pythona..."
sudo make altinstall

PYTHON_BIN="/usr/local/bin/python3.12"
PIP_BIN="/usr/local/bin/pip3.12"

echo "🐍 Instalacja pip oraz bibliotek Python (requests, pillow)..."
$PYTHON_BIN -m ensurepip --upgrade
$PIP_BIN install --upgrade pip
$PIP_BIN install requests pillow

echo "✅ Python $($PYTHON_BIN --version) i biblioteki zainstalowane!"

echo "⬇️ Instalacja FFmpeg (lokalnie)..."
cd /tmp
git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
cd ffmpeg
./configure --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libmp3lame --enable-libfdk-aac --enable-libopus --enable-nonfree
make -j$(nproc)
sudo make install

echo "🎞️ FFmpeg zainstalowany w $(which ffmpeg)"
ffmpeg -version

echo "✅ Wszystko gotowe!"