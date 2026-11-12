import json, sys
BS = chr(92); key = 'Temp' + BS + 'claude' + BS
d = json.load(open(sys.argv[1], encoding='utf-8'))
for r in d['candidates']:
    if key in r['path']: print(r['bytes'], r['mtime'], 'ON-SHARE' if r.get('onShare') else 'unique', r['path'].split(key)[1])
