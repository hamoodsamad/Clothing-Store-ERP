@echo off
title Clothing Store - ERP System
color 0A

echo ======================================================================
echo    CLOTHING STORE ERP SYSTEM
echo    Enterprise Retail Point of Sale & Inventory Core
echo ======================================================================
echo.
echo [1] Initializing ERP Server on port 8080...
echo [2] Opening Web Browser to http://localhost:8080...
echo.
echo Direct URL: http://localhost:8080
echo.

start http://localhost:8080
python "%~dp0run_server.py"

pause