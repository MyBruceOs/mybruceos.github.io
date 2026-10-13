import React from 'react';
import {Img, staticFile} from 'remotion';
import {C, FONT} from '../theme';
import {MediaKey, Status, STATUS_LABEL} from '../data';
import {Emoji, IconSprout, IconTrendUp} from './icons';

/** TRENDLY wordmark as on the landing page: TREN in white, DLY in pink. */
export const Wordmark: React.FC<{
	size: number;
	tracking?: number;
	weight?: number;
	letterStyle?: (i: number) => React.CSSProperties;
	glow?: number;
	style?: React.CSSProperties;
}> = ({size, tracking = 0.02, weight = 600, letterStyle, glow = 0, style}) => (
	<div
		style={{
			fontFamily: FONT.brand,
			fontWeight: weight,
			fontSize: size,
			letterSpacing: `${tracking}em`,
			lineHeight: 1,
			display: 'flex',
			whiteSpace: 'nowrap',
			...style,
		}}
	>
		{'TRENDLY'.split('').map((ch, i) => (
			<span
				key={i}
				style={{
					display: 'inline-block',
					color: i >= 4 ? C.pinkWord : C.white,
					textShadow:
						glow > 0
							? i >= 4
								? `0 0 ${size * 0.35}px rgba(255,79,154,${0.55 * glow})`
								: `0 0 ${size * 0.3}px rgba(255,255,255,${0.25 * glow})`
							: undefined,
					...letterStyle?.(i),
				}}
			>
				{ch}
			</span>
		))}
	</div>
);

const PILL: Record<Status, {bg: string; border: string; text: string; glow: string}> = {
	emergent: {
		bg: 'linear-gradient(180deg, rgba(58,24,44,0.94), rgba(36,14,28,0.94))',
		border: 'rgba(255,150,196,0.62)',
		text: '#ffd9ea',
		glow: '255,140,190',
	},
	croissance: {
		bg: 'linear-gradient(180deg, #5b1a40, #3c0f2a)',
		border: '#e0569c',
		text: '#ffffff',
		glow: '255,79,154',
	},
	viral: {
		bg: 'linear-gradient(180deg, #7a1937, #5a0f27)',
		border: '#de4a80',
		text: '#ffb2cd',
		glow: '255,60,120',
	},
};

/** ÉMERGENT / CROISSANCE / VIRAL pill, 30pt tall at scale 1. */
export const StatusPill: React.FC<{status: Status; scale?: number; glow?: number; style?: React.CSSProperties}> = ({
	status,
	scale = 1,
	glow = 0,
	style,
}) => {
	const p = PILL[status];
	const h = 30 * scale;
	return (
		<div
			style={{
				height: h,
				padding: `0 ${13 * scale}px 0 ${11 * scale}px`,
				borderRadius: h / 2,
				background: p.bg,
				border: `${1.5 * scale}px solid ${p.border}`,
				display: 'inline-flex',
				alignItems: 'center',
				gap: 6 * scale,
				boxShadow: `0 ${4 * scale}px ${14 * scale}px rgba(0,0,0,0.35)${
					glow > 0 ? `, 0 0 ${26 * scale * glow}px rgba(${p.glow},${0.55 * glow}), inset 0 0 ${10 * scale * glow}px rgba(${p.glow},${0.35 * glow})` : ''
				}`,
				fontFamily: FONT.ui,
				fontWeight: 800,
				fontSize: 12.5 * scale,
				letterSpacing: '0.045em',
				color: p.text,
				whiteSpace: 'nowrap',
				boxSizing: 'border-box',
				...style,
			}}
		>
			{status === 'viral' ? (
				<Emoji char="🔥" size={14 * scale} style={{marginTop: -1 * scale}} />
			) : status === 'croissance' ? (
				<IconTrendUp size={15 * scale} color="#fff" stroke={2.4} />
			) : (
				<IconSprout size={15 * scale} color="#ff9cc8" stroke={2.2} />
			)}
			<span>{STATUS_LABEL[status]}</span>
		</div>
	);
};

/** A fashion frame from public/media, cropped like object-fit: cover. */
export const Media: React.FC<{
	k: MediaKey;
	blur?: boolean;
	zoom?: number;
	focus?: [number, number];
	mirror?: boolean;
	style?: React.CSSProperties;
}> = ({k, blur = false, zoom = 1, focus = [0.5, 0.5], mirror = false, style}) => (
	<Img
		src={staticFile(`media/${k}${blur ? '-blur' : ''}.jpg`)}
		style={{
			position: 'absolute',
			inset: 0,
			width: '100%',
			height: '100%',
			objectFit: 'cover',
			objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%`,
			transform: `scale(${mirror ? -zoom : zoom}, ${zoom})`,
			transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
			...style,
		}}
	/>
);

export const Avatar: React.FC<{src: string; size: number}> = ({src, size}) => (
	<Img
		src={staticFile(`media/${src}`)}
		style={{
			width: size,
			height: size,
			borderRadius: size / 2,
			objectFit: 'cover',
			border: '1.5px solid rgba(255,255,255,0.35)',
			boxSizing: 'border-box',
			flexShrink: 0,
		}}
	/>
);
