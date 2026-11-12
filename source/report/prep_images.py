"""Builds source/report/img/*.jpg from the native 4K stills, report shots, model-viewer shots, Lux3D originals and
review/process images.   python prep_images.py <stills4k_dir> <report_shots_dir> <mv_dir>"""
import os, sys
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
S4, RS, MV = sys.argv[1], sys.argv[2], sys.argv[3]
OUT = os.path.join(ROOT, 'source', 'report', 'img'); os.makedirs(OUT, exist_ok=True)
LUX = os.path.join(ROOT, 'assets', 'lux3d'); PROC = os.path.join(ROOT, 'review', 'process')


def save(im, name, w=1600):
    im = im.convert('RGB')
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.jpg'), quality=86, optimize=True); print(name, im.size)


s4 = lambda n: Image.open(os.path.join(S4, n + '.png'))
rs = lambda n: Image.open(os.path.join(RS, n + '.jpg'))
save(s4('JIXIN_4K_04_awake'), 'cover', 2400)
for n in ['home', 'idea_talisman', 'loop1', 'loop2', 'loop3', 'loop4', 'trans1', 'trans2', 'trans3', 'trans4', 'split_closed', 'split_open', 'code_halo', 'code_water']:
    save(rs(n), n, 1400)
save(s4('JIXIN_4K_05_glyph-drums'), 'idea_drums', 1000); save(s4('JIXIN_4K_06_reed-comb'), 'idea_reeds', 1000); save(s4('JIXIN_4K_07_seed'), 'idea_seed', 1000)
save(s4('JIXIN_4K_08_inner-lining'), 'split_lining', 1200); save(s4('JIXIN_4K_11_wugang'), 'code_city', 1200)
save(s4('JIXIN_4K_04_awake').crop((1080, 300, 2760, 1880)), 'code_engine', 1200)
# native-resolution crops (1:1 pixels from the 4K stills)
save(s4('JIXIN_4K_05_glyph-drums').crop((1200, 300, 2640, 1900)), 'detail1', 1440)
save(s4('JIXIN_4K_08_inner-lining').crop((1500, 500, 2940, 2100)), 'detail2', 1440)
save(s4('JIXIN_4K_09_shrine').crop((1000, 400, 2840, 2160)), 'detail3', 1440)
# Lux3D: concept image, model as generated, model in the scene
for a, task in [('mask', '6690690'), ('censer', '6690707'), ('drone', '6690729')]:
    save(Image.open(os.path.join(LUX, a, '%s_image_t%s_0.jpg' % (a, task))), 'lux_%s_concept' % a, 700)
    save(Image.open(os.path.join(MV, 'lux_%s_glb.png' % a)), 'lux_%s_glb' % a, 700)
save(s4('JIXIN_4K_02_rings-aligned'), 'lux_mask_scene', 1300); save(s4('JIXIN_4K_09_shrine'), 'lux_censer_scene', 1300)
save(s4('JIXIN_4K_01_sealed').crop((2840, 300, 3640, 830)), 'lux_drone_scene', 800)
save(Image.open(os.path.join(MV, 'split_wire.png')).crop((1300, 950, 2300, 1950)), 'split_wire', 1000)
# process / iterations
for src, dst in [('01_first-run_NaN-lighting-bug', 'it1'), ('02_first-lit-frame_small-chrome-head_thick-cables', 'it2'), ('04_first-awake_overbloom_snowy-beads', 'it3'),
                 ('09_awake_after-bloom-and-seam-pass', 'it4'), ('14_porcelain-after-gold-key-fix', 'it5'), ('11_native-4k-crop_from-capture-test', 'it6')]:
    save(Image.open(os.path.join(PROC, src + '.jpg')), dst, 1100)
