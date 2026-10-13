import React from 'react';
import {random} from 'remotion';
import {MediaKey, Status, Tile} from '../data';
import {clamp, ease, kf, prog, pulse} from '../lib/anim';
import {SCREEN} from '../theme';
import {CUT_SCALE, Fmt, T} from '../timeline';
import {FeedScreen} from '../ui/Feed';
import {SavedTile} from '../ui/Saved';

const CW = 300;
const CH = 533;
const GAP = 30;
const COLS = 9;
const ROWS = 8;
const PERIOD = ROWS * (CH + GAP);
/** Hero card = the app screen at this scale inside the wall. */
const K = 0.62;

// Varied cards from the two full-resolution looks: crops, mirrors and
// editorial grades (B&W, magenta duotone).
const BASES: MediaKey[] = ['gold', 'paris', 'gold-bw', 'paris-duo', 'paris', 'gold-duo', 'paris-bw', 'gold'];
const CROPS: {zoom: number; focus: [number, number]}[] = [
	{zoom: 1, focus: [0.5, 0.45]},
	{zoom: 1.5, focus: [0.5, 0.22]},
	{zoom: 1.9, focus: [0.32, 0.7]},
	{zoom: 1.3, focus: [0.58, 0.78]},
];
const STATUSES: Status[] = ['viral', 'croissance', 'emergent'];
const VIEWS = ['6 M', '2,3M', '829,1K', '61,7K', '3,1M', '240K', '47,9K', '1,1M', '388K', '512K', '980K', '84,2K'];
const WALL: Tile[] = Array.from({length: 24}, (_, i) => ({
	media: BASES[i % BASES.length],
	...CROPS[(i * 7) % CROPS.length],
	status: STATUSES[(i * 5) % 3],
	views: VIEWS[(i * 7) % VIEWS.length],
	mirror: i % 3 === 1,
}));

const PLANE: Record<Fmt, {x: number[][]; y: number[][]; rz0: number; rz1: number; tilt: number}> = {
	landscape: {x: [[0, 420], [96, 420], [132, 0]], y: [[0, 30], [132, 0]], rz0: -34, rz1: -21, tilt: 1},
	portrait: {x: [[0, 0], [132, 0]], y: [[0, 150], [96, 150], [132, 0]], rz0: -30, rz1: -18, tilt: 0.78},
};

/** Opening: a tilted, endlessly scrolling wall of fashion videos. */
export const Hook: React.FC<{frame: number; fmt: Fmt; W: number; H: number}> = ({frame, fmt, W, H}) => {
	if (frame > T.matchCut) return null;
	const pl = PLANE[fmt];
	const endScale = CUT_SCALE[fmt] / K;
	const px = kf(frame, pl.x.map(([f, v], i) => [f, v, i === 1 ? ease.smooth : ease.inOut] as const));
	const py = kf(frame, pl.y.map(([f, v]) => [f, v, ease.smooth] as const));
	const pz = kf(frame, [[0, -1500, ease.outExpo], [50, -140, ease.inOut], [100, -60, ease.smooth], [T.matchCut, 0]]);
	const rx = pl.tilt * kf(frame, [[0, 64, ease.outExpo], [50, 52, ease.inOut], [100, 48, ease.smooth], [T.matchCut, 0]]);
	const rz = kf(frame, [[0, pl.rz0, ease.outExpo], [50, pl.rz1 - 3, ease.inOut], [100, pl.rz1, ease.smooth], [T.matchCut, 0]]);
	const sc = kf(frame, [[100, 1, ease.smooth], [T.matchCut, endScale]]);
	// Columns rush in, then drift (alternate directions, like scrolling feeds)
	const rush = 1700 * (1 - ease.outExpo(clamp(frame / 62)));
	const heroLift = kf(frame, [[40, 0, ease.out], [80, 46, ease.inOut], [112, 46, ease.smooth], [T.matchCut, 0]]);
	const heroGlow = prog(frame, 50, 90, ease.out) * (1 - prog(frame, 116, 132));
	const dim = prog(frame, 6, 30) * 0.18 * (1 - prog(frame, 100, 120));

	const cards: React.ReactNode[] = [];
	for (let c = 0; c < COLS; c++) {
		const dir = c % 2 === 0 ? -1 : 1;
		const spd = 1.1 + random(`spd${c}`) * 0.7;
		const off = dir * (frame * spd + rush) + random(`off${c}`) * PERIOD;
		const x = (c - (COLS - 1) / 2) * (CW + GAP);
		for (let r = 0; r < ROWS; r++) {
			const yRaw = r * (CH + GAP) + off;
			const y = ((((yRaw + PERIOD / 2) % PERIOD) + PERIOD) % PERIOD) - PERIOD / 2;
			const dist = Math.hypot(x, y);
			const tile = WALL[(c * 5 + r * 3 + 2) % WALL.length];
			const out = prog(frame, 100 + dist / 160, 122 + dist / 160, ease.in);
			if (out >= 1) continue;
			const popAt = 18 + random(`pop${c}-${r}`) * 90;
			const pop = pulse(frame, popAt, 10);
			cards.push(
				<div
					key={`${c}-${r}`}
					style={{
						position: 'absolute',
						left: x - CW / 2,
						top: y - CH / 2,
						width: CW,
						height: CH,
						borderRadius: 20,
						overflow: 'hidden',
						opacity: 1 - out,
						transform: `translateZ(${-out * 420}px)`,
						boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 0 ${40 * pop}px rgba(255,79,154,${0.7 * pop})`,
					}}
				>
					<div style={{position: 'absolute', inset: 0, transform: `scale(${CW / 119})`, transformOrigin: '0 0', width: 119, height: 212}}>
						<SavedTile tile={tile} w={119} h={212} radius={0} frame={frame} highlight={0} />
					</div>
					<div style={{position: 'absolute', inset: 0, background: `rgba(6,6,8,${0.1 + dim})`}} />
				</div>,
			);
		}
	}

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				perspective: 1600,
				perspectiveOrigin: '50% 50%',
				overflow: 'hidden',
				filter: frame < 18 ? `blur(${(1 - prog(frame, 0, 18, ease.out)) * 7}px)` : undefined,
			}}
		>
			<div
				style={{
					position: 'absolute',
					left: W / 2,
					top: H / 2,
					transformStyle: 'preserve-3d',
					transform: `translate3d(${px}px, ${py}px, ${pz}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${sc})`,
				}}
			>
				{cards}
				{/* Hero: the TRENDLY feed itself, hovering above the wall */}
				<div
					style={{
						position: 'absolute',
						left: (-SCREEN.w * K) / 2,
						top: (-SCREEN.h * K) / 2,
						width: SCREEN.w * K,
						height: SCREEN.h * K,
						borderRadius: SCREEN.radius * K,
						overflow: 'hidden',
						transform: `translateZ(${heroLift}px)`,
						boxShadow: `0 0 0 ${1.5 * heroGlow}px rgba(255,120,190,${heroGlow}), 0 0 ${90 * heroGlow}px rgba(255,79,154,${0.75 * heroGlow}), 0 40px 80px rgba(0,0,0,${0.6 * heroGlow})`,
					}}
				>
					<div style={{width: SCREEN.w, height: SCREEN.h, transform: `scale(${K})`, transformOrigin: '0 0', position: 'relative'}}>
						<FeedScreen frame={frame} scroll={0} pillPop={[pulse(frame, 92, 14), 0]} filterId="heroblur" />
					</div>
				</div>
			</div>
		</div>
	);
};
