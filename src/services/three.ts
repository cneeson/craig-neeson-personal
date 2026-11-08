/**
 * Frame-rate independent exponential smoothing towards a target.
 * `lambda` is the response speed: higher settles faster. Unlike stepping by a fixed
 * fraction per frame, this behaves the same at 30, 60 or 120fps.
 */
export const damp = (current: number, target: number, lambda: number, delta: number) => {
    const next = current + (target - current) * (1 - Math.exp(-lambda * delta));
    return Math.abs(target - next) < 1e-5 ? target : next;
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export const smoothstep = (t: number) => t * t * (3 - 2 * t);
