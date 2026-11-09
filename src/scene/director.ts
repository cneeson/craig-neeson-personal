import { reactive } from 'vue';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/services/device';
import { clamp01, damp, lerp } from '@/services/three';
import { ENTRANCE_DURATION, windows } from './choreography';
import { nearestHeading, poseOf, shots, type Pose, type Shot, type ShotName } from './shots';
import { sceneState } from './state';

/**
 * The director moves the camera between the stops of each part of the site. Over Belfast it flies from wherever
 * the camera is to the stop's shot (shots.ts), up and over on long hops, and keeps the city's features (the
 * outlined offices, the arc to Paris, the telescope, the letterbox) in step with where it's going. Out to the
 * planet and back it plays the old journey's progress (choreography.ts) instead: the glide down from orbit, and
 * the climb back out to the arcs over Europe and the US.
 *
 * `route` is reactive, for the DOM. Everything else changes every frame and is read by the render loop.
 */

export const employerBeats = ['coleraine', 'antrim', 'liberty', 'flexera', 'locum', 'ankorstore', 'ocula'] as const;
export type EmployerBeat = typeof employerBeats[number];

export const modes = {
    home: ['home'],
    about: ['hello', 'craft', 'reach'],
    experience: ['overview', ...employerBeats],
    skills: ['docks', 'arena', 'lagan'],
    contact: ['contact'],
} as const;
export type Mode = keyof typeof modes;
export type StopId = typeof modes[Mode][number];
/** The order the modes come in, stepping on from the end of one to the start of the next. */
export const modeOrder: Mode[] = ['home', 'about', 'experience', 'skills', 'contact'];

/** Out over the planet, rather than over the city. */
const PLANET_STOPS: StopId[] = ['reach'];
const shotOf = (stop: StopId): Shot => shots[(stop === 'contact' ? 'home' : stop) as ShotName];

// Resting points of the journey's progress: over the city once the clouds have cleared, at the arcs over the
// planet, and just short of the clouds on the way out of the city
const CITY_REST = windows.belfast[0] + 0.03;
const PLANET_REST = windows.reach[1] + 0.006;
const CLIMB_FROM = windows.belfast[1] - 0.04;

export const route = reactive({
    mode: 'intro' as Mode | 'intro',
    step: 0,
    stop: 'home' as StopId,
    /** The camera has arrived at the stop. */
    isLanded: false,
    /** Close enough to the stop to show what's there: arrived, or nearly. */
    isArriving: false,
    /** The glide down from orbit has reached the city (or the clouds over it), and the site can be used. */
    isIntroDone: false,
    /** The title is up over the planet, waiting to set off. */
    isHeroUp: true,
    /** The planet's ready (its textures uploaded, so the canvas fades in) and it's making its entrance. */
    isPlanetUp: false,
});

/** What's shown over the city, eased in time. Read every frame by the render loop and the overlays. */
export const cityState = {
    /** How strongly each office is outlined (0 → 1). */
    offices: Object.fromEntries(employerBeats.map(beat => [beat, 0])) as Record<EmployerBeat, number>,
    paris: { draw: 0, opacity: 0 },
    /** The telescope: how far it's `open`, which `sight` it shows, and the `whip` across from one to the other (-1 → 1). */
    scope: { open: 0, sight: 'coleraine' as 'coleraine' | 'antrim', whip: -1 },
    letterbox: 0,
    /** How far the train has pulled away from Lanyon Place (0 → 1, and past it once it's gone). */
    trainAway: 0,
};

const now = () => performance.now() / 1000;

let shot: Shot = shots.home;
let landedAt = 0;
/** The move under way, if any: from `from` to `shot`, along a curve lifted by `lift` (scene units). */
let move: { from: Pose, k: number, lift: number } | null = null;
let moveTween: gsap.core.Tween | undefined;
let progressTween: gsap.core.Animation | undefined;
/** Out of the clouds onto the city at the end of the intro. */
let settling: gsap.core.Tween | undefined;

const bezier = (a: number, b: number, c: number, d: number, t: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** Where the city camera is at `time` (s). */
export const cityPoseAt = (time = now()): Pose => {
    if (!move) return poseOf(shot, time - landedAt, time);
    const { from, k, lift } = move;
    const to = poseOf(shot, 0, time);
    // A cubic through two points a third and two thirds of the way along, raised by `lift`
    const along = (key: 'x' | 'y' | 'z', third: number) => lerp(from[key], to[key], third) + (key === 'y' ? lift : 0);
    return {
        x: bezier(from.x, along('x', 1 / 3), along('x', 2 / 3), to.x, k),
        y: bezier(from.y, along('y', 1 / 3), along('y', 2 / 3), to.y, k),
        z: bezier(from.z, along('z', 1 / 3), along('z', 2 / 3), to.z, k),
        heading: lerp(from.heading, nearestHeading(from.heading, to.heading), k),
        // Looking down a little more mid-flight on long hops, at where it's going
        pitch: lerp(from.pitch, to.pitch, k) - Math.sin(k * Math.PI) * Math.min(lift * 0.25, 12),
        zoom: lerp(from.zoom, to.zoom, k),
    };
};

/** Where the camera's flying to, while it's moving over the city. */
export const cityDestination = (): Pose | null => (move ? poseOf(shot, 0, now()) : null);

const land = () => {
    route.isLanded = true;
    route.isArriving = true;
};

/** Flies the city camera from wherever it is to `next`. */
const flyTo = (next: Shot) => {
    const time = now();
    const from = cityPoseAt(time);
    moveTween?.kill();
    shot = next;
    const to = poseOf(next, 0, time);
    const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const turn = Math.abs(nearestHeading(from.heading, to.heading) - from.heading);
    const duration = prefersReducedMotion ? 0 : Math.min(2.4, Math.max(0.9, 0.8 + distance / 140 + (turn / 180) * 0.9));
    move = { from, k: 0, lift: Math.min(distance * 0.3, 70) };
    const state = move;
    moveTween = gsap.to(state, {
        k: 1,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
            if (move === state && state.k > 0.7 && !route.isArriving) route.isArriving = true;
        },
        onComplete: () => {
            if (move !== state) return;
            move = null;
            landedAt = now();
            land();
        },
    });
};

/** Puts the city camera straight at `next` (under the clouds). */
const cutTo = (next: Shot) => {
    moveTween?.kill();
    move = null;
    shot = next;
    landedAt = now();
};

const isOnPlanet = () => sceneState.progress > CLIMB_FROM;

let pending: { mode: Mode, step: number } | null = null;
/** The intro's over, but it's holding in the clouds until the city has loaded. */
let isWaitingForCity = false;

/** Where the camera goes once it's out of the clouds: the stop linked to, if it's in the city, or home. */
export const firstShot = (): Shot => {
    const stop = pending ? modes[pending.mode][pending.step] : 'home';
    return PLANET_STOPS.includes(stop) ? shots.home : shotOf(stop);
};

/** Goes to a stop: flying over the city, or out to the planet and back. */
export const go = (mode: Mode, step = 0) => {
    const stops = modes[mode];
    const index = Math.min(Math.max(step, 0), stops.length - 1);
    if (!route.isIntroDone || isWaitingForCity) {
        // Still gliding down, or waiting in the clouds for the city: it goes there once it's out of them
        pending = { mode, step: index };
        skipIntro();
        return;
    }
    pending = null;
    if (route.mode === mode && route.step === index) return;
    const stop = stops[index];
    Object.assign(route, { mode, step: index, stop, isLanded: false, isArriving: false });
    progressTween?.kill();

    if (PLANET_STOPS.includes(stop)) {
        settling?.kill();
        // Up and away from where the camera is, then out through the clouds to the planet
        if (!isOnPlanet()) {
            const from = cityPoseAt();
            flyTo({ pose: { x: from.x, z: from.z + 25, y: from.y + 70, pitch: -38, heading: 174 } });
            sceneState.progress = CLIMB_FROM;
        }
        progressTween = gsap.to(sceneState, {
            progress: PLANET_REST,
            duration: prefersReducedMotion ? 0.6 : 5,
            ease: 'power1.inOut',
            onUpdate: () => {
                if (sceneState.progress > windows.reach[0]) route.isArriving = true;
            },
            onComplete: land,
        });
        return;
    }

    if (isOnPlanet()) {
        // Back down through the clouds onto the stop
        cutTo(shotOf(stop));
        progressTween = gsap.timeline({ onComplete: land })
            .to(sceneState, { progress: CLIMB_FROM, duration: prefersReducedMotion ? 0.6 : 3, ease: 'power1.inOut' })
            .set(sceneState, { progress: CITY_REST });
        return;
    }
    flyTo(shotOf(stop));
};

// --- The intro: the title over the whole planet, then the descent into the clouds over Belfast ---

let intro: gsap.core.Timeline | undefined;

const finishIntro = () => {
    // Straight onto where it's going (home, unless a stop was linked to), under the clouds
    cutTo(firstShot());
    route.isIntroDone = true;
    isWaitingForCity = true;
    // Out of the clouds once the city has loaded
    const start = now();
    const waitForCity = () => {
        if (route.mode !== 'intro') return;
        if (!sceneState.cityReady && now() - start < 20) {
            gsap.delayedCall(0.25, waitForCity);
            return;
        }
        gsap.delayedCall(0.3, () => {
            if (route.mode !== 'intro') return;
            isWaitingForCity = false;
            const next = pending ?? { mode: 'home' as Mode, step: 0 };
            go(next.mode, next.step);
        });
    };
    waitForCity();
};

let entrance: gsap.core.Tween | undefined;

/** The planet's entrance (see entranceAt), played once its first frame has been drawn. */
export const playEntrance = () => {
    if (route.isPlanetUp) return;
    route.isPlanetUp = true;
    if (entrance) return;
    if (prefersReducedMotion) sceneState.entrance = 1;
    else entrance = gsap.to(sceneState, { entrance: 1, duration: ENTRANCE_DURATION, ease: 'none' });
};

/** Hurries the entrance to its end, when setting off before it's finished. */
const finishEntrance = () => {
    if (sceneState.entrance >= 1) return;
    entrance?.kill();
    entrance = gsap.to(sceneState, { entrance: 1, duration: 1, ease: 'power1.out' });
};

const setOff = () => {
    if (!intro || intro.isActive() || intro.progress() > 0) return;
    route.isHeroUp = false;
    finishEntrance();
    intro.play();
};

/**
 * Starts the intro: the title over the planet, until Enter (or a scroll, swipe or key). With somewhere to go already
 * (a link to a stop), it sets off straight away, and quickly.
 */
export const startIntro = (destination?: { mode: Mode, step: number }) => {
    pending = destination ?? null;
    sceneState.progress = 0;
    intro = gsap.timeline({ paused: true, onComplete: finishIntro })
        // One sweep down onto Northern Ireland, under way at once and gathering pace: the clouds parting over it and its outline traced and
        // Belfast named on the way, then into the clouds, which clear once the city's ready
        .to(sceneState, { progress: windows.belfast[0], duration: 6.5, ease: (t: number) => t ** 1.5 })
        .call(() => {
            // Not progressTween: the first move over the city mustn't stop it short, in the clouds
            settling = gsap.to(sceneState, { progress: CITY_REST, duration: 1.5, ease: 'power1.out' });
        });
    if (prefersReducedMotion) intro.timeScale(3);
    if (destination) {
        intro.timeScale(3.5);
        setOff();
    }
};

/** Sets off from the title, or speeds the descent along if it's already going. */
export const skipIntro = () => {
    if (!intro || route.isIntroDone) return;
    if (intro.progress() === 0) setOff();
    else intro.timeScale(Math.max(intro.timeScale(), 4));
};

// --- The city's features, eased every frame ---

const SCOPE_STOPS: StopId[] = ['coleraine', 'antrim'];
let whipping: { to: 'coleraine' | 'antrim', t: number } | null = null;
let trainCue = 0;
let lastStop: StopId | null = null;

/** Every frame, from the render loop. */
export const tickDirector = (delta: number) => {
    const time = now();
    const { stop, mode } = route;
    const arriving = route.isArriving;
    const isExperience = mode === 'experience';

    employerBeats.forEach(beat => {
        const target = !isExperience ? 0 : stop === 'overview' ? 0.4 : stop === beat && arriving ? 1 : 0;
        cityState.offices[beat] = damp(cityState.offices[beat], target, 4, delta);
    });

    const isParis = isExperience && stop === 'ankorstore' && arriving;
    const { paris, scope } = cityState;
    paris.opacity = damp(paris.opacity, isParis ? 1 : 0, 4, delta);
    paris.draw = isParis ? clamp01(paris.draw + delta / 2.4) : paris.opacity < 0.01 ? 0 : paris.draw;

    // The telescope stays up moving between its two sights, and whips across from one to the other
    const sight = isExperience && SCOPE_STOPS.includes(stop) ? stop as 'coleraine' | 'antrim' : null;
    scope.open = damp(scope.open, sight && (arriving || scope.open > 0.5) ? 1 : 0, 5, delta);
    if (sight && sight !== scope.sight && !whipping) {
        if (scope.open < 0.05) scope.sight = sight;
        else whipping = { to: sight, t: 0 };
    }
    if (whipping) {
        whipping.t += delta / (prefersReducedMotion ? 0.2 : 0.6);
        if (whipping.t >= 0.5) scope.sight = whipping.to;
        scope.whip = Math.min(1, whipping.t * 2 - 1);
        if (whipping.t >= 1) {
            whipping = null;
            scope.whip = -1;
        }
    }

    cityState.letterbox = damp(cityState.letterbox, stop === 'hello' && arriving ? 1 : 0, 3, delta);

    // The train sets off from Lanyon Place as Ocula comes up, and again every so often
    if (stop === 'ocula' && lastStop !== 'ocula') trainCue = time;
    if (cityState.trainAway > 1.4) trainCue = time;
    cityState.trainAway = Math.max(0, (time - trainCue - 2) / 30);
    lastStop = stop;
};
