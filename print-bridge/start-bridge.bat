@echo off
REM Runs the print bridge forever, restarting it automatically if it ever
REM crashes or the network blips. Launched by a Windows Task Scheduler task
REM ("TAKSH Print Bridge") set to trigger "At startup" — see docs/printer-setup.md.

cd /d "%~dp0"
if not exist logs mkdir logs

REM Single-instance guard. Two bridges polling print_jobs at once can print the
REM same KOT twice, and both would fight over bridge.log. File handle 9 is held
REM open for the whole run; a second copy cannot open it and exits immediately.
2>nul (
  9>logs\bridge.lock (
    call :run
  )
) || (
  echo [%date% %time%] another instance is already running - exiting >> logs\bridge-skipped.log
  exit /b 1
)
exit /b 0

:run
REM npm must be invoked by full path: when cmd finds "npm" through a PATH search,
REM npm.cmd's own %%~dp0 resolves to the current directory and it fails to locate
REM its CLI. Task Scheduler can also start with a minimal PATH, so fall back to
REM the standard install locations.
set "NPM_CMD="
for /f "delims=" %%i in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%i"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%APPDATA%\npm\npm.cmd" set "NPM_CMD=%APPDATA%\npm\npm.cmd"
if not defined NPM_CMD (
  echo [%date% %time%] FATAL: npm.cmd not found - install Node.js on this PC >> logs\bridge.log
  exit /b 1
)

echo [%date% %time%] using npm at "%NPM_CMD%" >> logs\bridge.log

:loop
echo [%date% %time%] starting print bridge >> logs\bridge.log
call "%NPM_CMD%" start >> logs\bridge.log 2>&1
echo [%date% %time%] print bridge exited, restarting in 5s >> logs\bridge.log
timeout /t 5 /nobreak >nul
goto loop
