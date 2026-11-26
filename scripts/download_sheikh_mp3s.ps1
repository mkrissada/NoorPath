# Optional helper script to download all 101 MP3 files of Sheikh Abdallah Humeid Al-Hadhramiy
# into public/audio/sheikh-abdallah/ for 100% local offline playback without external streaming.

$ErrorActionPreference = "Stop"
$manifestPath = Join-Path $PSScriptRoot "..\public\data\audio\sheikh-abdallah-humeid.json"
$outDir = Join-Path $PSScriptRoot "..\public\audio\sheikh-abdallah"

if (-not (Test-Path $manifestPath)) {
    Write-Error "Manifest not found at $manifestPath. Run 'python scripts/build_datasets.py' first."
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

$total = 0
$downloaded = 0
foreach ($prop in $manifest.surahs.PSObject.Properties) {
    foreach ($track in $prop.Value) {
        $total++
        $dest = Join-Path $outDir $track.filename
        if (Test-Path $dest) {
            Write-Host "[$total] Skip (exists): $($track.filename)"
            continue
        }
        Write-Host "[$total] Downloading: $($track.filename)"
        curl.exe -L -s -o $dest $track.remoteUrl
        $downloaded++
    }
}

Write-Host "Complete! Total tracks: $total, Newly downloaded: $downloaded"
