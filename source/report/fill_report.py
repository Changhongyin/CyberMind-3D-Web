"""Fills the measured-results page of report.html from the raw validation/benchmark JSON and writes report_built.html.
  python fill_report.py <video_validation.json> <bench_dir> <env.json>"""
import glob, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
val = json.load(open(sys.argv[1], encoding='utf-8')); benches = sorted(glob.glob(os.path.join(sys.argv[2], 'bench_*.json'))); env = json.load(open(sys.argv[3], encoding='utf-8'))
m = val['master']; h = open(os.path.join(HERE, 'report.html'), encoding='utf-8').read()
ok = lambda b: '<span class="ok">通过</span>' if b else '<span class="bad">未通过</span>'
joins = ' / '.join('%.2f' % j['ratio'] for j in m['joins'])
mt = f"""<table>
<tr><th>项目</th><th>结果</th><th></th></tr>
<tr><td>分辨率 / 帧率</td><td>{m['width']}×{m['height']} · {m['fps']:g} fps（逐帧原生渲染，绘图缓冲每帧校验）</td><td>{ok(m['width']==3840 and m['height']==2160 and m['fps']==120)}</td></tr>
<tr><td>完整解码帧数 / 时长</td><td>{m['decodedFrames']} 帧 · {m['containerSeconds']} s（期望 7020 帧 · 58.5 s）</td><td>{ok(m['decodedFrames']==7020)}</td></tr>
<tr><td>编码</td><td>HEVC Main10 4:2:0，CRF 16，约 {m['bytes']*8/58.5/1e6:.0f} Mbps；6 段无损拼接</td><td></td></tr>
<tr><td>拼接处连续性</td><td>接缝帧差比 {joins}；前三处≈1（连续），后两处落在剧本镜头切换（40 s、50 s）上，已用一次不中断的连续渲染核对一致</td><td>{ok(all(j['ok'] for j in m['joins']))}</td></tr>
<tr><td>与录制时无损原帧比对</td><td>{len(m['nativeFrameCheck'])} 帧，平均差 {sum(x['madVsNativePNG'] for x in m['nativeFrameCheck'])/len(m['nativeFrameCheck']):.2f} / 255（仅编码损失）</td><td>{ok(m['ok'])}</td></tr>
<tr><td>声音</td><td>网站同一合成器离线生成，按仿真帧对齐；AAC 48 kHz，视频流不变</td><td></td></tr>
<tr><td>录制耗时</td><td>约 {env.get('masterWallHours','?')} 小时（约 {env.get('secPerFrame','?')} 秒 / 帧，远慢于实时）</td><td></td></tr>
</table>"""
rows = []
for p in benches:
    b = json.load(open(p, encoding='utf-8'))
    head = 'HEADLESS' in b.get('mode', '')
    rows.append(f"<tr><td>{b['profile']}{'（离屏）' if head else ''}</td><td>{b['sceneTarget'][0]}×{b['sceneTarget'][1]}<br><span style='color:var(--dim)'>缓冲 {b['drawingBuffer'][0]}×{b['drawingBuffer'][1]} · DPR {b['devicePixelRatio']}</span></td>"
                f"<td class='n'>{b['avgFps']:.1f}</td><td class='n'>{b['frameMs']['p50']:.1f} / {b['frameMs']['p95']:.1f} / {b['frameMs']['p99']:.1f}</td><td class='n'>{b['drawCalls']}</td></tr>")
bt = "<table><tr><th>档位</th><th>内部渲染尺寸</th><th class='n'>平均 FPS</th><th class='n'>帧时 p50 / p95 / p99 ms</th><th class='n'>调用</th></tr>" + ''.join(rows) + "</table>" \
     "<p style='font-size:2.4mm;line-height:1.45;color:var(--dim);margin:.6mm 0 0'>6 s 预热 + 40 s 自动导览，页面可见并聚焦，rAF 计时；原始 JSON：review/benchmark/。离屏一行未上屏，仅作参考。</p>"
et = "<table>" + ''.join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in env['rows']) + "</table>"
vd = env['verdictHtml']
for k, v in [('<!--MASTER_TABLE-->', mt), ('<!--BENCH_TABLE-->', bt), ('<!--ENV_TABLE-->', et), ('<!--VERDICT-->', vd)]:
    assert k in h, k; h = h.replace(k, v)
open(os.path.join(HERE, 'report_built.html'), 'w', encoding='utf-8', newline='\n').write(h)
print('report_built.html written')
