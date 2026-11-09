import { go, modeOrder, modes, route, skipIntro, startIntro, type Mode, type StopId } from '@/scene/director';

/**
 * Where the site is lives in the address (`#experience/ankorstore`), so stops can be linked to, the back button
 * works and a reload lands in the same place. Scrolling, swiping and the arrow keys step from one stop to the next,
 * on through the modes in turn; Escape goes home.
 */

const parse = (hash: string): { mode: Mode, step: number } | null => {
    const [mode, stop] = hash.replace(/^#\/?/, '').split('/');
    if (!(mode in modes)) return null;
    const stops = modes[mode as Mode] as readonly StopId[];
    return { mode: mode as Mode, step: Math.max(0, stops.indexOf(stop as StopId)) };
};

const hashOf = (mode: Mode, step: number) => {
    if (mode === 'home') return ' ';
    const stops = modes[mode];
    return step === 0 && stops.length === 1 ? `#${mode}` : `#${mode}/${stops[step]}`;
};

/** Goes to a stop (by index or name), recording it in the address: as a new entry, or in place of the last. */
export const navigate = (mode: Mode, stop: number | StopId = 0, { replace = false } = {}) => {
    const stops = modes[mode] as readonly StopId[];
    const step = typeof stop === 'number' ? stop : Math.max(0, stops.indexOf(stop));
    const url = `${location.pathname}${location.search}${hashOf(mode, step)}`.trim();
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    go(mode, step);
};

/** Steps to the next (1) or previous (-1) stop, carrying on into the next or previous mode at the ends. */
export const step = (direction: 1 | -1) => {
    if (!route.isIntroDone) {
        if (direction > 0) skipIntro();
        return;
    }
    const mode = route.mode === 'intro' ? 'home' : route.mode;
    const next = route.step + direction;
    if (next >= 0 && next < modes[mode].length) {
        navigate(mode, next, { replace: true });
        return;
    }
    const nextMode = modeOrder[modeOrder.indexOf(mode) + direction];
    if (nextMode) navigate(nextMode, direction > 0 ? 0 : modes[nextMode].length - 1, { replace: true });
};

// --- Input ---

/** Somewhere the wheel or a swipe should scroll rather than step (a dialog, the timeline, a long panel). */
const isScrollable = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-scrolls], dialog[open]');
const isDialogOpen = () => !!document.querySelector('dialog[open]');

/** Wheel movement (px) that counts as one step, and how long after a step to ignore more of the same flick (s). */
const WHEEL_STEP = 50;
const WHEEL_REST = 0.45;

let wheel = 0;
let lastWheel = 0;
let lockedUntil = 0;

const onWheel = (event: WheelEvent) => {
    if (isScrollable(event.target) || isDialogOpen()) return;
    event.preventDefault();
    const time = performance.now() / 1000;
    // A trackpad's momentum keeps sending events: only a fresh gesture, after a pause, steps again
    if (time - lastWheel > 0.25) wheel = 0;
    lastWheel = time;
    if (time < lockedUntil) {
        lockedUntil = time + WHEEL_REST;
        return;
    }
    wheel += Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(wheel) < WHEEL_STEP) return;
    step(wheel > 0 ? 1 : -1);
    wheel = 0;
    lockedUntil = time + WHEEL_REST;
};

let touch: { x: number, y: number, isIgnored: boolean } | null = null;
const SWIPE = 40;

const onTouchStart = (event: TouchEvent) => {
    const { clientX: x, clientY: y } = event.touches[0];
    touch = { x, y, isIgnored: event.touches.length > 1 || isScrollable(event.target) };
};

const onTouchEnd = (event: TouchEvent) => {
    if (!touch || touch.isIgnored || isDialogOpen()) return;
    const { clientX, clientY } = event.changedTouches[0];
    const [dx, dy] = [touch.x - clientX, touch.y - clientY];
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    // Up or left is onwards
    step((Math.abs(dy) > Math.abs(dx) ? dy : dx) > 0 ? 1 : -1);
};

// Stops the page itself scrolling or bouncing (it doesn't scroll), outside the places that do
const onTouchMove = (event: TouchEvent) => {
    if (!isScrollable(event.target)) event.preventDefault();
};

const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isDialogOpen()) return;
    const target = event.target as HTMLElement;
    if (target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(event.key) || (event.key === ' ' && target.tagName !== 'BUTTON')) {
        event.preventDefault();
        step(1);
    } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        step(-1);
    } else if (event.key === 'Escape' || event.key === 'Home') {
        if (route.isIntroDone) navigate('home');
    }
};

const onPopState = () => {
    const destination = parse(location.hash) ?? { mode: 'home' as Mode, step: 0 };
    go(destination.mode, destination.step);
};

/** Starts the site at the stop in the address (if any) and listens for input. Returns a function that stops it. */
export const startNavigation = () => {
    const destination = parse(location.hash) ?? undefined;
    startIntro(destination);

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPopState);
    return () => {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('popstate', onPopState);
    };
};
