import { clamp01, lerp, smoothstep } from '@/services/three';

/**
 * The journey out on the planet is a pure function of its progress (0 → 1), which the director (director.ts)
 * plays: the glide down from orbit into the clouds over Belfast as the site opens, and the climb back out of
 * them to the arcs over Europe and the US. In between, over the city, the director moves the camera itself.
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
 * The beats of the journey as [start, end] progress ranges: where each one's overlays are fully up (they fade
 * in just before and out just after).
 */
export const windows = {
    // The whole planet, under the title
    hero: [0, 0.026],
    // Down onto Northern Ireland as the clouds part over it, its outline traced and Belfast named
    northernIreland: [0.088, 0.141],
    // Over Belfast, between diving into the clouds and climbing back out of them
    belfast: [0.185, 0.876],
    // Climbed back out over the planet, with arcs out to where the work has reached
    reach: [0.894, 0.925],
    reveal: [0.943, 0.978],
} as const;

/** Beats with markers or overlays on the planet, which pull the bloom back so the map stays crisp. */
const marked = [windows.northernIreland, windows.reach];

/** How far either side of a readable window its caption and markers fade over. */
export const FADE = 0.012;

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
    // (see diveAt) to pull back over the North Atlantic.
    { at: windows.northernIreland[0], earthRotationY: -0.36, cameraZ: 10.75, cameraRotationX: -0.375 },
    { at: windows.northernIreland[1], earthRotationY: -0.44, cameraZ: 10.95 },
    // Over Ireland and Britain as the arcs set off, then pulling back and turning west, out over the Atlantic
    // to America as they land
    {
        at: windows.reach[0], earthRotationY: -0.5, cameraZ: 11.4, cameraRotationX: -0.36,
        portrait: { cameraZ: 11.9, cameraRotationX: -0.31 },
    },
    {
        at: windows.reach[1], earthRotationY: 0.5, cameraZ: 14.2, cameraRotationX: -0.33,
        portrait: { cameraZ: 15.6, cameraRotationX: -0.22 },
    },
    // Right out to the whole planet and the sun, then drifting on as the content arrives
    { at: windows.reveal[1], earthRotationY: 0.7, cameraZ: 17, cameraRotationX: -0.25, cameraRotationY: 0, portrait: {} },
    { at: 1, earthRotationY: 0.74, cameraZ: 17.4 },
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

// The descent starts as the clouds close back over Northern Ireland
const [diveFrom, cityFrom, cityTo, climbTo] = [
    windows.northernIreland[1], windows.belfast[0], windows.belfast[1], windows.reach[0],
];

export const isInBelfast = (progress: number) => progress >= cityFrom && progress < cityTo;

/** 1 → 0 (steadily) as the camera climbs back out of the clouds after Belfast. PlanetScene eases the motion. */
export const diveAt = (progress: number) => {
    if (progress < cityTo) return 1;
    return 1 - clamp01((progress - cityTo) / (climbTo - cityTo));
};

// The descent from the whole planet, which ends in the clouds and carries on just past them so it's still moving there
const approachKnots = [0, windows.northernIreland[0], diveFrom, cityFrom, cityFrom + 0.015];
const approachSplines = {
    arc: createSpline(approachKnots, [-24, -13, -7, -2, -1.5]),
    // Eased in proportion, like a steady descent: the surface keeps coming up at the same rate however close.
    // Starting far enough out for the whole planet to fit, further on portrait screens, which are narrow across.
    // Right down at the end, onto the clouds, lowered by then (cloudHeightAt) so it's close to the ground
    height: createSpline(approachKnots, [3.6, 0.6, 0.12, 0.0056, 0.0035].map(Math.log)),
    portraitHeight: createSpline(approachKnots, [7.4, 0.7, 0.13, 0.0056, 0.0035].map(Math.log)),
    aim: createSpline(approachKnots, [-15, -15, -14, -11, -11]),
};

/**
 * The descent from the whole planet down to Northern Ireland, until the clouds. The camera starts out far off
 * over the Atlantic to the south, looking at the middle of the planet (`overview` 1, with it framed off to the side
 * of the title), and comes down along a great circle through the Northern Ireland marker, looking at Belfast, then
 * at the end turning to look on ahead over the horizon the way the first shot over the city does (`turn`, 0 → 1):
 * - `arc`: degrees along the great circle from the marker, north positive;
 * - `height`: above the surface, in earth radii;
 * - `aim`: degrees above the horizon it looks, once it's looking ahead;
 * - `time`: how far through the descent it is in time (0 → 1).
 */
export const approachAt = (progress: number, portrait = 0) => {
    const p = Math.min(progress, cityFrom);
    const time = (p / cityFrom) ** (2 / 3);
    return {
        arc: approachSplines.arc(p),
        height: Math.exp(lerp(approachSplines.height(p), approachSplines.portraitHeight(p), portrait)),
        aim: approachSplines.aim(p),
        // All spread over the time the descent takes (the intro tweens progress as t^1.5; see director.ts), from the
        // moment it sets off, so the camera turns in one gradual sweep
        overview: 1 - smoothstep(clamp01(time / 0.7)),
        turn: smoothstep(time),
        time,
    };
};

/**
 * How high the clouds are (the planet's and the deck over Belfast), as a share of their usual height above the ground:
 * sinking towards it over the last of the way down, so the camera comes right down close to the surface to reach them,
 * and rising again as it climbs back out to the planet.
 */
export const CLOUDS_LOW = 0.3;
export const cloudHeightAt = (progress: number) => (progress < cityTo
    ? lerp(1, CLOUDS_LOW, ramp(progress, diveFrom - 0.01, cityFrom))
    : lerp(CLOUDS_LOW, 1, ramp(progress, cityTo, climbTo)));

/** 0 → 1 → 0 around a point, rising over `before`, staying at 1 for `hold` either side, and falling over `after`. */
const bump = (progress: number, at: number, before: number, after: number, hold = 0) => smoothstep(progress < at
    ? clamp01((progress - at + hold + before) / before)
    : clamp01((at + hold + after - progress) / after));

/**
 * How much the clouds cover the screen. They hide the switch between the planet and the city, gathering
 * gradually and staying solid for a moment either side of it, so flying through them doesn't feel abrupt.
 */
export const veilAt = (progress: number) => Math.max(
    // Gathering as the clouds close back over Northern Ireland, and clearing quickly onto the cranes
    bump(progress, cityFrom, 0.04, 0.016, 0.006),
    bump(progress, cityTo, 0.03, 0.025, 0.006),
);

/** 0 → 1 across [from, to], eased. */
const ramp = (progress: number, from: number, to: number) => smoothstep(clamp01((progress - from) / (to - from)));

/** How long the planet's first appearance takes, in seconds, and how far through it it's risen into view. */
export const ENTRANCE_DURATION = 4.5;
export const RISEN = 0.62;

/**
 * The planet's first appearance (0 → 1 over ENTRANCE_DURATION), before the title. Its night side rises out of the dark
 * below the frame, with the sun behind it, so there's only its city lights and a ring of air, and the day sweeps across
 * the disc as it comes up.
 */
export const entranceAt = (entrance: number) => ({
    /** Up into the frame from below (0 → 1), after a moment of just the stars. */
    rise: 1 - (1 - clamp01((entrance - 0.06) / (RISEN - 0.06))) ** 4,
    /** The light on the planet swinging round from behind it to where it shines (0 → 1). */
    sunrise: ramp(entrance, 0.08, 0.7),
});

/**
 * Belfast's sign, hung over it on the way down: where the camera passes through it (`SIGN_PASS`), how far it's drawn on
 * (`enter`, 0 → 1, as the descent gets going) and its `opacity` (gone once the camera's through).
 */
export const SIGN_PASS = windows.northernIreland[0] + 0.046;
export const signAt = (progress: number) => ({
    // From early in the descent, so the ring draws round slowly; the lettering keeps to its time (belfast-sign.ts)
    enter: clamp01((progress - 0.015) / 0.075),
    // Gone the moment the camera's through: it's hung ahead of the camera by how far it is from the pass, which grows
    // again after it, so it would come back up in front
    opacity: progress < SIGN_PASS ? 1 : 0,
});

/**
 * How much of the cloud deck over Belfast is showing (0 → 1): fading in slowly from as the sign starts drawing on
 * until the camera's well past it, and gone
 * under the clouds over the switch to the city, so it's only on the way down.
 */
export const deckAt = (progress: number) => progress >= cityFrom + 0.01
    ? 0
    : ramp(progress, 0.075, SIGN_PASS + 0.025) * (1 - ramp(progress, cityFrom, cityFrom + 0.01));

/**
 * The descent's pace: one sweep from the title down to the clouds (to `windows.belfast[0]`), gathering pace (as
 * progress = t^1.5), but easing off a little while Belfast's sign reads, from its name being written on to the camera
 * reaching it. `descentEase` is the tween's ease, over `DESCENT_DURATION` seconds.
 */
const DESCENT_BASE = 4.6;
/** How much of a running start the descent gets (as a share of it): more, and it sets off faster. */
const DESCENT_HEAD_START = 0.012;
/**
 * How much slower it goes at most while the sign reads (0.45 = 55% of the speed), and when (progress): it eases off
 * gently over a long run-in before the sign, holds while the name's written on, and picks up again past it.
 */
const [SIGN_EASE_OFF, SIGN_READ] = [0.45, [0.06, 0.1, SIGN_PASS - 0.006, SIGN_PASS + 0.022]] as const;
/** Like smoothstep, but flat to the second derivative at both ends, so the change of pace has no corner to feel. */
const smootherstep = (t: number) => t * t * t * (t * (6 * t - 15) + 10);
const descent = (() => {
    const steps = 2000;
    const end = windows.belfast[0];
    // Time to each step: (2/3)x^(-1/3) per unit of x = progress / end without the easing off, over the slower speed.
    // x is nudged on there by DESCENT_HEAD_START, so it leaves at a speed the moment Enter's pressed rather than from rest
    const times = [0];
    for (let i = 1; i <= steps; i++) {
        const x = (i - 0.5) / steps;
        const progress = x * end;
        const reading = smootherstep(clamp01((progress - SIGN_READ[0]) / (SIGN_READ[1] - SIGN_READ[0])))
            * (1 - smootherstep(clamp01((progress - SIGN_READ[2]) / (SIGN_READ[3] - SIGN_READ[2]))));
        const speed = 1 - SIGN_EASE_OFF * reading;
        times.push(times[i - 1] + ((2 / 3) * (x + DESCENT_HEAD_START) ** (-1 / 3)) / speed / steps);
    }
    return { times, total: times[steps] };
})();
export const DESCENT_DURATION = DESCENT_BASE * descent.total;
export const descentEase = (t: number) => {
    const { times, total } = descent;
    const time = clamp01(t) * total;
    let [low, high] = [0, times.length - 1];
    while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (times[middle] <= time) low = middle;
        else high = middle;
    }
    const along = (time - times[low]) / (times[high] - times[low] || 1);
    return (low + along) / (times.length - 1);
};

/** How brightly the land's lit on the way down, kept low so the thinning clouds round it don't glare. */
const DESCENT_FILL = 0.06;

/**
 * Northern Ireland picked out on the planet. As the planet rises into view (`entrance`) the clouds part a little over
 * it (`hole`); once the hero's arrow has reached it its border's traced (`traced`, into `draw`), dimmed (`dim`), and
 * the land's lit a little (`fill`), so it can be found from orbit, under the title. Then thick cloud gathers round it
 * as the descent sets off (`cover`) and parts all the way as the camera comes down, the border brightens, the land's
 * light drops back and it's scanned (`scan`), before it all fades (`opacity`) as the camera goes into the clouds for
 * the city.
 */
export const highlightAt = (progress: number, entrance = 1, traced = 1) => {
    const [start] = windows.northernIreland;
    const descent = ramp(progress, 0.004, start - 0.01);
    return {
        cover: progress < cityTo ? ramp(progress, 0, 0.03) : 0,
        // Closing up again as the camera comes down to the sign, all but shut by the time it's through it
        hole: Math.max(ramp(entrance, 0.4, 0.9) * 0.8, descent) * (1 - 0.85 * ramp(progress, SIGN_PASS - 0.045, SIGN_PASS - 0.005)),
        draw: Math.max(traced, ramp(progress, start - 0.042, start - 0.015)),
        fill: Math.max(ramp(traced, 0.6, 1) * lerp(1, DESCENT_FILL, descent), ramp(progress, start - 0.025, start - 0.008) * DESCENT_FILL),
        scan: clamp01((progress - start + 0.02) / 0.03),
        dim: lerp(0.3, 1, descent),
        // The outline (and its tint) fades as the camera closes on Belfast's sign, leaving it the one thing to read
        opacity: 1 - ramp(progress, SIGN_PASS - 0.04, SIGN_PASS - 0.012),
    };
};

/** The arcs out to where the work has reached: how far through drawing them (`amount`), and their `opacity`. */
export const reachAt = (progress: number) => {
    const [start, end] = windows.reach;
    return {
        amount: clamp01((progress - start + 0.01) / (end - start)),
        opacity: windowOpacity(progress, [start, windows.reveal[1]], FADE * 2),
    };
};

/**
 * Bloom is strong for the atmospheric shots, pulled back while markers are shown so the map stays
 * crisp, and off in the clouds and over the city.
 */
export const bloomThresholdAt = (progress: number) => {
    const focus = Math.max(...marked.map(window => windowOpacity(progress, window, FADE * 2)));
    // Held back from the moment the descent sets off, or the clouds gathering over Northern Ireland glare
    const descending = progress < cityFrom ? ramp(progress, 0.001, 0.03) : 0;
    // and off altogether as it comes down to the clouds, which would glow white
    const intoClouds = progress < cityFrom ? ramp(progress, SIGN_PASS - 0.04, SIGN_PASS) : 0;
    const base = isInBelfast(progress) ? 1.2 : lerp(lerp(0.3, 0.9, Math.max(focus, descending)), 1.3, intoClouds);
    return lerp(base, 1.2, veilAt(progress));
};
