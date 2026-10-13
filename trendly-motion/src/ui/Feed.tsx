import React from 'react';
import {C, FEED_H, FONT, SCREEN, TABBAR_H} from '../theme';
import {FEED, FeedItem} from '../data';
import {Avatar, Media, StatusPill, Wordmark} from './Brand';
import {
	IconArrowRight,
	IconBookmark,
	IconBookmarkSolid,
	IconComment,
	IconHeart,
	IconHeartSolid,
	IconHome,
	IconPlay,
	IconShare,
} from './icons';
import {StatusBar} from './Phone';

const shadowText = '0 1px 3px rgba(0,0,0,0.55), 0 0 12px rgba(0,0,0,0.25)';

/** Slow push-in so stills read as footage. */
export const kenBurns = (frame: number, seed = 0) => 1.03 + ((frame + seed * 97) % 900) * 0.00011;

const RailItem: React.FC<{icon: React.ReactNode; label: string; y: number}> = ({icon, label, y}) => (
	<div
		style={{
			position: 'absolute',
			right: 10,
			top: y,
			width: 60,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			gap: 5,
			fontFamily: FONT.ui,
			fontWeight: 600,
			fontSize: 13,
			color: '#fff',
			textShadow: shadowText,
			filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))',
		}}
	>
		{icon}
		<span>{label}</span>
	</div>
);

export const FeedCard: React.FC<{
	item: FeedItem;
	frame: number;
	pillPop?: number;
	press?: number;
	index: number;
}> = ({item, frame, pillPop = 0, press = 0, index}) => {
	const zoom = kenBurns(frame, index);
	const cardTop = 652;
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: SCREEN.w, height: FEED_H, overflow: 'hidden'}}>
			<Media k={item.media} zoom={zoom} focus={item.focus} />
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background:
						'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.55) 100%)',
				}}
			/>
			{/* Status pill */}
			<div
				style={{
					position: 'absolute',
					top: 94,
					left: 0,
					right: 0,
					display: 'flex',
					justifyContent: 'center',
				}}
			>
				<StatusPill
					status={item.status}
					glow={0.35 + pillPop * 0.9}
					style={{transform: `scale(${1 + pillPop * 0.12})`}}
				/>
			</div>
			{/* Right rail */}
			<RailItem y={404} label={item.rail.likes} icon={<IconHeart size={31} color="#fff" stroke={1.9} />} />
			<RailItem y={490} label={item.rail.comments} icon={<IconComment size={31} color="#fff" stroke={1.9} />} />
			<RailItem y={576} label={item.rail.shares} icon={<IconShare size={31} color="#fff" stroke={1.9} />} />
			{/* Glass info card */}
			<div
				style={{
					position: 'absolute',
					left: 12,
					top: cardTop,
					width: SCREEN.w - 24,
					height: 104,
					borderRadius: 22,
					overflow: 'hidden',
					border: '1px solid rgba(255,255,255,0.16)',
					boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 30px rgba(0,0,0,0.3)',
					boxSizing: 'border-box',
				}}
			>
				<div style={{position: 'absolute', left: -12, top: -cardTop, width: SCREEN.w, height: FEED_H}}>
					<Media k={item.media} blur zoom={zoom} focus={item.focus} />
				</div>
				<div style={{position: 'absolute', inset: 0, background: 'rgba(22,20,26,0.42)'}} />
				<div
					style={{
						position: 'absolute',
						left: 11,
						right: 14,
						top: 9,
						height: 38,
						display: 'flex',
						alignItems: 'center',
						gap: 10,
						fontFamily: FONT.ui,
						color: '#fff',
					}}
				>
					<Avatar src={item.avatar} size={34} />
					<span style={{fontWeight: 600, fontSize: 15, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
						{item.handle}
					</span>
					<span style={{display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 14.5}}>
						<IconPlay size={14} />
						{item.views}
					</span>
					<span style={{display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 14.5, marginLeft: 8}}>
						<IconHeartSolid size={15} />
						{item.likes}
					</span>
				</div>
				<div
					style={{
						position: 'absolute',
						left: 10,
						right: 10,
						bottom: 9,
						height: 41,
						borderRadius: 21,
						background: `rgba(255,255,255,${0.09 + press * 0.16})`,
						border: `1px solid rgba(255,255,255,${0.18 + press * 0.3})`,
						boxShadow: press > 0 ? `0 0 ${24 * press}px rgba(255,79,154,${0.45 * press})` : undefined,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 10,
						fontFamily: FONT.ui,
						fontWeight: 500,
						fontSize: 15.5,
						color: '#fff',
						transform: `scale(${1 - press * 0.035})`,
						boxSizing: 'border-box',
					}}
				>
					Voir l’analyse
					<IconArrowRight size={19} stroke={2} />
				</div>
			</div>
		</div>
	);
};

export const TabBar: React.FC<{active: 'feed' | 'saved'; bounce?: number}> = ({active, bounce = 0}) => {
	const tab = (id: 'feed' | 'saved', label: string, x: number) => {
		const on = id === active;
		const color = on ? C.pinkWord : '#a8a7b0';
		const s = on ? 1 + bounce * 0.22 : 1;
		return (
			<div
				style={{
					position: 'absolute',
					left: x - 70,
					width: 140,
					top: 10,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 4,
					fontFamily: FONT.ui,
					fontWeight: on ? 600 : 500,
					fontSize: 13,
					color,
				}}
			>
				<div style={{transform: `scale(${s})`, filter: on ? `drop-shadow(0 0 ${6 + bounce * 10}px rgba(255,79,154,0.6))` : undefined}}>
					{id === 'feed' ? <IconHome size={27} color={color} stroke={1.9} /> : <IconBookmark size={27} color={color} stroke={1.9} />}
				</div>
				<span>{label}</span>
			</div>
		);
	};
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				bottom: 0,
				width: SCREEN.w,
				height: TABBAR_H,
				background: '#0a0a0d',
				borderTop: '1px solid rgba(255,255,255,0.06)',
				zIndex: 30,
			}}
		>
			{tab('feed', 'Feed', 98)}
			{tab('saved', 'Sauvegardées', 295)}
			<div
				style={{
					position: 'absolute',
					bottom: 8,
					left: (SCREEN.w - 134) / 2,
					width: 134,
					height: 5,
					borderRadius: 3,
					background: 'rgba(255,255,255,0.85)',
				}}
			/>
		</div>
	);
};

/** Header shared by the feed: wordmark + bookmark button (landing page mockup). */
const FeedHeader: React.FC<{saved?: number}> = ({saved = 0}) => (
	<>
		<div style={{position: 'absolute', top: 58, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20}}>
			<Wordmark size={23} style={{filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.5))'}} />
		</div>
		<div
			style={{
				position: 'absolute',
				top: 58,
				right: 12,
				width: 50,
				height: 50,
				borderRadius: 25,
				zIndex: 20,
				background: `rgba(${58 + saved * 60},${18},${40 + saved * 10},0.88)`,
				border: '1.5px solid #f04f97',
				boxShadow: `0 0 ${14 + saved * 20}px rgba(255,79,154,${0.35 + saved * 0.4})`,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<IconBookmarkSolid size={24} color={saved > 0.5 ? '#fff' : C.pinkIcon} />
		</div>
	</>
);

/** The TRENDLY feed: vertical swipe between items (scroll = item index). */
export const FeedScreen: React.FC<{
	frame: number;
	scroll: number;
	blur?: number;
	pillPop?: number[];
	press?: number;
	items?: FeedItem[];
	filterId?: string;
}> = ({frame, scroll, blur = 0, pillPop = [], press = 0, items = FEED, filterId = 'feedblur'}) => {
	const active = Math.round(scroll);
	return (
		<div style={{position: 'absolute', inset: 0, background: C.ink, overflow: 'hidden'}}>
			{blur > 0.3 && (
				<svg width="0" height="0" style={{position: 'absolute'}}>
					<filter id={filterId} x="0" y="-20%" width="100%" height="140%">
						<feGaussianBlur stdDeviation={`0 ${blur}`} />
					</filter>
				</svg>
			)}
			<div style={{position: 'absolute', inset: 0, filter: blur > 0.3 ? `url(#${filterId})` : undefined}}>
				{items.map((item, i) => {
					const y = (i - scroll) * FEED_H;
					if (Math.abs(y) >= FEED_H) return null;
					return (
						<div key={i} style={{position: 'absolute', left: 0, top: 0, transform: `translateY(${y}px)`}}>
							<FeedCard item={item} frame={frame} index={i} pillPop={pillPop[i] ?? 0} press={i === active ? press : 0} />
						</div>
					);
				})}
			</div>
			<FeedHeader />
			<StatusBar />
			<TabBar active="feed" />
		</div>
	);
};

/** Finger touch indicator (screen coordinates). */
export const Touch: React.FC<{x: number; y: number; opacity: number; press?: number; ripple?: number}> = ({
	x,
	y,
	opacity,
	press = 0,
	ripple = 0,
}) => {
	if (opacity <= 0.01) return null;
	return (
		<div style={{position: 'absolute', left: x, top: y, zIndex: 80, opacity}}>
			{ripple > 0 && ripple < 1 && (
				<div
					style={{
						position: 'absolute',
						left: -40,
						top: -40,
						width: 80,
						height: 80,
						borderRadius: 40,
						border: '2px solid rgba(255,255,255,0.9)',
						transform: `scale(${0.4 + ripple * 1.3})`,
						opacity: 1 - ripple,
					}}
				/>
			)}
			<div
				style={{
					position: 'absolute',
					left: -22,
					top: -22,
					width: 44,
					height: 44,
					borderRadius: 22,
					background: 'radial-gradient(circle, rgba(255,255,255,0.55), rgba(255,255,255,0.25))',
					border: '2px solid rgba(255,255,255,0.85)',
					boxShadow: '0 0 18px rgba(255,255,255,0.35), 0 0 30px rgba(255,79,154,0.35)',
					transform: `scale(${1 - press * 0.2})`,
					boxSizing: 'border-box',
				}}
			/>
		</div>
	);
};
