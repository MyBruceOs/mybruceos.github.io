import React from 'react';
import {clamp, ease} from '../lib/anim';

// Vector rebuild of the TRENDLY app icon (neon magenta squircle, black "T"
// whose right arm turns into a rising arrow), 240x240 viewBox.
const BAR = 'M 54 90 Q 66 74 96 79 L 118 85';
const STEM = 'M 118 94 L 118 184';
const ARM = 'M 128 97 C 150 101 166 92 181 70';
const HEAD = '166,55 205,41 198,82';

const FLICKER = [0, 0.85, 0.12, 0.9, 0.3, 1, 0.65, 1];

export const LogoIcon: React.FC<{
	size: number;
	/** 0..1 neon ignition (flicker) of the T */
	ignite?: number;
	/** 0..1 the right arm draws out of the T */
	arm?: number;
	/** arrowhead pop, spring value (0 → ~1) */
	head?: number;
	/** 0..1 squircle body */
	body?: number;
	/** specular sweep position, -0.5..1.5 */
	shine?: number;
	glow?: number;
	id?: string;
	style?: React.CSSProperties;
}> = ({size, ignite = 1, arm = 1, head = 1, body = 1, shine = -1, glow = 1, id = 'logo', style}) => {
	const flick = ignite >= 1 ? 1 : FLICKER[Math.min(7, Math.floor(clamp(ignite) * 8))];
	const back = 1 - clamp(head);
	const glyph = (stroke: string, extra: number, filter?: string) => (
		<g filter={filter} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
			<g opacity={flick}>
				<path d={BAR} strokeWidth={34 + extra} />
				<path d={STEM} strokeWidth={40 + extra} />
			</g>
			{arm > 0.002 && <path d={ARM} strokeWidth={22 + extra} pathLength={1} strokeDasharray={`${arm} 1.2`} />}
			{head > 0.002 && (
				<polygon
					points={HEAD}
					fill={stroke}
					strokeWidth={extra > 0 ? extra : 0.01}
					style={{
						transformOrigin: '185px 62px',
						transformBox: 'view-box',
						transform: `translate(${-16 * back}px, ${20 * back}px) scale(${Math.max(0, head)})`,
					}}
				/>
			)}
		</g>
	);
	const b = clamp(body);
	return (
		<svg width={size} height={size} viewBox="0 0 240 240" style={{display: 'block', overflow: 'visible', ...style}}>
			<defs>
				<radialGradient id={`${id}-fill`} cx="50%" cy="56%" r="62%">
					<stop offset="0%" stopColor="#020001" />
					<stop offset="42%" stopColor="#14010c" />
					<stop offset="66%" stopColor="#4c0530" />
					<stop offset="86%" stopColor="#b3106a" />
					<stop offset="100%" stopColor="#ff3c9f" />
				</radialGradient>
				<linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stopColor="#ff9fd4" />
					<stop offset="45%" stopColor="#ff2f93" />
					<stop offset="100%" stopColor="#ff6fc0" />
				</linearGradient>
				<radialGradient id={`${id}-gloss`} cx="30%" cy="18%" r="45%">
					<stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
					<stop offset="100%" stopColor="#fff" stopOpacity="0" />
				</radialGradient>
				<linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
					<stop offset={`${clamp(shine - 0.12) * 100}%`} stopColor="#fff" stopOpacity="0" />
					<stop offset={`${clamp(shine) * 100}%`} stopColor="#fff" stopOpacity="0.42" />
					<stop offset={`${clamp(shine + 0.12) * 100}%`} stopColor="#fff" stopOpacity="0" />
				</linearGradient>
				<clipPath id={`${id}-clip`}>
					<rect x="14" y="14" width="212" height="212" rx="54" />
				</clipPath>
				<filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="7" />
				</filter>
				<filter id={`${id}-halo`} x="-60%" y="-60%" width="220%" height="220%">
					<feGaussianBlur stdDeviation="16" />
				</filter>
			</defs>
			{/* Outer halo */}
			<rect x="14" y="14" width="212" height="212" rx="54" fill="#ff2d8f" opacity={0.55 * glow * b} filter={`url(#${id}-halo)`} />
			<g opacity={b} style={{transformOrigin: '120px 120px', transformBox: 'view-box', transform: `scale(${0.82 + 0.18 * ease.outBack(b)})`}}>
				<rect x="10" y="10" width="220" height="220" rx="58" fill="#07020a" />
				<rect x="14" y="14" width="212" height="212" rx="54" fill={`url(#${id}-fill)`} />
				<g clipPath={`url(#${id}-clip)`}>
					{/* light streaks */}
					<path d="M 4 150 Q 70 112 150 236" stroke="#ff5fb6" strokeWidth="2.2" fill="none" opacity="0.35" />
					<path d="M 0 182 Q 60 150 118 240" stroke="#ff8fcc" strokeWidth="1.5" fill="none" opacity="0.28" />
					<path d="M 236 150 Q 190 170 168 240" stroke="#ff5fb6" strokeWidth="1.6" fill="none" opacity="0.22" />
					<ellipse cx="78" cy="40" rx="74" ry="26" fill={`url(#${id}-gloss)`} transform="rotate(-18 78 40)" />
					<rect x="0" y="0" width="240" height="240" fill={`url(#${id}-shine)`} />
				</g>
				<rect x="14" y="14" width="212" height="212" rx="54" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="5" />
				<rect x="20" y="20" width="200" height="200" rx="49" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" />
			</g>
			{/* Neon glyph: glow, pink outline, black body */}
			<g opacity={0.7 * glow}>{glyph('#ff3ea0', 9, `url(#${id}-blur)`)}</g>
			{glyph('#ff58b0', 7)}
			{glyph('#040104', 0)}
		</svg>
	);
};
