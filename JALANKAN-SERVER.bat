@echo off
title SERVER DASHBOARD CIAWI :8090
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cek-port.ps1"
if errorlevel 1 goto :eof
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
