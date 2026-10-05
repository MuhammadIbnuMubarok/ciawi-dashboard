@echo off
chcp 65001 >nul
title PIEZOMETER CIAWI - SERVER LOKAL
cd /d "%~dp0"

REM ============================================================
REM  Dashboard Ciawi + modul Piezometer, jalan di komputer ini.
REM  Kunci isi data untuk pemakaian LOKAL (beda dengan kunci
REM  produksi di Vercel, jadi data uji tidak bercampur).
REM ============================================================
set CCTV_UPLOAD_KEY=ciawi-lokal
set PORT=8090

echo.
echo  ================================================================
echo    DASHBOARD CIAWI  +  MODUL PIEZOMETER
echo  ================================================================
echo.
echo    Alamat          : http://localhost:8090
echo    Langsung panel  : http://localhost:8090/#piezometer
echo    Kunci isi data  : ciawi-lokal
echo.
echo    Penyimpanan     : data\piezo-local.json (lokal, aman untuk uji)
echo    Riwayat         : 32.034 pembacaan sudah tersedia
echo.
echo    Browser akan terbuka otomatis dalam 3 detik.
echo    Tutup jendela ini atau tekan Ctrl+C untuk berhenti.
echo  ================================================================
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:8090/#piezometer'"

node "tools\dev-server.js"

echo.
echo  Server berhenti.
pause
