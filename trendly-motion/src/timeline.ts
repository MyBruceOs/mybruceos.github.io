import {useVideoConfig} from 'remotion';
import {ease, Key, kf} from './lib/anim';

// 15 s at 60 fps = 900 frames.
export const DURATION = 900;

export const T = {
	// 1. Hook - 3D wall of fashion videos, match cut into the phone (0 - 2.2 s)
	hookText1: 6,
	hookText1Exit: 56,
	hookText2: 60,
	hookText2Exit: 112,
	matchCut: 132,
	// 2. Feed swipe (2.2 - 4.2 s)
	feedText: 150,
	swipeTouch: 170,
	swipe: [176, 210] as const,
	viralPop: 206,
	feedExit: 238,
	// 3. ÉMERGENT / CROISSANCE / VIRAL (4.2 - 6.3 s)
	statusIn: 252,
	curve: [258, 342] as const,
	statusText: 286,
	statusExit: 356,
	// 4. Analysis (6.3 - 10.1 s)
	tapAnalysis: 398,
	push: [406, 432] as const,
	ring: [436, 498] as const,
	tiles: 452,
	explode: [440, 472, 522, 548] as const,
	analysisText: 432,
	scroll: [540, 580] as const,
	reasons: 552,
	analysisExit: 604,
	// 5. Save (10.1 - 12.5 s)
	scrollBack: [616, 636] as const,
	tapSave: 642,
	fly: [652, 702] as const,
	saveText: 646,
	saveExit: 738,
	// 6. Finale (12.5 - 15 s)
	morph: [752, 778] as const, // grid tiles spiral into the icon
	ignite: [786, 798] as const, // neon flicker of the T
	arm: [796, 812] as const, // the trend arrow shoots up
	hit: 814,
	word: 800,
	tagline: 822,
};

export type Fmt = 'landscape' | 'portrait';
export const useFmt = (): Fmt => {
	const {width, height} = useVideoConfig();
	return width >= height ? 'landscape' : 'portrait';
};

type Track = readonly Key[];
type PhoneTrack = {x: Track; y: Track; z: Track; rx: Track; ry: Track; rz: Track; s: Track};

const e = ease;

// Phone camera moves (offsets from frame centre, degrees, scale).
const PHONE: Record<Fmt, PhoneTrack> = {
	landscape: {
		x: [[132, 0, e.smooth], [178, 330], [252, 330, e.inOut], [294, 640], [362, 640, e.smooth], [400, -300], [432, -300, e.smooth], [474, -250], [602, -250, e.smooth], [636, -330], [736, -330, e.smooth], [752, 0]],
		y: [[132, 0, e.smooth], [178, 20], [252, 20, e.inOut], [294, 40], [362, 40, e.smooth], [400, 0], [432, 0, e.smooth], [474, 150], [538, 150, e.smooth], [582, 0], [602, 0, e.smooth], [636, 20], [736, 20, e.smooth], [752, 0]],
		z: [[252, 0, e.inOut], [294, -260], [362, -260, e.smooth], [400, 0]],
		rx: [[132, 0, e.smooth], [178, 5], [252, 4, e.inOut], [294, 6], [362, 6, e.smooth], [400, 4], [432, 4, e.smooth], [474, 9], [602, 9, e.smooth], [636, 4], [736, 3, e.smooth], [752, 0]],
		ry: [[132, 0, e.smooth], [178, -17], [252, -12, e.inOut], [294, -26], [362, -26, e.smooth], [400, 14], [432, 14, e.smooth], [476, 27], [530, 15, e.inOut], [602, 16, e.smooth], [636, 14], [736, 10, e.smooth], [752, 0]],
		rz: [[132, 0, e.smooth], [178, -1.5], [252, -1, e.inOut], [294, -2], [362, -2, e.smooth], [400, 1], [474, 0]],
		s: [[132, 0.95, e.smooth], [178, 0.92], [252, 0.92, e.inOut], [294, 0.8], [362, 0.8, e.smooth], [400, 0.95], [432, 0.95, e.smooth], [474, 1.55], [602, 1.55, e.smooth], [636, 0.98], [736, 0.98, e.smooth], [752, 0.9]],
	},
	portrait: {
		// key UI kept inside TikTok's safe area (x 60-940, y 160-1500)
		x: [[132, 0], [752, 0]],
		y: [[132, 0, e.smooth], [178, 140], [252, 140, e.inOut], [294, 1650], [362, 1650, e.smooth], [400, 170], [736, 170, e.smooth], [752, 0]],
		z: [[252, 0, e.inOut], [294, -200], [362, -200, e.smooth], [400, 0]],
		rx: [[132, 0, e.smooth], [178, 6], [252, 5, e.inOut], [294, 10], [362, 10, e.smooth], [400, 5], [432, 5, e.smooth], [474, 7], [602, 7, e.smooth], [636, 4], [736, 3, e.smooth], [752, 0]],
		ry: [[132, 0, e.smooth], [178, -10], [252, -8, e.inOut], [294, -14], [362, -14, e.smooth], [400, 8], [432, 8, e.smooth], [476, 17], [530, 8, e.inOut], [602, 9, e.smooth], [636, 6], [736, 4, e.smooth], [752, 0]],
		rz: [[132, 0, e.smooth], [178, -1], [252, -0.5], [400, 0.5], [474, 0]],
		s: [[132, 1.38, e.smooth], [178, 1.2], [252, 1.2, e.inOut], [294, 1.0], [362, 1.0, e.smooth], [400, 1.2], [432, 1.2, e.smooth], [474, 1.6], [602, 1.6, e.smooth], [636, 1.2], [736, 1.2, e.smooth], [752, 1.15]],
	},
};

export const phoneAt = (fmt: Fmt, frame: number) => {
	const p = PHONE[fmt];
	return {
		x: kf(frame, p.x),
		y: kf(frame, p.y),
		z: kf(frame, p.z),
		rx: kf(frame, p.rx),
		ry: kf(frame, p.ry),
		rz: kf(frame, p.rz),
		s: kf(frame, p.s),
	};
};

/** Phone scale at the match cut (the hero card must land at this size). */
export const CUT_SCALE: Record<Fmt, number> = {landscape: 0.95, portrait: 1.38};
