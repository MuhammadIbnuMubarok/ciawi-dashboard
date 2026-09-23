@echo off
start "PROXY 8080" powershell -NoExit -File "%~dp0proxy.ps1"
start "SERVER 5500" powershell -NoExit -File "%~dp0server-statis.ps1"
