import React from 'react';
import {C, FONT, SCREEN} from '../theme';
import {ANALYSIS, formatCount, formatPercent} from '../data';
import {clamp} from '../lib/anim';
import {Media, StatusPill, Wordmark} from './Brand';
import {Emoji, IconArrowLeft, IconArrowUpRight, IconBookmark, IconBookmarkSolid, IconCircle, IconPlay} from './icons';
import {StatusBar} from './Phone';

// Layout of the analysis sheet in screen coordinates (scroll = 0), measured on
// the MVP screenshot (706px wide = 393pt).
export const AN = {
	card1: {x: 14, y: 108, w: 365, h: 460},
	thumb: {x: 31, y: 126, w: 156, h: 172},
	score: {cx: 283, label: 133, ring: 222, pill: 300},
	title: {x: 31, y: 324},
	tiles: {x: 31, y: 376, w: 105, gap: 8, h1: 60, h2: 74},
	card2: {x: 14, y: 584, w: 365},
};

/** Thumbnail with play button, as in the analysis sheet. */
export const Thumb: React.FC<{frame: number; x?: number; y?: number; lift?: number}> = ({frame, x = AN.thumb.x, y = AN.thumb.y, lift = 0}) => (
	<div
		style={{
			position: 'absolute',
			left: x,
			top: y,
			width: AN.thumb.w,
			height: AN.thumb.h,
			borderRadius: 13,
			overflow: 'hidden',
			border: '1px solid rgba(255,255,255,0.16)',
			boxShadow: lift > 0 ? `0 ${20 * lift}px ${50 * lift}px rgba(0,0,0,0.55), 0 0 ${40 * lift}px rgba(255,79,154,${0.35 * lift})` : undefined,
			boxSizing: 'border-box',
			background: '#111',
		}}
	>
		<Media k="gold" zoom={1.45 + frame * 0.00008} focus={[0.5, 0.3]} />
		<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)'}} />
		<div
			style={{
				position: 'absolute',
				left: AN.thumb.w / 2 - 21,
				top: AN.thumb.h / 2 - 25,
				width: 42,
				height: 42,
				borderRadius: 21,
				background: 'rgba(20,20,24,0.55)',
				border: '1.5px solid rgba(255,255,255,0.45)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				boxSizing: 'border-box',
			}}
		>
			<IconPlay size={17} />
		</div>
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				bottom: 11,
				textAlign: 'center',
				fontFamily: FONT.ui,
				fontWeight: 600,
				fontSize: 11.5,
				color: '#fff',
			}}
		>
			Revoir dans le feed
		</div>
	</div>
);

/** "Score TRENDLY" label, ring, number and status pill. */
export const ScoreBlock: React.FC<{ring: number; pillPop: number; glow?: number; part?: 'all' | 'label' | 'ring'}> = ({
	ring,
	pillPop,
	glow = 0,
	part = 'all',
}) => {
	const r = 54;
	const circ = 2 * Math.PI * r;
	const value = ANALYSIS.score / 100;
	const {cx} = AN.score;
	const label = (
			<div
				style={{
					position: 'absolute',
					left: cx - 90,
					width: 180,
					top: AN.score.label - 9,
					textAlign: 'center',
					fontFamily: FONT.ui,
					fontWeight: 700,
					fontSize: 13,
					letterSpacing: '0.07em',
					color: '#ece2ea',
				}}
			>
				Score TRENDLY
			</div>
	);
	if (part === 'label') return label;
	return (
		<>
			{part === 'all' && label}
			<svg
				width={140}
				height={140}
				viewBox="0 0 140 140"
				style={{
					position: 'absolute',
					left: cx - 70,
					top: AN.score.ring - 70,
					overflow: 'visible',
					filter: glow > 0 ? `drop-shadow(0 0 ${10 * glow}px rgba(255,101,155,${0.8 * glow}))` : undefined,
				}}
			>
				<circle cx="70" cy="70" r={r} fill="none" stroke="#3a2a38" strokeWidth="7.5" />
				<circle
					cx="70"
					cy="70"
					r={r}
					fill="none"
					stroke={C.pinkRing}
					strokeWidth="7.5"
					strokeLinecap="round"
					strokeDasharray={`${circ * value * ring} ${circ}`}
					transform="rotate(-90 70 70)"
					opacity={ring > 0.002 ? 1 : 0}
				/>
			</svg>
			<div
				style={{
					position: 'absolute',
					left: cx - 60,
					width: 120,
					top: AN.score.ring - 31,
					textAlign: 'center',
					fontFamily: FONT.ui,
					fontWeight: 700,
					fontSize: 41,
					letterSpacing: '-0.02em',
					color: '#fff',
					lineHeight: 1,
					fontVariantNumeric: 'tabular-nums',
				}}
			>
				{Math.round(ANALYSIS.score * ring)}
			</div>
			<div
				style={{
					position: 'absolute',
					left: cx - 40,
					width: 80,
					top: AN.score.ring + 16,
					textAlign: 'center',
					fontFamily: FONT.ui,
					fontWeight: 400,
					fontSize: 13,
					color: 'rgba(255,255,255,0.62)',
				}}
			>
				/100
			</div>
			<div
				style={{
					position: 'absolute',
					left: cx - 80,
					width: 160,
					top: AN.score.pill - 13,
					display: 'flex',
					justifyContent: 'center',
					opacity: clamp(pillPop * 3),
					transform: `scale(${0.6 + 0.4 * pillPop})`,
				}}
			>
				<StatusPill status="viral" scale={0.86} glow={0.3 + 0.7 * clamp(pillPop)} />
			</div>
		</>
	);
};

/** One metric tile. `t` = entrance progress (0..1, may overshoot). */
const Tile: React.FC<{i: number; t: number; count: number}> = ({i, t, count}) => {
	const m = ANALYSIS.metrics[i];
	const {x, y, w, gap, h1, h2} = AN.tiles;
	const col = i % 3;
	const row = Math.floor(i / 3);
	const value = m.kind === 'percent' ? formatPercent(m.value * count) : formatCount(m.value * count);
	return (
		<div
			style={{
				position: 'absolute',
				left: x + col * (w + gap),
				top: y + row * (h1 + gap),
				width: w,
				height: row === 0 ? h1 : h2,
				borderRadius: 11,
				background: C.tile,
				border: '1px solid rgba(255,255,255,0.1)',
				padding: '9px 9px 0 10px',
				boxSizing: 'border-box',
				fontFamily: FONT.ui,
				opacity: clamp(t * 2),
				transform: `translateY(${(1 - t) * 14}px) scale(${0.92 + 0.08 * t})`,
			}}
		>
			<div style={{fontSize: 9.6, fontWeight: 500, letterSpacing: '0.03em', color: C.label, lineHeight: 1.35}}>{m.label}</div>
			<div style={{fontSize: 16.5, fontWeight: 700, color: '#fff', marginTop: 4, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums'}}>
				{value}
			</div>
		</div>
	);
};

/** The six metric tiles; tiles(i) returns the entrance progress of tile i. */
export const MetricTiles: React.FC<{
	tiles: (i: number) => number;
	count: number;
	wrap?: (i: number, node: React.ReactNode) => React.ReactNode;
}> = ({tiles, count, wrap}) => (
	<>
		{ANALYSIS.metrics.map((_, i) => {
			const node = <Tile key={i} i={i} t={tiles(i)} count={count} />;
			return wrap ? <React.Fragment key={i}>{wrap(i, node)}</React.Fragment> : node;
		})}
	</>
);

const Reason: React.FC<{i: number; y: number; t: number; count: number}> = ({i, y, t, count}) => {
	const r = ANALYSIS.reasons[i];
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: y,
				height: i === 3 ? 80 : 64,
				borderTop: '1px solid rgba(255,255,255,0.08)',
				fontFamily: FONT.ui,
				opacity: clamp(t * 2),
				transform: `translateX(${(1 - t) * 24}px)`,
			}}
		>
			<div
				style={{
					position: 'absolute',
					left: 16,
					top: 14,
					width: 34,
					height: 34,
					borderRadius: 17,
					background: 'rgba(255,79,154,0.14)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				{r.ok ? <IconArrowUpRight size={17} color={C.pink} stroke={2.2} /> : <IconCircle size={18} color={C.pink} stroke={2.2} />}
			</div>
			<div style={{position: 'absolute', left: 62, top: 12, fontSize: 14.5, fontWeight: 700, color: '#fff'}}>{r.title}</div>
			<div style={{position: 'absolute', left: 62, top: 33, width: i === 3 ? 200 : 210, fontSize: 12, color: '#a3a1ab', lineHeight: 1.4}}>
				{r.detail}
			</div>
			<div
				style={{
					position: 'absolute',
					right: 14,
					top: 19,
					height: 24,
					padding: '0 10px',
					borderRadius: 12,
					border: '1px solid rgba(255,255,255,0.18)',
					display: 'flex',
					alignItems: 'center',
					fontSize: 11.5,
					fontWeight: 500,
					color: '#d2d0d8',
					fontVariantNumeric: 'tabular-nums',
					boxShadow: r.ok && count > 0.98 ? `0 0 12px rgba(255,79,154,0.25)` : undefined,
				}}
			>
				{Math.round(r.pts * count)} / {r.max} pts
			</div>
		</div>
	);
};

export const ReasonsCard: React.FC<{reasons: (i: number) => number; count: number; y?: number}> = ({reasons, count, y = AN.card2.y}) => (
	<div
		style={{
			position: 'absolute',
			left: AN.card2.x,
			top: y,
			width: AN.card2.w,
			height: 350,
			borderRadius: 18,
			background: C.card,
			border: '1px solid rgba(255,255,255,0.08)',
			boxSizing: 'border-box',
		}}
	>
		<div style={{position: 'absolute', left: 17, top: 21, fontFamily: FONT.ui, fontWeight: 700, fontSize: 17.5, color: '#fff'}}>
			Pourquoi ce score ?
		</div>
		<div style={{position: 'absolute', left: 17, right: 17, top: 62, bottom: 0}}>
			{[0, 64, 128, 192].map((y2, i) => (
				<Reason key={i} i={i} y={y2} t={reasons(i)} count={count} />
			))}
		</div>
	</div>
);

export const SaveButton: React.FC<{press: number; saved: number}> = ({press, saved}) => (
	<div
		style={{
			height: 32,
			padding: '0 12px 0 10px',
			borderRadius: 16,
			display: 'flex',
			alignItems: 'center',
			gap: 6,
			background: saved > 0 ? `linear-gradient(180deg, rgba(255,95,165,${saved}), rgba(230,40,120,${saved}))` : 'rgba(255,255,255,0.06)',
			border: `1px solid ${saved > 0.5 ? 'rgba(255,170,210,0.9)' : 'rgba(255,255,255,0.2)'}`,
			boxShadow: saved > 0 ? `0 0 ${26 * saved}px rgba(255,79,154,${0.7 * saved})` : undefined,
			transform: `scale(${1 - press * 0.08 + saved * (1 - saved) * 0.5})`,
			fontFamily: FONT.ui,
			fontWeight: 600,
			fontSize: 13,
			color: '#fff',
			boxSizing: 'border-box',
		}}
	>
		{saved > 0.5 ? <IconBookmarkSolid size={15} color="#fff" /> : <IconBookmark size={15} color="#fff" stroke={2.2} />}
		Sauvegarder
	</div>
);

export const AnalysisScreen: React.FC<{
	frame: number;
	ring: number;
	count: number;
	tiles: (i: number) => number;
	reasons: (i: number) => number;
	reasonsCount?: number;
	pillPop: number;
	scroll?: number;
	savePress?: number;
	saved?: number;
	hide?: {score?: boolean; tiles?: boolean; thumb?: boolean};
	ringGlow?: number;
}> = ({frame, ring, count, tiles, reasons, reasonsCount = 1, pillPop, scroll = 0, savePress = 0, saved = 0, hide = {}, ringGlow = 0}) => {
	const {card1} = AN;
	return (
		<div style={{position: 'absolute', inset: 0, background: C.ink, overflow: 'hidden'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: SCREEN.w, transform: `translateY(${-scroll}px)`}}>
				<div
					style={{
						position: 'absolute',
						left: card1.x,
						top: card1.y,
						width: card1.w,
						height: card1.h,
						borderRadius: 18,
						background:
							'radial-gradient(120% 75% at 100% 0%, #3b1631 0%, #23141f 42%, #141218 72%), linear-gradient(180deg,#151318,#131218)',
						border: '1px solid rgba(255,255,255,0.08)',
						boxSizing: 'border-box',
					}}
				/>
				{!hide.thumb && <Thumb frame={frame} />}
				<ScoreBlock ring={ring} pillPop={pillPop} glow={ringGlow} part={hide.score ? 'label' : 'all'} />
				<div
					style={{
						position: 'absolute',
						left: AN.title.x,
						top: AN.title.y,
						width: 330,
						fontFamily: FONT.ui,
						fontWeight: 700,
						fontSize: 16,
						color: '#fff',
						whiteSpace: 'nowrap',
						display: 'flex',
						alignItems: 'center',
						gap: 0,
					}}
				>
					in love with this outfit&nbsp;
					<Emoji char="🤌🏼" size={16} />
					&nbsp;#ootd #fyp
				</div>
				<div style={{position: 'absolute', left: AN.title.x, top: AN.title.y + 27, fontFamily: FONT.ui, fontSize: 13, color: '#8f8d98'}}>
					{ANALYSIS.handle}
				</div>
				{!hide.tiles && <MetricTiles tiles={tiles} count={count} />}
				<div
					style={{
						position: 'absolute',
						left: AN.title.x,
						top: 526,
						width: 320,
						fontFamily: FONT.ui,
						fontSize: 11,
						lineHeight: 1.45,
						color: '#8f8d98',
					}}
				>
					{ANALYSIS.note}
				</div>
				<ReasonsCard reasons={reasons} count={reasonsCount} />
			</div>
			{/* Fixed header */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: SCREEN.w,
					height: 104,
					background: 'linear-gradient(180deg, #0a0a0c 78%, rgba(10,10,12,0))',
					zIndex: 20,
				}}
			>
				<div style={{position: 'absolute', left: 18, top: 64}}>
					<IconArrowLeft size={24} color="#fff" stroke={2.2} />
				</div>
				<div style={{position: 'absolute', top: 66, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
					<Wordmark size={20} />
				</div>
				<div style={{position: 'absolute', right: 12, top: 60}}>
					<SaveButton press={savePress} saved={saved} />
				</div>
			</div>
			<StatusBar />
		</div>
	);
};
