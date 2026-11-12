// Camera home pose and the inspection points (second layer of exploration). Text is fictional world copy.
// pose: camera = tgt + dist * (sin az cos el, sin el, cos az cos el)
export const HEAD = { scale: 1.2, y: 0.64 };          // placement of the head group (face + engine) in the well
export const HOME = { az: 0.30, el: 0.035, dist: 19.5, tgt: [0, 0.55, 0], fov: 38 };

export const HOTSPOTS = [
  { id: 'face', when: ['dormant'], anchor: [0.0, 2.3, 3.15], pose: { az: 0.42, el: 0.06, dist: 8.8, tgt: [0.15, 0.6, 1.4], fov: 36 },
    zh: '面壳', en: 'THE FACE', body: '白釉是烧出来的，裂纹是用金补的。雾港借这张脸说了四十年的话，后来人们决定让它睡。', sub: 'Fired porcelain, mended in gold. The city spoke through this face for forty years — then voted to let it sleep.' },
  { id: 'shrine', when: ['dormant', 'awake'], anchor: [2.85, -2.75, 3.9], pose: { az: 0.78, el: 0.2, dist: 2.7, tgt: [2.85, -3.08, 3.9], fov: 34 },
    zh: '供案', en: 'NIGHT-SHIFT SHRINE', body: '一只青铜炉，被改成了散热器，接在机心的回水管上。没有哪个夜班技工承认是自己放的。', sub: 'A bronze censer rebuilt as a heat sink and plumbed into the coolant return. No technician admits to leaving it here.' },
  { id: 'drums', when: ['awake'], anchor: [0, 0.3, 1.3], pose: { az: 0.2, el: 0.02, dist: 5.6, tgt: [0, 0.3, 0.3], fov: 36 },
    zh: '字鼓', en: 'GLYPH DRUMS', body: '四只字鼓，每只八字。它的每一个念头都是四个字，一共四千零九十六种。点击任意一只，替它换一个字。', sub: 'Four drums, eight glyphs each: every thought it can hold is four characters long — 4,096 in all. Click a drum to turn it.' },
  { id: 'reeds', when: ['awake'], anchor: [0.72, 0.30, 1.33], pose: { az: -0.36, el: 0.1, dist: 1.3, tgt: [0.74, 0.27, 1.2], fov: 32 },
    zh: '簧梳', en: 'REED COMBS', body: '鼓上的铜针拨动簧片，簧片把字变成声音。它不是在计算，它是在给自己唱。', sub: 'Brass pins pluck tuned reeds, and a glyph becomes a note. It does not compute its thoughts. It hums them.' },
  { id: 'seed', when: ['awake'], anchor: [0, 3.3, 0.1], pose: { az: -0.35, el: 0.22, dist: 3.0, tgt: [0, 3.15, 0.06], fov: 34 },
    zh: '心种', en: 'THE SEED', body: '莲座里的晶体随第一只字鼓换色。技工们叫它“心种”，图纸上只写着：勿触。', sub: 'The crystal in the lotus cage takes its colour from the first drum. Technicians call it the seed. The drawings only say: do not touch.' },
  { id: 'lining', when: ['awake'], anchor: [3.7, 1.2, 2.3], pose: { az: -0.62, el: 0.05, dist: 4.4, tgt: [3.5, 0.8, 2.2], fov: 36 },
    zh: '内壁', en: 'INNER LINING', body: '面壳背面是黑漆与金线。脸是给城市看的，这一面是给它自己看的。', sub: 'Behind the glaze: black lacquer and gold trace. The face was for the city. This side was for itself.' },
  { id: 'city', when: ['dormant', 'awake'], anchor: [-24, 7, -30], pose: { az: 0.62, el: 0.02, dist: 40, tgt: [-8, 5.5, -14], fov: 30 },
    zh: '雾港', en: 'WUGANG', body: '井外是雾港。机心醒来的时候，整座城的雨会停一拍。', sub: 'Beyond the well lies Wugang, the fog harbour. When the mind wakes, the whole city’s rain misses a beat.' },
];
