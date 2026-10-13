import React from 'react';
import {Composition} from 'remotion';
import './fonts';
import {Film} from './Film';
import {DURATION} from './timeline';
import {UiSheet} from './UiSheet';

export const Root: React.FC = () => (
	<>
		<Composition id="Trendly-16x9" component={Film} durationInFrames={DURATION} fps={60} width={1920} height={1080} />
		<Composition id="Trendly-9x16" component={Film} durationInFrames={DURATION} fps={60} width={1080} height={1920} />
		{/* Seller cut: who it is for (fashion sellers) and the « Demande » criterion */}
		<Composition id="Trendly-Vendeurs-16x9" component={Film} durationInFrames={DURATION} fps={60} width={1920} height={1080} defaultProps={{variant: 'vendeurs' as const}} />
		<Composition id="Trendly-Vendeurs-9x16" component={Film} durationInFrames={DURATION} fps={60} width={1080} height={1920} defaultProps={{variant: 'vendeurs' as const}} />
		<Composition id="UiSheet" component={UiSheet} durationInFrames={1} fps={60} width={2560} height={1100} />
	</>
);
