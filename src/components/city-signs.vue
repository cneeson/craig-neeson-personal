<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { PerspectiveCamera, Vector3 } from 'three';
import { isInBelfast } from '@/scene/choreography';
import { cityState, route, type EmployerBeat } from '@/scene/director';
import { onOverlayFrame } from '@/scene/overlay';
import { sceneState } from '@/scene/state';
import { officeAnchors } from '@/scene/belfast/offices';
import type { SightName } from '@/scene/belfast/telescope';
import { navigate } from '@/services/navigation';
import { stops, type Stop } from '@/data/journey';
import EmployerDialog from './employer-dialog.vue';
import CompanyLogo from './company-logo.vue';

/**
 * The experience written over Belfast: a callout for each stop, pointing down at the building (outlined by
 * offices.ts) and opening its details, and in the overview a pin on each building to fly to it. The callouts stay
 * flat to the screen and inside it, so they read on a phone too. Shown in time as the camera arrives.
 */

/** Seen through the telescope, or Paris through the binoculars (telescope.ts): under the eyepieces, with how far. */
const SCOPE_CARDS: Partial<Record<EmployerBeat, string>> = {
  coleraine: '78 km north-west, as the crow flies',
  antrim: '21 km north-west',
  ankorstore: 'Paris, 860 km south-east',
};
const scopeBeats = Object.keys(SCOPE_CARDS) as SightName[];
/** The stops with a building to point at, in the city (those through the telescope have their cards under it). */
const callouts = (Object.keys(officeAnchors) as EmployerBeat[])
  .filter(beat => !(beat in SCOPE_CARDS))
  .map(beat => ({ beat, anchor: officeAnchors[beat] as Vector3 }));
/** The overview's pins: each office, and the telescope over City Hall for the first two. */
const pins: { beat: EmployerBeat, anchor: Vector3, label?: string }[] = [
  { beat: 'coleraine', anchor: new Vector3(-96.7, 6, 83.7), label: 'The telescope at City Hall' },
  ...callouts,
];

const root = ref<HTMLElement>();
const calloutElements = new Map<EmployerBeat, HTMLElement>();
const pinElements: HTMLElement[] = [];
const openStop = shallowRef<Stop | null>(null);

const shown = new Map<HTMLElement, boolean>();
const toggle = (element: HTMLElement, isShown: boolean) => {
  if (shown.get(element) === isShown) return;
  shown.set(element, isShown);
  element.classList.toggle('is-shown', isShown);
};

/** Space kept clear round the edges of the screen, and the leader's length (px). */
const MARGIN = 16;
const leaderLength = (height: number) => Math.min(110, height * 0.12);

const onScreen = new Vector3();
/** Where `anchor` is on screen (px), or null if it's out of view. */
const project = (anchor: Vector3, camera: PerspectiveCamera, width: number, height: number) => {
  onScreen.copy(anchor).project(camera);
  if (onScreen.z > 1 || Math.abs(onScreen.x) > 1 || Math.abs(onScreen.y) > 1) return null;
  return [((onScreen.x + 1) / 2) * width, ((1 - onScreen.y) / 2) * height];
};

/**
 * Points `element`'s callout at `anchor`: the dot on the building, the leader up from it (or down, near the top
 * of the screen) and the card at its end, slid along to stay on screen. False if the building is out of view.
 */
const point = (element: HTMLElement, anchor: Vector3, camera: PerspectiveCamera, width: number, height: number) => {
  const at = project(anchor, camera, width, height);
  if (!at) return false;
  const [x, y] = at;
  const card = element.lastElementChild as HTMLElement;
  const [cardWidth, cardHeight] = [card.offsetWidth, card.offsetHeight];
  const leader = leaderLength(height);
  const isBelow = y - leader - cardHeight < MARGIN * 4;
  const left = Math.min(Math.max(x - cardWidth / 2, MARGIN), width - cardWidth - MARGIN) - x;
  element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  element.style.setProperty('--leader', `${isBelow ? leader : -leader}px`);
  card.style.transform = `translate3d(${left}px, ${isBelow ? leader : -leader - cardHeight}px, 0)`;
  return true;
};

let stop: (() => void) | undefined;

onMounted(() => {
  let [width, height] = [0, 0];

  stop = onOverlayFrame((camera, progress) => {
    const isShowing = !!root.value && isInBelfast(progress) && sceneState.cityReady && route.mode === 'experience';
    if (root.value) root.value.style.visibility = isShowing ? 'visible' : 'hidden';
    if (!isShowing || !root.value) return;
    [width, height] = [root.value.clientWidth, root.value.clientHeight];
    const arriving = route.isArriving;
    const isUp = (beat: EmployerBeat) => route.stop === beat && arriving;

    callouts.forEach(({ beat, anchor }) => {
      const element = calloutElements.get(beat);
      if (!element) return;
      const up = isUp(beat);
      // Up in the sky instead if the building's out of view (on a narrow screen, say)
      const isPointing = up && point(element, anchor, camera, width, height);
      if (up && !isPointing && !element.classList.contains('is-in-the-sky')) {
        element.style.transform = '';
        (element.lastElementChild as HTMLElement).style.transform = '';
      }
      element.classList.toggle('is-in-the-sky', up && !isPointing);
      toggle(element, up);
    });
    scopeBeats.forEach(beat => {
      const element = calloutElements.get(beat);
      const { open, sight, whip } = cityState.scope;
      if (element) toggle(element, isUp(beat) && open > 0.6 && sight === beat && Math.abs(whip) === 1);
    });

    const isOverview = route.stop === 'overview' && arriving;
    pins.forEach(({ anchor }, i) => {
      const element = pinElements[i];
      if (!element) return;
      const at = isOverview ? project(anchor, camera, width, height) : null;
      if (at) {
        element.style.transform = `translate3d(${at[0]}px, ${at[1]}px, 0)`;
        // The label's kept on screen, even when its building's at the edge
        const label = element.lastElementChild as HTMLElement;
        const half = label.offsetWidth / 2 + 8;
        const shift = Math.min(Math.max(at[0], half), width - half) - at[0];
        label.style.transform = `translateX(calc(-50% + ${shift}px))`;
      }
      toggle(element, !!at);
    });
  });
});

onBeforeUnmount(() => stop?.());
</script>

<template>
  <div ref="root" class="city-signs">
    <button
      v-for="(pin, i) in pins"
      :key="`pin-${pin.beat}`"
      :ref="element => element && (pinElements[i] = element as HTMLElement)"
      type="button"
      class="pin sign"
      @click="navigate('experience', pin.beat)"
    >
      <span class="dot" />
      <span class="label">
        <template v-if="pin.label">{{ pin.label }}</template>
        <CompanyLogo v-else :stop="stops[pin.beat]" :size="16" />
      </span>
    </button>

    <div
      v-for="beat in [...callouts.map(callout => callout.beat), ...scopeBeats]"
      :key="beat"
      :ref="element => element && calloutElements.set(beat, element as HTMLElement)"
      class="callout sign"
      :class="{ 'is-in-the-scope': (scopeBeats as EmployerBeat[]).includes(beat) }"
    >
      <span class="dot" />
      <span class="leader" />
      <article class="card">
        <p v-if="SCOPE_CARDS[beat]" class="readout">◎ {{ SCOPE_CARDS[beat] }}</p>
        <p class="eyebrow">{{ stops[beat].place }} · {{ stops[beat].dates }}</p>
        <h3><CompanyLogo :stop="stops[beat]" :size="30" /></h3>
        <p class="role">{{ stops[beat].role }}</p>
        <p class="line">{{ stops[beat].line }}</p>
        <button type="button" class="more" @click="openStop = stops[beat]">More about {{ stops[beat].name }}</button>
      </article>
    </div>
  </div>

  <EmployerDialog :stop="openStop" @close="openStop = null" />
</template>

<style lang="scss" scoped>
$blue: #88b8f2;

.city-signs {
  position: fixed;
  inset: 0;
  // Sized like the canvas (see .scene in App.vue), so the projection lines up
  height: 100vh;
  height: 100lvh;
  // Over the page (so the signs can be clicked) but under the journey nav
  z-index: 25;
  pointer-events: none;
  overflow: hidden;
  visibility: hidden;
}

.sign {
  // Only the buttons take the pointer, so swiping over the rest still steps
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s ease, visibility 0s linear 0.5s;
  color: white;

  &.is-shown {
    opacity: 1;
    visibility: inherit;
    transition: opacity 0.6s ease;
  }
}

// A pin on a building in the overview, which flies to it
.pin {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: auto;
  cursor: pointer;

  .dot {
    position: absolute;
    left: -5px;
    top: -5px;
    width: 10px;
    height: 10px;
    border: 2px solid white;
    border-radius: 50%;
    background: $blue;
    box-shadow: 0 0 12px 3px rgba(136, 184, 242, 0.7);
  }

  .label {
    position: absolute;
    left: 0;
    bottom: 12px;
    transform: translateX(-50%);
    display: block;
    padding: 6px 9px;
    border: 1px solid rgba(136, 184, 242, 0.55);
    border-radius: 6px;
    background: rgba(9, 1, 24, 0.72);
    backdrop-filter: blur(4px);
    font-size: 11px;
    white-space: nowrap;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  &:hover .label,
  &:focus-visible .label {
    background: rgba(42, 35, 122, 0.9);
    border-color: $blue;
  }
}

// A callout pointing down at the building
.callout {
  position: absolute;
  left: 0;
  top: 0;

  .dot {
    position: absolute;
    left: -6px;
    top: -6px;
    width: 12px;
    height: 12px;
    border: 2px solid white;
    border-radius: 50%;
    background: $blue;
    box-shadow: 0 0 0 5px rgba(136, 184, 242, 0.3), 0 0 18px 4px $blue;
  }

  // From the dot to the card, up (a negative --leader) or down
  .leader {
    position: absolute;
    left: -1px;
    top: min(0px, var(--leader, 0px));
    width: 2px;
    height: max(var(--leader, 0px), calc(var(--leader, 0px) * -1));
    background: rgba(136, 184, 242, 0.85);
    box-shadow: 0 0 8px rgba(136, 184, 242, 0.6);
    transform-origin: 50% 100%;
  }

  .card {
    position: absolute;
    left: 0;
    top: 0;
    width: min(340px, calc(100vw - 32px));
    padding: 16px 18px;
    border: 1px solid rgba(136, 184, 242, 0.55);
    border-radius: 8px;
    background: rgba(9, 1, 24, 0.72);
    backdrop-filter: blur(6px);
    box-shadow: 0 0 30px rgba(136, 184, 242, 0.25);
  }

  // With no building to point at, or none in view: up in the sky over the middle of the screen
  &.is-in-the-sky {
    left: 50%;
    top: 22%;

    .dot,
    .leader {
      display: none;
    }

    .card {
      transform: translateX(-50%);
    }
  }

  // Under the telescope's eyepieces
  &.is-in-the-scope {
    left: 50%;
    top: auto;
    bottom: calc(var(--chrome-bottom) + 1rem);

    .dot,
    .leader {
      display: none;
    }

    .card {
      top: auto;
      bottom: 0;
      transform: translateX(-50%);
    }
  }

  .readout {
    margin-bottom: 6px;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 11px;
    color: #ffd27a;
  }

  .eyebrow {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: $blue;
  }

  h3 {
    margin: 10px 0 8px;
  }

  .role {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
  }

  .line {
    margin-top: 8px;
    font-size: 14px;
    line-height: 1.4;

    // On phones the card stays small, and the line's in the dialog
    @media (max-width: 767px) {
      display: none;
    }
  }

  .more {
    margin-top: 10px;
    font-size: 12px;
    color: $blue;
    text-decoration: underline;
    text-underline-offset: 3px;
    pointer-events: auto;
    cursor: pointer;
  }
}
</style>
