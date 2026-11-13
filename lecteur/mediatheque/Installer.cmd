@echo off
rem Installation de la mediatheque (Sonarr, Radarr, Prowlarr sans indexeur, qBittorrent, Jellyfin)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"
