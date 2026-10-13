import React from 'react';
import {COPY, NEW_TILE, SAVED} from '../data';
import {clamp, ease, kf, lerp, prog, pulse, springAt} from '../lib/anim';
import {FONT, SCREEN} from '../theme';
import {Fmt, phoneAt, T} from '../timeline';
import {Wordmark} from '../ui/Brand';
import {LogoIcon} from '../ui/LogoIcon';
import {Phone} from '../ui/Phone';
import {SavedScreen, SavedTile, slotRect} from '../ui/Saved';
import {Shockwave, Sparks} from '../fx/Fx';

const LAYOUT: Record<Fmt, {icon: number; ix: number; iy: number; word: number; wordY: number; tag: number; tagY: number}> = {
	landscape: {icon: 250, ix: 960, iy: 410, word: 118, wordY: 592, tag: 36, tagY: 742},
	portrait: {icon: 330, ix: 540, iy: 760, word: 140, wordY: 1010, tag: 46, tagY: 1196},
};

const TILES = [NEW_TILE, ...SAVED];
const CONVERGE = T.morph[1];

/** Saved opportunities implode into the app icon; neon glyph; wordmark; tagline. */
export const Finale: React.FC<{frame: number; fmt: Fmt; W: number; H: number}> = ({frame, fmt, W, H}) => {
	if (frame < T.morph[0]) return null;
	const L = LAYOUT[fmt];
	const cam = phoneAt(fmt, T.morph[0]);
	const sf = cam.s;
	const shell = prog(frame, T.morph[0], T.morph[0] + 18, ease.in);

	// grid tiles in frame coordinates at the start of the finale
	const tiles = TILES.map((tile, k) => {
		const r = slotRect(k);
		const x0 = W / 2 + cam.x + (r.x + r.w / 2 - SCREEN.w / 2) * sf;
		const y0 = H / 2 + cam.y + (r.y + r.h / 2 - SCREEN.h / 2) * sf;
		return {tile, k, x0, y0, w0: r.w * sf, h0: r.h * sf};
	});

	const iconPop = springAt(frame, CONVERGE - 2, 10, 150);
	const hit = T.hit;
	const push = 1 + prog(frame, CONVERGE, 900, ease.out) * 0.035;
	const shine = kf(frame, [[hit + 4, -0.3, ease.inOut], [hit + 34, 1.4]]);
	const core = prog(frame, CONVERGE - 4, CONVERGE + 16, ease.out);

	return (
		<div style={{position: 'absolute', inset: 0}}>
			{/* the device dissolves while its content leaves */}
			{shell < 1 && (
				<div
					style={{
						position: 'absolute',
						left: W / 2 + cam.x,
						top: H / 2 + cam.y,
						transform: `scale(${sf * (1 - 0.1 * shell)})`,
						opacity: 1 - shell,
					}}
				>
					<Phone body={1 - shell}>
						<SavedScreen frame={frame} shift={1} hideTiles />
					</Phone>
				</div>
			)}
			{/* light rays + glow behind the icon */}
			<div
				style={{
					position: 'absolute',
					left: L.ix - 900,
					top: L.iy - 900,
					width: 1800,
					height: 1800,
					opacity: prog(frame, CONVERGE, CONVERGE + 30) * 0.5,
					background: `repeating-conic-gradient(from ${frame * 0.25}deg, rgba(255,79,154,0) 0deg, rgba(255,79,154,0.16) 4deg, rgba(255,79,154,0) 10deg)`,
					WebkitMaskImage: 'radial-gradient(closest-side, rgba(0,0,0,1), rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)',
					maskImage: 'radial-gradient(closest-side, rgba(0,0,0,1), rgba(0,0,0,0.4) 40%, rgba(0,0,0,0) 100%)',
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: L.ix - 520,
					top: L.iy - 520,
					width: 1040,
					height: 1040,
					borderRadius: '50%',
					background: 'radial-gradient(closest-side, rgba(255,60,150,0.38), rgba(255,60,150,0.1) 50%, rgba(255,60,150,0))',
					opacity: prog(frame, T.morph[0] + 6, CONVERGE + 6) * (0.8 + 0.4 * pulse(frame, hit, 14)),
				}}
			/>
			{/* vortex: tiles swing out, then spiral into the icon (with light trails) */}
			{tiles.map(({tile, k, x0, y0, w0, h0}) => {
				const dx = x0 - L.ix;
				const dy = y0 - L.iy;
				const r0 = Math.hypot(dx, dy);
				const th0 = Math.atan2(dy, dx);
				const start = T.morph[0] + 2 + k * 0.7;
				return [0, 0.06, 0.12, 0.18].map((lag, gi) => {
					const a = prog(frame, start + lag * 26, CONVERGE + lag * 26);
					if ((a <= 0 && gi > 0) || a >= 1) return null;
					const out = ease.outSoft(clamp(a / 0.3));
					const inn = ease.inExpo(clamp((a - 0.3) / 0.7));
					const r = r0 * (1 + 0.16 * out) * (1 - inn);
					const th = th0 + 0.22 * out + 2.1 * inn;
					const x = L.ix + r * Math.cos(th);
					const y = L.iy + r * Math.sin(th);
					const s = (1 + 0.06 * out) * lerp(1, 0.16, inn);
					const rot = ((th - th0) * 180) / Math.PI * 0.55;
					const o = [1, 0.42, 0.22, 0.1][gi] * (1 - prog(inn, 0.8, 1));
					return (
						<div
							key={`${k}-${gi}`}
							style={{
								position: 'absolute',
								left: x - w0 / 2,
								top: y - h0 / 2,
								width: w0,
								height: h0,
								opacity: o,
								transform: `scale(${s}) rotate(${rot}deg)`,
								boxShadow: `0 0 ${40 * inn}px rgba(255,79,154,${0.9 * inn})`,
								borderRadius: 11 * sf,
							}}
						>
							<div style={{width: w0 / sf, height: h0 / sf, transform: `scale(${sf})`, transformOrigin: '0 0', position: 'relative'}}>
								<SavedTile tile={tile} w={w0 / sf} h={h0 / sf} frame={frame} highlight={k === 0 ? 0.5 : 0} />
							</div>
						</div>
					);
				});
			})}
			{/* arrow hit: radial bloom on the icon */}
			<div
				style={{
					position: 'absolute',
					left: L.ix - 900,
					top: L.iy - 900,
					width: 1800,
					height: 1800,
					borderRadius: '50%',
					background: 'radial-gradient(closest-side, rgba(255,235,245,0.9), rgba(255,110,185,0.45) 22%, rgba(255,79,154,0.12) 50%, rgba(255,79,154,0) 75%)',
					opacity: pulse(frame, hit + 1, 5) * 0.8,
					mixBlendMode: 'screen',
					pointerEvents: 'none',
				}}
			/>
			{/* convergence core */}
			{core > 0 && core < 1 && (
				<div
					style={{
						position: 'absolute',
						left: L.ix - 300,
						top: L.iy - 300,
						width: 600,
						height: 600,
						borderRadius: 300,
						background: 'radial-gradient(closest-side, rgba(255,255,255,1), rgba(255,140,200,0.6) 25%, rgba(255,79,154,0) 70%)',
						opacity: 1 - core,
						transform: `scale(${0.3 + core * 1.2})`,
						mixBlendMode: 'screen',
					}}
				/>
			)}
			<div style={{position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: `${L.ix}px ${L.iy + L.icon * 0.6}px`}}>
				{iconPop > 0.001 && (
					<div
						style={{
							position: 'absolute',
							left: L.ix - L.icon / 2,
							top: L.iy - L.icon / 2,
							transform: `scale(${0.35 + 0.65 * iconPop})`,
						}}
					>
						<LogoIcon
							size={L.icon}
							ignite={prog(frame, T.ignite[0], T.ignite[1])}
							arm={prog(frame, T.arm[0], T.arm[1], ease.inOut)}
							head={springAt(frame, T.arm[1] - 4, 10, 220)}
							body={clamp(iconPop * 1.4)}
							shine={shine}
							glow={0.6 + 0.6 * pulse(frame, hit, 12)}
							id={`logo-${fmt}`}
						/>
					</div>
				)}
				<Shockwave x={L.ix} y={L.iy} p={prog(frame, CONVERGE, CONVERGE + 30, ease.out)} size={L.icon * 2.6} width={3} />
				<Shockwave x={L.ix} y={L.iy} p={prog(frame, hit, hit + 34, ease.out)} size={L.icon * 3.2} width={4} />
				<Sparks x={L.ix} y={L.iy} p={prog(frame, hit, hit + 36, ease.out)} radius={L.icon * 1.25} count={26} seed="fin" />
				{/* Wordmark */}
				<div style={{position: 'absolute', left: 0, right: 0, top: L.wordY, display: 'flex', justifyContent: 'center'}}>
					<Wordmark
						size={L.word}
						weight={600}
						tracking={lerp(0.34, 0.035, prog(frame, T.word, T.word + 34, ease.outExpo))}
						glow={0.6}
						letterStyle={(i) => {
							const p = prog(frame, T.word + i * 2.2, T.word + 22 + i * 2.2, ease.outExpo);
							return {
								opacity: clamp(p * 1.6),
								transform: `translateY(${(1 - p) * 42}%) scale(${0.85 + 0.15 * p})`,
								filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined,
							};
						}}
					/>
				</div>
				{/* Tagline */}
				<div
					style={{
						position: 'absolute',
						left: 0,
						right: 0,
						top: L.tagY,
						textAlign: 'center',
						fontFamily: FONT.ui,
						fontWeight: 500,
						fontSize: L.tag,
						letterSpacing: '-0.005em',
						color: 'rgba(255,255,255,0.88)',
						overflow: 'hidden',
						paddingBottom: 6,
					}}
				>
					<div
						style={{
							transform: `translateY(${(1 - prog(frame, T.tagline, T.tagline + 24, ease.outExpo)) * 110}%)`,
							opacity: prog(frame, T.tagline, T.tagline + 10),
						}}
					>
						{COPY.tagline}
					</div>
				</div>
			</div>
		</div>
	);
};
