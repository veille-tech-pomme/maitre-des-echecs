# Planche contact : python3 tools/sheet.py out.png img1 img2 ... (largeur 300 px chacune)
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
W = 300; ims = []
for f in files:
    im = Image.open(f).convert('RGB'); h = int(im.height * W / im.width); ims.append((f, im.resize((W, h))))
H = max(i.height for _, i in ims) + 22
sheet = Image.new('RGB', (W * len(ims) + 8 * (len(ims) - 1), H), 'white'); d = ImageDraw.Draw(sheet)
for k, (f, im) in enumerate(ims):
    x = k * (W + 8); sheet.paste(im, (x, 22)); d.text((x + 4, 4), f.split('/')[-1][:44], fill='black')
sheet.save(out)
