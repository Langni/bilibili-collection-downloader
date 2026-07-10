# bili-download installer (Windows PowerShell) — 国内镜像 + 多源 fallback
# Usage: powershell -ExecutionPolicy Bypass -File install.ps1
$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"   # 关闭 Invoke-WebRequest 进度条(否则极慢)
Write-Host "Installing bili-download dependencies..." -ForegroundColor Cyan

# 国内镜像 + 多源 fallback(2026-07-10 实测,按速度排序;代理失效时逐个回退)
# gh proxy 公共服务易挂,故每个二进制留 3 个互备;ffmpeg 用 github 上的 BtbN 构建
# (gh proxy 只代理 github.com,不代理 gyan.dev —— 经实测 gyan@ghfast 返 403)
$Sources = @{
    ytdlp = @(
        "https://gh-proxy.com/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        "https://ghfast.top/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        "https://ghproxy.net/https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"   # 官方兜底(国内通常不通)
    )
    ffmpeg = @(
        "https://gh-proxy.com/https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        "https://ghfast.top/https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        "https://ghproxy.net/https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    )
}

# ---- 多源 fallback 下载(逐个尝试,首个成功即停) ----
function Get-FromSources {
    param([string[]]$Urls, [string]$OutFile)
    foreach ($u in $Urls) {
        if ($u -notmatch '^https?://') { continue }   # 跳过未替换的占位
        try {
            Write-Host "  try: $u"
            Invoke-WebRequest $u -OutFile $OutFile -UseBasicParsing -TimeoutSec 90
            if ((Test-Path $OutFile) -and (Get-Item $OutFile).Length -gt 1KB) {
                $mb = [math]::Round((Get-Item $OutFile).Length / 1MB, 1)
                Write-Host "  OK ($mb MB)" -ForegroundColor Green
                return $true
            }
            Remove-Item $OutFile -Force -ErrorAction SilentlyContinue
        } catch { Write-Host "  fail: $($_.Exception.Message)" -ForegroundColor DarkGray }
    }
    return $false
}

# 1. yt-dlp.exe
Write-Host "`n[1/2] yt-dlp.exe" -ForegroundColor Cyan
if (Test-Path "yt-dlp.exe") { Write-Host "  exists, skip" }
elseif (Get-FromSources $Sources.ytdlp "yt-dlp.exe") { }
else { Write-Host "  ALL SOURCES FAILED — 手动下: https://github.com/yt-dlp/yt-dlp/releases" -ForegroundColor Red }

# 2. ffmpeg.exe + ffprobe.exe (zip 解压取 bin/)
Write-Host "`n[2/2] ffmpeg + ffprobe" -ForegroundColor Cyan
if ((Test-Path "ffmpeg.exe") -and (Test-Path "ffprobe.exe")) { Write-Host "  exists, skip" }
else {
    $zip = "$env:TEMP\bili-ffmpeg.zip"
    $tmp = "$env:TEMP\bili-ffmpeg"
    if (Get-FromSources $Sources.ffmpeg $zip) {
        Expand-Archive $zip -DestinationPath $tmp -Force
        Copy-Item "$tmp\*\bin\ffmpeg.exe"  . -Force
        Copy-Item "$tmp\*\bin\ffprobe.exe" . -Force
        Remove-Item $zip, $tmp -Recurse -Force
        Write-Host "  ffmpeg OK" -ForegroundColor Green
    } else { Write-Host "  ALL SOURCES FAILED — 手动下: https://github.com/BtbN/FFmpeg-Builds/releases" -ForegroundColor Red }
}

# 3. 注册 Claude skill(目录 junction,符合 Q1 纯 skill 决策;旧版"复制副本"已弃用)
Write-Host "`n[skill] 注册到 Claude" -ForegroundColor Cyan
$skillDir = Join-Path $env:USERPROFILE ".claude\skills\bili-download"
if (Test-Path $skillDir) { Write-Host "  $skillDir 已存在(可能是软链),跳过" }
else {
    cmd /c mklink /J "$skillDir" "$PWD" | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "  junction -> $PWD" -ForegroundColor Green }
    else { Write-Host "  mklink 失败,手动跑: New-Item -ItemType Junction -Path '$skillDir' -Target '$PWD'" -ForegroundColor Yellow }
}

Write-Host "`n=== Next ===" -ForegroundColor Cyan
Write-Host "  node scripts/login.js                  # 扫码登录 -> cookies.txt"
Write-Host "  node scripts/bili_download.js <UID/BV> # 下载合集或单视频"
