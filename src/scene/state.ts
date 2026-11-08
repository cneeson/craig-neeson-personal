/**
 * Scroll-driven values shared between the DOM (GSAP/ScrollTrigger in App.vue) and the
 * render loop. Deliberately a plain object rather than reactive state: it changes every
 * frame and is only ever read from the render loop, so Vue never needs to know about it.
 */
export const sceneState = {
    /** 0 → 1 across the scene track (hero → Northern Ireland → Belfast → Europe → planet reveal). */
    progress: 0,
    /** 0 → 1 as the content sections scroll in over the (now blurred) canvas. */
    exit: 0,
    /** Set once the Belfast flythrough has loaded (it's fetched in the background after the planet). */
    cityReady: false,
    /** The planet's spin (radians), written by the render loop for the overlays pinned to it. */
    earthRotationY: 0,
};
