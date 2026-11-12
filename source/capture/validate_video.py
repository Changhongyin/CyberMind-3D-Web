"""Validate the demonstration master and its derivatives by DECODING them (not by trusting capture metadata).
  python validate_video.py <work_dir> <out_json> [--master FILE] [--deriv FILE ...]
Checks per segment and for the joined master: full decode without errors, decoded frame count, stream width/height/fps/
pix_fmt/codec, container duration. For the master it also extracts frames around every segment join, measures the
change across each join against the change between neighbouring frames, writes a join contact sheet, and compares
decoded frames with the lossless native PNGs kept during capture (proves frame order/alignment).
Needs FFMPEG env var and Pillow."""
import json, os, re, subprocess, sys, glob
from PIL import Image, ImageChops, ImageStat, ImageDraw

FF = os.environ['FFMPEG']
work, out_json = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
master = args[args.index('--master') + 1] if '--master' in args else os.path.join(work, 'JIXIN_master_3840x2160_120fps_hevc.mp4')
derivs = [args[i + 1] for i, a in enumerate(args) if a == '--deriv']
BOUNDS_F = [0, 1200, 2400, 3600, 4800, 6000, 7020]


def probe(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True, encoding='utf-8', errors='replace')
    s = r.stderr; info = {}
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', s)
    if m: info['containerSeconds'] = round(int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]), 4)
    m = re.search(r'Stream #\S+.*?Video: (\w+)[^,]*?(?:\(([^)]*)\))?.*?, (\w+)\(?.*?, (\d+)x(\d+)', s)
    v = re.search(r'Video: ([^\n]+)', s)
    if v:
        line = v[1]; info['videoLine'] = line.strip()
        info['codec'] = line.split()[0]
        wh = re.search(r', (\d{3,5})x(\d{3,5})', line); info['width'], info['height'] = int(wh[1]), int(wh[2])
        f = re.search(r', ([\d.]+) fps', line); info['fps'] = float(f[1]) if f else None
        pf = re.search(r'\), (yuv\w+|rgb\w+|gbr\w+)', line) or re.search(r', (yuv\w+)', line); info['pix_fmt'] = pf[1] if pf else None
    a = re.search(r'Audio: ([^\n]+)', s); info['audioLine'] = a[1].strip() if a else None
    return info


def decode(path):
    r = subprocess.run([FF, '-hide_banner', '-v', 'error', '-stats', '-i', path, '-map', '0:v:0', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    frames = re.findall(r'frame=\s*(\d+)', r.stderr)
    errs = [l for l in r.stderr.splitlines() if l.strip() and not l.startswith('frame=') and 'frame=' not in l]
    return {'exitCode': r.returncode, 'decodedFrames': int(frames[-1]) if frames else 0, 'decodeErrors': errs[:10]}


def mad(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3


report = {'segments': [], 'master': None, 'derivatives': []}
for i in range(6):
    p = os.path.join(work, 'seg_%d.mp4' % i)
    if not os.path.exists(p): report['segments'].append({'file': p, 'missing': True}); continue
    d = {'file': os.path.basename(p), **probe(p), **decode(p)}
    exp = BOUNDS_F[i + 1] - BOUNDS_F[i]; d['expectedFrames'] = exp
    d['ok'] = d['exitCode'] == 0 and not d['decodeErrors'] and d['decodedFrames'] == exp and d.get('width') == 3840 and d.get('height') == 2160 and d.get('fps') == 120
    report['segments'].append(d); print('segment', i, 'OK' if d['ok'] else 'FAIL', d['decodedFrames'], d.get('containerSeconds'))

if os.path.exists(master):
    m = {'file': os.path.basename(master), 'bytes': os.path.getsize(master), **probe(master), **decode(master)}
    m['expectedFrames'] = 7020; m['expectedSeconds'] = 58.5
    m['ok'] = m['exitCode'] == 0 and not m['decodeErrors'] and m['decodedFrames'] == 7020 and m.get('width') == 3840 and m.get('height') == 2160 and m.get('fps') == 120 and abs(m.get('containerSeconds', 0) - 58.5) < 0.02
    # frames around the joins + kept native frames, in ONE decode pass
    tmp = os.path.join(work, '_val'); os.makedirs(tmp, exist_ok=True)
    for f in glob.glob(os.path.join(tmp, '*.png')): os.remove(f)
    want = sorted(set([n for b in BOUNDS_F[1:-1] for n in (b - 2, b - 1, b, b + 1)]))
    kept = sorted(int(re.search(r'(\d+)\.png$', f)[1]) for f in glob.glob(os.path.join(work, 'seg_*_frames', 'frame_*.png')))
    sel = '+'.join('eq(n,%d)' % n for n in sorted(set(want + kept)))
    subprocess.run([FF, '-hide_banner', '-v', 'error', '-i', master, '-vf', 'select=' + sel.replace(',', r'\,'), '-fps_mode', 'passthrough', os.path.join(tmp, 'd_%03d.png')], check=True)
    order = sorted(set(want + kept)); dec = {n: os.path.join(tmp, 'd_%03d.png' % (k + 1)) for k, n in enumerate(order)}
    joins = []; sheet = Image.new('RGB', (960 * 2, 270 * 5)); dr = ImageDraw.Draw(sheet)
    for j, b in enumerate(BOUNDS_F[1:-1]):
        im = {n: Image.open(dec[n]).convert('RGB').resize((960, 540), Image.BILINEAR) for n in (b - 2, b - 1, b, b + 1)}
        before, across, after = mad(im[b - 2], im[b - 1]), mad(im[b - 1], im[b]), mad(im[b], im[b + 1])
        ratio = across / max(1e-6, (before + after) / 2)
        joins.append({'join': b, 'madBefore': round(before, 3), 'madAcross': round(across, 3), 'madAfter': round(after, 3), 'ratio': round(ratio, 2), 'ok': ratio < 2.5})
        sheet.paste(im[b - 1].resize((480, 270)), (0, j * 270)); sheet.paste(im[b].resize((480, 270)), (480, j * 270))
        diff = ImageChops.difference(im[b - 1], im[b]).resize((480, 270)); diff = Image.eval(diff, lambda x: min(255, x * 4))
        sheet.paste(diff, (960, j * 270)); sheet.paste(ImageChops.difference(im[b - 2], im[b - 1]).resize((480, 270)).point(lambda x: min(255, x * 4)), (1440, j * 270))
        dr.text((6, j * 270 + 4), 'frame %d | %d   (join %d)' % (b - 1, b, j + 1), fill=(255, 255, 0)); dr.text((966, j * 270 + 4), 'x4 diff across join  ratio %.2f' % ratio, fill=(255, 255, 0)); dr.text((1446, j * 270 + 4), 'x4 diff %d|%d (reference)' % (b - 2, b - 1), fill=(255, 255, 0))
    sheet.save(out_json.replace('.json', '_joins.png'))
    m['joins'] = joins
    nat = []
    for n in kept:
        a = Image.open(glob.glob(os.path.join(work, 'seg_*_frames', 'frame_%05d.png' % n))[0]).convert('RGB'); b = Image.open(dec[n]).convert('RGB')
        same = mad(a, b)
        nat.append({'frame': n, 'size': list(b.size), 'madVsNativePNG': round(same, 3)})
    m['nativeFrameCheck'] = nat
    m['ok'] = m['ok'] and all(j['ok'] for j in joins) and all(x['madVsNativePNG'] < 6 and x['size'] == [3840, 2160] for x in nat)
    report['master'] = m; print('master', 'OK' if m['ok'] else 'FAIL', m['decodedFrames'], m.get('containerSeconds'), [j['ratio'] for j in joins])

for p in derivs:
    d = {'file': os.path.basename(p), 'bytes': os.path.getsize(p), **probe(p), **decode(p)}
    report['derivatives'].append(d); print('derivative', d['file'], d['decodedFrames'], d.get('width'), d.get('height'), d.get('fps'), d.get('containerSeconds'), 'exit', d['exitCode'])

json.dump(report, open(out_json, 'w', encoding='utf-8'), indent=1)
print('written', out_json)
