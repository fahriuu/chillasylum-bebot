#!/bin/bash

# Script untuk menjalankan Lavalink Server
# Dibuat untuk ChillAsylum BeBot

LAVALINK_DIR="$(cd "$(dirname "$0")" && pwd)"
LAVALINK_JAR="$LAVALINK_DIR/Lavalink.jar"
LAVALINK_VERSION="4.2.2"
DOWNLOAD_URL="https://github.com/lavalink-devs/Lavalink/releases/download/$LAVALINK_VERSION/Lavalink.jar"

echo "🎵 ChillAsylum BeBot - Lavalink Starter"
echo "========================================"
echo ""

# 1. Cek Java (System atau Portable tanpa sudo)
JAVA_BIN="java"
HAS_JAVA=false

if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 17 ] 2>/dev/null; then
        HAS_JAVA=true
        echo "☕ Java system ditemukan: $(java -version 2>&1 | head -n 1)"
    fi
fi

if [ "$HAS_JAVA" = false ]; then
    PORTABLE_JAVA="$LAVALINK_DIR/jre/bin/java"
    if [ -f "$PORTABLE_JAVA" ]; then
        JAVA_BIN="$PORTABLE_JAVA"
        HAS_JAVA=true
        echo "☕ Portable Java ditemukan di $PORTABLE_JAVA"
    else
        echo "⚠️  Java 17+ tidak ditemukan di sistem."
        echo "📥 Mendownload portable Java 17 (tanpa perlu sudo / root)..."
        mkdir -p "$LAVALINK_DIR/jre"
        JRE_URL="https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jre/hotspot/normal/eclipse"
        
        if command -v curl &> /dev/null; then
            curl -sL "$JRE_URL" | tar -xz -C "$LAVALINK_DIR/jre" --strip-components=1
        elif command -v wget &> /dev/null; then
            wget -qO- "$JRE_URL" | tar -xz -C "$LAVALINK_DIR/jre" --strip-components=1
        fi
        
        if [ -f "$PORTABLE_JAVA" ]; then
            JAVA_BIN="$PORTABLE_JAVA"
            HAS_JAVA=true
            echo "✅ Portable Java 17 berhasil dipasang!"
        else
            echo "❌ Gagal mendownload portable Java!"
            exit 1
        fi
    fi
fi

# 2. Download Lavalink.jar jika belum ada ATAU versi berubah
VERSION_FILE="$LAVALINK_DIR/.lavalink-version"
CURRENT_VERSION=""
if [ -f "$VERSION_FILE" ]; then
    CURRENT_VERSION=$(cat "$VERSION_FILE")
fi

if [ ! -f "$LAVALINK_JAR" ] || [ "$CURRENT_VERSION" != "$LAVALINK_VERSION" ]; then
    echo ""
    if [ -f "$LAVALINK_JAR" ]; then
        echo "🔄 Upgrading Lavalink dari $CURRENT_VERSION ke $LAVALINK_VERSION..."
        rm -f "$LAVALINK_JAR"
    else
        echo "📥 Lavalink.jar tidak ditemukan, mendownload..."
    fi
    echo "URL: $DOWNLOAD_URL"
    
    if command -v wget &> /dev/null; then
        wget -q -O "$LAVALINK_JAR" "$DOWNLOAD_URL"
    elif command -v curl &> /dev/null; then
        curl -sL -o "$LAVALINK_JAR" "$DOWNLOAD_URL"
    else
        echo "❌ wget atau curl tidak ditemukan!"
        exit 1
    fi
    
    if [ ! -f "$LAVALINK_JAR" ]; then
        echo "❌ Download Lavalink.jar gagal!"
        exit 1
    fi
    
    echo "$LAVALINK_VERSION" > "$VERSION_FILE"
    echo "✅ Download Lavalink.jar v$LAVALINK_VERSION selesai!"
fi

# 3. Cek apakah application.yml ada
if [ ! -f "$LAVALINK_DIR/application.yml" ]; then
    echo "❌ application.yml tidak ditemukan di $LAVALINK_DIR"
    exit 1
fi

# Bersihkan plugin lama
rm -f "$LAVALINK_DIR/plugins/youtube-plugin-1.18.1.jar"
rm -f "$LAVALINK_DIR/plugins/youtube-plugin-1.18.2.jar"

# 4. Jalankan Lavalink
echo ""
echo "🚀 Menjalankan Lavalink Server..."
echo "Port: 2333"
echo "Password: ChillAsylumBebot2026"
echo ""
echo "Tekan Ctrl+C untuk stop"
echo "========================================"
echo ""

cd "$LAVALINK_DIR"
exec "$JAVA_BIN" -jar "$LAVALINK_JAR"
