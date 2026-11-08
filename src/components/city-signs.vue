<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { isInBelfast, windowOpacity, windows, type EmployerBeat } from '@/scene/choreography';
import { onOverlayFrame } from '@/scene/overlay';
import { sceneState } from '@/scene/state';
import { officeAnchors } from '@/scene/belfast/offices';
import { stops, type Stop } from '@/data/journey';
import EmployerDialog from './employer-dialog.vue';
import CompanyLogo from './company-logo.vue';

/**
 * What's written over Belfast: the gig poster of skills standing by the SSE Arena (placed in the scene with a
 * CSS3DRenderer that follows the city camera, turned to face it), and a callout for each stop along the career
 * walk, pointing down at the building (outlined by offices.ts) and opening its details. The callouts stay flat
 * to the screen and inside it, so they read on a phone too. Both are shown in time while their beat is up.
 */

/** The poster: where it stands (scene units, 10 m) and its size (world units per CSS pixel). */
const POSTER = { position: new Vector3(-1, 6.5, 5.5), scale: 0.017 };

/** The stops with a building to point at. */
const callouts = (Object.keys(officeAnchors) as EmployerBeat[]).map(beat => ({ beat, anchor: officeAnchors[beat] as Vector3 }));
/** The remote years at Ankorstore have the arc to Paris instead, and their card up in the sky. */
const SKY_CARDS: EmployerBeat[] = ['ankorstore'];

const root = ref<HTMLElement>();
const poster = ref<HTMLElement>();
const calloutElements = new Map<EmployerBeat, HTMLElement>();
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
/**
 * Points `element`'s callout at `anchor`: the dot on the building, the leader up from it (or down, near the top
 * of the screen) and the card at its end, slid along to stay on screen. False if the building is out of view.
 */
const point = (element: HTMLElement, anchor: Vector3, camera: PerspectiveCamera, width: number, height: number) => {
  onScreen.copy(anchor).project(camera);
  if (onScreen.z > 1 || Math.abs(onScreen.x) > 1 || Math.abs(onScreen.y) > 1) return false;
  const [x, y] = [((onScreen.x + 1) / 2) * width, ((1 - onScreen.y) / 2) * height];
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
let renderer: CSS3DRenderer | undefined;

onMounted(() => {
  renderer = new CSS3DRenderer();
  root.value?.prepend(renderer.domElement);
  const scene = new Scene();
  const posterObject = new CSS3DObject(poster.value as HTMLElement);
  posterObject.position.copy(POSTER.position);
  posterObject.scale.setScalar(POSTER.scale);
  scene.add(posterObject);
  let [width, height] = [0, 0];

  stop = onOverlayFrame((camera, progress) => {
    const isShowing = !!root.value && isInBelfast(progress) && sceneState.cityReady && sceneState.exit < 1;
    if (root.value) root.value.style.visibility = isShowing ? 'visible' : 'hidden';
    if (!isShowing || !root.value || !renderer) return;

    if (root.value.clientWidth !== width || root.value.clientHeight !== height) {
      [width, height] = [root.value.clientWidth, root.value.clientHeight];
      renderer.setSize(width, height);
    }

    const isPosterUp = windowOpacity(progress, windows.skills) > 0.5;
    toggle(posterObject.element, isPosterUp);
    if (isPosterUp) {
      // Turned about its upright to face the camera
      posterObject.rotation.y = Math.atan2(camera.position.x - POSTER.position.x, camera.position.z - POSTER.position.z);
      renderer.render(scene, camera);
    }

    callouts.forEach(({ beat, anchor }) => {
      const element = calloutElements.get(beat);
      if (!element) return;
      const isUp = windowOpacity(progress, windows[beat]) > 0.5;
      // Up in the sky instead if the building's out of view (on a narrow screen, say)
      const isPointing = isUp && point(element, anchor, camera, width, height);
      if (isUp && !isPointing && !element.classList.contains('is-in-the-sky')) {
        element.style.transform = '';
        (element.lastElementChild as HTMLElement).style.transform = '';
      }
      element.classList.toggle('is-in-the-sky', isUp && !isPointing);
      toggle(element, isUp);
    });
    SKY_CARDS.forEach(beat => {
      const element = calloutElements.get(beat);
      if (element) toggle(element, windowOpacity(progress, windows[beat]) > 0.5);
    });
  });
});

onBeforeUnmount(() => {
  stop?.();
  renderer?.domElement.remove();
});
</script>

<template>
  <div ref="root" class="city-signs">
    <!-- The renderer moves the poster into its own element -->
    <div hidden>
      <article ref="poster" class="sign poster">
        <p class="venue">Live at the SSE Arena</p>
        <p class="billing">Tonight</p>
        <p class="headliners">
          <span>TypeScript</span>
          <span>Vue</span>
          <span>React</span>
        </p>
        <p class="billing">With special guests</p>
        <p class="support">Nuxt · Node · Three.js · GSAP</p>
        <p class="billing">Doors open with</p>
        <p class="openers">HTML · CSS · Tailwind · JavaScript</p>
        <p class="small-print">All ages · Fully accessible venue</p>
      </article>
    </div>

    <div
      v-for="beat in [...callouts.map(callout => callout.beat), ...SKY_CARDS]"
      :key="beat"
      :ref="element => element && calloutElements.set(beat, element as HTMLElement)"
      class="callout sign"
      :class="{ 'is-in-the-sky': SKY_CARDS.includes(beat) }"
    >
      <span class="dot" />
      <span class="leader" />
      <article class="card">
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
  // CSS3DObject makes its element take the pointer; only the buttons should, so the page still scrolls under it
  pointer-events: none !important;
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

// A gig poster, pasted up by the arena
.poster {
  width: 320px;
  padding: 26px 24px 20px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 190, 90, 0.35), transparent 60%),
    linear-gradient(170deg, #2a0f4a, #12052a 70%);
  border: 3px solid #ffd27a;
  box-shadow: 0 0 40px rgba(255, 190, 90, 0.35);
  font-family: 'Funnel Display', Helvetica, Arial, sans-serif;
  text-transform: uppercase;

  .venue {
    font-size: 11px;
    letter-spacing: 0.3em;
    color: #ffd27a;
  }

  .billing {
    margin-top: 14px;
    font-size: 10px;
    letter-spacing: 0.35em;
    color: rgba(255, 255, 255, 0.7);
  }

  .headliners {
    display: flex;
    flex-direction: column;
    margin-top: 4px;
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.01em;

    span:nth-child(2) {
      color: #ffd27a;
    }
  }

  .support {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 700;
  }

  .openers {
    margin-top: 4px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .small-print {
    margin-top: 18px;
    font-size: 8px;
    letter-spacing: 0.25em;
    color: rgba(255, 255, 255, 0.5);
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
