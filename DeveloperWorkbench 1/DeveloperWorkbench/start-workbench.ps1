param(
  [ValidateSet('dev', 'server', 'full')]
  [string]$Mode = 'dev'
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $projectRoot

switch ($Mode) {
  'dev' { npm run dev; break }
  'server' { npm run server; break }
  'full' { npm run dev:full; break }
}
