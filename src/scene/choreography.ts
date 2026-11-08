import { clamp01, lerp, smoothstep } from '@/services/three';

/**
 * The whole 3D journey is a pure function of scroll progress (0 → 1 across the scene track).
 * Keeping it stateless means scrubbing backwards, jumping (e.g. reload mid-page) and
 * resizing all land on exactly the same frame.
 */

export interface SceneFrame {
    earthRotationY: number;
    cameraZ: number;
    cameraRotationX: number;
}

type Keyframe = SceneFrame & { at: number };

// Each segment eases in/out, so the camera decelerates into the "dwell" segments
// where a caption and markers are on screen.
const keyframes: Keyframe[] = [
    { at: 0.00, earthRotationY: 0, cameraZ: 10, cameraRotationX: 0 },
    // Swoop down over the horizon to Northern Ireland
    { at: 0.20, earthRotationY: -0.35, cameraZ: 10.75, cameraRotationX: -0.375 },
    { at: 0.38, earthRotationY: -0.42, cameraZ: 10.95, cameraRotationX: -0.375 },
    // Drift east and rise slightly to take in Europe
    { at: 0.52, earthRotationY: -0.68, cameraZ: 11.25, cameraRotationX: -0.375 },
    { at: 0.72, earthRotationY: -0.82, cameraZ: 11.3, cameraRotationX: -0.37 },
    // Pull right out to reveal the whole planet and the sun
    { at: 1.00, earthRotationY: -2.1, cameraZ: 17, cameraRotationX: -0.25 },
];

/** [start, end] progress ranges where captions/markers are shown. */
export const windows = {
    hero: [0, 0.04],
    northernIreland: [0.18, 0.4],
    europe: [0.5, 0.74],
} as const;

const FADE = 0.035;

/** 0 → 1 → 0 opacity envelope for a window, with soft edges. */
export const windowOpacity = (progress: number, [start, end]: readonly [number, number], fade = FADE) =>
    Math.min(
        smoothstep(clamp01((progress - start) / fade)),
        smoothstep(clamp01((end - progress) / fade)),
    );

export const frameAt = (progress: number): SceneFrame => {
    const p = clamp01(progress);
    const nextIndex = keyframes.findIndex(k => k.at >= p);
    if (nextIndex <= 0) return keyframes[0];

    const from = keyframes[nextIndex - 1];
    const to = keyframes[nextIndex];
    const t = smoothstep((p - from.at) / (to.at - from.at));

    return {
        earthRotationY: lerp(from.earthRotationY, to.earthRotationY, t),
        cameraZ: lerp(from.cameraZ, to.cameraZ, t),
        cameraRotationX: lerp(from.cameraRotationX, to.cameraRotationX, t),
    };
};

/**
 * Bloom is strong for the atmospheric shots, and pulled back while markers are shown
 * so the map stays crisp.
 */
export const bloomThresholdAt = (progress: number) => {
    const focus = Math.max(
        windowOpacity(progress, windows.northernIreland, 0.06),
        windowOpacity(progress, windows.europe, 0.06),
    );
    return lerp(0.3, 0.9, focus);
};
