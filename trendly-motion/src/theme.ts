// Colours sampled from the TRENDLY MVP screenshots and the landing page mockup.
export const C = {
	bg: '#070709',
	ink: '#0a0a0c', // app background
	card: '#131218', // analysis cards
	tile: '#0d0c11', // metric tiles
	line: 'rgba(255,255,255,0.09)',
	pink: '#ff4f9a', // brand accent
	pinkRing: '#ff659b', // score ring
	pinkWord: '#f2559a', // "DLY" in the wordmark
	pinkIcon: '#fe508f', // bookmark icon
	pinkSoft: '#ff8fbd',
	pinkPale: '#ffc2db',
	plum: '#45122f', // CROISSANCE pill
	crimson: '#66142f', // VIRAL pill
	white: '#ffffff',
	muted: 'rgba(255,255,255,0.62)',
	faint: 'rgba(255,255,255,0.42)',
	label: '#b7b4bf',
} as const;

export const FONT = {
	ui: 'Inter, system-ui, sans-serif',
	display: 'Inter, system-ui, sans-serif',
	brand: 'Montserrat, Inter, sans-serif',
	emoji: 'TrendlyEmoji',
} as const;

// Logical size of the phone screen (iPhone 15 Pro, points).
export const SCREEN = {w: 393, h: 852, radius: 55} as const;
export const PHONE = {w: 429, h: 888, radius: 70, bezel: 18} as const;
export const TABBAR_H = 84;
export const FEED_H = SCREEN.h - TABBAR_H;
