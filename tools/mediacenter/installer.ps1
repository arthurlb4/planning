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
  'Downloads\SavePath' = ($dl -replace '\\', '/') + '/'; 'Session\DefaultSavePath' = ($dl -replace '\\', '/') + '/'
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

Etape 'Prowlarr'
Start-Service 'Prowlarr' -ErrorAction SilentlyContinue
Ok 'installé, sans aucun indexeur : http://localhost:9696'

Etape 'Jellyfin'
Ok 'première configuration dans le navigateur : http://localhost:8096 (bibliothèques Films et Séries à ajouter, voir le guide)'

Write-Host ''
Write-Host 'Terminé. Suite dans le guide (LISEZ-MOI.md) : comptes de connexion, bibliothèques Jellyfin.' -ForegroundColor Cyan
Start-Process 'http://localhost:8096'
Read-Host 'Entrée pour fermer'
