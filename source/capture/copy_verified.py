"""Copies files to the share and verifies each copy by SHA256 (source hashed, destination re-read and hashed).
  python copy_verified.py <manifest_out.json> <src>=<dst_dir> [<src>=<dst_dir> ...]     (src may be a file or a directory)
Appends to the manifest; never deletes anything."""
import hashlib, json, os, shutil, sys


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 22), b''): h.update(b)
    return h.hexdigest()


man_path = sys.argv[1]
man = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else []
bad = 0
for spec in sys.argv[2:]:
    src, dst = spec.split('=', 1)
    files = [src] if os.path.isfile(src) else [os.path.join(d, f) for d, _, fs in os.walk(src) for f in sorted(fs)]
    for f in files:
        rel = os.path.basename(f) if os.path.isfile(src) else os.path.relpath(f, src)
        out = os.path.join(dst, rel); os.makedirs(os.path.dirname(out), exist_ok=True)
        a = sha(f); shutil.copyfile(f, out); b = sha(out)
        ok = a == b and os.path.getsize(f) == os.path.getsize(out); bad += not ok
        man = [m for m in man if m['dst'] != out.replace('\\', '/')]
        man.append({'src': f.replace('\\', '/'), 'dst': out.replace('\\', '/'), 'bytes': os.path.getsize(out), 'sha256': b, 'verified': ok})
        print('%s %10d  %s' % ('OK  ' if ok else 'FAIL', os.path.getsize(out), out))
json.dump(man, open(man_path, 'w', encoding='utf-8'), indent=1)
print('failures:', bad); sys.exit(1 if bad else 0)
