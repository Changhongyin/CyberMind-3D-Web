// GPU / WebGL2 capability probe for the capture browser (headless Edge) at a given viewport.
//   node probe.mjs [WxH=3840x2160]
import puppeteer from 'puppeteer-core';
const [W, H] = (process.argv[2] || '3840x2160').split('x').map(Number);
const browser = await puppeteer.launch({
  executablePath: process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new',
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.setContent('<body style="margin:0;background:#000"><canvas id=c style="width:100vw;height:100vh;display:block"></canvas></body>');
const info = await page.evaluate(() => {
  const c = document.getElementById('c'); c.width = innerWidth; c.height = innerHeight;
  const gl = c.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) return { webgl2: false };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const out = {
    webgl2: true, inner: [innerWidth, innerHeight], dpr: devicePixelRatio, buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxRB: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS), maxVertUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    colorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'), colorBufferHalfFloat: !!gl.getExtension('EXT_color_buffer_half_float'),
    floatLinear: !!gl.getExtension('OES_texture_float_linear'), aniso: !!gl.getExtension('EXT_texture_filter_anisotropic'),
    timerQuery: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    ua: navigator.userAgent, cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory,
  };
  // can we allocate a 4x MSAA RGBA16F renderbuffer at full size?
  const fb = gl.createFramebuffer(), rb = gl.createRenderbuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  for (const s of [4, 2]) {
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.RGBA16F, c.width, c.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
    out['msaa' + s + '_rgba16f'] = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === 0;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clearColor(0.1, 0.4, 0.6, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return out;
});
console.log(JSON.stringify(info, null, 1));
const cdp = await page.createCDPSession();
for (const fmt of ['png', 'jpeg']) {
  const t0 = Date.now(); let bytes = 0;
  for (let i = 0; i < 5; i++) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: fmt, quality: 97, optimizeForSpeed: true });
    bytes = data.length * 0.75;
  }
  console.log(`screenshot ${fmt}: ${((Date.now() - t0) / 5).toFixed(0)} ms/frame, ~${(bytes / 1e6).toFixed(2)} MB (flat colour)`);
}
await browser.close();
