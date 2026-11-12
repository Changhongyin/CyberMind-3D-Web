// Read-only visit to the public competition page to confirm rules text (no login, no form interaction).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const urls = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--window-size=1400,2000', '--disable-gpu'], defaultViewport: { width: 1400, height: 2000 } });
for (const [i, u] of urls.entries()) {
  const page = await browser.newPage();
  try {
    await page.goto(u, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(`out/rules_${i}.txt`, `URL: ${page.url()}\nTITLE: ${await page.title()}\n\n${text}`);
    console.log(u, '->', page.url(), 'chars', text.length);
    const links = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.innerText.trim().slice(0, 30) + ' | ' + a.href).filter((s) => s.length > 5).slice(0, 60));
    fs.writeFileSync(`out/rules_${i}_links.txt`, links.join('\n'));
  } catch (e) { console.log(u, 'FAILED', e.message.slice(0, 200)); }
  await page.close();
}
await browser.close();
