"""Windows -> share transfer audit for JIXIN (read-only on Windows; writes only a JSON result file).
Scans the whole C:\\Users\\lover profile tree. A file is a CANDIDATE when it was modified since the project started
(2026-11-11 19:00 local) and has a project-like extension, or when its path/name mentions the project in any form.
Every candidate is SHA256-hashed and looked up in a hash index of the whole share project folder."""
import hashlib, json, os, sys, time, datetime, re

SHARE = r'\\172.16.136.1\Win_share\CyberMind-3D-Web'
ROOT = r'C:\Users\lover'
OUT = sys.argv[1]
SINCE = datetime.datetime(2026, 11, 11, 19, 0).timestamp()
EXT = {'.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mkv', '.mov', '.wav', '.json', '.mjs', '.js', '.py', '.html', '.css', '.pdf',
       '.zip', '.glb', '.gltf', '.txt', '.md', '.sh', '.log', '.output', '.csv', '.ply', '.hdr', '.exr'}
NAME_RX = re.compile(r'jixin|cybermind|机心|capture\.json|seg_\d|master_3840|soundtrack|report_built', re.I)
# browser profiles, OS/app caches and agent configuration: never copied; counted only
EXCLUDE_RX = re.compile(r'\\AppData\\Local\\Microsoft\\|\\AppData\\Local\\Packages\\|\\AppData\\Roaming\\|\\AppData\\Local\\npm-cache\\|'
                        r'\\AppData\\Local\\pip\\|\\AppData\\Local\\Programs\\|\\AppData\\LocalLow\\|\\AppData\\Local\\ms-playwright|'
                        r'\\\.claude\\|\\\.cache\\|\\\.npm\\|\\node_modules\\|\\AppData\\Local\\Temp\\puppeteer_dev', re.I)


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 22), b''): h.update(b)
    return h.hexdigest()


t0 = time.time()
share_idx, share_n, share_err = {}, 0, []
for d, dirs, fs in os.walk(SHARE, onerror=lambda e: share_err.append(str(e))):
    for f in fs:
        p = os.path.join(d, f)
        try: share_idx.setdefault(sha(p), []).append(os.path.relpath(p, SHARE).replace('\\', '/')); share_n += 1
        except Exception as e: share_err.append('%s: %s' % (p, e))
print('share indexed', share_n, 'files', round(time.time() - t0), 's', flush=True)

walk_err, n_all, excluded = [], 0, {}
cands = []
for d, dirs, fs in os.walk(ROOT, onerror=lambda e: walk_err.append(str(e))):
    for f in fs:
        p = os.path.join(d, f); n_all += 1
        try: st = os.stat(p)
        except Exception as e: walk_err.append('%s: %s' % (p, e)); continue
        recent = st.st_mtime >= SINCE and os.path.splitext(f)[1].lower() in EXT
        named = bool(NAME_RX.search(p))
        if not (recent or named): continue
        if EXCLUDE_RX.search(p):
            key = EXCLUDE_RX.search(p).group(0).strip('\\'); excluded[key] = excluded.get(key, 0) + 1; continue
        cands.append((p, st.st_size, st.st_mtime, recent, named))
print('walked', n_all, 'files;', len(cands), 'candidates;', len(walk_err), 'walk errors', flush=True)

rows = []
for p, size, mt, recent, named in cands:
    r = {'path': p, 'bytes': size, 'mtime': datetime.datetime.fromtimestamp(mt).isoformat(timespec='seconds'), 'recent': recent, 'nameMatch': named}
    try:
        h = sha(p); r['sha256'] = h; r['onShare'] = share_idx.get(h, [])
    except Exception as e:
        r['error'] = str(e)
    rows.append(r)
json.dump({'scanRoot': ROOT, 'since': '2026-11-11T19:00 local', 'filesWalked': n_all, 'walkErrors': walk_err[:200], 'walkErrorCount': len(walk_err),
           'excludedCandidateCounts': excluded, 'shareFilesIndexed': share_n, 'shareErrors': share_err, 'candidates': rows},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('done', round(time.time() - t0), 's; unmatched:', sum(1 for r in rows if not r.get('onShare')))
