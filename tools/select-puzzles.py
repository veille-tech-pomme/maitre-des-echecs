# Sélectionne un échantillon équilibré de puzzles Lichess (CC0) par thème et difficulté.
import csv, json, random, collections
random.seed(42)
THEMES = ["fork","pin","skewer","discoveredAttack","doubleCheck","discoveredCheck","mateIn1","mateIn2","mateIn3","mateIn4",
 "backRankMate","smotheredMate","hangingPiece","deflection","attraction","sacrifice","promotion","underPromotion","advancedPawn",
 "trappedPiece","intermezzo","clearance","interference","xRayAttack","capturingDefender","zugzwang","quietMove","defensiveMove",
 "rookEndgame","pawnEndgame","bishopEndgame","knightEndgame","queenEndgame","enPassant","castling","kingsideAttack","exposedKing",
 "attackingF2F7","anastasiaMate","arabianMate","bodenMate","doubleBishopMate","hookMate","operaMate","pillsburysMate","epauletteMate","dovetailMate","equality","opening"]
rows=[]
with open('data/puzzles_sample.csv') as f:
    for r in csv.DictReader(f):
        if int(r['Popularity'])<85 or int(r['NbPlays'])<300 or int(r['RatingDeviation'])>90: continue
        rows.append(r)
random.shuffle(rows)
chosen={}
# 1) couverture par thème x tranche de difficulté
bands=[(0,1000),(1000,1400),(1400,1800),(1800,2200),(2200,3500)]
for t in THEMES:
    for lo,hi in bands:
        n=0
        for r in rows:
            if n>=14: break
            if t in r['Themes'].split() and lo<=int(r['Rating'])<hi and r['PuzzleId'] not in chosen:
                chosen[r['PuzzleId']]=r; n+=1
# 2) remplissage uniforme par tranche de 100 points
cnt=collections.Counter((int(r['Rating'])//100) for r in chosen.values())
for r in rows:
    b=int(r['Rating'])//100
    if r['PuzzleId'] in chosen or b<4 or b>28: continue
    if cnt[b]<140:
        chosen[r['PuzzleId']]=r; cnt[b]+=1
out=[[r['PuzzleId'],r['FEN'],r['Moves'],int(r['Rating']),r['Themes']] for r in chosen.values()]
out.sort(key=lambda x:x[3])
json.dump(out,open('data/puzzles_selected.json','w'))
print(len(out))
