import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Phone} from './ui/Phone';
import {FeedScreen} from './ui/Feed';
import {AnalysisScreen} from './ui/Analysis';
import {SavedScreen} from './ui/Saved';
import {LogoIcon} from './ui/LogoIcon';
import {StatusPill, Wordmark} from './ui/Brand';

// Static contact sheet of every UI piece, used to check fidelity against the
// MVP screenshots (npx remotion still UiSheet).
export const UiSheet: React.FC = () => (
	<AbsoluteFill style={{background: '#222'}}>
		{[0, 1].map((s, i) => (
			<div key={i} style={{position: 'absolute', left: 260 + i * 470, top: 550}}>
				<Phone>
					<FeedScreen frame={0} scroll={s} pillPop={[0, 0]} />
				</Phone>
			</div>
		))}
		<div style={{position: 'absolute', left: 260 + 2 * 470, top: 550}}>
			<Phone>
				<AnalysisScreen frame={0} ring={1} count={1} tiles={() => 1} reasons={() => 1} pillPop={1} />
			</Phone>
		</div>
		<div style={{position: 'absolute', left: 260 + 3 * 470, top: 550}}>
			<Phone>
				<AnalysisScreen frame={0} ring={1} count={1} tiles={() => 1} reasons={() => 1} pillPop={1} scroll={330} saved={1} />
			</Phone>
		</div>
		<div style={{position: 'absolute', left: 260 + 4 * 470, top: 550}}>
			<Phone>
				<SavedScreen frame={0} shift={0} />
			</Phone>
		</div>
		<div style={{position: 'absolute', left: 2130, top: 40, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
			<LogoIcon size={200} />
			<Wordmark size={44} />
			<StatusPill status="emergent" />
			<StatusPill status="croissance" />
			<StatusPill status="viral" />
			<StatusPill status="viral" scale={2} glow={1} />
		</div>
	</AbsoluteFill>
);
