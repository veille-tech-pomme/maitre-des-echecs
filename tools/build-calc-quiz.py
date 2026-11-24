# Audit Magnus C2 : entraînement au calcul sur des positions NON forcées. Parmi les positions des cours (puzzles Lichess CC0),
# on garde celles dont le coup gagnant est tranquille (ni échec ni prise) et où au moins deux coups « tentants » (échecs ou prises)
# échouent nettement (≥ 2 pions de moins, Stockfish 17.1 prof. 20). Sortie : tools/data/calc-quiz.json.
import json, chess, chess.engine, random
d = json.load(open('src/data/lessons/course-data.json'))['examples']
eng = chess.engine.SimpleEngine.popen_uci('/tmp/sf'); eng.configure({'Threads': 4})
FR = str.maketrans({'K': 'R', 'Q': 'D', 'R': 'T', 'B': 'F', 'N': 'C'})
out = []; seen = set()
cands = [e for th, l in d.items() for e in l if 1300 <= e['r'] <= 2100]
random.Random(7).shuffle(cands)
for e in cands:
    if e['id'] in seen: continue
    b = chess.Board(e['fen']); b.push_san(e['pre'][0]); m0 = b.parse_san(e['line'][0])
    if b.is_capture(m0) or b.gives_check(m0): continue
    info = eng.analyse(b, chess.engine.Limit(depth=20), multipv=12)
    sc = lambda i: i['score'].pov(b.turn).score(mate_score=10000)
    best = info[0]
    if best['pv'][0] != m0 or len(info) < 3: continue
    if sc(info[1]) > sc(best) - 150: continue  # coup gagnant unique
    tempt = [i for i in info[1:] if (b.is_capture(i['pv'][0]) or b.gives_check(i['pv'][0])) and sc(i) <= sc(best) - 200]
    if len(tempt) < 2: continue
    seen.add(e['id'])
    alts = [b.san(i['pv'][0]) for i in tempt[:2]]
    ref = [b.variation_san(i['pv'][:4]).translate(FR) for i in tempt[:2]]
    out.append({'id': e['id'], 'fen': b.fen(), 'best': b.san(m0), 'pv': b.variation_san(best['pv'][:5]).translate(FR), 'alts': alts, 'refs': ref, 'scores': [sc(best)] + [sc(i) for i in tempt[:2]], 'r': e['r']})
    print(out[-1], flush=True)
    if len(out) >= 4: break
eng.quit(); json.dump(out, open('tools/data/calc-quiz.json', 'w'), ensure_ascii=False, indent=1)
