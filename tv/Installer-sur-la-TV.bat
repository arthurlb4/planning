@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Lecteur IPTV - installation sur la TV
echo.
echo  Installation du Lecteur IPTV sur la television Samsung
echo  ------------------------------------------------------
echo  Avant : TV en mode developpeur avec ladresse IP de ce PC, TV redemarree,
echo          PC et TV sur la meme box, VPN du PC coupe.
echo.
set /p TV=Adresse IP de la television (ex. 192.168.1.50) : 
if "%TV%"=="" goto :eof
echo.
echo [1/4] Connexion a la TV...
sdb.exe kill-server >nul 2>&1
sdb.exe connect %TV%
echo [2/4] Envoi de lappli...
sdb.exe -s %TV%:26101 shell 0 vd_appuninstall LectIPTVfr.LecteurIPTV >nul 2>&1
sdb.exe -s %TV%:26101 push LecteurIPTV.wgt /home/owner/share/tmp/sdk_tools/tmp/
echo [3/4] Installation...
sdb.exe -s %TV%:26101 shell 0 vd_appinstall LectIPTVfr.LecteurIPTV /home/owner/share/tmp/sdk_tools/tmp/LecteurIPTV.wgt
echo [4/4] Lancement...
sdb.exe -s %TV%:26101 shell 0 execute LectIPTVfr.LecteurIPTV
echo.
echo  Termine. Lappli est dans Applications sur la TV.
echo  En cas derreur (certificat, signature, connexion), envoyez une photo de cette fenetre.
echo.
pause
