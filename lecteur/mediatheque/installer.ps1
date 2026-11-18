# Installation d'une médiathèque personnelle sur PC Windows : Sonarr (séries), Radarr (films), Prowlarr (laissé sans
# indexeur), qBittorrent (client torrent piloté par Sonarr / Radarr pour vos propres torrents) et Jellyfin (serveur
# multimédia). Aucun indexeur n'est configuré.
#
# Ce que fait le script, dans l'ordre :
#   1. installe les cinq logiciels avec winget (le gestionnaire d'applications de Windows), ou les met à jour s'ils sont
#      déjà là ;
#   2. crée les dossiers de la médiathèque (Films, Séries, Téléchargements) ;
#   3. règle qBittorrent : interface web sur le port 8085 (accessible seulement depuis ce PC), dossier de téléchargement ;
#   4. relie Sonarr et Radarr à qBittorrent et à leurs dossiers (Séries / Films), par leur API locale ;
#   5. relie Prowlarr à Sonarr et Radarr (les indexeurs que vous ajoutez dans Prowlarr leur sont transmis).
# Aucun indexeur n'est ajouté : c'est à vous de le faire dans Prowlarr (identifiants de votre tracker).
# Il peut être relancé sans risque : ce qui est déjà fait est sauté.
#
# Lancement : double-clic sur « Installer.cmd », ou case cochée à la fin de l'installation du Lecteur IPTV, ou
# Paramètres › Appareils du lecteur (demande les droits d'administrateur).

# Médiathèque hors du dossier personnel : Sonarr, Radarr et Jellyfin tournent comme services Windows (compte système),
# qui ne parcourent pas C:\Users\<nom> ; noms sans accents (plus sûr pour tous les logiciels)
param([string]$Racine = 'C:\Mediatheque')

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
Etape 'Installation et mise à jour des logiciels (quelques minutes)'
$paquets = [ordered]@{ 'TeamSonarr.Sonarr' = 'Sonarr'; 'TeamRadarr.Radarr' = 'Radarr'; 'TeamProwlarr.Prowlarr' = 'Prowlarr'; 'qBittorrent.qBittorrent' = 'qBittorrent'; 'Jellyfin.Server' = 'Jellyfin' }
foreach ($id in $paquets.Keys) {
  $deja = winget list --id $id --exact --accept-source-agreements 2>$null | Select-String -SimpleMatch $id
  if ($deja) {
    # déjà là : mise à jour si une version plus récente existe (code 0x8A15002B : rien à mettre à jour)
    winget upgrade --id $id --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "$($paquets[$id]) mis à jour" }
    elseif ($LASTEXITCODE -eq -1978335189 -or $LASTEXITCODE -eq -1978335212) { Ok "$($paquets[$id]) déjà installé et à jour" }
    else { Ok "$($paquets[$id]) déjà installé (mise à jour non faite, code $LASTEXITCODE)" }
    continue
  }
  winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "$($paquets[$id]) installé" } else { Attention "$($paquets[$id]) : installation à vérifier (code $LASTEXITCODE)" }
}

# 2. Dossiers
Etape "Dossiers de la médiathèque : $Racine"
$films = Join-Path $Racine 'Films'; $series = Join-Path $Racine 'Series'; $dl = Join-Path $Racine 'Telechargements'
foreach ($d in @($films, $series, $dl)) { New-Item -ItemType Directory -Force -Path $d | Out-Null; Ok $d }
# lecture et écriture pour les utilisateurs du PC et les services (compte système)
icacls $Racine /grant '*S-1-5-32-545:(OI)(CI)M' /grant '*S-1-5-18:(OI)(CI)F' /T /Q | Out-Null
Ok 'droits : utilisateurs et services Windows'

# 3. qBittorrent : interface web (pour Sonarr / Radarr), seulement depuis ce PC, sans mot de passe en local
Etape 'Réglage de qBittorrent'
Get-Process qbittorrent -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$qdir = Join-Path $env:APPDATA 'qBittorrent'; $ini = Join-Path $qdir 'qBittorrent.ini'
New-Item -ItemType Directory -Force -Path $qdir | Out-Null
$lignes = @(if (Test-Path $ini) { Get-Content $ini -Encoding UTF8 })
# Mot de passe de l'interface web, obligatoire depuis qBittorrent 4.6 (sinon elle ne démarre pas) : gardé d'une fois sur
# l'autre dans Mediatheque\qbittorrent-mdp.txt, haché comme le fait qBittorrent (PBKDF2-SHA512, 100 000 tours)
$mdpFich = Join-Path $Racine 'qbittorrent-mdp.txt'
if (Test-Path $mdpFich) { $qmdp = (Get-Content $mdpFich -Raw).Trim() } else { $qmdp = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object { [char]$_ }); Set-Content $mdpFich $qmdp }
$sel = New-Object byte[] 16; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($sel)
$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($qmdp, $sel, 100000, [Security.Cryptography.HashAlgorithmName]::SHA512)
$hache = '@ByteArray(' + [Convert]::ToBase64String($sel) + ':' + [Convert]::ToBase64String($kdf.GetBytes(64)) + ')'
$voulu = [ordered]@{
  'WebUI\Username' = 'admin'; 'WebUI\Password_PBKDF2' = '"' + $hache + '"'
  'WebUI\Enabled' = 'true'; 'WebUI\Port' = '8085'; 'WebUI\Address' = '127.0.0.1'; 'WebUI\LocalHostAuth' = 'false'
}
# dossier de téléchargement : celui de la médiathèque, sauf si un dossier a déjà été choisi dans qBittorrent
if (-not ($lignes | Where-Object { $_ -like 'Session\DefaultSavePath=*' -or $_ -like 'Downloads\SavePath=*' })) {
  $voulu['Downloads\SavePath'] = ($dl -replace '\\', '/') + '/'; $voulu['Session\DefaultSavePath'] = ($dl -replace '\\', '/') + '/'
}
$lignes = [System.Collections.ArrayList]@($lignes)
$pref = $lignes.IndexOf('[Preferences]'); if ($pref -lt 0) { [void]$lignes.Add('[Preferences]'); $pref = $lignes.Count - 1 }
foreach ($k in $voulu.Keys) {
  $i = -1; for ($j = 0; $j -lt $lignes.Count; $j++) { if ($lignes[$j] -like "$k=*") { $i = $j; break } }
  if ($i -ge 0) { $lignes[$i] = "$k=$($voulu[$k])" } else { $lignes.Insert($pref + 1, "$k=$($voulu[$k])") }
}
# notice légale du premier lancement acceptée (sinon qBittorrent attend un clic et n'ouvre pas son interface web)
if (-not ($lignes -contains '[LegalNotice]')) { [void]$lignes.Add('[LegalNotice]'); [void]$lignes.Add('Accepted=true') }
else { $g = $lignes.IndexOf('[LegalNotice]'); $f = -1; for ($j = $g + 1; $j -lt $lignes.Count -and $lignes[$j] -notlike '[[]*'; $j++) { if ($lignes[$j] -like 'Accepted=*') { $f = $j } }; if ($f -ge 0) { $lignes[$f] = 'Accepted=true' } else { $lignes.Insert($g + 1, 'Accepted=true') } }
[IO.File]::WriteAllLines($ini, [string[]]$lignes, (New-Object Text.UTF8Encoding $false))   # sans marque UTF-8 (qBittorrent)
Ok "interface web : http://127.0.0.1:8085 (identifiant admin, mot de passe dans $mdpFich)"
$qexe = Join-Path $env:ProgramFiles 'qBittorrent\qbittorrent.exe'
if (Test-Path $qexe) { Start-Process $qexe; Ok 'qBittorrent lancé' } else { Attention 'qBittorrent introuvable : lancez-le une fois à la main' }

# 4. Sonarr et Radarr : dossier racine et client de téléchargement, par leur API locale
function CleApi($nom) {
  # service Windows (ProgramData), sinon lancé comme application (AppData) ; premier démarrage parfois long (5 min au plus)
  $cfgs = @((Join-Path $env:ProgramData "$nom\config.xml"), (Join-Path $env:LOCALAPPDATA "$nom\config.xml"), (Join-Path $env:APPDATA "$nom\config.xml"))
  if (-not (Get-Service $nom -ErrorAction SilentlyContinue)) {
    $exe = @((Join-Path $env:ProgramData "$nom\bin\$nom.exe"), (Join-Path $env:ProgramFiles "$nom\$nom.exe")) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($exe) { Start-Process $exe; Ok "$nom lancé (pas de service Windows trouvé)" }
  }
  for ($k = 0; $k -lt 150; $k++) { $c = $cfgs | Where-Object { Test-Path $_ } | Select-Object -First 1; if ($c) { break }; Start-Sleep 2 }
  if (-not $c) { return $null }
  return ([xml](Get-Content $c)).Config.ApiKey
}
# Envoi en UTF-8 (sinon PowerShell 5 abîme les accents des chemins) ; en cas de refus, le message exact du logiciel
function Poster($url, $h, $objet) {
  $octets = [Text.Encoding]::UTF8.GetBytes(($objet | ConvertTo-Json -Depth 6))
  Invoke-RestMethod $url -Method Post -Headers $h -ContentType 'application/json; charset=utf-8' -Body $octets | Out-Null
}
function Motif($e) { $m = $e.ErrorDetails.Message; if ($m) { try { $j = $m | ConvertFrom-Json; $m = (@($j) | ForEach-Object { if ($_.errorMessage) { $_.errorMessage } elseif ($_.message) { $_.message } else { $_ } }) -join ' ; ' } catch {} }; if ($m) { $m } else { $e.Exception.Message } }
function Attendre($url, $cle) {
  for ($k = 0; $k -lt 100; $k++) { try { Invoke-RestMethod "$url/system/status" -Headers @{ 'X-Api-Key' = $cle } -TimeoutSec 5 | Out-Null; return $true } catch { Start-Sleep 3 } }
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
    if (-not ($racines | Where-Object { $_.path.TrimEnd('\') -eq $dossier.TrimEnd('\') })) { Poster "$api/rootfolder" $h @{ path = $dossier } }
    Ok "dossier : $dossier"
  } catch { Attention "dossier non ajouté : $(Motif $_)" }
  try {
    $clients = Invoke-RestMethod "$api/downloadclient" -Headers $h
    if (-not ($clients | Where-Object { $_.implementation -eq 'QBittorrent' })) {
      # 127.0.0.1 et non « localhost » (que Windows peut traduire en ::1, où qBittorrent n'écoute pas)
      Poster "$api/downloadclient" $h @{ name = 'qBittorrent'; implementation = 'QBittorrent'; configContract = 'QBittorrentSettings'; protocol = 'torrent'; enable = $true; priority = 1
        fields = @(@{ name = 'host'; value = '127.0.0.1' }, @{ name = 'port'; value = 8085 }, @{ name = 'useSsl'; value = $false }, @{ name = 'username'; value = 'admin' }, @{ name = 'password'; value = $qmdp }, @{ name = $champCat; value = $cat }) }
    }
    Ok 'client de téléchargement : qBittorrent'
  } catch { Attention "qBittorrent non relié : $(Motif $_)" }
  Ok "interface : http://localhost:$port"
}
Relier 'Sonarr' 8989 $series 'tvCategory' 'series'
Relier 'Radarr' 7878 $films 'movieCategory' 'films'

# 5. Prowlarr : Sonarr et Radarr ajoutés comme applications (synchronisation complète des indexeurs)
Etape 'Réglage de Prowlarr'
Start-Service 'Prowlarr' -ErrorAction SilentlyContinue
$pcle = CleApi 'Prowlarr'
if (-not $pcle) { Attention 'Prowlarr : clé d''API introuvable (le service a-t-il démarré ?)' }
elseif (-not (Attendre 'http://localhost:9696/api/v1' $pcle)) { Attention 'Prowlarr ne répond pas sur le port 9696' }
else {
  $ph = @{ 'X-Api-Key' = $pcle }
  $apps = @(Invoke-RestMethod 'http://localhost:9696/api/v1/applications' -Headers $ph -ErrorAction SilentlyContinue)
  foreach ($a in @(@{ n = 'Radarr'; p = 7878; cats = @(2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060, 2070, 2080) }, @{ n = 'Sonarr'; p = 8989; cats = @(5000, 5010, 5020, 5030, 5040, 5045, 5050, 5070, 5080) })) {
    if ($apps | Where-Object { $_.implementation -eq $a.n }) { Ok "$($a.n) déjà relié"; continue }
    $acle = CleApi $a.n; if (-not $acle) { Attention "$($a.n) : clé d'API introuvable"; continue }
    try {
      Poster 'http://localhost:9696/api/v1/applications' $ph @{ name = $a.n; implementation = $a.n; configContract = "$($a.n)Settings"; syncLevel = 'fullSync'
        fields = @(@{ name = 'prowlarrUrl'; value = 'http://localhost:9696' }, @{ name = 'baseUrl'; value = "http://localhost:$($a.p)" }, @{ name = 'apiKey'; value = $acle }, @{ name = 'syncCategories'; value = $a.cats }) }
      Ok "$($a.n) relié (les indexeurs de Prowlarr lui sont transmis)"
    } catch { Attention "$($a.n) non relié : $(Motif $_)" }
  }
  Ok 'interface : http://localhost:9696 — ajoutez-y votre indexeur (Indexers › Add Indexer) ; le Lecteur IPTV le trouve tout seul'
}

Etape 'Jellyfin'
Ok 'première configuration dans le navigateur : http://localhost:8096 (bibliothèques Films et Séries à ajouter, voir le guide)'

Write-Host ''
Write-Host 'Terminé. Le mode d''emploi de la suite s''ouvre (indexeur dans Prowlarr, Jellyfin, VPN).' -ForegroundColor Cyan
$guide = Join-Path $PSScriptRoot 'Guide.html'
if (Test-Path $guide) { Start-Process $guide } else { Start-Process 'http://localhost:8096' }
Read-Host 'Entrée pour fermer'
