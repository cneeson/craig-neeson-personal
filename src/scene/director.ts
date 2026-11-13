import { reactive } from 'vue';
import { gsap } from 'gsap';
import { MathUtils } from 'three';
import { prefersReducedMotion } from '@/services/device';
import { clamp01, damp, lerp } from '@/services/three';
import { DESCENT_DURATION, descentEase, ENTRANCE_DURATION, windows } from './choreography';
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

/** Flies the city camera from wherever it is to `next` (by default taking as long as the distance and turn need). */
const flyTo = (
    next: Shot,
    { duration: forced, ease = 'power2.inOut', lift: liftTo }: { duration?: number, ease?: string, lift?: number } = {},
) => {
    const time = now();
    const from = cityPoseAt(time);
    moveTween?.kill();
    shot = next;
    const to = poseOf(next, 0, time);
    const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const turn = Math.abs(nearestHeading(from.heading, to.heading) - from.heading);
    const duration = prefersReducedMotion
        ? 0
        : forced ?? Math.min(2.4, Math.max(0.9, 0.8 + distance / 140 + (turn / 180) * 0.9));
    move = { from, k: 0, lift: liftTo ?? Math.min(distance * 0.3, 70) };
    const state = move;
    moveTween = gsap.to(state, {
        k: 1,
        duration,
        ease,
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

/**
 * Out of the clouds, the camera's still finishing the glide down from orbit: it's put a little above and behind where
 * it's going (`up`, `back`, scene units), looking further down (`pitch`, degrees), and eases on into the shot from
 * there, slowing to a stop, over `duration` (s). Going back up to the title it leaves the same way, over `leave` (s).
 */
const ARRIVAL = { up: 18, back: 22, pitch: -7, duration: 3.2, leave: 1.1 };
const shortOf = (next: Shot): Shot => {
    const pose = poseOf(next, 0, now());
    const heading = MathUtils.degToRad(pose.heading);
    return {
        pose: {
            ...pose,
            x: pose.x - Math.sin(heading) * ARRIVAL.back,
            z: pose.z + Math.cos(heading) * ARRIVAL.back,
            y: pose.y + ARRIVAL.up,
            pitch: pose.pitch + ARRIVAL.pitch,
        },
    };
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
/** The stop a link opened the site straight onto (see landAt), for the city to load first. */
let landedOn: StopId | null = null;

/** Where the camera goes once it's out of the clouds: the stop linked to, if it's in the city, or home. */
export const firstShot = (): Shot => {
    const stop = pending ? modes[pending.mode][pending.step] : landedOn ?? 'home';
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
    const isOutOfClouds = route.mode === 'intro';
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
    // Out of the clouds at the end of the intro, settling onto it (see ARRIVAL), straight down rather than over a hop
    flyTo(shotOf(stop), isOutOfClouds ? { duration: ARRIVAL.duration, ease: 'power2.out', lift: 0 } : {});
};

// --- The intro: the title over the whole planet, then the descent into the clouds over Belfast ---

let intro: gsap.core.Timeline | undefined;

const finishIntro = () => {
    // Just short of where it's going (home, unless a stop was linked to), under the clouds, to settle onto it
    cutTo(shortOf(firstShot()));
    route.isIntroDone = true;
    isWaitingForCity = true;
    // Out of the clouds once the city has loaded
    const start = now();
    const waitForCity = () => {
        if (route.mode !== 'intro' || !isWaitingForCity) return;
        if (!sceneState.cityReady && now() - start < 20) {
            gsap.delayedCall(0.25, waitForCity);
            return;
        }
        gsap.delayedCall(0.3, () => {
            if (route.mode !== 'intro' || !isWaitingForCity) return;
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

let isSettingOff = false;

/** Sets off down to Belfast, at once: the title's left behind as the camera moves (hero.vue). */
const setOff = () => {
    if (!intro || isSettingOff) return;
    isSettingOff = true;
    // Setting off again on the way back up to the title (see returnToHero): down from wherever it's got to
    progressTween?.kill();
    intro.play();
    finishEntrance();
    route.isHeroUp = false;
};

/**
 * Opens the site straight onto a stop (a link to it, or a reload there), as it would be once arrived: no entrance, no
 * title and no descent. Over the city it waits under the clouds until the city has loaded (they then clear, see
 * PlanetScene), and lands then, so what plays on arrival (the captions) is seen.
 */
const landAt = (mode: Mode, step: number) => {
    const stop = modes[mode][step];
    entrance?.kill();
    sceneState.entrance = 1;
    Object.assign(route, { mode, step, stop, isHeroUp: false, isIntroDone: true, isLanded: false, isArriving: false });
    if (PLANET_STOPS.includes(stop)) {
        cutTo(shots.home);
        sceneState.progress = PLANET_REST;
        land();
        return;
    }
    landedOn = stop;
    cutTo(shotOf(stop));
    sceneState.progress = CITY_REST;
    const start = now();
    const waitForCity = () => {
        // Somewhere else already (it flies there itself), or back to the title
        if (route.stop !== stop || route.isHeroUp) return;
        if (!sceneState.cityReady && now() - start < 20) gsap.delayedCall(0.25, waitForCity);
        else if (!move) land();
    };
    waitForCity();
};

/**
 * Starts the site: the title over the planet, until Enter (or a scroll, swipe or key), then the descent. With
 * somewhere to go already (a link to a stop), straight there instead (landAt).
 */
export const startIntro = (destination?: { mode: Mode, step: number }) => {
    pending = null;
    sceneState.progress = 0;
    prepareIntro();
    if (prefersReducedMotion) intro!.timeScale(3);
    if (destination) landAt(destination.mode, destination.step);
};

/** The descent, ready to play (from wherever the journey's got to, when it starts). */
const prepareIntro = () => {
    intro = gsap.timeline({ paused: true, onComplete: finishIntro })
        // One sweep down onto Northern Ireland, under way at once and gathering pace: the clouds parting over it and its outline traced and
        // Belfast named on the way (easing off a little while it reads), then into the clouds, which clear once the city's ready
        .to(sceneState, { progress: windows.belfast[0], duration: DESCENT_DURATION, ease: descentEase })
        .call(() => {
            // Not progressTween: the first move over the city mustn't stop it short, in the clouds
            settling = gsap.to(sceneState, { progress: CITY_REST, duration: 1.5, ease: 'power1.out' });
        });
};

/** How long the climb back up to the title takes from the clouds (s): quicker than the way down (4.5 s). */
const RETURN_DURATION = 3;
/** How sharply it leaves the clouds: its starting speed, against the way down's (1.5 would be that backwards). */
const RETURN_EASE = 3;

/**
 * Back up to the title over the planet (the browser's back button, from the first stop): out of the city into the
 * clouds, then the descent in reverse, quickly out of the clouds and slowing into the view of the whole planet, as
 * the title writes in again. From the arcs over the planet it goes back down into the clouds first.
 */
export const returnToHero = () => {
    if (route.isHeroUp) return;
    pending = null;
    landedOn = null;
    intro?.kill();
    settling?.kill();
    progressTween?.kill();
    const wasInCity = route.isIntroDone && !isOnPlanet();
    isWaitingForCity = false;
    isSettingOff = false;
    Object.assign(route, {
        mode: 'intro', step: 0, stop: 'home', isLanded: false, isArriving: false, isIntroDone: false, isHeroUp: true,
    });
    prepareIntro();
    if (prefersReducedMotion) intro!.timeScale(3);

    const climb = progressTween = gsap.timeline().timeScale(prefersReducedMotion ? 3 : 1);
    if (wasInCity) {
        // The way it came in, backwards (see ARRIVAL): drawing up and back off the city, gathering pace, and only then
        // on up off it into the clouds
        flyTo(shortOf({ pose: cityPoseAt() }), { duration: ARRIVAL.leave, ease: 'power2.in', lift: 0 });
        climb.call(() => {
            const from = cityPoseAt();
            flyTo({ pose: { x: from.x, z: from.z + 25, y: from.y + 70, pitch: -38, heading: 174 } }, { duration: 0.7, ease: 'none' });
        }, [], ARRIVAL.leave).set(sceneState, { progress: CLIMB_FROM });
    }
    if (sceneState.progress > windows.belfast[0]) {
        climb.to(sceneState, { progress: windows.belfast[1], duration: wasInCity ? 0.45 : 1.2, ease: wasInCity ? 'none' : 'power1.in' })
            .set(sceneState, { progress: windows.belfast[0] - 1e-4 });
    }
    // Out over however much is left: fast up off the clouds (the way down eases into them, so played backwards it would
    // linger there), then slowing into the view of the whole planet
    const left = Math.min(sceneState.progress, windows.belfast[0]) / windows.belfast[0];
    climb.to(sceneState, {
        progress: 0, duration: RETURN_DURATION * left ** (2 / 3), ease: (t: number) => 1 - (1 - t) ** RETURN_EASE,
    });
};

/** Sets off from the title, or speeds the descent along if it's already going. */
export const skipIntro = () => {
    if (!intro || route.isIntroDone) return;
    if (!isSettingOff) setOff();
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
