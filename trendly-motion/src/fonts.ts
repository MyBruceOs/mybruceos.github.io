import {continueRender, delayRender, staticFile} from 'remotion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';

// @font-face rules load lazily: block rendering until every face used in the
// film is ready, otherwise the first frames of each render tab use fallbacks.
const SAMPLE = 'TRENDLY Émergent ÉMERGENT àéèç’ 0123456789 %,▶';
const faces = [
	...[400, 500, 600, 700, 800, 900].map((w) => `${w} 32px Inter`),
	...[500, 600, 700].map((w) => `${w} 32px Montserrat`),
];

// Noto Color Emoji subset holding 🔥 and 🤌🏼. The .woff build is used on
// purpose: Chromium does not paint the SVG glyphs of the .woff2 build.
const emoji = new FontFace('TrendlyEmoji', `url(${staticFile('fonts/noto-color-emoji-subset.woff')}) format('woff')`);

const handle = delayRender('Loading fonts');
Promise.all([
	...faces.map((f) => document.fonts.load(f, SAMPLE)),
	emoji.load().then((face) => document.fonts.add(face)),
])
	.then(() => continueRender(handle))
	.catch((err) => {
		console.error('Font loading failed', err);
		continueRender(handle);
	});
