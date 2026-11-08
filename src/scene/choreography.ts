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
    cameraRotationY: number;
}

type Track = keyof SceneFrame;
const tracks: Track[] = ['earthRotationY', 'cameraZ', 'cameraRotationX', 'cameraRotationY'];

/**
 * The beats of the journey as [start, end] progress ranges. For the captioned beats this is
 * the stretch where the caption is fully readable: it fades in just before and out just after.
 */
export const windows = {
    hero: [0, 0.04],
    northernIreland: [0.13, 0.23],
    // The flight over Belfast, between diving into the clouds and climbing back out of them
    belfast: [0.3, 0.6],
    // The introduction, as the flight heads in towards the cranes
    belfastIntro: [0.355, 0.44],
    europe: [0.68, 0.78],
    reveal: [0.78, 0.94],
} as const;

/** Beats with markers on the planet, which pull the bloom back so the map stays crisp. */
const marked = [windows.northernIreland, windows.europe];
/** Beats that scrolling settles onto: the markers, and the introduction over Belfast. */
const settled = [windows.northernIreland, windows.belfastIntro, windows.europe];

/** How far either side of a readable window its caption and markers fade over. */
export const FADE = 0.04;

type Keyframe = Partial<SceneFrame> & {
    at: number;
    /** Overrides for portrait screens, which have a much narrower horizontal view. */
    portrait?: Partial<SceneFrame>;
};

// The camera arrives at each beat's framing as its caption becomes readable, then drifts
// slowly through it rather than stopping. Unset values carry over from the previous keyframe.
// Until the clouds over Belfast the camera follows the glide from orbit instead (see approachAt), and only the
// earth's spin comes from here.
const keyframes: Keyframe[] = [
    // Turned so the camera starts out looking away from the sun, which would wash out the planet under the
    // title, then spun into position under it
    { at: 0, earthRotationY: -0.6, cameraZ: 10, cameraRotationX: 0, cameraRotationY: 0 },
    // Over Northern Ireland. From there the camera dives into the clouds, and climbs back out of them
    // (see diveAt) to pull back across Europe.
    { at: windows.northernIreland[0], earthRotationY: -0.36, cameraZ: 10.75, cameraRotationX: -0.375 },
    { at: windows.northernIreland[1], earthRotationY: -0.44, cameraZ: 10.95 },
    // Drift east to take in Europe. Portrait pulls back and aims up/left to fit all five markers.
    {
        at: windows.europe[0], earthRotationY: -0.68, cameraZ: 11.2,
        portrait: { cameraZ: 11.6, cameraRotationX: -0.305, cameraRotationY: 0.05 },
    },
    {
        at: windows.europe[1], earthRotationY: -0.8, cameraZ: 11.3, cameraRotationX: -0.37,
        portrait: { cameraZ: 11.7, cameraRotationX: -0.3, cameraRotationY: 0.05 },
    },
    // Pull right out to reveal the whole planet and the sun, then keep drifting as the content arrives
    { at: windows.reveal[1], earthRotationY: -2.1, cameraZ: 17, cameraRotationX: -0.25, cameraRotationY: 0 },
    { at: 1, earthRotationY: -2.18, cameraZ: 17.4 },
];

/**
 * Monotone cubic (PCHIP) interpolation. Unlike easing each segment separately, the camera
 * never stops dead at a keyframe and its speed changes smoothly from one segment to the next.
 * Being monotone, it also never overshoots, so a value that only ever increases between
 * keyframes never reverses direction on the way.
 */
export const createSpline = (xs: number[], ys: number[]) => {
    const last = xs.length - 1;
    const widths = xs.slice(1).map((x, i) => x - xs[i]);
    const slopes = widths.map((width, i) => (ys[i + 1] - ys[i]) / width);

    // Starts and ends at rest; zero where the direction changes, so there's no overshoot
    const tangents = xs.map((_, i) => {
        if (i === 0 || i === last) return 0;
        const [a, b] = [slopes[i - 1], slopes[i]];
        if (a * b <= 0) return 0;
        const [w1, w2] = [2 * widths[i] + widths[i - 1], widths[i] + 2 * widths[i - 1]];
        return (w1 + w2) / (w1 / a + w2 / b);
    });

    return (x: number) => {
        const next = xs.findIndex(k => k > x);
        const i = next === -1 ? last - 1 : Math.max(0, next - 1);
        const width = widths[i];
        const t = clamp01((x - xs[i]) / width);
        const [t2, t3] = [t * t, t * t * t];
        return (2 * t3 - 3 * t2 + 1) * ys[i]
            + (t3 - 2 * t2 + t) * width * tangents[i]
            + (-2 * t3 + 3 * t2) * ys[i + 1]
            + (t3 - t2) * width * tangents[i + 1];
    };
};

const createSplines = (orientation: 'landscape' | 'portrait') => {
    const resolved: SceneFrame[] = [];
    keyframes.forEach((keyframe, i) => {
        const { at, portrait, ...values } = keyframe;
        resolved.push({
            ...resolved[i - 1],
            ...values,
            ...(orientation === 'portrait' ? portrait : undefined),
        } as SceneFrame);
    });

    const xs = keyframes.map(k => k.at);
    return Object.fromEntries(
        tracks.map(track => [track, createSpline(xs, resolved.map(frame => frame[track]))]),
    ) as Record<Track, (progress: number) => number>;
};

const splines = {
    landscape: createSplines('landscape'),
    portrait: createSplines('portrait'),
};

/** `portrait` is 0 → 1, blending towards the portrait framing as the screen gets narrower. */
export const frameAt = (progress: number, portrait = 0): SceneFrame => {
    const p = clamp01(progress);
    return Object.fromEntries(tracks.map(track => [
        track,
        lerp(splines.landscape[track](p), splines.portrait[track](p), portrait),
    ])) as unknown as SceneFrame;
};

/** 0 → 1 → 0 opacity envelope: fully visible across the window, fading out either side of it. */
export const windowOpacity = (progress: number, [start, end]: readonly [number, number], fade = FADE) =>
    Math.min(
        smoothstep(clamp01((progress - start + fade) / fade)),
        smoothstep(clamp01((end + fade - progress) / fade)),
    );

// The descent starts halfway through the Northern Ireland caption, so it glides in gradually
const [diveFrom, cityFrom, cityTo, climbTo] = [
    (windows.northernIreland[0] + windows.northernIreland[1]) / 2, windows.belfast[0], windows.belfast[1], windows.europe[0],
];

export const isInBelfast = (progress: number) => progress >= cityFrom && progress < cityTo;

/** 0 → 1 across the flight over Belfast. */
export const flightProgressAt = (progress: number) => clamp01((progress - cityFrom) / (cityTo - cityFrom));

/** 1 → 0 (steadily) as the camera climbs back out of the clouds after Belfast. PlanetScene eases the motion. */
export const diveAt = (progress: number) => {
    if (progress < cityTo) return 1;
    return 1 - clamp01((progress - cityTo) / (climbTo - cityTo));
};

// The glide in from orbit, which ends in the clouds and carries on just past them so it's still moving there
const approachKnots = [0, windows.northernIreland[0], diveFrom, cityFrom, cityFrom + 0.03];
const approachSplines = {
    arc: createSpline(approachKnots, [30, -11, -12, -2, -1.5]),
    // Eased in proportion, like a steady descent: the surface keeps coming up at the same rate however close
    height: createSpline(approachKnots, [0.21, 0.5, 0.45, 0.018, 0.012].map(Math.log)),
    aim: createSpline(approachKnots, [9.7, -15, -14, -11, -11]),
};

/**
 * The glide from orbit down to Northern Ireland, until the clouds. The camera starts out far to the north,
 * looking on past the North Pole, backs away south past Northern Ireland, still looking north, then sinks
 * down onto it, turning to the way the flight over the city starts out looking (`turn`, 0 → 1). All along a
 * great circle through the Northern Ireland marker, heading a little east of north so it passes beside the
 * pole rather than over it, where the planet's texture pinches (see APPROACH_BEARING in PlanetScene):
 * - `arc`: degrees along it from the marker, north positive;
 * - `height`: above the surface, in earth radii;
 * - `aim`: degrees above the horizon it looks, so the horizon stays in view right down to the clouds.
 */
export const approachAt = (progress: number) => {
    const p = Math.min(progress, cityFrom);
    return {
        arc: approachSplines.arc(p),
        height: Math.exp(approachSplines.height(p)),
        aim: approachSplines.aim(p),
        turn: smoothstep(clamp01((p - diveFrom) / (cityFrom - diveFrom))),
    };
};

/** 0 → 1 → 0 around a point, rising over `before`, staying at 1 for `hold` either side, and falling over `after`. */
const bump = (progress: number, at: number, before: number, after: number, hold = 0) => smoothstep(progress < at
    ? clamp01((progress - at + hold + before) / before)
    : clamp01((at + hold + after - progress) / after));

/**
 * How much the clouds cover the screen. They hide the switch between the planet and the city, gathering
 * gradually and staying solid for a moment either side of it, so flying through them doesn't feel abrupt.
 */
export const veilAt = (progress: number) => Math.max(
    bump(progress, cityFrom, 0.055, 0.04, 0.01),
    bump(progress, cityTo, 0.04, 0.05, 0.01),
);

/**
 * Bloom is strong for the atmospheric shots, pulled back while markers are shown so the map stays
 * crisp, and off in the clouds. Over the city it's moderate at night, so the lights glow, and off by day.
 */
export const bloomThresholdAt = (progress: number, isDaytimeCity: boolean) => {
    const focus = Math.max(...marked.map(window => windowOpacity(progress, window, FADE * 2)));
    const cityThreshold = isDaytimeCity ? 1.2 : 0.55;
    const base = isInBelfast(progress) ? cityThreshold : lerp(0.3, 0.9, focus);
    return lerp(base, 1.2, veilAt(progress));
};

/** How close to a beat a scroll has to come to rest before it's eased the rest of the way in. */
const SETTLE_REACH = 0.07;

/**
 * Where the journey should settle when scrolling stops. Coming to rest while a caption is still
 * fading in eases it the rest of the way, so it isn't left half-readable. Only in the direction
 * of travel: scrolling on past a caption never pulls the reader back to it.
 */
export const settleAt = (progress: number, direction: number) => {
    // Never left resting in the clouds: carry on through them the way the reader was going
    if (direction !== 0 && veilAt(progress) > 0.05) {
        let target = progress;
        while (target > 0 && target < 1 && veilAt(target) > 0.02) target += 0.002 * Math.sign(direction);
        return clamp01(target);
    }
    for (const [start, end] of settled) {
        const [readFrom, readTo] = [start + 0.01, end - 0.01];
        if (direction > 0 && progress > start - SETTLE_REACH && progress < readFrom) return readFrom;
        if (direction < 0 && progress < end + SETTLE_REACH && progress > readTo) return readTo;
    }
    return progress;
};

const middle = ([start, end]: readonly [number, number]) => (start + end) / 2;

/**
 * The beats as chapters, for the journey navigation: `from` is where each becomes the current
 * one, `at` is where jumping to it lands (the middle of its caption, if it has one).
 */
export const chapters = [
    { label: 'Hello', from: 0, at: 0 },
    { label: 'Home', from: windows.northernIreland[0] - FADE, at: middle(windows.northernIreland) },
    // Lands as the introduction plays, heading for the cranes
    { label: 'Belfast', from: cityFrom - 0.055, at: windows.belfastIntro[0] + 0.01 },
    { label: 'Europe', from: windows.europe[0] - FADE, at: middle(windows.europe) },
    // Lands as the reveal completes, just before the content starts to arrive
    { label: 'The world', from: windows.europe[1] + FADE, at: windows.reveal[1] },
] as const;

export const chapterAt = (progress: number) =>
    chapters.reduce((current, chapter, index) => (progress >= chapter.from ? index : current), 0);
