# Sélection des puzzles Lichess (CC0) : « cœur » équilibré (~52k) + packs supplémentaires (~300k).
import csv, json, collections, random
random.seed(7)
existing = {p['i'] for p in json.load(open('src/data/puzzles.json'))}
SKIP = {'short','long','veryLong','oneMove','crushing','advantage','equality','master','masterVsMaster','superGM','middlegame','endgame','opening','mate'}
bands = collections.defaultdict(list)
for r in csv.DictReader(open('tools/data/puzzles_big.csv')):
    if r['PuzzleId'] in existing: continue
    R = int(r['Rating']); pop = int(r['Popularity']); n = int(r['NbPlays']); rd = int(r['RatingDeviation'])
    edge = R < 600 or R >= 2600
    if not ((pop >= 80 and n >= 100 and rd <= 100) or (edge and pop >= 70 and n >= 40 and rd <= 110)): continue
    b = max(4, min(29, R // 100))
    o = r['OpeningTags'].split(' ')[0] if r['OpeningTags'] else ''
    bands[b].append({'i': r['PuzzleId'], 'f': r['FEN'], 'm': r['Moves'], 'r': R, 't': r['Themes'].split(), 'o': o, 'q': pop + min(n, 5000) / 250})
core, extra = [], []
CORE_PER_BAND, EXTRA_PER_BAND = 2000, 12000
for b in sorted(bands):
    L = bands[b]; random.shuffle(L); L.sort(key=lambda p: -p['q'])
    cnt = collections.Counter(t for p in L for t in p['t'] if t not in SKIP)
    chosen, seen = [], set()
    for th, _ in sorted(cnt.items(), key=lambda x: x[1]):          # thèmes rares d'abord
        k = 0
        for p in L:
            if k >= 110 or len(chosen) >= CORE_PER_BAND * 0.8: break
            if th in p['t'] and p['i'] not in seen: chosen.append(p); seen.add(p['i']); k += 1
    for p in L:
        if len(chosen) >= CORE_PER_BAND: break
        if p['i'] not in seen: chosen.append(p); seen.add(p['i'])
    core += chosen
    rest = [p for p in L if p['i'] not in seen][:EXTRA_PER_BAND]
    extra += rest
for p in core + extra: p.pop('q')
with open('tools/data/core_candidates.jsonl', 'w') as f:
    for p in core: f.write(json.dumps(p) + '\n')
with open('tools/data/extra_candidates.jsonl', 'w') as f:
    for p in extra: f.write(json.dumps(p) + '\n')
print('core', len(core), 'extra', len(extra))
print({b: len(bands[b]) for b in sorted(bands)})
