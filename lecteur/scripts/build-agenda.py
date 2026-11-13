# Agenda sport du lecteur IPTV : à partir du guide TV libre XML TV Fr (https://xmltvfr.fr, chaînes accessibles en France),
# garde les retransmissions sportives (directs et premières diffusions, sans magazines ni rediffusions) des chaînes sport
# et des grandes chaînes gratuites, sur les 5 jours du guide, et regroupe un même match diffusé sur plusieurs chaînes.
# Usage : python3 lecteur/scripts/build-agenda.py [fichier .xml.gz déjà téléchargé] > agenda.json
import gzip, io, json, re, sys, time, unicodedata, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
PARIS = ZoneInfo('Europe/Paris')

URL = 'https://xmltvfr.fr/xmltv/xmltv_fr.xml.gz'
# Chaînes retenues (identifiants du guide)
SPORT_CH = re.compile(r'^(CanalPlus(Sport|Sport360|Foot|PremierLeague|Ligue1|Live\d+)?|beINSPORTS(\d|MAX\d+)|RMCSport\d|RMCSportUHD|Eurosport[12]|LEquipe21|Ligue1Plus\d*|DAZN|InfosportPlus|GolfPlus|ABMoteurs|SportEnFrance|EvenementsSports4KUHD'
                      r'|TF1|France2|France3|France4|France5|M6|W9|TMC|TFX|RMCStory|RMCDecouverte|Arte|6ter|C8|NRJ12|CStar|Gulli|LCP|TV5Monde)\.fr$')
# Catégories de retransmissions (pas les magazines ni documentaires)
NOT_EVENT = re.compile(r'magazine|mag |review|preview|documentaire|emission|émission|talk|plateau|débrief|debrief|avant-match|après-match|résumé|best of|jeu|série|film|culture|météo|pas de diffusion|indéterminé', re.I)
SPORTS = [('Football', r'football(?! américain)|soccer|ligue 1|ligue des champions|ligue europa|premier league|liga|serie a|bundesliga|coupe de france|première ligue'),
          ('Rugby', r'rugby|top 14|pro d2|champions cup|six nations'), ('Tennis', r'tennis|atp|wta|roland|wimbledon|masters'),
          ('Basket', r'basket'), ('Sports mécaniques', r'formule|f1|automobilisme|moto|rallye|endurance|nascar|indycar|wec'),
          ('Cyclisme', r'cyclisme|tour de|vuelta|giro'), ('Handball', r'handball'), ('Golf', r'golf'),
          ('Sports de combat', r'boxe|mma|arts martiaux|ufc|catch|judo'), ('Sports US', r'football américain|nfl|nhl|hockey|baseball|mlb'),
          ('Athlétisme', r'athlétisme|marathon'), ('Sports d\'hiver', r'ski|biathlon|patinage|luge'), ('Volley', r'volley'), ('Natation', r'natation|plongeon')]

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

# Clé d'un match, insensible aux variantes d'écriture d'une chaîne à l'autre : « Toulon / Stade Français Paris » = « Toulon / Stade Français »
STOP = set('fc sc ac as us rc sm cf afc ssc sv vfl tsg le la les l de du des club olympique stade sporting racing real athletic union paris'.split())
def match_key(m):
    sides = []
    for side in m.split('/')[:2]:
        w = [x for x in norm(side).split() if x not in STOP] or norm(side).split()
        sides.append((w[0] if w else '')[:5])
    return '/'.join(sides)

def ts(v):  # « 20261113184500 +0100 » → millisecondes
    return int(datetime.strptime(v, '%Y%m%d%H%M%S %z').timestamp() * 1000)

def main():
    raw = open(sys.argv[1], 'rb').read() if len(sys.argv) > 1 else urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': 'lecteur-iptv-agenda (franceinfoplanning.com)'}), timeout=120).read()
    now = time.time() * 1000
    names, events = {}, {}
    for _, el in ET.iterparse(io.BytesIO(gzip.decompress(raw)), events=('end',)):
        if el.tag == 'channel':
            names[el.get('id')] = (el.findtext('display-name') or el.get('id')).strip(); el.clear(); continue
        if el.tag != 'programme': continue
        ch = el.get('channel', '')
        if not SPORT_CH.match(ch): el.clear(); continue
        cats = [c.text or '' for c in el.findall('category')]
        title = (el.findtext('title') or '').strip(); sub = (el.findtext('sub-title') or '').strip(); desc = (el.findtext('desc') or '').strip()
        if ' | ' in title:                                   # « Football : Ligue 3 | Aubagne / Amiens »
            title, extra = [x.strip() for x in title.split(' | ', 1)]
            if not sub or ('/' in extra and '/' not in sub): sub = extra
        rerun = el.find('previously-shown') is not None
        start, end = ts(el.get('start')), ts(el.get('stop'))
        el.clear()
        # En France un direct commence à une minute ronde (20 h 45, 21 h, 13 h 55…) ; une rediffusion tombe n'importe quand (8 h 53).
        # Ces indices ne servent qu'à juger la première diffusion connue d'un match (voir plus bas).
        odd = datetime.fromtimestamp(start / 1000, timezone.utc).minute % 5 != 0
        if not cats or any(NOT_EVENT.search(c) for c in cats) or NOT_EVENT.search(title.split(':')[0]) or re.search(r'review|preview', title, re.I): continue
        if re.search(r'\bdoc\.|meilleurs moments|best of|résumé|les plus beaux', title + ' ' + sub, re.I): continue
        sport = next((n for n, rx in SPORTS if re.search(rx, ' '.join(cats), re.I)), None) or next((n for n, rx in SPORTS if re.search(rx, title + ' ' + sub, re.I)), None)
        if not sport and not any(re.search(r'^sport|multisports', c, re.I) for c in cats): continue
        # « Football : Ligue des champions » + « Villarreal / Paris-SG » ; ou « Vannes / Bordeaux-Bègles » + « Top 14 - 9e journée »
        comp, match = '', ''
        m = re.match(r'^([^:]{2,40}?)\s*:\s*(.+)$', title)
        if m and re.search(r'/| - ', sub): comp, match = m.group(2), sub
        elif re.search(r' / | - ', title) and len(title) < 70: comp, match = sub, title
        else: comp, match = (m.group(2) if m else title), (sub if sub and not sub.lower().startswith(title.lower()[:12]) else '')
        match = re.sub(r'^\d+e journ[ée]e\s*:\s*', '', match).replace(' - ', ' / ').strip()
        comp = re.sub(r'^(football|rugby|tennis|basket-ball|handball|cyclisme|golf|sport)\.\s*', '', comp, flags=re.I).strip(' .')
        if not match and not re.search(r'grand prix|course|étape|etape|finale|tournoi|open|masters|championnat|coupe|qualif|essais', title + ' ' + sub, re.I): continue
        if re.match(r'^(sport|football|rugby|tennis)\.', match, re.I): match = ''
        # Un match n'est joué qu'une fois : on garde toutes ses diffusions, puis seulement la première (voir plus bas)
        key = match_key(match) if match and '/' in match else norm(title + ' ' + match) + '|' + str(int(start // (2 * 3600e3)))
        events.setdefault(key, []).append({'start': start, 'end': end, 'ch': ch, 'rerun': rerun or odd, 'sport': sport or 'Autres sports', 'comp': comp.strip(), 'match': match,
                                           'title': title, 'desc': desc[:220], 'live': bool(re.search(r'en direct|\bdirect\b|\blive\b', ' '.join([title, sub, desc]), re.I))})
    out = []
    for occ in events.values():
        occ.sort(key=lambda o: o['start'])
        first = occ[0]
        if first['end'] < now - 3 * 3600e3: continue                 # déjà joué (les diffusions suivantes sont des rediffusions)
        if first['rerun']: continue                                  # la première connue est déjà une rediffusion : joué avant le guide
        # Sports d'équipe européens : pas de direct entre minuit et midi (heure de Paris) ; c'est une rediffusion d'un match d'avant le guide
        h = datetime.fromtimestamp(first['start'] / 1000, PARIS).hour
        if first['sport'] in ('Football', 'Rugby', 'Handball', 'Volley') and 0 <= h < 12 \
           and not re.search(r'mls|libertadores|copa|sudamericana|brasil|argentin|mexi|j-league|j1|a-league|nwsl|saudi|qatar|chine|china|k-league|asie|asia', first['comp'] + ' ' + first['title'], re.I): continue
        ev = {k: first[k] for k in ('start', 'end', 'sport', 'comp', 'match', 'title', 'desc', 'live')}
        ev['ch'] = []
        for o in occ:                                                # chaînes qui le diffusent en même temps
            if o['start'] <= first['start'] + 3600e3 and not o['rerun'] and o['ch'] not in [c['id'] for c in ev['ch']]: ev['ch'].append({'id': o['ch'], 'name': names.get(o['ch'], o['ch'])})
        out.append(ev)
    out.sort(key=lambda e: e['start'])
    json.dump({'source': 'XML TV Fr (xmltvfr.fr)', 'at': int(now), 'events': out}, sys.stdout, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
