import React from 'react';
import {NEW_TILE} from '../data';
import {clamp, ease, kf, lerp, prog, pulse, springAt} from '../lib/anim';
import {SCREEN} from '../theme';
import {Fmt, phoneAt, T} from '../timeline';
import {AN, AnalysisScreen, MetricTiles, ScoreBlock, Thumb} from '../ui/Analysis';
import {FeedScreen, Touch} from '../ui/Feed';
import {Phone} from '../ui/Phone';
import {GRID, SavedScreen, SavedTile, slotRect} from '../ui/Saved';
import {IconPlay} from '../ui/icons';
import {Shockwave, Sparks} from '../fx/Fx';

// --- State of the app over time -------------------------------------------

const feedScroll = (f: number) => kf(f, [[172, 0, ease.in], [185, 0.24, ease.outExpo], [T.swipe[1] + 4, 1]]);

const explode = (f: number) => {
	const [a, b, c, d] = T.explode;
	return kf(f, [[a, 0, ease.outExpo], [b, 1, ease.linear], [c, 1, ease.inOut], [d, 0]]);
};

const analysisScroll = (f: number) =>
	kf(f, [[T.scroll[0], 0, ease.smooth], [T.scroll[1], 330, ease.linear], [T.scrollBack[0], 330, ease.inOut], [T.scrollBack[1], 0]]);

/** Touch indicator for the three gestures of the film. */
const touchAt = (f: number) => {
	// swipe up on the feed
	if (f < T.statusIn) {
		const o = prog(f, 164, 170) * (1 - prog(f, 188, 198));
		const y = kf(f, [[172, 600, ease.in], [186, 330, ease.out]]);
		return {x: 205, y, o, press: prog(f, 168, 172) * (1 - prog(f, 186, 190)), ripple: 0};
	}
	if (f < T.scroll[1]) {
		const o = prog(f, T.tapAnalysis - 10, T.tapAnalysis - 4) * (1 - prog(f, T.tapAnalysis + 12, T.tapAnalysis + 20));
		return {x: 196, y: 727, o, press: pulse(f, T.tapAnalysis, 4), ripple: prog(f, T.tapAnalysis + 2, T.tapAnalysis + 22)};
	}
	const o = prog(f, T.tapSave - 10, T.tapSave - 4) * (1 - prog(f, T.tapSave + 10, T.tapSave + 18));
	return {x: 322, y: 77, o, press: pulse(f, T.tapSave, 4), ripple: prog(f, T.tapSave + 2, T.tapSave + 22)};
};

// --- Screen content ----------------------------------------------------------

const Screen: React.FC<{frame: number}> = ({frame: f}) => {
	const scroll = feedScroll(f);
	const vel = Math.abs(feedScroll(f + 0.5) - feedScroll(f - 0.5)) * 768;
	const feed = (
		<FeedScreen
			frame={f}
			scroll={scroll}
			blur={Math.min(vel * 0.55, 22)}
			pillPop={[pulse(f, 150, 12), pulse(f, T.viralPop + 8, 12) + springAt(f, T.viralPop, 12, 180) * 0.25]}
			press={pulse(f, T.tapAnalysis, 5)}
		/>
	);
	const push = prog(f, T.push[0], T.push[1], ease.smooth);
	const ex = explode(f);
	const hidePop = ex > 0.001;
	const flying = f >= T.fly[0] && f < T.fly[1] + 2;
	const leaveAnalysis = prog(f, T.fly[0] + 2, T.fly[0] + 10, ease.in);
	const toSaved = prog(f, T.fly[0] + 6, T.fly[0] + 18, ease.out);
	const analysis = (
		<AnalysisScreen
			frame={f}
			ring={prog(f, T.ring[0], T.ring[1], ease.out)}
			count={prog(f, T.tiles, T.tiles + 66, ease.out)}
			tiles={(i) => springAt(f, T.tiles + i * 5, 15, 190)}
			reasons={(i) => springAt(f, T.push[1] + 8 + i * 5, 16, 190)}
			reasonsCount={prog(f, T.reasons, T.reasons + 46, ease.out)}
			pillPop={springAt(f, T.ring[1] - 8, 11, 210)}
			ringGlow={pulse(f, T.ring[1] + 4, 16) + 0.25 * prog(f, T.ring[1], T.ring[1] + 10)}
			scroll={analysisScroll(f)}
			savePress={pulse(f, T.tapSave, 3)}
			saved={clamp(springAt(f, T.tapSave + 1, 12, 220), 0, 1.3)}
			hide={{score: hidePop, tiles: hidePop, thumb: hidePop || f >= T.fly[0]}}
		/>
	);
	const t = touchAt(f);
	return (
		<div style={{position: 'absolute', inset: 0, background: '#000'}}>
			{f < T.push[1] + 1 && (
				<div style={{position: 'absolute', inset: 0, transform: `translateX(${-110 * push}px)`}}>
					{feed}
					<div style={{position: 'absolute', inset: 0, background: `rgba(0,0,0,${0.55 * push})`}} />
				</div>
			)}
			{f >= T.push[0] && leaveAnalysis < 1 && (
				<div
					style={{
						position: 'absolute',
						inset: 0,
						transform: `translateX(${SCREEN.w * (1 - push)}px) scale(${1 - 0.06 * leaveAnalysis})`,
						opacity: 1 - leaveAnalysis,
						boxShadow: '-20px 0 40px rgba(0,0,0,0.5)',
					}}
				>
					{analysis}
				</div>
			)}
			{f >= T.fly[0] + 6 && (
				<div style={{position: 'absolute', inset: 0, opacity: toSaved, transform: `scale(${1.04 - 0.04 * toSaved})`}}>
					<SavedScreen
						frame={f}
						shift={prog(f, T.fly[0] + 16, T.fly[1] - 4, ease.inOut)}
						reveal={prog(f, T.fly[0] + 12, T.fly[0] + 40)}
						bounce={pulse(f, T.fly[1] + 6, 10)}
						newTile={
							!flying && (
								<div style={{position: 'absolute', left: GRID.x, top: GRID.y, width: GRID.w, height: GRID.h}}>
									<SavedTile
										tile={NEW_TILE}
										w={GRID.w}
										h={GRID.h}
										frame={f}
										highlight={kf(f, [[T.fly[1], 1, ease.out], [T.fly[1] + 40, 0.45]])}
									/>
								</div>
							)
						}
					/>
				</div>
			)}
			<Touch x={t.x} y={t.y} opacity={t.o} press={t.press} ripple={t.ripple} />
		</div>
	);
};

// --- Pop-out layers (phone 3D space) -----------------------------------------

const Overlay: React.FC<{frame: number}> = ({frame: f}) => {
	const ex = explode(f);
	const nodes: React.ReactNode[] = [];
	if (ex > 0.001) {
		const shadow = (left: number, top: number, w: number, h: number, a: number) => (
			<div
				style={{
					position: 'absolute',
					left,
					top,
					width: w,
					height: h,
					borderRadius: '50%',
					background: `radial-gradient(closest-side, rgba(0,0,0,${0.7 * a}), rgba(0,0,0,0))`,
					transform: 'translateZ(1px)',
				}}
			/>
		);
		nodes.push(
			<React.Fragment key="shadows">
				{shadow(AN.score.cx - 95, AN.score.ring - 80, 190, 190, ex)}
				{shadow(AN.thumb.x - 10, AN.thumb.y + 10, AN.thumb.w + 20, AN.thumb.h + 10, ex * 0.8)}
				{shadow(AN.tiles.x - 10, AN.tiles.y + 10, 350, 150, ex * 0.7)}
			</React.Fragment>,
			<div key="thumb" style={{position: 'absolute', inset: 0, transform: `translateZ(${60 * ex}px)`}}>
				<Thumb frame={f} lift={ex} />
			</div>,
			<div key="score" style={{position: 'absolute', inset: 0, transform: `translateZ(${175 * ex}px)`}}>
				<ScoreBlock
					part="ring"
					ring={prog(f, T.ring[0], T.ring[1], ease.out)}
					pillPop={springAt(f, T.ring[1] - 8, 11, 210)}
					glow={0.7 * ex + pulse(f, T.ring[1] + 4, 16)}
				/>
			</div>,
			<MetricTiles
				key="tiles"
				tiles={(i) => springAt(f, T.tiles + i * 5, 15, 190)}
				count={prog(f, T.tiles, T.tiles + 66, ease.out)}
				wrap={(i, node) => (
					<div
						style={{
							position: 'absolute',
							inset: 0,
							transform: `translateZ(${(85 + (i % 3) * 22 + Math.floor(i / 3) * 12) * ex}px)`,
							filter: `drop-shadow(0 ${14 * ex}px ${18 * ex}px rgba(0,0,0,0.5))`,
						}}
					>
						{node}
					</div>
				)}
			/>,
		);
	}
	// VIRAL pill sparks on the feed
	nodes.push(
		<Sparks key="vs" x={SCREEN.w / 2} y={109} p={prog(f, T.viralPop + 2, T.viralPop + 30, ease.out)} radius={120} count={16} seed="vp" />,
		<Shockwave key="vw" x={SCREEN.w / 2} y={109} p={prog(f, T.viralPop, T.viralPop + 26, ease.out)} size={230} />,
	);
	// Save: sparks from the button, then the thumbnail flies into the grid
	nodes.push(
		<div key="ss" style={{position: 'absolute', inset: 0, transform: 'translateZ(30px)'}}>
			<Sparks x={322} y={77} p={prog(f, T.tapSave + 1, T.tapSave + 26, ease.out)} radius={90} count={14} seed="sv" />
			<Shockwave x={322} y={77} p={prog(f, T.tapSave, T.tapSave + 24, ease.out)} size={160} />
		</div>,
	);
	if (f >= T.fly[0] && f < T.fly[1] + 2) {
		const t = prog(f, T.fly[0] + 4, T.fly[1] - 2, ease.inOut);
		const a = AN.thumb;
		const b = slotRect(0);
		const x = lerp(a.x, b.x, t);
		const y = lerp(a.y, b.y, t);
		const w = lerp(a.w, b.w, t);
		const h = lerp(a.h, b.h, t);
		const [f0, f1] = T.fly;
		const z = kf(f, [[f0, 0, ease.outExpo], [f0 + 16, 240, ease.inOut], [f1 - 8, 60, ease.in], [f1, 0]]);
		const sc = kf(f, [[f0, 1, ease.outBack], [f0 + 16, 1.22, ease.inOut], [f1 - 6, 1.04, ease.out], [f1, 1]]);
		const ry = kf(f, [[f0, 0, ease.out], [f0 + 16, -20, ease.inOut], [f1 - 10, 10, ease.out], [f1, 0]]);
		const rz = kf(f, [[f0, 0, ease.out], [f0 + 16, 7, ease.inOut], [f1 - 10, -3, ease.out], [f1, 0]]);
		const lift = clamp(z / 240);
		const chrome = prog(t, 0.45, 0.9);
		nodes.push(
			<div
				key="fly"
				style={{
					position: 'absolute',
					left: x,
					top: y,
					width: w,
					height: h,
					transform: `translateZ(${z + 2}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`,
					boxShadow: `0 ${34 * lift}px ${70 * lift}px rgba(0,0,0,0.6), 0 0 ${60 * lift + 12}px rgba(255,79,154,${0.6 * lift + 0.2})`,
					borderRadius: lerp(13, 11, t),
				}}
			>
				<SavedTile tile={NEW_TILE} w={w} h={h} radius={lerp(13, 11, t)} frame={f} chrome={chrome} highlight={0.5 * lift} />
				<div
					style={{
						position: 'absolute',
						left: w / 2 - 21,
						top: h / 2 - 25,
						width: 42,
						height: 42,
						borderRadius: 21,
						background: 'rgba(20,20,24,0.55)',
						border: '1.5px solid rgba(255,255,255,0.45)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						opacity: 1 - prog(t, 0, 0.35),
						boxSizing: 'border-box',
					}}
				>
					<IconPlay size={17} />
				</div>
			</div>,
		);
	}
	// landing burst
	const land = slotRect(0);
	nodes.push(
		<div key="land" style={{position: 'absolute', inset: 0, transform: 'translateZ(10px)'}}>
			<Shockwave x={land.x + land.w / 2} y={land.y + land.h / 2} p={prog(f, T.fly[1], T.fly[1] + 28, ease.out)} size={300} />
			<Sparks x={land.x + land.w / 2} y={land.y + land.h / 2} p={prog(f, T.fly[1], T.fly[1] + 30, ease.out)} radius={170} count={18} seed="ld" />
		</div>,
	);
	return <>{nodes}</>;
};

// --- The phone through scenes 2-5 ------------------------------------------

export const PhoneStory: React.FC<{frame: number; fmt: Fmt; W: number; H: number}> = ({frame, fmt, W, H}) => {
	if (frame < T.matchCut || frame >= T.morph[0]) return null;
	const cam = phoneAt(fmt, frame);
	const body = prog(frame, T.matchCut, T.matchCut + 16, ease.out);
	const rim = 0.3 + pulse(frame, T.viralPop + 6, 16) * 0.5 + pulse(frame, T.ring[1], 20) * 0.5 + pulse(frame, T.fly[1], 18) * 0.6;
	return (
		<div style={{position: 'absolute', inset: 0, perspective: fmt === 'landscape' ? 2200 : 2600, perspectiveOrigin: '50% 50%'}}>
			<div
				style={{
					position: 'absolute',
					left: W / 2,
					top: H / 2,
					transformStyle: 'preserve-3d',
					transform: `translate3d(${cam.x}px, ${cam.y}px, ${cam.z}px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) rotateZ(${cam.rz}deg) scale(${cam.s})`,
				}}
			>
				{/* frame materialises around the screen at the match cut */}
				<Phone
					body={body}
					rim={rim}
					glare={cam.ry / 25}
					overlay={<Overlay frame={frame} />}
				>
					<Screen frame={frame} />
				</Phone>
			</div>
		</div>
	);
};
