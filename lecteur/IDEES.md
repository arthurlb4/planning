# Idées gardées pour plus tard

## Ratio du tracker privé (torrents)

Contexte : les torrents privés n'existent que sur leur tracker (empreinte unique, pas de DHT ni de trackers publics) ; ce
qui est téléchargé ailleurs ne compte pas dans le ratio privé.

- **Indexeurs publics dans Prowlarr** (Indexers › Add Indexer, type « public ») : un ou deux, pour télécharger les titres
  populaires sans entamer le ratio privé. Contreparties : plus de fausses publications ou de mauvais encodages, peu de sources
  pour les titres anciens, VPN indispensable (déjà imposé par l'appli).
- **Règle de choix du meilleur torrent** dans l'appli, au choix :
  - public d'abord : version publique prise si elle est aussi bonne (même qualité, assez de sources), privé en secours ;
  - privé d'abord : public seulement si le privé n'a rien ;
  - au cas par cas : le meilleur dans l'absolu (comportement actuel).
- **Préférer les versions freeleech** quand Prowlarr le signale (elles ne comptent pas en téléchargement).
- **cross-seed** (outil gratuit, s'appuie sur Prowlarr et qBittorrent) : pour chaque torrent terminé, cherche la même
  publication, octet pour octet, sur les trackers privés et l'ajoute en partage sans rien télécharger ; le ratio privé monte
  avec des téléchargements faits en public. Marche surtout pour les sorties des grands groupes, reprises telles quelles.
  À préparer : étapes d'installation sur le PC (à côté de Prowlarr et qBittorrent).
