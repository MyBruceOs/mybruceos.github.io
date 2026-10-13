import React from 'react';
import {C, FONT} from '../theme';
import {clamp, ease, prog} from '../lib/anim';

export type KLine = {text: string; accent?: boolean; size?: number; weight?: number; color?: string};

/**
 * Per-letter 3D kinetic typography. Letters rise and unfold from below
 * (rotateX), staggered; the block exits upwards with a blur.
 */
export const KineticText: React.FC<{
	lines: KLine[];
	frame: number;
	start: number;
	exit?: number;
	size: number;
	align?: 'left' | 'center' | 'right';
	stagger?: number;
	lineDelay?: number;
	duration?: number;
	tracking?: number;
	lineHeight?: number;
	style?: React.CSSProperties;
}> = ({
	lines,
	frame,
	start,
	exit = Infinity,
	size,
	align = 'left',
	stagger = 1.1,
	lineDelay = 7,
	duration = 26,
	tracking = -0.045,
	lineHeight = 1.0,
	style,
}) => {
	if (frame < start - 1) return null;
	const out = prog(frame, exit, exit + 16, ease.in);
	if (out >= 1) return null;
	return (
		<div
			style={{
				position: 'absolute',
				display: 'flex',
				flexDirection: 'column',
				alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
				fontFamily: FONT.display,
				perspective: size * 9,
				opacity: 1 - out,
				transform: `translateY(${-out * size * 0.35}px)`,
				filter: out > 0 ? `blur(${out * 14}px)` : undefined,
				...style,
			}}
		>
			{lines.map((line, li) => {
				const ls = line.size ?? size;
				let ci = 0;
				return (
					<div
						key={li}
						style={{
							display: 'flex',
							fontSize: ls,
							fontWeight: line.weight ?? 800,
							letterSpacing: `${tracking}em`,
							lineHeight,
							whiteSpace: 'pre',
							color: line.color ?? (line.accent ? C.pink : '#fff'),
							textShadow: line.accent ? `0 0 ${ls * 0.45}px rgba(255,79,154,0.55)` : '0 2px 24px rgba(0,0,0,0.45)',
							paddingBottom: ls * 0.08,
						}}
					>
						{line.text.split('').map((ch, k) => {
							const delay = start + li * lineDelay + ci++ * stagger;
							const t = clamp((frame - delay) / duration);
							const e = ease.outExpo(t);
							return (
								<span
									key={k}
									style={{
										display: 'inline-block',
										opacity: clamp(t * 3),
										transform: `translateY(${(1 - e) * 0.62}em) rotateX(${(1 - e) * -82}deg) scale(${0.9 + 0.1 * e})`,
										transformOrigin: '50% 100%',
									}}
								>
									{ch}
								</span>
							);
						})}
					</div>
				);
			})}
		</div>
	);
};

/** Small caption that slides in with a mask. */
export const Caption: React.FC<{
	text: string;
	frame: number;
	start: number;
	exit?: number;
	size: number;
	color?: string;
	weight?: number;
	align?: 'left' | 'center';
	style?: React.CSSProperties;
}> = ({text, frame, start, exit = Infinity, size, color = 'rgba(255,255,255,0.72)', weight = 500, align = 'left', style}) => {
	const t = prog(frame, start, start + 24, ease.outExpo);
	const out = prog(frame, exit, exit + 14, ease.in);
	if (t <= 0 || out >= 1) return null;
	return (
		<div
			style={{
				position: 'absolute',
				overflow: 'hidden',
				fontFamily: FONT.ui,
				fontSize: size,
				fontWeight: weight,
				color,
				letterSpacing: '-0.01em',
				textAlign: align,
				opacity: 1 - out,
				filter: out > 0 ? `blur(${out * 8}px)` : undefined,
				...style,
			}}
		>
			<div style={{transform: `translateY(${(1 - t) * 110}%)`}}>{text}</div>
		</div>
	);
};
