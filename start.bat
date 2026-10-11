@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem =============================================================================
rem  TAM / Meraqi - one-click local stack startup
rem
rem    start.bat           Docker (default): builds and starts the backend +
rem                        frontend containers from docker-compose.yml
rem    start.bat --local   Native: uvicorn from backend\.venv + `npm run dev`,
rem                        each in its own window (no Docker needed)
rem =============================================================================

cd /d "%~dp0"
set "ROOT=%CD%"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "COMPOSE_FILE=%ROOT%\docker-compose.yml"
set "DOCKER_DESKTOP=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
set "BACKEND_URL=http://localhost:8000"
set "FRONTEND_URL=http://localhost:3000"
set "HEALTH_URL=%BACKEND_URL%/health"

echo.
echo ========================================
echo   TAM local stack startup
echo ========================================
echo   Root: %ROOT%
echo.

if /i "%~1"=="--local" goto local_mode
if not "%~1"=="" (
  echo [error] Unknown option: %~1
  echo         Usage: start.bat [--local]
  exit /b 1
)

rem =============================================================================
rem  Docker mode (default)
rem =============================================================================

if not exist "%COMPOSE_FILE%" (
  echo [error] Compose file not found: %COMPOSE_FILE%
  exit /b 1
)

call :ensure_docker
if errorlevel 1 (
  echo [error] Docker is not available. Start Docker Desktop and retry,
  echo         or run natively with:  start.bat --local
  exit /b 1
)

echo [info] Building images ^(first run takes a few minutes^)...
docker compose -f "%COMPOSE_FILE%" build
if errorlevel 1 (
  echo [error] docker compose build failed. See the output above.
  exit /b 1
)

rem Backend data lives in the tam-backend-data volume (see docker-compose.yml).
rem Seed it once from backend\data - already-encrypted files are copied byte for
rem byte, never decrypted. The marker file makes every later run a no-op.
docker compose -f "%COMPOSE_FILE%" run --rm --no-deps --user root -v ./backend/data:/seed:ro backend sh -c "test -f /app/data/.seeded-from-host && exit 0; echo '[info] First Docker run: copying backend/data into the tam-backend-data volume (one-time)...'; cp -a /seed/. /app/data/ && touch /app/data/.seeded-from-host && chown -R tam:tam /app/data"
if errorlevel 1 (
  echo [error] Seeding the tam-backend-data volume failed. See the output above.
  exit /b 1
)

echo [info] Starting containers...
rem -V renews the frontend's node_modules volume from the image, so a changed
rem package.json never leaves stale dependencies behind.
docker compose -f "%COMPOSE_FILE%" up -d --renew-anon-volumes
if errorlevel 1 (
  echo [error] docker compose up failed. See the output above.
  exit /b 1
)
echo [ok]   Containers are up.

call :wait_backend_health

echo.
echo ========================================
echo   Stack is running in Docker
echo ========================================
echo   Backend API : %BACKEND_URL%
echo   API docs    : %BACKEND_URL%/docs
echo   Frontend    : %FRONTEND_URL%  ^(first page load compiles - give it a moment^)
echo.
echo   Data        : Docker volume tam-backend-data ^(separate from --local mode^)
echo.
echo   Logs : docker compose logs -f
echo   Stop : docker compose down     ^(never -v: that deletes the data volume^)
echo ========================================
echo.

start "" "%FRONTEND_URL%"
exit /b 0

rem =============================================================================
rem  Native mode (--local)
rem =============================================================================

:local_mode
if not exist "%VENV_PY%" (
  echo [error] Backend venv not found: %VENV_PY%
  echo         Run:  cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\pip install -e ".[dev]"
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [error] npm not found on PATH. Install Node.js 20+ and retry.
  exit /b 1
)
if not exist "%FRONTEND_DIR%\node_modules\" (
  echo [info] frontend\node_modules missing - running npm install...
  pushd "%FRONTEND_DIR%"
  call npm install
  if errorlevel 1 (
    echo [error] npm install failed.
    popd
    exit /b 1
  )
  popd
)

echo.
echo [info] Starting backend  (uvicorn)  on %BACKEND_URL%
start "TAM Backend" /D "%BACKEND_DIR%" cmd /k ""%VENV_PY%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo [info] Starting frontend (Next.js) on %FRONTEND_URL%
start "TAM Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev"

call :wait_backend_health

echo.
echo ========================================
echo   Stack is starting ^(native^)
echo ========================================
echo   Backend API : %BACKEND_URL%
echo   API docs    : %BACKEND_URL%/docs
echo   Frontend    : %FRONTEND_URL%
echo.
echo   Close the "TAM Backend" / "TAM Frontend" windows to stop those services.
echo ========================================
echo.

start "" "%FRONTEND_URL%"
exit /b 0

rem =============================================================================
rem  Helpers
rem =============================================================================

:wait_backend_health
echo.
echo [info] Waiting for backend health at %HEALTH_URL% ...
set /a "TRIES=0"
:wait_health_loop
set /a "TRIES+=1"
curl -fsS "%HEALTH_URL%" >nul 2>&1
if not errorlevel 1 (
  echo [ok]   Backend is healthy.
  exit /b 0
)
if !TRIES! GEQ 60 (
  echo [warn] Backend health check timed out. Check the backend logs.
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto wait_health_loop

:ensure_docker
where docker >nul 2>&1
if errorlevel 1 (
  echo [warn] Docker CLI not found on PATH.
  exit /b 1
)

docker info >nul 2>&1
if not errorlevel 1 (
  echo [ok]   Docker daemon is already running.
  exit /b 0
)

if not exist "%DOCKER_DESKTOP%" (
  echo [warn] Docker Desktop not found at:
  echo         %DOCKER_DESKTOP%
  exit /b 1
)

echo [info] Starting Docker Desktop...
start "" "%DOCKER_DESKTOP%"

set /a "TRIES=0"
:wait_docker
set /a "TRIES+=1"
docker info >nul 2>&1
if not errorlevel 1 (
  echo [ok]   Docker daemon is ready.
  exit /b 0
)
if !TRIES! GEQ 90 (
  echo [warn] Timed out waiting for Docker daemon ^(~90s^).
  exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto wait_docker
