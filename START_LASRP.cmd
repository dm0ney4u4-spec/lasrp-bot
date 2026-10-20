@echo off
cd /d "%~dp0"
echo Starting LASRP Discord bot and CAD. Keep this window open.
call npm start
if errorlevel 1 (
 echo.
 echo Startup failed. Run npm run doctor and read docs\DISCORD_CONFIGURATION.md.
 pause
)
