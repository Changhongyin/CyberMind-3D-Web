"""Builds the two competition ZIPs into deliverables/ and records their SHA256.
  python source/package.py
- JIXIN_site-static.zip : contents of source/web/ at the ZIP root (index.html first level) -> unzip onto any static host.
- JIXIN_source.zip      : complete editable source package (site, Lux3D client + requests + original outputs and ledger,
                          capture/test/report tooling, references, coordination, README, process images, docs).
Excludes: credentials (none are stored), caches (__pycache__, node_modules, .DS_Store), video masters, stills and
other large rendered outputs (they are delivered separately). Both ZIPs must stay under 500 MB (competition form)."""
import hashlib, json, os, sys, zipfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DL = os.path.join(ROOT, 'deliverables'); os.makedirs(DL, exist_ok=True)
SKIP_DIRS = {'__pycache__', 'node_modules', '.git', '_val'}
SKIP_FILES = {'.DS_Store', 'Thumbs.db'}
LIMIT = 500 * 1000 * 1000


def walk(base):
    for d, dirs, files in os.walk(base):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        for f in sorted(files):
            if f in SKIP_FILES or f.endswith('.pyc'): continue
            yield os.path.join(d, f)


def build(name, entries):
    path = os.path.join(DL, name)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for src, arc in entries: z.write(src, arc)
    h = hashlib.sha256(open(path, 'rb').read()).hexdigest(); size = os.path.getsize(path)
    print('%-26s %8.1f MB  %d files  sha256 %s' % (name, size / 1e6, len(entries), h))
    if size >= LIMIT: sys.exit('%s is over 500 MB' % name)
    return {'file': name, 'bytes': size, 'files': len(entries), 'sha256': h}


web = os.path.join(ROOT, 'source', 'web')
site = [(p, os.path.relpath(p, web).replace(os.sep, '/')) for p in walk(web)]
src = []
for top in ['source', 'assets', 'references', 'coordination', 'review/process']:
    for p in walk(os.path.join(ROOT, top)):
        src.append((p, 'JIXIN_source/' + os.path.relpath(p, ROOT).replace(os.sep, '/')))
for f in ['README.md', 'deliverables/SUBMISSION.md', 'deliverables/VALIDATION.md']:
    p = os.path.join(ROOT, f)
    if os.path.exists(p): src.append((p, 'JIXIN_source/' + f))
out = [build('JIXIN_site-static.zip', site), build('JIXIN_source.zip', src)]
json.dump(out, open(os.path.join(DL, 'zips.sha256.json'), 'w'), indent=1)
