#!/usr/bin/env bash
# bili-download installer (macOS / Linux / Git Bash)
# Usage: bash install.sh
set -e
echo "Installing bili-download..."

# 1. yt-dlp (国内若 github 慢,可在 URL 前加 gh proxy,见 install.ps1 的 $Sources)
if [ ! -f yt-dlp ] && [ ! -f yt-dlp.exe ]; then
    echo "Downloading yt-dlp..."
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp || \
      echo "  download failed (network?). Get manually: https://github.com/yt-dlp/yt-dlp/releases"
    chmod +x yt-dlp 2>/dev/null || true
else echo "yt-dlp exists, skip"; fi

# 2. ffmpeg (跨平台: brew/apt 装最省事,或手动放同目录)
if ! command -v ffmpeg >/dev/null 2>&1 && [ ! -f ffmpeg ] && [ ! -f ffmpeg.exe ]; then
    echo "ffmpeg NOT found. Install via 'brew install ffmpeg' / 'apt install ffmpeg', or put ffmpeg+ffprobe here"
fi

# 3. 注册 Claude skill: 软链整个目录到 ~/.claude/skills/(纯 skill 决策,取代旧版复制副本)
SKILL_DIR="$HOME/.claude/skills/bili-download"
if [ -e "$SKILL_DIR" ]; then
    echo "Skill dir exists ($SKILL_DIR), skip"
else
    ln -s "$PWD" "$SKILL_DIR" && echo "Symlinked -> $SKILL_DIR" || \
      echo "  symlink failed, manual: ln -s \"$PWD\" \"$SKILL_DIR\""
fi

echo ""
echo "=== Next steps ==="
echo "  1. node scripts/login.js        (scan QR with phone Bilibili app -> cookies.txt)"
echo "  2. node scripts/bili_download.js <UID/BV>   (download collections)"
echo ""
echo "In Claude Code, just say: download collections of space.bilibili.com/<UID>"
