# Audit Magnus B4 : commentaires des parties célèbres.
# 1) supprime les commentaires mécaniques (« Le fou va en e7. », « Le pion prend le pion en d4. ») ;
# 2) garde les commentaires écrits (en gras, notes « le moteur moderne préférait ») ;
# 3) ajoute des moments clés vérifiés par Stockfish 17.1 (prof. 18) jusqu'à 8 à 12 par partie :
#    tournants (perte ≥ 1 pion pour le camp qui joue, avec le meilleur coup et sa suite), sacrifices qui gardent l'avantage, mats.
# Usage : python3 tools/annotate-famous.py  (Stockfish natif : $STOCKFISH ou /tmp/sf)
import json, re, os, chess, chess.engine
SF = os.environ.get('STOCKFISH') or '/tmp/sf'
P = 'src/data/lessons/course-data.json'; d = json.load(open(P))
eng = chess.engine.SimpleEngine.popen_uci(SF); eng.configure({'Threads': 8, 'Hash': 256})
FR = str.maketrans({'K': 'R', 'Q': 'D', 'R': 'T', 'B': 'F', 'N': 'C'})
fr = lambda s: s.translate(FR)
VAL = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
NAME = {chess.PAWN: 'un pion', chess.KNIGHT: 'un cavalier', chess.BISHOP: 'un fou', chess.ROOK: 'une tour', chess.QUEEN: 'la dame'}
MECH = re.compile(r"^(Le|La|Les|L’)\s?[^*]*?\b(va|avance|prend|se développe|recule|roquent|roque|se place|a avancé|s’installe|revient|monte|descend|passe)\b")
def mat(b, c): return sum(VAL[p.piece_type] for p in b.piece_map().values() if p.color == c)
def sc(info, pov):
    s = info['score'].pov(pov); return s.score(mate_score=10000)
def num(i): return f"{i // 2 + 1}." if i % 2 == 0 else f"{i // 2 + 1}…"
def line_fr(b, pv, n=4):
    bb = b.copy(); out = []
    for k, m in enumerate(pv[:n]):
        if m not in bb.legal_moves: break
        ply = bb.ply(); out.append((f"{ply // 2 + 1}." if bb.turn else (f"{ply // 2 + 1}…" if k == 0 else '')) + fr(bb.san(m))); bb.push(m)
    return ' '.join(x for x in out)
CACHE = {} if '--fresh' in __import__('sys').argv or not os.path.exists('tools/data/famous-analysis.json') else json.load(open('tools/data/famous-analysis.json'))
# Notes écrites à la main (parties où le moteur trouve moins de 8 moments) — indice = demi-coup
HAND = {
  'deep-blue': {20: "**11.Ff4 !** Pour la pièce, les Blancs ont deux pions, un roi noir coincé au centre et toutes leurs pièces en jeu.",
                21: "**11…b5 ?!** Kasparov veut abriter son roi par c8 et b7, mais affaiblit c6 : 12.a4 ouvre aussitôt la colonne a.",
                24: "**13.Te1** La tour s’installe sur la colonne e, face à la dame noire : e6 et le roi noir restent sous pression."},
  'short-timman': {52: "**27.Fxg7 Rxg7** Sans son fou g7, le roi noir perd le défenseur de ses cases noires : c’est ce qui rendra possible la marche du roi blanc.",
                   25: "**13…e6** Les Noirs ferment la diagonale du fou b3, mais affaiblissent les cases f6 et h6 autour de leur roi."},
  'pluie-or': {20: "**11.Cxe6 fxe6** Les Blancs prennent la paire de fous, mais ouvrent la colonne f aux tours noires.",
               41: "**21…Th6** La tour rejoint l’attaque et vise h3 : tout est prêt pour le coup final.",
               30: "**16.Tad1** Les Blancs vont regagner le pion d5, mais leurs pièces restent loin de leur roi."},
}
stats = {'before': 0, 'mech': 0, 'kept': 0, 'added': 0, 'games': 0}; analysis = {}
for g in d['famous']:
    if g['id'] in CACHE:
        evals = CACHE[g['id']]['evals']; bests = [[chess.Move.from_uci(u) for u in pv] for pv in CACHE[g['id']]['best']]
    else:
      b = chess.Board(); evals = []; bests = []
      for i, s in enumerate(g['sans']):
        info = eng.analyse(b, chess.engine.Limit(depth=18)); evals.append(sc(info, chess.WHITE)); bests.append(info.get('pv', [])[:5])
        b.push_san(s)
      final = eng.analyse(b, chess.engine.Limit(depth=18)) if not b.is_game_over() else None
      evals.append(sc(final, chess.WHITE) if final else (10000 if b.is_checkmate() and not b.turn else -10000 if b.is_checkmate() else 0))
    analysis[g['id']] = {'evals': evals, 'best': [[m.uci() for m in pv] for pv in bests]}
    new = []
    for c in g['comments']:
        stats['before'] += bool(c)
        c2 = re.sub(r"\s*Éval\. : [^ ]+\.?$", '', c or '').strip()
        if not c2 or (MECH.match(c2) and '**' not in c2 and 'moteur' not in c2): stats['mech'] += bool(c); new.append(''); continue
        if MECH.match(c2) and '**' not in c2:
            m = re.search(r"_\((Le moteur moderne préférait [^)]*)\)_", c2)
            c2 = m.group(1) if m else c2
        stats['kept'] += 1; new.append(c2)
    # candidats : tournants, sacrifices, mats
    cands = []; b = chess.Board()
    # bal[k] : matériel du camp qui joue le k-ième demi-coup, vu de ce camp, k demi-coups après le début (pour le demi-coup i : bal relatif au camp de i)
    bb = chess.Board(); mats = [ (mat(bb, True) - mat(bb, False)) ]; prevcap = []
    for x in g['sans']:
        mv_ = bb.parse_san(x); prevcap.append(bb.is_capture(mv_)); bb.push(mv_); mats.append(mat(bb, True) - mat(bb, False))
    for i, s in enumerate(g['sans']):
        me = b.turn; sign = 1 if me == chess.WHITE else -1
        before, after = evals[i] * sign, evals[i + 1] * sign
        mv = b.parse_san(s); best = bests[i]
        bal = [x * sign for x in mats]
        bb = b.copy(); bb.push(mv)
        if bb.is_checkmate(): cands.append((10**6, i, '**Mat !**')); b.push(mv); continue
        loss = before - after
        prevloss = (evals[i] - evals[i - 1]) * sign if i else 0   # ce que l'adversaire vient de concéder
        if prevloss >= 120 and best and best[0] == mv and abs(before) < 3000:
            cands.append((prevloss / 2, i, f"**{num(i)}{fr(s)} !** Le coup juste, celui du moteur : il exploite tout de suite l’imprécision précédente (gain d’environ {prevloss / 100:.1f} pion{'s' if prevloss >= 200 else ''}).".replace('.', ',', 1) if False else f"**{num(i)}{fr(s)} !** Le coup juste, celui du moteur : il exploite tout de suite l’imprécision adverse (environ {str(round(prevloss / 100, 1)).replace('.', ',')} pion{'s' if prevloss >= 200 else ''} de gagné)."))
        if loss >= 100 and abs(before) < 3000 and best and best[0] != mv:
            alt = line_fr(b, best, 4)
            tone = '??' if loss >= 300 else '?'
            what = f"perd l’équivalent de {loss / 100:.1f} pion{'s' if loss >= 200 else ''}".replace('.', ',') if loss < 500 else ('laisse passer un gain décisif' if loss >= 3000 else 'change le cours de la partie (écart de plus de 5 pions)')
            cands.append((loss, i, f"**Tournant : {num(i)}{fr(s)}{tone}** Ce coup {what} selon le moteur. Mieux : {alt}."))
        else:
            # sacrifice : matériel en baisse d'au moins 2 points pendant 4 demi-coups, hors échange en cours, éval. maintenue
            if bal[i] >= bal[i - 1 if i else 0] and i + 4 < len(bal) and max(bal[i + 2], bal[i + 4]) <= bal[i] - 2 and after >= -50 and after >= before - 60 and not (i and prevcap[i - 1]) and b.piece_at(mv.from_square).piece_type != chess.KING and i + 1 < len(prevcap) and prevcap[i + 1]:
                lost = bal[i] - max(bal[i + 2], bal[i + 4])
                cands.append((500 + lost * 50, i, f"**{num(i)}{fr(s)} ! Sacrifice** : les {'Blancs' if me else 'Noirs'} donnent du matériel ({lost} point{'s' if lost > 1 else ''}), et le moteur confirme que l’initiative compense."))
        b.push(mv)
    have = sum(1 for c in new if c.startswith('**'))
    want = max(0, min(12, max(8, have)) - have)
    used = {i for i, c in enumerate(new) if c.startswith('**')}
    for _, i, txt in sorted(cands, key=lambda x: -x[0]):
        if want <= 0: break
        if i in used or (i - 1) in used and not txt.startswith('**Mat'): continue
        old = new[i] if not (txt.startswith('**Tournant') and new[i].startswith('Le moteur moderne')) else ''
        new[i] = (txt + (' ' + old if old else '')).strip(); used.add(i); want -= 1; stats['added'] += 1
    for i, txt in HAND.get(g['id'], {}).items():
        if not new[i].startswith('**'): new[i] = txt; stats['added'] += 1
    g['comments'] = new; stats['games'] += 1
    print(g['id'], 'gras', sum(1 for c in new if c.startswith('**')), 'commentaires', sum(1 for c in new if c), '/', len(new), flush=True)
eng.quit()
json.dump(d, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(analysis, open('tools/data/famous-analysis.json', 'w'))
print(stats)
