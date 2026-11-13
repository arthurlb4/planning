# Installation d'une médiathèque personnelle sur PC Windows : Sonarr (séries), Radarr (films), Prowlarr (laissé sans
# indexeur), qBittorrent (client torrent piloté par Sonarr / Radarr pour vos propres torrents) et Jellyfin (serveur
# multimédia). Aucun indexeur n'est configuré.
#
# Ce que fait le script, dans l'ordre :
#   1. installe les cinq logiciels avec winget (le gestionnaire d'applications de Windows) ;
#   2. crée les dossiers de la médiathèque (Films, Séries, Téléchargements) ;
#   3. règle qBittorrent : interface web sur le port 8085 (accessible seulement depuis ce PC), dossier de téléchargement ;
#   4. relie Sonarr et Radarr à qBittorrent et à leurs dossiers (Séries / Films), par leur API locale.
# Il peut être relancé sans risque : ce qui est déjà fait est sauté.
#
# Lancement : double-clic sur « Installer.cmd » (demande les droits d'administrateur).

param([string]$Racine = (Join-Path $env:USERPROFILE 'Médiathèque'))

$ErrorActionPreference = 'Continue'
function Etape($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "   ok  $t" -ForegroundColor Green }
function Attention($t) { Write-Host "   !   $t" -ForegroundColor Yellow }

# Droits d'administrateur (les trois gestionnaires s'installent comme services Windows)
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Racine `"$Racine`""
  exit
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host 'winget est introuvable. Installez « App Installer » depuis le Microsoft Store, puis relancez.' -ForegroundColor Red
  Read-Host 'Entrée pour fermer'; exit 1
}

# 1. Logiciels
Etape 'Installation des logiciels (quelques minutes)'
$paquets = [ordered]@{ 'TeamSonarr.Sonarr' = 'Sonarr'; 'TeamRadarr.Radarr' = 'Radarr'; 'TeamProwlarr.Prowlarr' = 'Prowlarr'; 'qBittorrent.qBittorrent' = 'qBittorrent'; 'Jellyfin.Server' = 'Jellyfin' }
foreach ($id in $paquets.Keys) {
  $deja = winget list --id $id --exact --accept-source-agreements 2>$null | Select-String -SimpleMatch $id
  if ($deja) { Ok "$($paquets[$id]) déjà installé"; continue }
  winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "$($paquets[$id]) installé" } else { Attention "$($paquets[$id]) : installation à vérifier (code $LASTEXITCODE)" }
}

# 2. Dossiers
Etape "Dossiers de la médiathèque : $Racine"
$films = Join-Path $Racine 'Films'; $series = Join-Path $Racine 'Séries'; $dl = Join-Path $Racine 'Téléchargements'
foreach ($d in @($films, $series, $dl)) { New-Item -ItemType Directory -Force -Path $d | Out-Null; Ok $d }

# 3. qBittorrent : interface web (pour Sonarr / Radarr), seulement depuis ce PC, sans mot de passe en local
Etape 'Réglage de qBittorrent'
Get-Process qbittorrent -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$qdir = Join-Path $env:APPDATA 'qBittorrent'; $ini = Join-Path $qdir 'qBittorrent.ini'
New-Item -ItemType Directory -Force -Path $qdir | Out-Null
$lignes = @(if (Test-Path $ini) { Get-Content $ini -Encoding UTF8 })
$voulu = [ordered]@{
  'WebUI\Enabled' = 'true'; 'WebUI\Port' = '8085'; 'WebUI\Address' = '127.0.0.1'; 'WebUI\LocalHostAuth' = 'false'
  'Downloads\SavePath' = ($dl -replace '\\', '/') + '/'; 'Session\DefaultSavePath' = ($dl -replace '\\', '/') + '/'
}
$lignes = [System.Collections.ArrayList]@($lignes)
$pref = $lignes.IndexOf('[Preferences]'); if ($pref -lt 0) { [void]$lignes.Add('[Preferences]'); $pref = $lignes.Count - 1 }
foreach ($k in $voulu.Keys) {
  $i = -1; for ($j = 0; $j -lt $lignes.Count; $j++) { if ($lignes[$j] -like "$k=*") { $i = $j; break } }
  if ($i -ge 0) { $lignes[$i] = "$k=$($voulu[$k])" } else { $lignes.Insert($pref + 1, "$k=$($voulu[$k])") }
}
[IO.File]::WriteAllLines($ini, [string[]]$lignes, (New-Object Text.UTF8Encoding $false))   # sans marque UTF-8 (qBittorrent)
Ok 'interface web : http://127.0.0.1:8085 (sans mot de passe depuis ce PC)'
$qexe = Join-Path $env:ProgramFiles 'qBittorrent\qbittorrent.exe'
if (Test-Path $qexe) { Start-Process $qexe; Ok 'qBittorrent lancé' } else { Attention 'qBittorrent introuvable : lancez-le une fois à la main' }

# 4. Sonarr et Radarr : dossier racine et client de téléchargement, par leur API locale
function CleApi($nom) {
  $cfg = Join-Path $env:ProgramData "$nom\config.xml"
  for ($k = 0; $k -lt 60 -and -not (Test-Path $cfg); $k++) { Start-Sleep 2 }
  if (-not (Test-Path $cfg)) { return $null }
  return ([xml](Get-Content $cfg)).Config.ApiKey
}
function Attendre($url, $cle) {
  for ($k = 0; $k -lt 60; $k++) { try { Invoke-RestMethod "$url/system/status" -Headers @{ 'X-Api-Key' = $cle } -TimeoutSec 5 | Out-Null; return $true } catch { Start-Sleep 3 } }
  return $false
}
function Relier($nom, $port, $dossier, $champCat, $cat) {
  Etape "Réglage de $nom"
  Start-Service $nom -ErrorAction SilentlyContinue
  $cle = CleApi $nom
  if (-not $cle) { Attention "$nom : clé d'API introuvable (le service a-t-il démarré ?). Réglage à faire à la main, voir le guide."; return }
  $api = "http://localhost:$port/api/v3"; $h = @{ 'X-Api-Key' = $cle }
  if (-not (Attendre $api $cle)) { Attention "$nom ne répond pas sur le port $port. Réglage à faire à la main, voir le guide."; return }
  try {
    $racines = Invoke-RestMethod "$api/rootfolder" -Headers $h
    if (-not ($racines | Where-Object { $_.path -eq $dossier })) { Invoke-RestMethod "$api/rootfolder" -Method Post -Headers $h -ContentType 'application/json' -Body (@{ path = $dossier } | ConvertTo-Json) | Out-Null }
    Ok "dossier : $dossier"
  } catch { Attention "dossier non ajouté : $($_.Exception.Message)" }
  try {
    $clients = Invoke-RestMethod "$api/downloadclient" -Headers $h
    if (-not ($clients | Where-Object { $_.implementation -eq 'QBittorrent' })) {
      $corps = @{ name = 'qBittorrent'; implementation = 'QBittorrent'; configContract = 'QBittorrentSettings'; protocol = 'torrent'; enable = $true; priority = 1
        fields = @(@{ name = 'host'; value = 'localhost' }, @{ name = 'port'; value = 8085 }, @{ name = 'useSsl'; value = $false }, @{ name = $champCat; value = $cat }) } | ConvertTo-Json -Depth 5
      Invoke-RestMethod "$api/downloadclient" -Method Post -Headers $h -ContentType 'application/json' -Body $corps | Out-Null
    }
    Ok 'client de téléchargement : qBittorrent'
  } catch { Attention "qBittorrent non relié : $($_.Exception.Message)" }
  Ok "interface : http://localhost:$port"
}
Relier 'Sonarr' 8989 $series 'tvCategory' 'series'
Relier 'Radarr' 7878 $films 'movieCategory' 'films'

Etape 'Prowlarr'
Start-Service 'Prowlarr' -ErrorAction SilentlyContinue
Ok 'installé, sans aucun indexeur : http://localhost:9696'

Etape 'Jellyfin'
Ok 'première configuration dans le navigateur : http://localhost:8096 (bibliothèques Films et Séries à ajouter, voir le guide)'

Write-Host ''
Write-Host 'Terminé. Suite dans le guide (LISEZ-MOI.md) : comptes de connexion, bibliothèques Jellyfin.' -ForegroundColor Cyan
Start-Process 'http://localhost:8096'
Read-Host 'Entrée pour fermer'
