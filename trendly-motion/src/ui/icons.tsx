import React from 'react';

// Line icons in the style used by the MVP (Lucide-like, 24x24 grid).
type P = {size?: number; color?: string; stroke?: number; fill?: string; style?: React.CSSProperties};

const Svg: React.FC<P & {children: React.ReactNode}> = ({size = 24, color = 'currentColor', stroke = 2, fill = 'none', style, children}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill={fill}
		stroke={color}
		strokeWidth={stroke}
		strokeLinecap="round"
		strokeLinejoin="round"
		style={{display: 'block', overflow: 'visible', ...style}}
	>
		{children}
	</svg>
);

export const IconHome: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M3.5 10.2a2 2 0 0 1 .72-1.54l6.5-5.47a2 2 0 0 1 2.56 0l6.5 5.47a2 2 0 0 1 .72 1.54V19a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
		<circle cx="12" cy="15.2" r="1.25" fill={p.color ?? 'currentColor'} stroke="none" />
	</Svg>
);

export const IconBookmark: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
	</Svg>
);

// Solid ribbon bookmark (feed save button)
export const IconBookmarkSolid: React.FC<{size?: number; color?: string}> = ({size = 24, color = '#fe508f'}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block'}}>
		<path d="M6 3.2h12v17.6l-6-4.6-6 4.6z" fill={color} />
	</svg>
);

export const IconHeart: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
	</Svg>
);

export const IconComment: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
		<path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth={(p.stroke ?? 2) * 1.5} />
	</Svg>
);

export const IconShare: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M14 5.5 21 12l-7 6.5v-3.6c-5.2 0-8.3 1.4-11 4.6.9-5.8 4.3-9.6 11-10.3z" />
	</Svg>
);

export const IconPlay: React.FC<{size?: number; color?: string}> = ({size = 24, color = '#fff'}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block'}}>
		<path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l11.7-7.4a1 1 0 0 0 0-1.7L8.52 3.75A1 1 0 0 0 7 4.6z" fill={color} />
	</svg>
);

export const IconHeartSolid: React.FC<{size?: number; color?: string}> = ({size = 24, color = '#fff'}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block'}}>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill={color} />
	</svg>
);

export const IconArrowRight: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M5 12h14M12 5l7 7-7 7" />
	</Svg>
);

export const IconArrowLeft: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M19 12H5M12 19l-7-7 7-7" />
	</Svg>
);

export const IconTrendUp: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
		<path d="M16 7h6v6" />
	</Svg>
);

// Diagonal arrow used in the "Pourquoi ce score ?" rows
export const IconArrowUpRight: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M7 17 17 7M8 7h9v9" />
	</Svg>
);

export const IconCircle: React.FC<P> = (p) => (
	<Svg {...p}>
		<circle cx="12" cy="12" r="8" />
	</Svg>
);

export const IconSprout: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M7 20h10" />
		<path d="M10 20c5.5-2.5.8-6.4 3-10" />
		<path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
		<path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
	</Svg>
);

export const IconVolume: React.FC<P> = (p) => (
	<Svg {...p}>
		<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z" />
		<path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8" />
	</Svg>
);

export const Emoji: React.FC<{char: string; size: number; style?: React.CSSProperties}> = ({char, size, style}) => (
	<span style={{fontFamily: 'TrendlyEmoji', fontSize: size, lineHeight: 1, display: 'inline-block', ...style}}>{char}</span>
);

// iOS status bar glyphs
export const StatusGlyphs: React.FC<{color?: string}> = ({color = '#fff'}) => (
	<div style={{display: 'flex', alignItems: 'center', gap: 6}}>
		<svg width="19" height="12" viewBox="0 0 19 12">
			{[0, 1, 2, 3].map((i) => (
				<rect key={i} x={i * 5} y={9 - i * 3} width="3.2" height={3 + i * 3} rx="1" fill={color} />
			))}
		</svg>
		<svg width="17" height="12" viewBox="0 0 17 12">
			<path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.6 10.6 0 0 0 8.5.5 10.6 10.6 0 0 0 1 3.5l1.2 1.3a9 9 0 0 1 6.3-2.5z" fill={color} />
			<path d="M8.5 5.9c1.4 0 2.7.5 3.7 1.4l1.2-1.3a7.2 7.2 0 0 0-9.8 0l1.2 1.3c1-.9 2.3-1.4 3.7-1.4z" fill={color} />
			<path d="m8.5 11.3 2.4-2.6a3.6 3.6 0 0 0-4.8 0z" fill={color} />
		</svg>
		<svg width="27" height="13" viewBox="0 0 27 13">
			<rect x="0.5" y="0.5" width="22.5" height="12" rx="3.6" fill="none" stroke={color} strokeOpacity="0.4" />
			<rect x="2.2" y="2.2" width="19" height="8.6" rx="2.2" fill={color} />
			<path d="M24.5 4.4v4.2a2.2 2.2 0 0 0 0-4.2z" fill={color} fillOpacity="0.45" />
		</svg>
	</div>
);
