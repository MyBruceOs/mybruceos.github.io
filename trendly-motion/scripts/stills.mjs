// Render a contact sheet of key frames for review.
// Usage: node scripts/stills.mjs <compositionId> <outDir> [frames...]
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const [id = 'Trendly-16x9', outDir = 'out/stills', ...frameArgs] = process.argv.slice(2);
const frames = frameArgs.length
	? frameArgs.map(Number)
	: [0, 6, 14, 30, 50, 75, 100, 118, 128, 134, 150, 175, 190, 215, 250, 300, 330, 360, 385, 405, 430, 452, 470, 500, 530, 560, 600, 640, 670, 692, 712, 730, 752, 780, 800, 815, 834, 850, 866, 899];
const shell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browserExecutable = fs.existsSync(shell) ? shell : null;

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, browserExecutable});
fs.mkdirSync(outDir, {recursive: true});
for (const frame of frames) {
	const t0 = Date.now();
	await renderStill({
		composition,
		serveUrl,
		frame,
		output: path.join(outDir, `${id}-${String(frame).padStart(3, '0')}.jpg`),
		imageFormat: 'jpeg',
		jpegQuality: 88,
		puppeteerInstance: browser,
		browserExecutable,
		chromiumOptions: {gl: 'swangle'},
	});
	console.log(`frame ${frame} ${Date.now() - t0}ms`);
}
await browser.close({silent: true});
