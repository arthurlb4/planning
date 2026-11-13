# Médiathèque personnelle sur PC Windows

Sonarr (séries), Radarr (films), Prowlarr (sans indexeur), qBittorrent et Jellyfin, installés et reliés entre eux.
**Aucun indexeur n'est configuré** : rien n'est cherché ni téléchargé automatiquement sur des sites de torrents.
Vous ajoutez vous-même vos torrents (fichiers dont vous avez les droits) ; Sonarr et Radarr rangent et renomment, Jellyfin
présente la bibliothèque.

## Installation

1. Mettez les fichiers `Installer.cmd` et `installer.ps1` dans un même dossier.
2. Double-cliquez sur **Installer.cmd** et acceptez la demande des droits d'administrateur
   (les gestionnaires s'installent comme services Windows, démarrés avec le PC).
3. Laissez faire (quelques minutes). Le script peut être relancé sans risque : ce qui est déjà fait est sauté.

Dossiers créés : `Médiathèque\Films`, `Médiathèque\Séries`, `Médiathèque\Téléchargements` dans votre dossier utilisateur.

## Adresses (dans le navigateur du PC)

| Logiciel    | Adresse                 | Rôle |
|-------------|-------------------------|------|
| Jellyfin    | http://localhost:8096   | votre bibliothèque, avec affiches ; lisible sur télé, téléphone, navigateur |
| Radarr      | http://localhost:7878   | films : suivi, renommage, rangement dans `Films` |
| Sonarr      | http://localhost:8989   | séries : épisodes, renommage, rangement dans `Séries` |
| qBittorrent | http://127.0.0.1:8085   | vos torrents (interface web, seulement depuis ce PC) |
| Prowlarr    | http://localhost:9696   | installé, laissé vide (aucun indexeur) |

## À faire une fois après l'installation

1. **Sonarr, Radarr, Prowlarr** : à la première ouverture, ils demandent de créer un identifiant et un mot de passe
   (choisissez « Formulaire » et « Désactivé pour les adresses locales » si vous ne les ouvrez que depuis ce PC).
2. **Jellyfin** : l'assistant de première configuration s'ouvre. Créez votre compte, puis ajoutez deux bibliothèques :
   - type **Films** → dossier `Médiathèque\Films`
   - type **Séries** → dossier `Médiathèque\Séries`
   Langue des métadonnées : Français, pays : France.
3. **Vos fichiers existants** : dans Radarr (Films › Importer une bibliothèque) et Sonarr (Séries › Importer), indiquez
   les dossiers où sont déjà vos vidéos ; ils les reconnaissent et peuvent les renommer et les déplacer proprement.

## Au quotidien

- **Un torrent à vous** : ajoutez-le dans qBittorrent avec la catégorie `films` ou `series`. Une fois terminé, Radarr ou
  Sonarr le reconnaît, le renomme (« Titre (Année).mkv », « Série - S01E02 - Titre.mkv ») et le range ; Jellyfin
  l'affiche dans la foulée.
- **Lire** : Jellyfin dans le navigateur, sur la télé (application Jellyfin) ou l'iPhone (application Jellyfin, ou
  Infuse / Swiftfin). La connexion au Lecteur IPTV peut être ajoutée ensuite.

## En cas de souci

- Le script affiche une ligne jaune « ! » quand une étape n'a pas pu se faire. Relancez-le ; si ça persiste, faites
  l'étape à la main :
  - **Radarr / Sonarr › Paramètres › Gestion des médias › Dossiers racines** : `Médiathèque\Films` / `Médiathèque\Séries`
  - **Radarr / Sonarr › Paramètres › Clients de téléchargement › + › qBittorrent** : hôte `127.0.0.1`, port `8085`,
    catégorie `films` / `series`, sans identifiant.
- **Désinstaller** : Paramètres Windows › Applications, ou `winget uninstall TeamSonarr.Sonarr` (même chose avec
  `TeamRadarr.Radarr`, `TeamProwlarr.Prowlarr`, `qBittorrent.qBittorrent`, `Jellyfin.Server`). Vos fichiers ne sont
  pas touchés.
