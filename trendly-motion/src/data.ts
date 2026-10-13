// Everything the film says and shows, in one place. Swap media files in
// public/media/ (same names) or edit these values to re-cut the film.

export type Status = 'emergent' | 'croissance' | 'viral';
export type MediaKey = 'gold' | 'paris' | 'jeans' | 'gold-bw' | 'paris-bw' | 'gold-duo' | 'paris-duo';

export const STATUS_LABEL: Record<Status, string> = {
	emergent: 'ÉMERGENT',
	croissance: 'CROISSANCE',
	viral: 'VIRAL',
};

export type FeedItem = {
	media: MediaKey;
	handle: string;
	avatar: string;
	status: Status;
	views: string;
	likes: string;
	rail: {likes: string; comments: string; shares: string};
	/** Focus point of the frame (object-position), 0..1 */
	focus: [number, number];
};

// Feed order in the swipe: CROISSANCE → VIRAL (the analysed video).
export const FEED: FeedItem[] = [
	{
		media: 'paris',
		handle: '@chloeprs',
		avatar: 'avatar-chloe.jpg',
		status: 'croissance',
		views: '2,3M',
		likes: '129,4K',
		rail: {likes: '142,6K', comments: '1 203', shares: '2 871'},
		focus: [0.55, 0.5],
	},
	{
		media: 'gold',
		handle: '@anisiafromsprouts',
		avatar: 'avatar-anisia.jpg',
		status: 'viral',
		views: '6 M',
		likes: '1,3 M',
		rail: {likes: '1,3M', comments: '1 557', shares: '43,8K'},
		focus: [0.5, 0.45],
	},
];

export type Reason = {title: string; detail: string; pts: number; max: number; ok: boolean};

// Analysis sheet - values from the MVP screenshot.
export const ANALYSIS = {
	score: 75,
	status: 'viral' as Status,
	title: 'in love with this outfit 🤌🏼 #ootd #fyp',
	handle: '@anisiafromsprouts',
	metrics: [
		{label: 'VUES', value: 6_000_000, kind: 'count'},
		{label: 'LIKES', value: 1_300_000, kind: 'count'},
		{label: 'COMMENTAIRES', value: 1_557, kind: 'count'},
		{label: 'PARTAGES', value: 43_800, kind: 'count'},
		{label: 'SAVES TIKTOK', value: 90_300, kind: 'count'},
		{label: 'TAUX D’ENGAGEMENT', value: 23.9, kind: 'percent'},
	] as const,
	note: 'Engagement : likes, commentaires, partages et saves TikTok rapportés aux vues.',
	reasons: [
		{title: 'Portée', detail: '6 000 000 vues', pts: 30, max: 30, ok: true},
		{title: 'Engagement', detail: '23.9% d’interactions par vue', pts: 28, max: 35, ok: true},
		{title: 'Conversation', detail: '1557 commentaires', pts: 15, max: 15, ok: true},
		{title: 'Demande', detail: '2 signal(aux) d’achat/recherche sur 49 commentaire(s) analysé(s)', pts: 3, max: 20, ok: false},
	] as Reason[],
};
export type Analysis = typeof ANALYSIS;

// "Sauvegardées" grid (3 columns): tiles already saved before the film's save.
export type Tile = {media: MediaKey; status: Status; views: string; zoom: number; focus: [number, number]; mirror?: boolean};
export const SAVED: Tile[] = [
	{media: 'paris', status: 'croissance', views: '2,3M', zoom: 1, focus: [0.55, 0.45]},
	// jeans.jpg comes from a small thumbnail: only crops that avoid its retouched centre
	{media: 'jeans', status: 'emergent', views: '84,2K', zoom: 2.9, focus: [0.52, 0.02]},
	{media: 'gold', status: 'viral', views: '829,1K', zoom: 1.9, focus: [0.25, 0.62]},
	{media: 'paris', status: 'viral', views: '3,1M', zoom: 2.1, focus: [0.42, 0.88]},
	{media: 'jeans', status: 'croissance', views: '512K', zoom: 2.9, focus: [0.48, 1]},
	{media: 'gold', status: 'emergent', views: '61,7K', zoom: 1.6, focus: [0.55, 0.3]},
	{media: 'paris', status: 'emergent', views: '47,9K', zoom: 1.5, focus: [0.6, 0.25]},
	{media: 'gold', status: 'croissance', views: '388K', zoom: 2.2, focus: [0.7, 0.55]},
];

// The analysed video, saved during the film (lands in the first slot).
export const NEW_TILE: Tile = {media: 'gold', status: 'viral', views: '6 M', zoom: 1, focus: [0.5, 0.42]};

// --- Variants -------------------------------------------------------------
// original : the launch film (features first).
// vendeurs : the same film aimed at fashion sellers (boutiques, e-shops,
//            brands, resellers), built around the « Demande » criterion.
export type Variant = 'original' | 'vendeurs';
export type Line = {text: string; accent?: boolean};
export type Copy = {
	hookA: Line[];
	hookB: Line[];
	feed: Line[];
	feedSub: string;
	status: string;
	analysis: Line[];
	analysisSub: string;
	/** Optional second caption when the « Pourquoi ce score ? » card shows */
	analysisSub2?: string;
	save: Line[];
	tagline: string;
	/** Light up the « Demande » row of the analysis */
	highlightDemand?: boolean;
};

export const COPIES: Record<Variant, Copy> = {
	original: {
		hookA: [{text: 'Des milliers'}, {text: 'de vidéos mode.'}],
		hookB: [{text: 'Lesquelles'}, {text: 'décollent ?', accent: true}],
		feed: [{text: 'Un feed'}, {text: '100 % mode.', accent: true}],
		feedSub: 'Swipez. Repérez.',
		status: 'Chaque vidéo a son statut.',
		analysis: [{text: 'Le score'}, {text: 'TRENDLY.', accent: true}],
		analysisSub: 'Toutes les métriques. Et pourquoi.',
		save: [{text: 'Sauvegardez'}, {text: 'vos opportunités.', accent: true}],
		tagline: 'Repérez les vidéos mode qui décollent.',
	},
	vendeurs: {
		hookA: [{text: 'Vous vendez'}, {text: 'de la mode ?', accent: true}],
		hookB: [{text: 'Vos prochains'}, {text: 'best-sellers'}, {text: 'sont sur TikTok.', accent: true}],
		feed: [{text: 'Un feed'}, {text: '100 % mode.', accent: true}],
		feedSub: 'Swipez les tendances TikTok.',
		status: 'Repérez-les dès qu’elles émergent.',
		analysis: [{text: 'Le score'}, {text: 'TRENDLY.', accent: true}],
		analysisSub: 'Portée, engagement, conversation…',
		analysisSub2: '… et la vraie demande d’achat.',
		save: [{text: 'Sauvegardez'}, {text: 'vos opportunités.', accent: true}],
		tagline: 'Vendez la tendance avant les autres.',
		highlightDemand: true,
	},
};

// Demo data of the seller cut: a viral video whose comments show strong
// purchase intent (the score is the sum of the four criteria).
export const ANALYSES: Record<Variant, Analysis> = {
	original: ANALYSIS,
	vendeurs: {
		...ANALYSIS,
		score: 89,
		reasons: [
			...ANALYSIS.reasons.slice(0, 3),
			{title: 'Demande', detail: '21 signal(aux) d’achat/recherche sur 49 commentaire(s) analysé(s)', pts: 16, max: 20, ok: true},
		],
	},
};

/** French compact number formatting, as in the app: 6 M, 1,3 M, 43,8 k. */
export const formatCount = (v: number): string => {
	const fmt = (n: number, unit: string) => `${n.toFixed(1).replace('.', ',').replace(/,0$/, '')} ${unit}`;
	if (v >= 999_950) return fmt(v / 1_000_000, 'M');
	if (v >= 1_000) return fmt(v / 1_000, 'k');
	return String(Math.round(v));
};

export const formatPercent = (v: number) => `${v.toFixed(1).replace('.', ',')} %`;
