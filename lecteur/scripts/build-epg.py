# Guide des programmes du lecteur IPTV : à partir du guide TV libre XML TV Fr (https://xmltvfr.fr, ~400 chaînes accessibles
# en France), garde pour chaque chaîne les programmes de 2 h avant à 30 h après maintenant, en JSON compact.
# Plus complet que le guide du serveur de l'abonnement (souvent vide ou limité au titre).
# Usage : python3 lecteur/scripts/build-epg.py fichier.xml.gz > epg.json
#   {"at": ms, "src": "...", "ch": {"TF1.fr": [[début s, fin s, titre, sous-titre, résumé, image, thème], ...]}, "k": {"tf1": "TF1.fr", ...}}
# image : numéro d'image SFR (le plus courant, adresse recomposée par la page) ou adresse complète, '' sinon ;
# thème : F film, S série, J jeunesse, P sport, I info, D documentaire, E divertissement, M magazine, X adultes, '' autre
# "k" : noms simplifiés (identifiant du guide et nom affiché) → identifiant, pour retrouver la chaîne d'une liste IPTV.
import gzip, io, json, re, sys, time, unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime

def key(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower().replace('+', ' plus ')
    return re.sub(r'[^a-z0-9]+', '', s)

# Noms d'usage différents de ceux du guide
ALIAS = {'lequipe': 'LEquipe21.fr', 'lequipetv': 'LEquipe21.fr', 'lachainelequipe': 'LEquipe21.fr', 'tfx': 'NT1.fr', 'rmclife': 'Cherie25.fr',
         'cherie25': 'Cherie25.fr', 'lcp': 'LaChaineParlementaire.fr', 'lcpan': 'LaChaineParlementaire.fr', 'franceinfo': 'FranceInfo.fr',
         'bfmtv': 'BFMTV.fr', 'dazn': 'DAZN.fr', 'dazn1': 'DAZN.fr'}

SFR = re.compile(r'^https?://static-cdn\.tv\.sfr\.net/data/img/pl/\d/\d/\d/(\d+)\.jpg$')
THEMES = [('X', r'porno|adulte'), ('J', r'anim|dessin|jeunesse|enfant'), ('S', r'^ser|serie|fiction|drama'),
          ('F', r'film|metrage|western|comedie|drame|suspense|policier'),
          ('P', r'sport|foot|rugby|tennis|golf|basket|boxe|combat|cyclisme|automobil|moto|equestre|martiaux|aerobic|poker|mecanique|handball|ski|athletisme|natation|volley'),
          ('I', r'journal|info|actualit|meteo|debat|politique|interview|economie'),
          ('D', r'documentaire|^doc|decouverte|nature|animalier|histoire|science|voyage'),
          ('E', r'divertissement|jeu|realite|variete|humour|spectacle|concert|musique|musical|clips'),
          ('M', r'magazine|^mag|emission')]

def theme(cats):
    for c in cats:
        k = unicodedata.normalize('NFKD', c or '').encode('ascii', 'ignore').decode().lower().strip()
        for t, rx in THEMES:
            if re.search(rx, k): return t
    return ''

def icon(el):
    i = el.find('icon'); src = (i.get('src') if i is not None else '') or ''
    m = SFR.match(src)
    return int(m.group(1)) if m else (src if src.startswith('https://') else '')

def ts(v):
    return int(datetime.strptime(v, '%Y%m%d%H%M%S %z').timestamp())

def main():
    raw = open(sys.argv[1], 'rb').read()
    now = int(time.time())
    lo, hi = now - 2 * 3600, now + 30 * 3600
    names, ch = {}, {}
    for _, el in ET.iterparse(io.BytesIO(gzip.decompress(raw)), events=('end',)):
        if el.tag == 'channel':
            names[el.get('id')] = (el.findtext('display-name') or '').strip(); el.clear(); continue
        if el.tag != 'programme': continue
        cid = el.get('channel', '')
        try: start, end = ts(el.get('start')), ts(el.get('stop'))
        except Exception: el.clear(); continue
        if end < lo or start > hi: el.clear(); continue
        title = (el.findtext('title') or '').strip()
        sub = (el.findtext('sub-title') or '').strip()
        desc = re.sub(r'\s+', ' ', (el.findtext('desc') or '').strip())
        img, th = icon(el), theme([c.text for c in el.findall('category')])
        el.clear()
        if not title: continue
        if len(desc) > 300: desc = desc[:297].rsplit(' ', 1)[0] + '…'
        ch.setdefault(cid, []).append([start, end, title, sub, desc, img, th])
    for l in ch.values(): l.sort(key=lambda p: p[0])
    k = {}
    for cid in ch:                                   # identifiant d'abord (« France2.fr » → france2), puis nom affiché
        base = re.sub(r'\.[a-z]{2}$', '', cid)
        if cid.endswith('.fr') or key(base) not in k: k[key(base)] = cid
    for cid in ch:
        n = key(names.get(cid, ''))
        if n and n not in k and cid.endswith('.fr'): k[n] = cid
    for a, cid in ALIAS.items():
        if cid in ch: k[a] = cid
    json.dump({'at': now * 1000, 'src': 'XML TV Fr (xmltvfr.fr)', 'ch': ch, 'k': k}, sys.stdout, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
