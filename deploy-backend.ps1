param(
  [string]$FrontendPath = ''
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host 'Installing dependencies...' -ForegroundColor Cyan
npm ci

Write-Host 'Building frontend...' -ForegroundColor Cyan
npm run build

if ($FrontendPath) {
  if (-not (Test-Path $FrontendPath)) {
    throw "FrontendPath does not exist: $FrontendPath"
  }

  Write-Host "Publishing dist to $FrontendPath ..." -ForegroundColor Cyan
  Copy-Item -Path (Join-Path $ProjectRoot 'dist\*') -Destination $FrontendPath -Recurse -Force
}

Write-Host 'Starting backend with PM2...' -ForegroundColor Cyan
pm2 start ecosystem.config.cjs --update-env
pm2 save

Write-Host ''
Write-Host 'Backend deployment complete.' -ForegroundColor Green
Write-Host 'Backend: http://localhost:8787/api/health' -ForegroundColor Green
if ($FrontendPath) {
  Write-Host "Frontend published to: $FrontendPath" -ForegroundColor Green
}