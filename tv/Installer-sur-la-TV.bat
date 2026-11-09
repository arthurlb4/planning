@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Lecteur IPTV - installation sur la TV
echo.
echo  Installation du Lecteur IPTV sur la television Samsung
echo  ------------------------------------------------------
echo  Avant : TV en mode developpeur avec l'adresse IP de ce PC, TV redemarree,
echo          PC et TV sur la meme box, VPN du PC coupe.
echo  L'adresse de la TV : Parametres ^> General ^> Reseau ^> Etat du reseau ^> Parametres IP
echo.
:ask
set "TV="
set /p TV=Adresse IP de la television (souvent 192.168.x.x) : 
if "%TV%"=="" goto :eof
echo %TV%| findstr /R "^192\.168\.[0-9]*\.[0-9]*$ ^10\.[0-9]*\.[0-9]*\.[0-9]*$ ^172\.[0-9]*\.[0-9]*\.[0-9]*$" >nul
if errorlevel 1 (
  echo.
  echo  Attention : %TV% ne ressemble pas a une adresse de box ^(192.168.x.x, 10.x.x.x ou 172.x.x.x^).
  set /p OK=Continuer quand meme ? ^(o/n^) : 
  if /I not "!OK!"=="o" goto ask
)
echo.
echo [1/4] Connexion a la TV...
sdb.exe kill-server >nul 2>&1
sdb.exe connect %TV%
sdb.exe devices | findstr /C:"%TV%" | findstr /V /C:"offline" >nul
if errorlevel 1 goto noconnect
echo [2/4] Envoi de l'appli...
sdb.exe -s %TV%:26101 shell 0 vd_appuninstall LectIPTVfr.LecteurIPTV >nul 2>&1
sdb.exe -s %TV%:26101 push LecteurIPTV.wgt /home/owner/share/tmp/sdk_tools/tmp/
echo [3/4] Installation...
sdb.exe -s %TV%:26101 shell 0 vd_appinstall LectIPTVfr.LecteurIPTV /home/owner/share/tmp/sdk_tools/tmp/LecteurIPTV.wgt > install.log 2>&1
type install.log
findstr /I "fail error invalid denied" install.log >nul
if not errorlevel 1 goto installfail
echo [4/4] Lancement...
sdb.exe -s %TV%:26101 shell 0 execute LectIPTVfr.LecteurIPTV
echo.
echo  Termine : l'appli s'ouvre sur la TV. Ensuite, elle est dans Applications
echo  (ou au bout du bandeau d'accueil) sous le nom Lecteur IPTV.
goto end
:noconnect
echo.
echo  ECHEC : impossible de joindre la TV a l'adresse %TV%. Rien n'a ete installe.
echo  Verifiez : 1. l'adresse IP de la TV (Parametres IP sur la TV)
echo             2. mode developpeur sur On avec l'IP de CE PC, puis TV redemarree
echo             3. PC et TV sur la meme box, VPN du PC coupe
echo             4. pare-feu Windows : autoriser sdb.exe sur les reseaux prives
goto end
:installfail
echo.
echo  ECHEC de l'installation (voir les lignes ci-dessus). Envoyez une photo de cette fenetre.
:end
echo.
pause
