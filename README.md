# franceinfoplanning.com : deux applis

| Dossier | Appli | Publiée sur |
|---|---|---|
| [`planning/`](planning) | **Planning** : l'appli de planning (agenda des vacations, échanges, admin, paie) | franceinfoplanning.com (racine), `/app/`, `/admin/` |
| [`lecteur/`](lecteur) | **Lecteur IPTV** : page web, appli Windows, appli Samsung TV, médiathèque | franceinfoplanning.com/iptv/, versions `iptv-desktop` et `iptv-tv` |
| [`worker/`](worker) | serveur Cloudflare commun aux deux (API du planning, synchro et relais du lecteur) | planning-gcal…workers.dev |
| [`scripts/check.js`](scripts/check.js) | contrôle de syntaxe des deux applis et du serveur, avant chaque publication | |

## planning/
- `index.html`, `app/`, `admin/`, `paie/` : les pages ; `tests/` : contrôles des calculs, du mail et des écrans ; `scripts/bump.js` : numéro de version.

## lecteur/
- `iptv/` : le lecteur (page web, chargée aussi par les applis Windows et télé)
- `desktop/` : appli Windows (Electron : conversion ffmpeg, VLC, torrents)
- `tv/` : appli Samsung TV (Tizen)
- `mediatheque/` : installation de la médiathèque personnelle sur PC Windows (Sonarr, Radarr, Prowlarr, qBittorrent, Jellyfin)
- `scripts/` : agenda sport, guide TV, top Netflix, listes Wikipédia (tâche GitHub toutes les 3 h), version télé et signature

## Publication (GitHub Actions)
- `pages.yml` : le site (les deux applis) à chaque envoi sur `main`
- `desktop.yml`, `tv.yml` : appli Windows et appli télé (quand `lecteur/` change)
- `agenda.yml` : agenda sport, guide TV, top Netflix, Wikipédia (toutes les 3 h)
- `deploy-worker.yml` : le serveur Cloudflare (quand `worker/` change)
