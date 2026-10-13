import React from 'react';
import {FONT, PHONE, SCREEN} from '../theme';
import {StatusGlyphs} from './icons';

const TITANIUM =
	'linear-gradient(135deg, #9a919c 0%, #ece4ec 12%, #7c7380 26%, #c9c0ca 44%, #5d5660 62%, #d9d0d9 80%, #8a828d 100%)';

/**
 * iPhone-style device with titanium band, extruded thickness (visible when the
 * phone turns in 3D) and a glass reflection. `overlay` children live in the
 * phone's 3D space, in screen coordinates (393x852), and can use translateZ to
 * pop out of the glass (the screen itself clips and flattens its content).
 */
export const Phone: React.FC<{
	children: React.ReactNode;
	overlay?: React.ReactNode;
	/** Reflection position, -1..1 */
	glare?: number;
	/** 0..1 opacity of the device body (frame), the screen stays visible */
	body?: number;
	rim?: number;
	style?: React.CSSProperties;
}> = ({children, overlay, glare = 0, body = 1, rim = 0.35, style}) => {
	const depth = 9;
	const b = PHONE.bezel;
	return (
		<div
			style={{
				position: 'absolute',
				width: PHONE.w,
				height: PHONE.h,
				left: -PHONE.w / 2,
				top: -PHONE.h / 2,
				transformStyle: 'preserve-3d',
				...style,
			}}
		>
			{/* Extruded titanium edge */}
			{body > 0 &&
				Array.from({length: depth}).map((_, i) => (
					<div
						key={i}
						style={{
							position: 'absolute',
							inset: 0,
							borderRadius: PHONE.radius,
							background: i === depth - 1 ? '#1d1b20' : TITANIUM,
							filter: `brightness(${0.55 - i * 0.025})`,
							transform: `translateZ(${-(i + 1) * 1.5}px)`,
							opacity: body,
						}}
					/>
				))}
			{/* Front band + bezel */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					borderRadius: PHONE.radius,
					background: TITANIUM,
					opacity: body,
					boxShadow: `0 0 0 1px rgba(0,0,0,0.6), 0 0 ${90 * rim}px rgba(255,79,154,${0.5 * rim})`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					inset: 3.5,
					borderRadius: PHONE.radius - 3.5,
					background: '#050506',
					opacity: body,
					boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
				}}
			/>
			{/* Side buttons */}
			{body > 0 &&
				[
					{x: -3, y: 150, h: 30},
					{x: -3, y: 205, h: 56},
					{x: -3, y: 272, h: 56},
					{x: PHONE.w - 1, y: 230, h: 90},
				].map((btn, i) => (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: btn.x,
							top: btn.y,
							width: 4,
							height: btn.h,
							borderRadius: 2,
							background: 'linear-gradient(90deg, #6c6470, #d9d0da, #6c6470)',
							opacity: body,
							transform: 'translateZ(-4px)',
						}}
					/>
				))}
			{/* Screen */}
			<div
				style={{
					position: 'absolute',
					left: b,
					top: b,
					width: SCREEN.w,
					height: SCREEN.h,
					borderRadius: SCREEN.radius,
					overflow: 'hidden',
					background: '#000',
					transform: 'translateZ(0.5px)',
				}}
			>
				{children}
				{/* Dynamic island */}
				<div
					style={{
						position: 'absolute',
						top: 11,
						left: (SCREEN.w - 124) / 2,
						width: 124,
						height: 36,
						borderRadius: 18,
						background: '#000',
						zIndex: 50,
						opacity: body,
					}}
				/>
				{/* Glass reflection */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						zIndex: 60,
						opacity: body,
						background: `linear-gradient(115deg, rgba(255,255,255,0) ${28 + glare * 30}%, rgba(255,255,255,0.10) ${38 + glare * 30}%, rgba(255,255,255,0.02) ${46 + glare * 30}%, rgba(255,255,255,0) ${60 + glare * 30}%)`,
						pointerEvents: 'none',
					}}
				/>
			</div>
			{/* Pop-out layers, in screen coordinates */}
			<div
				style={{
					position: 'absolute',
					left: b,
					top: b,
					width: SCREEN.w,
					height: SCREEN.h,
					transformStyle: 'preserve-3d',
					pointerEvents: 'none',
				}}
			>
				{overlay}
			</div>
		</div>
	);
};

export const StatusBar: React.FC<{color?: string}> = ({color = '#fff'}) => (
	<div
		style={{
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			height: 54,
			zIndex: 40,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '4px 30px 0 44px',
			boxSizing: 'border-box',
			fontFamily: FONT.ui,
			fontWeight: 600,
			fontSize: 16.5,
			color,
			letterSpacing: '-0.01em',
		}}
	>
		<span>9:41</span>
		<StatusGlyphs color={color} />
	</div>
);
