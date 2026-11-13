import { watch } from 'vue';
import { go, modeOrder, modes, returnToHero, route, skipIntro, startIntro, type Mode, type StopId } from '@/scene/director';

/**
 * Where the site is lives in the address (`#experience/ankorstore`), so stops can be linked to, the back button
 * works and a reload lands in the same place. The title over the planet is the bare address, before them all, so back
 * from the first stop climbs back out to it. The arrow keys step from one stop to the next, on through the modes in
 * turn; Escape goes home. Scrolling and dragging don't move anything on.
 */

const parse = (hash: string): { mode: Mode, step: number } | null => {
    const [mode, stop] = hash.replace(/^#\/?/, '').split('/');
    if (!(mode in modes)) return null;
    const stops = modes[mode as Mode] as readonly StopId[];
    return { mode: mode as Mode, step: Math.max(0, stops.indexOf(stop as StopId)) };
};

const hashOf = (mode: Mode, step: number) => {
    if (mode === 'home') return '#home';
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

/** Somewhere a finger should scroll the page as usual (a dialog, the timeline, a long panel). */
const isScrollable = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-scrolls], dialog[open]');
const isDialogOpen = () => !!document.querySelector('dialog[open]');

// Scrolling and dragging don't move the scene on (the menu, the buttons and the keys do). This only stops the page
// itself scrolling or bouncing (it doesn't scroll), outside the places that do.
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
    const destination = parse(location.hash);
    if (destination) go(destination.mode, destination.step);
    else returnToHero();
};

const bare = () => `${location.pathname}${location.search}`;

/** Climbs back out to the title over the planet, as a new entry in the history (so back flies down again). */
export const goToOrbit = () => {
    if (route.isHeroUp) return;
    history.pushState(null, '', bare());
    returnToHero();
};

/** Starts the site at the stop in the address (if any) and listens for input. Returns a function that stops it. */
export const startNavigation = () => {
    const destination = parse(location.hash) ?? undefined;
    // A link to a stop: the title goes in the history before it, for the back button to climb out to
    if (destination) {
        const url = location.href;
        history.replaceState(null, '', bare());
        history.pushState(null, '', url);
    } else if (location.hash) {
        history.replaceState(null, '', bare());
    }
    // Setting off from the title (Enter, a key) is a step in the history
    const stopWatching = watch(() => route.isHeroUp, isUp => {
        if (!isUp && !location.hash) history.pushState(null, '', `${bare()}#home`);
    });
    startIntro(destination);

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPopState);
    return () => {
        stopWatching();
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('popstate', onPopState);
    };
};
