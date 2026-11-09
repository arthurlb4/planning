# Top 10 Netflix en France : à partir des classements hebdomadaires publiés par Netflix (fichier « all-weeks-countries »
# du site Netflix Top 10), garde la dernière semaine pour la France, films et séries.
# Usage : python3 scripts/build-netflix.py all-weeks-countries.tsv > netflix.json
#   {"week": "2026-11-02", "films": [{"r": 1, "t": "Titre", "s": ""}, ...], "tv": [{"r": 1, "t": "Série", "s": "Série : Saison 2"}, ...]}
import csv, json, sys

def main():
    rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8', errors='replace'), delimiter='\t'))
    fr = [r for r in rows if (r.get('country_iso2') or '').upper() == 'FR']
    if not fr: raise SystemExit('aucune ligne pour la France')
    week = max(r['week'] for r in fr)
    out = {'week': week, 'films': [], 'tv': []}
    for r in fr:
        if r['week'] != week: continue
        cat = 'tv' if (r.get('category') or '').strip().lower() in ('tv', 'séries', 'series', 'shows') else 'films'
        try: rank = int(r.get('weekly_rank') or 0)
        except ValueError: rank = 0
        t = (r.get('show_title') or '').strip()
        s = (r.get('season_title') or '').strip()
        if s.upper() == 'N/A': s = ''
        if t: out[cat].append({'r': rank, 't': t, 's': s})
    for k in ('films', 'tv'): out[k].sort(key=lambda x: x['r'])
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
