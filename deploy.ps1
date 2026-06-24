# Wdrożenie z automatycznym cache-bustingiem.
# Podbija ?v= w index.html na znacznik czasu, commituje i wypycha (Pages przebuduje się sam).
# Użycie:  powershell -ExecutionPolicy Bypass -File deploy.ps1 "opis zmiany"
param([string]$msg = "deploy: odswiezenie wersji zasobow")
$ErrorActionPreference = "Stop"
$repo  = $PSScriptRoot
$index = Join-Path $repo "index.html"
$ver   = Get-Date -Format "yyyyMMddHHmmss"

$text = Get-Content -Raw -LiteralPath $index
$text = [regex]::Replace($text, '\?v=\d+', "?v=$ver")
$utf8 = New-Object System.Text.UTF8Encoding($false)   # UTF-8 bez BOM
[System.IO.File]::WriteAllText($index, $text, $utf8)

git -C $repo add -A
$pending = git -C $repo status --porcelain
if (-not $pending) { Write-Output "Brak zmian do wdrozenia."; exit 0 }

$full = "$msg`n`nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git -C $repo commit -m $full
git -C $repo push
Write-Output "Wdrozono. Wersja zasobow: $ver"
