import {Easing, spring} from 'remotion';

export type EaseFn = (t: number) => number;

export const ease = {
	linear: (t: number) => t,
	out: Easing.bezier(0.22, 1, 0.36, 1),
	outExpo: Easing.bezier(0.16, 1, 0.3, 1),
	outSoft: Easing.bezier(0.33, 1, 0.68, 1),
	in: Easing.bezier(0.55, 0, 1, 0.45),
	inExpo: Easing.bezier(0.7, 0, 0.84, 0),
	inOut: Easing.bezier(0.65, 0, 0.35, 1),
	inOutExpo: Easing.bezier(0.87, 0, 0.13, 1),
	smooth: Easing.bezier(0.45, 0, 0.15, 1),
	outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
	outBackSoft: Easing.bezier(0.3, 1.3, 0.6, 1),
} satisfies Record<string, EaseFn>;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Eased 0..1 progress of `frame` between f0 and f1. */
export const prog = (frame: number, f0: number, f1: number, e: EaseFn = ease.linear) =>
	e(clamp((frame - f0) / (f1 - f0)));

/** Tween a value between two frames. */
export const tw = (frame: number, f0: number, f1: number, v0: number, v1: number, e: EaseFn = ease.out) =>
	lerp(v0, v1, prog(frame, f0, f1, e));

/** Piecewise keyframes: [frame, value, easing to the next key]. */
export type Key = readonly [number, number, EaseFn?];
export const kf = (frame: number, keys: readonly Key[]): number => {
	if (frame <= keys[0][0]) return keys[0][1];
	for (let i = 0; i < keys.length - 1; i++) {
		const [f0, v0, e] = keys[i];
		const [f1, v1] = keys[i + 1];
		if (frame <= f1) return lerp(v0, v1, (e ?? ease.inOut)(clamp((frame - f0) / (f1 - f0))));
	}
	return keys[keys.length - 1][1];
};

/** Fade window: 0 before `a`, 1 between `b` and `c`, 0 after `d`. */
export const win = (frame: number, a: number, b: number, c: number, d: number, e: EaseFn = ease.out) =>
	Math.min(prog(frame, a, b, e), 1 - prog(frame, c, d, ease.in));

export const FPS = 60;

/** Damped spring that starts at `f0` (0 → 1, may overshoot). */
export const springAt = (frame: number, f0: number, damping = 14, stiffness = 170, mass = 1) =>
	spring({frame: frame - f0, fps: FPS, config: {damping, stiffness, mass}});

/** Bell-shaped pulse peaking at `peak` with a half width of `w` frames. */
export const pulse = (frame: number, peak: number, w: number) => {
	const x = (frame - peak) / w;
	return Math.exp(-x * x * 2.5);
};
