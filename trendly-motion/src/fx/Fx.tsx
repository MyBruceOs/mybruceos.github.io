import React from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {clamp} from '../lib/anim';

/** Deep black stage with slow magenta aurora. `heat` drives the pink glow. */
export const Background: React.FC<{frame: number; heat?: number; vertical?: boolean}> = ({frame, heat = 1, vertical = false}) => {
	const t = frame / 60;
	const blob = (x: number, y: number, size: number, rgb: string, a: number) => (
		<div
			style={{
				position: 'absolute',
				left: `${x}%`,
				top: `${y}%`,
				width: `${size}%`,
				height: `${size * (vertical ? 0.5625 : 1.7778)}%`,
				transform: 'translate(-50%, -50%)',
				background: `radial-gradient(closest-side, rgba(${rgb},${a}), rgba(${rgb},${a * 0.35}) 45%, rgba(${rgb},0) 100%)`,
			}}
		/>
	);
	return (
		<AbsoluteFill style={{background: '#060608', overflow: 'hidden'}}>
			{blob(18 + Math.sin(t * 0.5) * 6, 82 + Math.cos(t * 0.4) * 5, 85, '255,40,140', 0.2 * heat)}
			{blob(86 + Math.cos(t * 0.35) * 5, 12 + Math.sin(t * 0.45) * 6, 70, '170,30,190', 0.13 * heat)}
			{blob(55 + Math.sin(t * 0.3) * 8, 55 + Math.sin(t * 0.5) * 6, 55, '255,60,110', 0.07 * heat)}
		</AbsoluteFill>
	);
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.75}) => (
	<AbsoluteFill
		style={{
			background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
			pointerEvents: 'none',
		}}
	/>
);

/** Animated film grain (changes every 2 frames). */
export const Grain: React.FC<{frame: number; opacity?: number}> = ({frame, opacity = 0.06}) => {
	const step = Math.floor(frame / 2);
	const ox = Math.floor(random(`gx${step}`) * 256);
	const oy = Math.floor(random(`gy${step}`) * 256);
	return (
		<AbsoluteFill style={{overflow: 'hidden', mixBlendMode: 'overlay', opacity, pointerEvents: 'none'}}>
			<div
				style={{
					position: 'absolute',
					left: -ox,
					top: -oy,
					right: -256,
					bottom: -256,
					backgroundImage: `url(${staticFile('media/grain.png')})`,
					backgroundRepeat: 'repeat',
				}}
			/>
			<Img src={staticFile('media/grain.png')} style={{display: 'none'}} />
		</AbsoluteFill>
	);
};

/** Anamorphic lens flare: horizontal streak + hot core. */
export const Flare: React.FC<{x: number; y: number; intensity: number; width?: number; color?: string}> = ({
	x,
	y,
	intensity,
	width = 1800,
	color = '255,90,170',
}) => {
	if (intensity <= 0.01) return null;
	const i = clamp(intensity, 0, 1.5);
	return (
		<div style={{position: 'absolute', left: x, top: y, pointerEvents: 'none', mixBlendMode: 'screen'}}>
			<div
				style={{
					position: 'absolute',
					left: -width / 2,
					top: -60,
					width,
					height: 120,
					background: `radial-gradient(closest-side, rgba(255,255,255,${0.55 * i}), rgba(${color},${0.35 * i}) 35%, rgba(${color},0) 100%)`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: -width * 0.6,
					top: -1.5,
					width: width * 1.2,
					height: 3,
					background: `linear-gradient(90deg, rgba(${color},0), rgba(255,220,240,${0.9 * i}) 50%, rgba(${color},0))`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: -110,
					top: -110,
					width: 220,
					height: 220,
					borderRadius: 110,
					background: `radial-gradient(closest-side, rgba(255,255,255,${0.9 * i}), rgba(${color},${0.4 * i}) 40%, rgba(${color},0))`,
				}}
			/>
		</div>
	);
};

/** Drifting glowing specks. */
export const Particles: React.FC<{frame: number; count?: number; w: number; h: number; opacity?: number; seed?: string; speed?: number}> = ({
	frame,
	count = 40,
	w,
	h,
	opacity = 1,
	seed = 'p',
	speed = 1,
}) => (
	<AbsoluteFill style={{pointerEvents: 'none', opacity, mixBlendMode: 'screen'}}>
		{Array.from({length: count}).map((_, i) => {
			const r1 = random(`${seed}${i}a`);
			const r2 = random(`${seed}${i}b`);
			const r3 = random(`${seed}${i}c`);
			const size = 2 + r3 * 5;
			const x = r1 * w + Math.sin(frame / 50 + i) * 20;
			const y = (((r2 * h - frame * (0.4 + r3) * speed) % h) + h) % h;
			const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / (20 + r3 * 30) + i));
			return (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: x,
						top: y,
						width: size * 4,
						height: size * 4,
						marginLeft: -size * 2,
						marginTop: -size * 2,
						borderRadius: '50%',
						background: `radial-gradient(closest-side, rgba(255,${190 + r1 * 60},${220 + r2 * 35},${0.9 * tw}), rgba(255,79,154,${0.35 * tw}) 45%, rgba(255,79,154,0))`,
					}}
				/>
			);
		})}
	</AbsoluteFill>
);

/** Expanding ring. p = 0..1 */
export const Shockwave: React.FC<{x: number; y: number; p: number; size: number; color?: string; width?: number}> = ({
	x,
	y,
	p,
	size,
	color = '255,79,154',
	width = 3,
}) => {
	if (p <= 0 || p >= 1) return null;
	const s = size * (0.2 + 0.8 * p);
	return (
		<div
			style={{
				position: 'absolute',
				left: x - s / 2,
				top: y - s / 2,
				width: s,
				height: s,
				borderRadius: '50%',
				border: `${width * (1 - p) + 0.5}px solid rgba(${color},${(1 - p) * 0.9})`,
				boxShadow: `0 0 ${30 * (1 - p)}px rgba(${color},${0.6 * (1 - p)}), inset 0 0 ${20 * (1 - p)}px rgba(${color},${0.4 * (1 - p)})`,
				pointerEvents: 'none',
			}}
		/>
	);
};

/** Burst of sparks flying out of a point. p = 0..1 */
export const Sparks: React.FC<{x: number; y: number; p: number; radius: number; count?: number; seed?: string}> = ({
	x,
	y,
	p,
	radius,
	count = 18,
	seed = 's',
}) => {
	if (p <= 0 || p >= 1) return null;
	return (
		<div style={{position: 'absolute', left: x, top: y, pointerEvents: 'none', mixBlendMode: 'screen'}}>
			{Array.from({length: count}).map((_, i) => {
				const a = (i / count) * Math.PI * 2 + random(`${seed}${i}`) * 0.5;
				const d = radius * (0.55 + random(`${seed}d${i}`) * 0.6) * (1 - Math.pow(1 - p, 3));
				const len = 10 + 26 * (1 - p);
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: Math.cos(a) * d - len / 2,
							top: Math.sin(a) * d - 1.5,
							width: len,
							height: 3,
							borderRadius: 2,
							transform: `rotate(${a}rad)`,
							background: `linear-gradient(90deg, rgba(255,79,154,0), rgba(255,${200 + (i % 3) * 20},230,${1 - p}))`,
						}}
					/>
				);
			})}
		</div>
	);
};
