import React from 'react';
import {Status} from '../data';
import {clamp, ease, prog, pulse, springAt} from '../lib/anim';
import {Fmt, T} from '../timeline';
import {StatusPill} from '../ui/Brand';
import {Shockwave, Sparks} from '../fx/Fx';

// The trend lifecycle drawn as an exponential growth curve; each status pops
// as the curve reaches it. ÉMERGENT → CROISSANCE → VIRAL.
const CURVE: Record<Fmt, {x0: number; x1: number; y0: number; y1: number; scales: number[]}> = {
	landscape: {x0: 140, x1: 1300, y0: 905, y1: 190, scales: [1.75, 2.15, 2.7]},
	portrait: {x0: 70, x1: 920, y0: 1380, y1: 400, scales: [2.2, 2.6, 3.0]},
};
const K = 2.6;
const STOPS: {u: number; status: Status}[] = [
	{u: 0.2, status: 'emergent'},
	{u: 0.56, status: 'croissance'},
	{u: 0.88, status: 'viral'},
];

const curveProgress = (frame: number) => prog(frame, T.curve[0], T.curve[1], ease.inOut);

/** Frame at which the drawn curve reaches status i (0 ÉMERGENT, 1 CROISSANCE, 2 VIRAL). */
export const statusHit = (i: number) => {
	let hit = T.curve[0];
	while (hit < T.curve[1] && curveProgress(hit) < STOPS[i].u) hit++;
	return hit;
};

export const Statuses: React.FC<{frame: number; fmt: Fmt; W: number; H: number}> = ({frame, fmt, W, H}) => {
	if (frame < T.statusIn - 4 || frame > T.statusExit + 30) return null;
	const c = CURVE[fmt];
	const pt = (u: number) => ({
		x: c.x0 + u * (c.x1 - c.x0),
		y: c.y0 - ((c.y0 - c.y1) * (Math.exp(K * u) - 1)) / (Math.exp(K) - 1),
	});
	const p = curveProgress(frame);
	const N = 90;
	const pts = Array.from({length: N + 1}, (_, i) => pt((i / N) * p));
	const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
	const area = `${d} L${pts[pts.length - 1].x.toFixed(1)} ${c.y0 + 40} L${c.x0} ${c.y0 + 40} Z`;
	const head = pt(p);
	const exitT = prog(frame, T.statusExit, T.statusExit + 20, ease.inExpo);
	const enter = prog(frame, T.statusIn - 4, T.statusIn + 14, ease.out);
	// Direction of the tip, for the arrowhead
	const ahead = pt(Math.min(1, p + 0.01));
	const ang = Math.atan2(ahead.y - head.y, ahead.x - head.x);
	const arrowPop = springAt(frame, T.curve[1] - 4, 11, 220);

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				opacity: enter * (1 - exitT),
				transform: `scale(${1 + exitT * 0.35})`,
				transformOrigin: `${(pt(0.88).x / W) * 100}% ${(pt(0.88).y / H) * 100}%`,
				filter: exitT > 0 ? `blur(${exitT * 16}px)` : undefined,
			}}
		>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				<defs>
					<linearGradient id="st-area" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#ff4f9a" stopOpacity="0.32" />
						<stop offset="100%" stopColor="#ff4f9a" stopOpacity="0" />
					</linearGradient>
					<linearGradient id="st-line" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="#ff9cc8" stopOpacity="0.35" />
						<stop offset="60%" stopColor="#ff5aa5" />
						<stop offset="100%" stopColor="#ffffff" />
					</linearGradient>
					<filter id="st-glow" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="9" />
					</filter>
					<filter id="st-arrow" x="-100%" y="-100%" width="300%" height="300%">
						<feGaussianBlur stdDeviation="6" />
					</filter>
					{/* the area fades out towards the moving tip (no hard vertical edge) */}
					<linearGradient id="st-fade" gradientUnits="userSpaceOnUse" x1={c.x0} y1="0" x2={head.x} y2="0">
						<stop offset="0%" stopColor="#fff" stopOpacity="1" />
						<stop offset="70%" stopColor="#fff" stopOpacity="0.85" />
						<stop offset="100%" stopColor="#fff" stopOpacity="0" />
					</linearGradient>
					<mask id="st-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
						<rect x="0" y="0" width={W} height={H} fill="url(#st-fade)" />
					</mask>
				</defs>
				{/* faint chart grid */}
				{Array.from({length: 6}).map((_, i) => {
					const y = c.y1 + ((c.y0 - c.y1) * i) / 5;
					return (
						<line
							key={i}
							x1={c.x0}
							x2={c.x1}
							y1={y}
							y2={y}
							stroke="#fff"
							strokeOpacity={0.05 * prog(frame, T.statusIn + i * 3, T.statusIn + 20 + i * 3)}
							strokeDasharray="2 10"
						/>
					);
				})}
				<path d={area} fill="url(#st-area)" mask="url(#st-mask)" />
				<path d={d} stroke="#ff3d95" strokeWidth={14} fill="none" opacity={0.55} filter="url(#st-glow)" strokeLinecap="round" />
				<path d={d} stroke="url(#st-line)" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
				{/* arrowhead at the end of the curve (echo of the logo) */}
				{p > 0.98 && (
					<g transform={`translate(${head.x} ${head.y}) rotate(${(ang * 180) / Math.PI}) scale(${arrowPop * 1.9})`}>
						<polygon points="18,0 -14,-15 -6,0 -14,15" fill="#ff4f9a" filter="url(#st-arrow)" />
						<polygon points="18,0 -14,-15 -6,0 -14,15" fill="#fff" />
					</g>
				)}
			</svg>
			{/* glowing tip */}
			{p > 0.001 && p < 0.985 && (
				<div
					style={{
						position: 'absolute',
						left: head.x - 60,
						top: head.y - 60,
						width: 120,
						height: 120,
						borderRadius: 60,
						background: 'radial-gradient(closest-side, rgba(255,255,255,1), rgba(255,120,190,0.55) 30%, rgba(255,79,154,0) 100%)',
						mixBlendMode: 'screen',
					}}
				/>
			)}
			{STOPS.map((s, i) => {
				const hit = statusHit(i);
				const q = pt(s.u);
				const sp = springAt(frame, hit, 10, 200);
				const glow = 0.45 + pulse(frame, hit + 6, 12) * 1.2 + (i === 2 ? 0.4 : 0);
				const scale = c.scales[i];
				return (
					<React.Fragment key={s.status}>
						<div
							style={{
								position: 'absolute',
								left: q.x - 9,
								top: q.y - 9,
								width: 18,
								height: 18,
								borderRadius: 9,
								background: '#fff',
								boxShadow: '0 0 18px rgba(255,79,154,0.9), 0 0 0 5px rgba(255,79,154,0.35)',
								opacity: clamp(sp * 2),
								transform: `scale(${sp})`,
							}}
						/>
						<Shockwave x={q.x} y={q.y} p={prog(frame, hit, hit + 30, ease.out)} size={180 + i * 90} />
						{i === 2 && <Sparks x={q.x} y={q.y - 70} p={prog(frame, hit + 2, hit + 34, ease.out)} radius={260} count={22} seed="viral" />}
						{i === 2 && (
							<div
								style={{
									position: 'absolute',
									left: q.x - 700,
									top: q.y - 760,
									width: 1400,
									height: 1400,
									borderRadius: '50%',
									background: 'radial-gradient(closest-side, rgba(255,235,245,0.85), rgba(255,110,185,0.4) 20%, rgba(255,79,154,0.1) 48%, rgba(255,79,154,0) 72%)',
									opacity: pulse(frame, hit + 3, 6) * 0.75,
									mixBlendMode: 'screen',
									pointerEvents: 'none',
								}}
							/>
						)}
						<div
							style={{
								position: 'absolute',
								left: q.x,
								top: q.y - 30 * scale - 22,
								transform: `translate(-50%, -50%) scale(${sp}) rotate(${(1 - clamp(sp)) * -8}deg)`,
								opacity: clamp(sp * 3),
							}}
						>
							<StatusPill status={s.status} scale={scale} glow={glow} />
						</div>
					</React.Fragment>
				);
			})}
		</div>
	);
};
