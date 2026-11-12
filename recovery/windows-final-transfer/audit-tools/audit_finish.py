"""Finishes the Windows -> share transfer audit: copies the remaining unique JIXIN leftovers (session job logs, audit
scripts) into recovery/windows-final-transfer with SHA256 verification, re-checks review/copy_manifest.json against the
current share, and writes review/windows-final-transfer-audit.json."""
import datetime, hashlib, json, os, shutil, sys

SHARE = r'\\172.16.136.1\Win_share\CyberMind-3D-Web'
SESSION = r'C:\Users\lover\AppData\Local\Temp\claude\105afce1da1a4480\7507bda7-4f2c-4fe6-81ef-431cc1790168'
scan = json.load(open(os.path.join(SESSION, 'scratchpad', 'scan.json'), encoding='utf-8'))
KEY = os.environ.get('LUX3D_CN_API_KEY', '').strip().encode()


def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 22), b''): h.update(b)
    return h.hexdigest()


# 1. transfer unique leftovers (never overwrite a different existing file)
JOBS = {'b91t0kjf2': 'Lux3D concept-image wait/fetch (2026-11-11)', 'bkxw7kdfs': 'master export watcher tail', 'bti87d89x': 'master export run_master.sh exit',
        'b8nk6x737': 'first (stopped) export attempt exit', 'bynmbi7on': 'timing probe run (background)', 'b3ds21epz': 'make_derivatives.sh exit',
        'blvu9nbir': 'static server :8787 (stopped by agent)', 'be6ep3cky': 'package test server :8790 (stopped)', 'bb0opvj1x': 'package test server :8791 (stopped)'}
dst_root = os.path.join(SHARE, 'recovery', 'windows-final-transfer')
items = [(os.path.join(SESSION, 'tasks', j + '.output'), os.path.join(dst_root, 'claude-session-7507bda7-job-logs', j + '.output'), d) for j, d in JOBS.items()]
for f in ['audit_scan.py', 'audit_finish.py', 'summ.py', 'summ2.py']:
    items.append((os.path.join(SESSION, 'scratchpad', f), os.path.join(dst_root, 'audit-tools', f), 'transfer-audit script'))
transferred = []
for src, dst, desc in items:
    if not os.path.exists(src): transferred.append({'src': src, 'error': 'missing'}); continue
    a = sha(src); data = open(src, 'rb').read()
    if KEY and KEY in data: transferred.append({'src': src, 'skipped': 'contains credential'}); continue
    if os.path.exists(dst) and sha(dst) != a: dst = dst + '.windows-' + a[:8]          # never overwrite a different file
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not (os.path.exists(dst) and sha(dst) == a): shutil.copyfile(src, dst)
    b = sha(dst)
    transferred.append({'src': src, 'dst': os.path.relpath(dst, SHARE).replace('\\', '/'), 'bytes': os.path.getsize(dst), 'sha256': b, 'verified': a == b, 'what': desc})

# 2. re-check the existing copy manifest against the current share
man = json.load(open(os.path.join(SHARE, 'review', 'copy_manifest.json'), encoding='utf-8'))
recheck = []
for e in man:
    dst = e['dst'].replace('/', '\\') if e['dst'].startswith('//') else e['dst']
    rel = e['dst'].split('CyberMind-3D-Web/')[-1]
    now = sha(dst) if os.path.exists(dst) else None
    r = {'file': rel, 'manifestSha256': e['sha256'], 'currentSha256': now, 'match': now == e['sha256']}
    if rel == 'review/copy_manifest.json' and not r['match']:
        r['expectedChange'] = ('self-referencing entry: the manifest records the hash of the version copied before the final entries '
                               'were appended; the final manifest was then written over it, so its own entry can never match')
    recheck.append(r)

# 3. classify everything the profile scan found
cands = []
for c in scan['candidates']:
    p = c['path']; cls = None
    if c.get('onShare'): cls = 'duplicate already on share'
    elif '7507bda7' in p and '\\tasks\\' in p:
        cls = 'JIXIN session job log -> transferred' if any(j in p for j in JOBS) else 'harness-internal job log of the audit itself (not a project file)'
    elif '7507bda7' in p and '\\scratchpad\\' in p:
        cls = 'transfer-audit script/data -> transferred' if not p.endswith('scan.json') else 'raw scan data (lists unrelated app files; summarised in this audit)'
    elif '85ea9ff6' in p: cls = 'previous Zoetrope session temp (pre-dates JIXIN, out of scope by instruction)'
    elif p.endswith(('a.txt', 'b.txt')) and '\\Temp\\' in p: cls = 'Zoetrope STL checksum list (not JIXIN, out of scope)'
    elif p.endswith('out.html'): cls = 'docs page fetched 2026-11-11 19:20, before JIXIN started (not JIXIN)'
    else: cls = 'unrelated application/system data (Claude app, clawd, codex, Steam, Clash, Edge, Windows temp)'
    cands.append({'path': p, 'bytes': c['bytes'], 'mtime': c['mtime'], 'sha256': c.get('sha256'), 'classification': cls})

audit = {
    'date': datetime.datetime.now().isoformat(timespec='seconds'), 'project': 'JIXIN / CyberMind-3D-Web',
    'scope': {
        'scannedRecursively': [r'C:\Users\lover (whole profile: Desktop, Documents, Downloads, OneDrive, AppData incl. Temp and all Claude session temp folders, .claude, .codex, .clawd)'],
        'checkedOnly': [r'C:\ top level (only OS swap/hibernation files changed since project start)', r'C:\Users (no other user profile in use)', 'D: (empty CD-ROM drive, no media)'],
        'notScanned': [r'C:\Windows, C:\Program Files*, C:\ProgramData (system locations, not used by the project)', 'other user profiles (Default/Public: not modified since 2026-08-11)'],
        'candidateRule': 'modified since 2026-11-11 19:00 local with a project-like extension, OR path/name mentions jixin/cybermind/机心/capture.json/seg_N/master_3840/soundtrack/report_built',
        'filesWalked': scan['filesWalked'], 'walkErrorCount': scan['walkErrorCount'], 'walkErrorsSample': scan['walkErrors'][:20],
        'walkErrorNote': 'access-denied legacy junctions (e.g. AppData\\Local\\Application Data) and over-long paths inside the Claude desktop app skills cache; not project locations',
        'excludedByRule_counts': scan['excludedCandidateCounts'],
        'excludedByRule_meaning': 'browser profiles (puppeteer temp profiles, Edge/WebView), app data, npm/pip caches, installed programs, agent configuration (.claude); never copied',
    },
    'previouslyRemoved': {'C:\\Users\\lover\\cybermind-scratch': 'removed 2026-11-12 ~06:05 after SHA256-verified transfer (review/copy_manifest.json); absent now',
                          'discardedThere': 'redundant intermediates only: 6 video segments, silent master (video packets identical to delivered master), superseded test renders, node_modules'},
    'shareIndex': {'files': scan['shareFilesIndexed'], 'errors': scan['shareErrors']},
    'transferredNow': transferred,
    'copyManifestRecheck': {'entries': len(recheck), 'matching': sum(r['match'] for r in recheck), 'mismatches': [r for r in recheck if not r['match']], 'all': recheck},
    'candidates': cands,
    'runningProjectJobs': 'none (no node/ffmpeg/python/headless-Edge processes, no listening ports 8700-8899) at 2026-11-12 06:33',
    'localCopiesDeletedInThisAudit': 'none — the transferred items are Claude harness temp files (job logs, scratchpad scripts), not project working copies; they are left for the harness to clean up',
}
json.dump(audit, open(os.path.join(SHARE, 'review', 'windows-final-transfer-audit.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('transferred', len(transferred), 'verified', sum(1 for t in transferred if t.get('verified')))
print('manifest', len(recheck), 'match', sum(r['match'] for r in recheck), 'mismatch', [r['file'] for r in recheck if not r['match']])
import collections; print(collections.Counter(c['classification'] for c in cands))
