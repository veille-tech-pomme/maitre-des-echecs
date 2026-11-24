# Lignes optimales (base de finales Lichess, ≤ 7 pièces) des exercices « aller à dame » : le camp fort joue le coup
# qui gagne le plus vite, la défense résiste le plus longtemps (ou suit la défense imposée de l'exercice).
# Sortie : tools/data/promo-lines.json (rejouée par tests/goal.test.ts, sans réseau).
import json, urllib.request, urllib.parse, time, chess
drills = json.load(open('/tmp/promo-drills.json'))
def tb(fen):
    for t in range(4):
        try: return json.load(urllib.request.urlopen('https://tablebase.lichess.ovh/standard?fen=' + urllib.parse.quote(fen), timeout=20))
        except Exception: time.sleep(2 + t * 3)
    raise RuntimeError(fen)
out = {}
for d in drills:
    b = chess.Board(d['fen']); me = b.turn
    if len(b.piece_map()) > 7: print('>7', d['id']); continue
    line = []; end = None
    for ply in range(200):
        key = ' '.join(b.fen().split()[:2])
        if b.turn != me and d['script'] and key in d['script']: mv = chess.Move.from_uci(d['script'][key])
        else:
            r = tb(b.fen()); time.sleep(0.25)
            mv = chess.Move.from_uci(r['moves'][0]['uci'])
        san = b.san(mv); b.push(mv); line.append(san)
        if b.is_checkmate(): end = 'mate'; break
        if mv.promotion and b.turn != me: end = 'promote'; break
        opp = [p for sq, p in b.piece_map().items() if p.color != me and p.piece_type != chess.KING]
        if not opp and b.turn == me and any(p.piece_type in (chess.QUEEN, chess.ROOK) for p in b.piece_map().values() if p.color == me): end = 'lone'; break
    if end == 'promote':  # réponse de la défense après la promotion
        r = tb(b.fen()); mv = chess.Move.from_uci(r['moves'][0]['uci']) if r['moves'] else None
        key = ' '.join(b.fen().split()[:2])
        if d['script'] and key in d['script']: mv = chess.Move.from_uci(d['script'][key])
        if mv: line.append(b.san(mv)); b.push(mv)
        after = tb(b.fen()); cat = after['category'] if b.turn == me else {'loss': 'win', 'win': 'loss'}.get(after['category'], after['category'])
    else: cat = None
    user_moves = (len([1 for i, _ in enumerate(line) if i % 2 == 0]))
    out[d['id']] = {'fen': d['fen'], 'line': line, 'end': end, 'afterCategory': cat, 'userMoves': user_moves, 'max': d['max']}
    print(d['id'], end, cat, user_moves, '/', d['max'], ' '.join(line), flush=True)
json.dump(out, open('tools/data/promo-lines.json', 'w'), ensure_ascii=False, indent=1)
