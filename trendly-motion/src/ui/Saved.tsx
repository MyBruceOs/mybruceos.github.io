import React from 'react';
import {C, FONT} from '../theme';
import {SAVED, Tile} from '../data';
import {clamp, ease, lerp} from '../lib/anim';
import {Media, StatusPill, Wordmark} from './Brand';
import {TabBar} from './Feed';
import {IconPlay} from './icons';
import {StatusBar} from './Phone';

export const GRID = {x: 12, y: 150, w: 119, h: 212, gap: 6, cols: 3};

export const slotRect = (slot: number) => {
	const col = slot % GRID.cols;
	const row = Math.floor(slot / GRID.cols);
	return {x: GRID.x + col * (GRID.w + GRID.gap), y: GRID.y + row * (GRID.h + GRID.gap), w: GRID.w, h: GRID.h};
};

/** A saved video tile: frame, status pill, view count. */
export const SavedTile: React.FC<{tile: Tile; w: number; h: number; radius?: number; chrome?: number; frame: number; highlight?: number}> = ({
	tile,
	w,
	h,
	radius = 11,
	chrome = 1,
	frame,
	highlight = 0,
}) => (
	<div
		style={{
			position: 'absolute',
			inset: 0,
			width: w,
			height: h,
			borderRadius: radius,
			overflow: 'hidden',
			background: '#141218',
			boxShadow: highlight > 0 ? `0 0 0 ${2 * highlight}px ${C.pink}, 0 0 ${30 * highlight}px rgba(255,79,154,${0.8 * highlight})` : undefined,
		}}
	>
		<Media k={tile.media} zoom={tile.zoom * (1.02 + frame * 0.00004)} focus={tile.focus} mirror={tile.mirror} />
		<div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.6) 100%)', opacity: chrome}} />
		<div style={{position: 'absolute', left: 6, top: 7, transformOrigin: '0 0', transform: 'scale(0.6)', opacity: chrome}}>
			<StatusPill status={tile.status} glow={0.2} />
		</div>
		<div
			style={{
				position: 'absolute',
				left: 8,
				bottom: 8,
				display: 'flex',
				alignItems: 'center',
				gap: 4,
				fontFamily: FONT.ui,
				fontWeight: 600,
				fontSize: 12,
				color: '#fff',
				textShadow: '0 1px 3px rgba(0,0,0,0.6)',
				opacity: chrome,
			}}
		>
			<IconPlay size={11} />
			{tile.views}
		</div>
	</div>
);

/**
 * "Sauvegardées" tab. Existing tiles shift one slot to the right as the new
 * one arrives (shift = 0..1); slot 0 is left free for the flying card.
 */
export const SavedScreen: React.FC<{
	frame: number;
	shift: number;
	reveal?: number;
	bounce?: number;
	newTile?: React.ReactNode;
	hideTiles?: boolean;
}> = ({frame, shift, reveal = 1, bounce = 0, newTile, hideTiles = false}) => (
	<div style={{position: 'absolute', inset: 0, background: C.ink, overflow: 'hidden'}}>
		<div style={{position: 'absolute', top: 58, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20}}>
			<Wordmark size={23} />
		</div>
		<div
			style={{
				position: 'absolute',
				left: 16,
				top: 98,
				fontFamily: FONT.ui,
				fontWeight: 800,
				fontSize: 27,
				letterSpacing: '-0.02em',
				color: '#fff',
			}}
		>
			Sauvegardées
		</div>
		{!hideTiles && SAVED.map((tile, i) => {
			const t = ease.inOut(clamp(shift * 1.6 - i * 0.07));
			const a = slotRect(i);
			const b = slotRect(i + 1);
			const x = lerp(a.x, b.x, t);
			const y = lerp(a.y, b.y, t);
			const r = clamp(reveal * 1.8 - i * 0.1);
			return (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: x,
						top: y,
						width: GRID.w,
						height: GRID.h,
						opacity: r,
						transform: `scale(${0.9 + 0.1 * r})`,
					}}
				>
					<SavedTile tile={tile} w={GRID.w} h={GRID.h} frame={frame} />
				</div>
			);
		})}
		{newTile}
		<StatusBar />
		<TabBar active="saved" bounce={bounce} />
	</div>
);

