/**
 * Values shared between the director (director.ts, tweened with GSAP) and the render loop. Deliberately a plain
 * object rather than reactive state: it changes every frame and is only ever read from the render loop, so Vue
 * never needs to know about it.
 */
export const sceneState = {
    /** The journey out on the planet, 0 → 1 (hero → Northern Ireland → Belfast → Europe; see choreography.ts). */
    progress: 0,
    /** The planet's first appearance, 0 → 1 (see entranceAt in choreography.ts). */
    entrance: 0,
    /** Northern Ireland's border traced on from orbit, 0 → 1, once the hero's arrow to it is drawn (hero.vue). */
    traced: 0,
    /** Set once the Belfast flythrough has loaded (it's fetched in the background after the planet). */
    cityReady: false,
    /** The planet's spin (radians), written by the render loop for the overlays pinned to it. */
    earthRotationY: 0,
};
