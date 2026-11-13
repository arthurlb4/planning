# Films et séries d'après Wikipédia et Wikidata (sources libres, API officielles de Wikimedia), pour le lecteur IPTV :
#  - « top » : les films et séries les plus consultés sur Wikipédia en français ces 3 derniers jours (ce dont on parle en
#    France : sorties, films passés à la télé, succès des plateformes) ;
#  - « prix » : les films primés (Palme d'or, César, Oscar, Lion d'or, Ours d'or…).
# Chaque titre porte son identifiant TMDB (Wikidata P4947 film / P4983 série) : croisement exact avec le catalogue.
# Usage : python3 lecteur/scripts/build-wiki.py > wiki.json
#   {"at": ms, "top": [{"id": "m27205", "v": vues, "m": {"k": "m", "t": "Inception", "o": "", "y": 2010}}, ...],
#    "prix": [{"n": "Palmes d'or", "l": [{"id": "m...", "y": 2023, "m": {...}}, ...]}, ...]}
import json, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

UA = 'lecteur-iptv/1.0 (https://franceinfoplanning.com/iptv/; usage personnel)'

# Une requête à la fois, une seconde d'écart, et le délai demandé par le serveur respecté en cas de refus (429)
def get(url, data=None):
    for k in range(5):
        time.sleep(1)
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=90) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            print('  HTTP', e.code, url[:90], file=sys.stderr)
            if k == 4 or e.code not in (429, 500, 502, 503, 504): raise
            try: wait = int(e.headers.get('Retry-After') or 0)
            except ValueError: wait = 0
            time.sleep(min(90, max(wait, 5 * (k + 1))))
        except Exception:
            if k == 4: raise
            time.sleep(5 * (k + 1))

SKIP = re.compile(r'^(Spécial|Wikipédia|Portail|Aide|Catégorie|Fichier|Modèle|Projet|Discussion|Utilisateur)[:]|^Accueil', re.I)

def top_titles(days=3):
    views = {}
    today = datetime.now(timezone.utc).date()
    for d in range(1, days + 1):
        day = today - timedelta(days=d)
        try: j = get('https://wikimedia.org/api/rest_v1/metrics/pageviews/top/fr.wikipedia.org/all-access/%d/%02d/%02d' % (day.year, day.month, day.day))
        except Exception: continue
        for a in j['items'][0]['articles']:
            t = a['article']
            if not SKIP.search(t): views[t] = views.get(t, 0) + a['views']
    return views

def qids(titles):
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 50):
        part = titles[i:i + 50]
        j = get('https://fr.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'prop': 'pageprops', 'ppprop': 'wikibase_item', 'redirects': 1, 'format': 'json', 'titles': '|'.join(part)}))
        q = j.get('query', {}); back = {}
        for n in q.get('normalized', []) + q.get('redirects', []): back[n['to']] = back.get(n['from'], n['from'])
        for p in q.get('pages', {}).values():
            w = p.get('pageprops', {}).get('wikibase_item')
            if w: out[back.get(p['title'], p['title'])] = w
    return out

def claim(e, p):
    for c in e.get('claims', {}).get(p, []):
        v = c.get('mainsnak', {}).get('datavalue', {}).get('value')
        if v is not None: return v
    return None

def year_of(e):
    for p in ('P577', 'P580'):
        v = claim(e, p)
        if isinstance(v, dict) and v.get('time'):
            m = re.match(r'[+-](\d{4})', v['time'])
            if m: return int(m.group(1))
    return 0

def entities(ids):
    out = {}
    ids = list(ids)
    for i in range(0, len(ids), 50):
        j = get('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(ids[i:i + 50]), 'props': 'claims|labels', 'languages': 'fr|en', 'format': 'json'}))
        out.update(j.get('entities', {}))
    return out

def meta(e, kind, title):
    t = re.sub(r'\s*\((film|série|téléfilm|mini-série|feuilleton|série télévisée|série d\'animation)[^)]*\)$', '', title.replace('_', ' '), flags=re.I)
    o = claim(e, 'P1476'); o = o.get('text', '') if isinstance(o, dict) else ''
    return {'k': kind, 't': t, 'o': o if o and o != t else '', 'y': year_of(e)}

def build_top():
    views = top_titles()
    best = sorted(views.items(), key=lambda x: -x[1])[:800]
    q = qids([t for t, _ in best])
    ents = entities(set(q.values()))
    out = []
    for t, v in best:
        e = ents.get(q.get(t, ''))
        if not e: continue
        m, s = claim(e, 'P4947'), claim(e, 'P4983')
        if m: out.append({'id': 'm' + str(m), 'v': v, 'm': meta(e, 'm', t)})
        elif s: out.append({'id': 's' + str(s), 'v': v, 'm': meta(e, 's', t)})
    seen, res = set(), []
    for x in out:
        if x['id'] in seen: continue
        seen.add(x['id']); res.append(x)
    return res[:150]

# Prix : [titre de la rangée, élément Wikidata du prix]
PRIX = [("Palmes d'or", 'Q179808'), ('César du meilleur film', 'Q900494'), ('Oscars du meilleur film', 'Q102427'),
        ("Lions d'or de Venise", 'Q209459'), ("Ours d'or de Berlin", 'Q154590'), ('Oscars du meilleur film international', 'Q105304')]

def build_prix():
    # 1 seule requête légère (prix, film, identifiant TMDB, date), puis les titres par l'API des éléments Wikidata
    vals = ' '.join('wd:' + q for _, q in PRIX)
    sparql = 'SELECT ?film ?award ?tmdb ?d WHERE { VALUES ?award { %s } ?film p:P166/ps:P166 ?award ; wdt:P4947 ?tmdb . OPTIONAL { ?film wdt:P577 ?d } }' % vals
    j = get('https://query.wikidata.org/sparql?' + urllib.parse.urlencode({'query': sparql, 'format': 'json'}))
    by, films = {q: {} for _, q in PRIX}, set()
    for b in j['results']['bindings']:
        aw = b['award']['value'].rsplit('/', 1)[1]; tm = b['tmdb']['value']; qid = b['film']['value'].rsplit('/', 1)[1]
        y = int(b['d']['value'][:4]) if 'd' in b and re.match(r'\d{4}', b['d']['value']) else 0
        cur = by[aw].get(tm)
        if cur and cur['y'] and (not y or cur['y'] <= y): continue
        by[aw][tm] = {'id': 'm' + tm, 'y': y, 'q': qid}; films.add(qid)
    ents = entities(films)
    lab = lambda e, l: ((e or {}).get('labels', {}).get(l) or {}).get('value', '')
    out = []
    for n, q in PRIX:
        l = []
        for x in sorted(by[q].values(), key=lambda x: -x['y']):
            e = ents.get(x.pop('q')); t, o = lab(e, 'fr') or lab(e, 'en'), lab(e, 'en')
            if not t: continue
            x['m'] = {'k': 'm', 't': t, 'o': o if o != t else '', 'y': x['y']}; l.append(x)
        if l: out.append({'n': n, 'l': l})
    return out

def main():
    out = {'at': int(time.time() * 1000), 'top': [], 'prix': []}
    try: out['top'] = build_top()
    except Exception as e: print('top Wikipédia indisponible :', e, file=sys.stderr)
    try: out['prix'] = build_prix()
    except Exception as e: print('prix Wikidata indisponibles :', e, file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
