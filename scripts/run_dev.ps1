# PowerShell script to run both FastAPI backend and Vite frontend together.

$ErrorActionPreference = "Stop"

# Resolve directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectDir = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectDir

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "          PROJECT INTELLIMESH - RUN DEV SERVERS" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

# 1. Verify python virtual environment
$VenvPython = Join-Path $ProjectDir "venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "❌ Error: Virtual environment python not found at $VenvPython" -ForegroundColor Red
    Write-Host "Please create the venv first: python -m venv venv" -ForegroundColor Yellow
    Exit 1
}

# 2. Check if uvicorn is installed in venv
$CheckUvicorn = Start-Process -FilePath $VenvPython -ArgumentList "-c `"import uvicorn`"" -NoNewWindow -Wait -PassThru
if ($CheckUvicorn.ExitCode -ne 0) {
    Write-Host "❌ Error: Python packages are not fully installed in virtual environment." -ForegroundColor Red
    Write-Host "Please run: .\venv\Scripts\pip install -r backend/requirements.txt" -ForegroundColor Yellow
    Exit 1
}

# 3. Start Backend Process
Write-Host "`n[1/2] Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
$BackendProc = Start-Process -FilePath $VenvPython -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload" -PassThru -NoNewWindow

# 4. Start Frontend Process
Write-Host "`n[2/2] Launching Vite Frontend on http://localhost:5173..." -ForegroundColor Cyan
Set-Location (Join-Path $ProjectDir "frontend")

# Verify node_modules exist
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
}

$FrontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -PassThru -NoNewWindow
Set-Location $ProjectDir

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "🟢 Both servers are running!" -ForegroundColor Green
Write-Host "   - Backend:  http://localhost:8000" -ForegroundColor Gray
Write-Host "   - Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "   Press Ctrl+C inside this terminal to stop both servers." -ForegroundColor Yellow
Write-Host "=========================================================`n" -ForegroundColor Green

# Loop to monitor processes and handle graceful teardown on exit
try {
    while ($true) {
        # Check if either process has exited
        if ($BackendProc.HasExited) {
            Write-Host "⚠️ Backend server has stopped unexpectedly." -ForegroundColor Red
            break
        }
        if ($FrontendProc.HasExited) {
            Write-Host "⚠️ Frontend dev server has stopped unexpectedly." -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`n🔴 Shutting down local servers..." -ForegroundColor Yellow
    
    if ($BackendProc -and -not $BackendProc.HasExited) {
        Write-Host "Stopping backend process (PID: $($BackendProc.Id))..." -ForegroundColor Gray
        Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
    }
    
    if ($FrontendProc -and -not $FrontendProc.HasExited) {
        Write-Host "Stopping frontend process (PID: $($FrontendProc.Id))..." -ForegroundColor Gray
        Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "👋 Goodbye!`n" -ForegroundColor Green
}

