# Audit Magnus B5 : chaque position des cours thématiques reçoit une explication propre
# (« pourquoi ça marche », cases et pièces concrètes) et un indice spécifique, au lieu du même indice générique.
# Détecteurs purement échiquéens (python-chess) : mat (cases de fuite couvertes), fourchette, clouage, enfilade,
# attaque à la découverte, déviation, élimination du défenseur, gain de matériel. Écrit `why`, `hint`, `notes` dans examples.
import json, chess
import os
P = os.environ.get('CD', 'src/data/lessons/course-data.json'); d = json.load(open(P))
FR = str.maketrans({'K': 'R', 'Q': 'D', 'R': 'T', 'B': 'F', 'N': 'C'})
VAL = {1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 100}
NOM = {1: 'pion', 2: 'cavalier', 3: 'fou', 4: 'tour', 5: 'dame', 6: 'roi'}
ART = {1: 'le pion', 2: 'le cavalier', 3: 'le fou', 4: 'la tour', 5: 'la dame', 6: 'le roi'}
TON = {1: 'ton pion', 2: 'ton cavalier', 3: 'ton fou', 4: 'ta tour', 5: 'ta dame', 6: 'ton roi'}
sq = chess.square_name
def fr(b, m): return b.san(m).translate(FR)
def mat(b, c): return sum(VAL[p.piece_type] for p in b.piece_map().values() if p.color == c and p.piece_type != 6)
def line_fr(b, moves):
    bb = b.copy(); out = []
    for k, m in enumerate(moves):
        n = bb.fullmove_number
        out.append((f"{n}." if bb.turn else (f"{n}…" if k == 0 else '')) + fr(bb, m)); bb.push(m)
    return ' '.join(out)
def _after(b, ms):
    c = b.copy()
    for m in ms: c.push(m)
    return c
def piece_on(b, s): p = b.piece_at(s); return ART[p.piece_type] + ' ' + sq(s) if p else sq(s)
def explain(e):
    b = chess.Board(e['fen']); b.push_san(e['pre'][0]); me = b.turn; start = b.copy()
    moves = []; bb = b.copy()
    for s in e['line']: m = bb.parse_san(s); moves.append(m); bb.push(m)
    end = bb; m0 = moves[0]; p0 = b.piece_at(m0.from_square)
    hint = f"Le coup clé se joue avec {TON[p0.piece_type]} {sq(m0.from_square)}."
    if b.gives_check(m0): hint += ' Il donne échec.'
    elif b.is_capture(m0): hint += ' C’est une prise.'
    else: hint += ' Ce n’est ni un échec ni une prise : un coup tranquille.'
    reasons = []
    a = b.copy(); a.push(m0)
    # fourchette (sur chaque coup du camp qui gagne, si la pièce n'est pas prise aussitôt)
    bf = b.copy()
    for i, m in enumerate(moves):
        if i % 2 == 0 and not (i + 1 < len(moves) and moves[i + 1].to_square == m.to_square):
            pm = bf.piece_at(m.from_square); vam = VAL[m.promotion or pm.piece_type]; af = bf.copy(); af.push(m)
            tg = [t for t in af.attacks(m.to_square) if af.piece_at(t) and af.piece_at(t).color != me and (af.piece_at(t).piece_type == 6 or (VAL[af.piece_at(t).piece_type] >= 3 and (VAL[af.piece_at(t).piece_type] > vam or not af.attackers(not me, t))))]
            if len(tg) >= 2 and not af.is_checkmate():
                reasons.append(f"Fourchette : {fr(bf, m)} attaque deux cibles à la fois ({', '.join(piece_on(af, t) for t in tg[:3])}), l’adversaire ne peut pas tout sauver."); bf.push(m); break
        bf.push(m)
    # attraction / sacrifice accepté
    if len(moves) >= 3 and moves[1].to_square == m0.to_square:
        rp = a.piece_at(moves[1].from_square)
        if rp: reasons.append(f"Sacrifice : {ART[rp.piece_type]} adverse prend en {sq(m0.to_square)} et se retrouve attiré{'e' if rp.piece_type in (4, 5) else ''} sur une case où le coup suivant {line_fr(_after(b, moves[:2]), [moves[2]])} le punit.")
    # clouage / enfilade par le coup joué
    if a.piece_at(m0.to_square) and a.piece_at(m0.to_square).piece_type in (3, 4, 5):
        for t in a.attacks(m0.to_square):
            pt = a.piece_at(t)
            if pt and pt.color != me and a.is_pinned(not me, t) and pt.piece_type != 6:
                reasons.append(f"Après {fr(b, m0)}, {piece_on(a, t)} est clouée sur son roi : elle ne peut plus bouger."); break
    # découverte
    for s2 in chess.SquareSet(b.occupied_co[me]):
        p = b.piece_at(s2)
        if s2 == m0.from_square or p.piece_type not in (3, 4, 5): continue
        newt = [t for t in a.attacks(s2) if t not in b.attacks(s2) and a.piece_at(t) and a.piece_at(t).color != me and VAL[a.piece_at(t).piece_type] >= 3]
        if newt: reasons.append(f"En partant de {sq(m0.from_square)}, {ART[p0.piece_type]} démasque {ART[p.piece_type]} {sq(s2)}, qui attaque {piece_on(a, newt[0])} : deux menaces d’un coup."); break
    # enfilade : la pièce attaquée s'écarte, celle de derrière tombe
    if len(moves) >= 3 and a.piece_at(m0.to_square).piece_type in (3, 4, 5) and moves[2].from_square == m0.to_square:
        for t in a.attacks(m0.to_square):
            pt = a.piece_at(t)
            if pt and pt.color != me and moves[2].to_square in chess.SquareSet(chess.ray(m0.to_square, t)) and chess.square_distance(m0.to_square, moves[2].to_square) > chess.square_distance(m0.to_square, t):
                reasons.append(f"Enfilade : {piece_on(a, t)} doit s’écarter, et la pièce placée derrière, en {sq(moves[2].to_square)}, tombe."); break
    # déviation / élimination du défenseur : la réponse adverse déplace une pièce qui défendait la case du coup suivant
    if len(moves) >= 3:
        r = moves[1]; nxt = moves[2]; bb2 = b.copy(); bb2.push(m0)
        defd = bb2.attacks(r.from_square)
        rp = bb2.piece_at(r.from_square)
        if nxt.to_square in defd and r.from_square != nxt.to_square and nxt.to_square != r.to_square and rp.piece_type != 6:
            reasons.append(f"La réponse forcée {line_fr(bb2, [r])} éloigne {ART[bb2.piece_at(r.from_square).piece_type]} de {sq(r.from_square)} : elle ne protège plus {sq(nxt.to_square)}, où frappe le coup suivant.")
        elif b.is_capture(m0) and b.piece_at(m0.to_square) and nxt.to_square in b.attacks(m0.to_square) and not b.gives_check(m0):
            reasons.append(f"{fr(b, m0)} élimine {piece_on(b, m0.to_square)}, qui défendait {sq(nxt.to_square)}.")
    # issue
    if end.is_checkmate():
        k = end.king(not me); esc = [t for t in chess.SquareSet(chess.BB_KING_ATTACKS[k]) if not end.piece_at(t) or end.piece_at(t).color != me]
        own = [t for t in chess.SquareSet(chess.BB_KING_ATTACKS[k]) if end.piece_at(t) and end.piece_at(t).color != me]
        out = f"Mat : le roi {sq(k)} est attaqué et n’a aucune case de fuite"
        if own: out += f" (ses propres pièces bloquent {', '.join(sq(t) for t in own[:3])})"
        reasons.append(out + '.')
    else:
        gain = (mat(end, me) - mat(end, not me)) - (mat(start, me) - mat(start, not me))
        if gain >= 2: reasons.append(f"Bilan : tu gagnes l’équivalent de {gain} point{'s' if gain > 1 else ''} de matériel.")
        elif gain <= -2: reasons.append(f"Tu donnes du matériel ({-gain} points), mais la position obtenue est gagnante.")
        else: reasons.append("Le matériel est égal, mais la position est maintenant gagnante.")
    why = f"Pourquoi ça marche : {line_fr(b, moves)}. " + ' '.join(dict.fromkeys(reasons))
    # notes coup par coup pour la démo
    notes = {}; bb = b.copy()
    for i, m in enumerate(moves):
        n = []
        if bb.is_capture(m): n.append(f"prend {ART[bb.piece_at(m.to_square).piece_type] if bb.piece_at(m.to_square) else 'le pion'}")
        if bb.gives_check(m): n.append('échec')
        bb.push(m)
        if bb.is_checkmate(): n = ['mat !']
        if i % 2 == 1: n.insert(0, 'réponse forcée')
        if n: notes[i] = ', '.join(n).capitalize() + '.'
    notes[len(moves) - 1] = (notes.get(len(moves) - 1, '') + ' ' + ' '.join(dict.fromkeys(reasons))).strip()
    return why, hint, notes
n = 0
for th, lst in d['examples'].items():
    for e in lst:
        e['why'], e['hint'], e['notes'] = explain(e); n += 1
json.dump(d, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print('expliqués', n)
