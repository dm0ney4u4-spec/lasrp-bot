$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host 'LASRP Operations - Windows setup'
Write-Host 'Use Node.js 22.12+ and Docker Desktop (or an existing PostgreSQL 16 server).'
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm run setup:env
if ($LASTEXITCODE -ne 0) { throw 'Environment setup failed' }
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Database client generation failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
Write-Host 'Next: edit config/ids.ts and .env; start PostgreSQL, run npm run db:migrate, then npm run register and npm start.'
Write-Host 'For a local credential-free database demo: npm run demo'
