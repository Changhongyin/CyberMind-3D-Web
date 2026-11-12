import json, sys, collections
BS = chr(92)
d = json.load(open(sys.argv[1], encoding='utf-8'))
print('excluded', d['excludedCandidateCounts'])
print('walk errors', d['walkErrorCount'], 'sample:')
for e in d['walkErrors'][:6]: print('   ', e[:170])
c = collections.Counter(BS.join(r['path'].split(BS)[:7]) for r in d['candidates'])
for k, v in c.most_common(): print(v, k)
for r in d['candidates']:
    if 'Temp' + BS + 'claude' not in r['path']:
        print(r['bytes'], r['mtime'], 'recent' if r['recent'] else '', 'name' if r['nameMatch'] else '', r['path'])
