// Captures scene.html frame by frame and encodes a 5 s, 30 fps, 1080p MP4.
// Usage: node render.js [--stills]   (--stills also writes a few PNG frames for review)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30;
const OUT = path.join(__dirname, 'orphanage-window.mp4');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'scene.html') + '?capture');
  const dur = await page.evaluate(() => window.DUR);
  const frames = Math.round(dur * FPS);

  if (process.argv.includes('--stills')) {
    for (const t of [0.5, 2.9, 4.3]) {
      await page.evaluate((t) => window.render(t), t);
      await page.screenshot({ path: path.join(__dirname, `still-${t.toFixed(1)}s.png`) });
    }
  }

  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT],
    { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`wrote ${OUT} (${frames} frames)`);
})();
