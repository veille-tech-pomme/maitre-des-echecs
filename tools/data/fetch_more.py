import zstandard, urllib.request, io
url="https://database.lichess.org/lichess_db_puzzle.csv.zst"
r=urllib.request.urlopen(url)
t=io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(r),encoding='utf-8')
out=open('puzzles_big.csv','w'); n=0
for line in t:
    out.write(line); n+=1
    if n>=1500001: break
out.close(); print(n)
