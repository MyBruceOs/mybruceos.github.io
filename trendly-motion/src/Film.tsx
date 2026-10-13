import React from 'react';
import {AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {COPY} from './data';
import {Background, Flare, Grain, Particles, Vignette} from './fx/Fx';
import {Caption, KineticText} from './fx/KineticText';
import {ease, kf, prog, pulse, win} from './lib/anim';
import {Finale} from './scenes/Finale';
import {Hook} from './scenes/Hook';
import {PhoneStory} from './scenes/PhoneStory';
import {statusHit, Statuses} from './scenes/Statuses';
import {Fmt, T, useFmt} from './timeline';

const accent = (text: string) => ({text, accent: true});

/** Headlines of each beat, placed per format. */
const Texts: React.FC<{frame: number; fmt: Fmt; W: number; H: number}> = ({frame, fmt}) => {
	const land = fmt === 'landscape';
	const left: React.CSSProperties = {left: 150, top: '50%', transform: 'translateY(-50%)'};
	const right: React.CSSProperties = {left: 1050, top: '50%', transform: 'translateY(-50%)'};
	const top: React.CSSProperties = {left: 0, right: 0, top: 230};
	const block = (pos: React.CSSProperties, children: React.ReactNode) => <div style={{position: 'absolute', ...pos}}>{children}</div>;
	const H1 = land ? 104 : 112;
	return (
		<>
			{/* 1. Hook */}
			{block(
				land ? left : top,
				<>
					<KineticText
						lines={COPY.hookA.map((t) => ({text: t}))}
						frame={frame}
						start={T.hookText1}
						exit={T.hookText1Exit}
						size={H1}
						align={land ? 'left' : 'center'}
						style={{position: 'relative'}}
					/>
				</>,
			)}
			{block(
				land ? left : top,
				<KineticText
					lines={[{text: COPY.hookB[0]}, accent(COPY.hookB[1])]}
					frame={frame}
					start={T.hookText2}
					exit={T.hookText2Exit}
					size={H1}
					align={land ? 'left' : 'center'}
					style={{position: 'relative'}}
				/>,
			)}
			{/* 2. Feed */}
			{block(
				land ? left : {...top, top: 170},
				<div style={{display: 'flex', flexDirection: 'column', alignItems: land ? 'flex-start' : 'center'}}>
					<KineticText
						lines={[{text: COPY.feed[0]}, accent(COPY.feed[1])]}
						frame={frame}
						start={T.feedText}
						exit={T.feedExit}
						size={land ? 100 : 104}
						align={land ? 'left' : 'center'}
						style={{position: 'relative'}}
					/>
					<Caption
						text={COPY.feedSub}
						frame={frame}
						start={T.feedText + 22}
						exit={T.feedExit}
						size={land ? 40 : 42}
						style={{position: 'relative', marginTop: 18}}
					/>
				</div>,
			)}
			{/* 3. Statuses */}
			{block(
				land ? {left: 150, top: 120} : {left: 0, right: 0, top: 170},
				<KineticText
					lines={[{text: COPY.status, size: land ? 64 : 62, weight: 800}]}
					frame={frame}
					start={T.statusText}
					exit={T.statusExit}
					size={land ? 64 : 62}
					stagger={0.55}
					align={land ? 'left' : 'center'}
					style={{position: 'relative'}}
				/>,
			)}
			{/* 4. Analysis */}
			{block(
				land ? {...right, left: 1110} : {...top, top: 130},
				<div style={{display: 'flex', flexDirection: 'column', alignItems: land ? 'flex-start' : 'center'}}>
					<KineticText
						lines={[{text: COPY.analysis[0]}, accent(COPY.analysis[1])]}
						frame={frame}
						start={T.analysisText}
						exit={T.analysisExit}
						size={land ? 104 : 96}
						align={land ? 'left' : 'center'}
						style={{position: 'relative'}}
					/>
					<Caption
						text={COPY.analysisSub}
						frame={frame}
						start={T.analysisText + 26}
						exit={T.analysisExit}
						size={land ? 38 : 42}
						style={{position: 'relative', marginTop: 18}}
					/>
				</div>,
			)}
			{/* 5. Save */}
			{block(
				land ? right : {...top, top: 170},
				<KineticText
					lines={[{text: COPY.save[0]}, accent(COPY.save[1])]}
					frame={frame}
					start={T.saveText}
					exit={T.saveExit}
					size={land ? 84 : 94}
					align={land ? 'left' : 'center'}
					style={{position: 'relative'}}
				/>,
			)}
		</>
	);
};

export const Film: React.FC = () => {
	const frame = useCurrentFrame();
	const {width: W, height: H} = useVideoConfig();
	const fmt = useFmt();
	const viral = statusHit(2);
	const heat = kf(frame, [
		[0, 1.5, ease.out],
		[60, 0.9],
		[T.statusIn, 0.9, ease.inOut],
		[viral + 4, 1.9, ease.out],
		[T.tapAnalysis, 1.0],
		[T.morph[0] - 10, 1.0, ease.inOut],
		[T.hit, 2.0, ease.out],
		[900, 1.6],
	]);
	// Opening light: a hot anamorphic streak that rips the frame open
	const open = 1 - prog(frame, 0, 30, ease.out);
	// Pink light leaks on each transition
	const leak = Math.max(
		pulse(frame, T.matchCut, 16),
		pulse(frame, T.statusIn + 8, 18),
		pulse(frame, T.tapAnalysis, 16),
		pulse(frame, T.fly[0] + 10, 16),
		pulse(frame, T.morph[0] + 12, 20),
	);
	return (
		<AbsoluteFill style={{background: '#060608', overflow: 'hidden'}}>
			<Background frame={frame} heat={heat} vertical={fmt === 'portrait'} />
			<Particles frame={frame} w={W} h={H} count={fmt === 'landscape' ? 46 : 54} opacity={0.55} />
			<Hook frame={frame} fmt={fmt} W={W} H={H} />
			{/* dark side gradient behind the hook headline */}
			<AbsoluteFill
				style={{
					background:
						fmt === 'landscape'
							? 'linear-gradient(90deg, rgba(6,6,8,0.92) 0%, rgba(6,6,8,0.7) 32%, rgba(6,6,8,0) 62%)'
							: 'linear-gradient(180deg, rgba(6,6,8,0.92) 0%, rgba(6,6,8,0.65) 24%, rgba(6,6,8,0) 44%)',
					opacity: prog(frame, 2, 20) * (1 - prog(frame, 108, T.matchCut)),
				}}
			/>
			<PhoneStory frame={frame} fmt={fmt} W={W} H={H} />
			{/* push the phone back while the status curve has the stage */}
			<AbsoluteFill style={{background: 'rgba(6,6,8,0.5)', opacity: win(frame, T.statusIn, T.statusIn + 30, T.statusExit, T.statusExit + 20)}} />
			<Statuses frame={frame} fmt={fmt} W={W} H={H} />
			<Texts frame={frame} fmt={fmt} W={W} H={H} />
			<Finale frame={frame} fmt={fmt} W={W} H={H} />
			<Flare x={W / 2} y={H / 2} intensity={open * 1.15} width={W * 1.7} />
			<AbsoluteFill
				style={{
					background: `radial-gradient(120% 90% at ${fmt === 'landscape' ? '85% 20%' : '70% 15%'}, rgba(255,80,160,${0.28 * leak}), rgba(255,80,160,0) 60%)`,
					mixBlendMode: 'screen',
					pointerEvents: 'none',
				}}
			/>
			<Vignette strength={0.7} />
			<Grain frame={frame} opacity={0.07} />
			{/* synthesised by scripts/sound_design.py, cued on the same frames */}
			<Html5Audio src={staticFile('audio/trendly-sound.wav')} />
		</AbsoluteFill>
	);
};
