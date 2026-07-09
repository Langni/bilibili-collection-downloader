#!/usr/bin/env bash
# bili-download installer (macOS / Linux / Git Bash)
# Usage: bash install.sh
set -e
echo "Installing bili-download..."

# 1. yt-dlp
if [ ! -f yt-dlp ]; then
    echo "Downloading yt-dlp..."
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp || \
      echo "  download failed (network?). Get manually: https://github.com/yt-dlp/yt-dlp/releases"
    chmod +x yt-dlp 2>/dev/null || true
else echo "yt-dlp exists, skip"; fi

# 2. ffmpeg
if ! command -v ffmpeg >/dev/null 2>&1 && [ ! -f ffmpeg ]; then
    echo "ffmpeg NOT found. Install via brew install ffmpeg / apt install ffmpeg, or put ffmpeg+ffprobe here"
fi

# 3. Register Claude skill
SKILL_DIR="$HOME/.claude/skills/bili-download"
mkdir -p "$SKILL_DIR"
for f in SKILL.md bili_download.js login.js package.json; do
    [ -f "$f" ] && cp "$f" "$SKILL_DIR"
done
echo "Skill registered to: $SKILL_DIR"

echo ""
echo "=== Next steps ==="
echo "  1. node login.js        (scan QR with phone Bilibili app -> cookies.txt)"
echo "  2. node bili_download.js <UID>   (download collections)"
echo ""
echo "In Claude Code, just say: download collections of space.bilibili.com/<UID>"
