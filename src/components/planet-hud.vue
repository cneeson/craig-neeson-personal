<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { PerspectiveCamera, Vector3 } from 'three';
import { FADE, windowOpacity, windows } from '@/scene/choreography';
import { onOverlayFrame } from '@/scene/overlay';
import { ARCS } from '@/scene/planet/arcs';
import { EARTH_POSITION, earthToWorld, onEarth, PLACES } from '@/scene/planet/geo';
import { sceneState } from '@/scene/state';

/**
 * The labels over the planet: Belfast named as the camera comes down onto it, and where the arcs land. Positioned every frame from the render loop
 * (`onOverlayFrame`) so it stays pinned to the planet, and shown and hidden in time rather than scrubbed.
 */

const BELFAST = onEarth(PLACES.belfast.lat, PLACES.belfast.lon).multiplyScalar(1.01);
const ENDS = ARCS.map(arc => ({ ...arc, at: onEarth(PLACES[arc.to].lat, PLACES[arc.to].lon).multiplyScalar(1.01) }));

const root = ref<HTMLElement>();
const belfast = ref<HTMLElement>();
const labels = ref<HTMLElement[]>([]);

const shown = new WeakMap<HTMLElement, boolean>();
/** Shows or hides an element (by class, so its entrance plays in time). Returns whether it just appeared. */
const toggle = (element: HTMLElement | undefined, isShown: boolean) => {
  if (!element || shown.get(element) === isShown) return false;
  shown.set(element, isShown);
  element.classList.toggle('is-shown', isShown);
  return isShown;
};

const world = new Vector3();
const toCamera = new Vector3();
/** Moves `element` to where `point` (earth group space) is on screen; false if it's behind the planet or off screen. */
const pin = (element: HTMLElement | undefined, point: Vector3, camera: PerspectiveCamera, width: number, height: number) => {
  if (!element) return false;
  earthToWorld(point, sceneState.earthRotationY, world);
  // Facing the camera?
  toCamera.copy(camera.position).sub(world);
  const facing = toCamera.dot(world.clone().sub(EARTH_POSITION)) > 0;
  world.project(camera);
  const onScreen = facing && world.z < 1 && Math.abs(world.x) < 1.1 && Math.abs(world.y) < 1.1;
  if (onScreen) {
    element.style.transform = `translate3d(${((world.x + 1) / 2) * width}px, ${((1 - world.y) / 2) * height}px, 0)`;
  }
  return onScreen;
};

let stop: (() => void) | undefined;

onMounted(() => {
  stop = onOverlayFrame((camera, progress) => {
    const width = root.value?.clientWidth ?? 0;
    const height = root.value?.clientHeight ?? 0;

    // From partway down, until it goes into the clouds
    const isNamed = windowOpacity(progress, [windows.northernIreland[0] - 0.045, windows.northernIreland[1] - 0.02]) > 0.5;
    toggle(belfast.value, pin(belfast.value, BELFAST, camera, width, height) && isNamed);

    const reach = windowOpacity(progress, [windows.reach[0], windows.reveal[0]], FADE);
    ENDS.forEach((end, i) => {
      const label = labels.value[i];
      const isLanded = progress > windows.reach[0] + (windows.reach[1] - windows.reach[0]) * (end.delay + 0.45);
      toggle(label, pin(label, end.at, camera, width, height) && isLanded && reach > 0.5);
    });
  });
});

onBeforeUnmount(() => stop?.());
</script>

<template>
  <div ref="root" class="planet-hud" aria-hidden="true">
    <div ref="belfast" class="place">
      <span class="dot" />
      <span class="name">Belfast</span>
      <span class="region">Northern Ireland</span>
    </div>

    <span
      v-for="end in ENDS"
      :key="end.to"
      :ref="element => element && (labels[ENDS.indexOf(end)] = element as HTMLElement)"
      class="arc-label"
      :class="`is-${end.side}`"
    >
      <span class="dot" /><span class="text">{{ end.label }}</span>
    </span>
  </div>
</template>

<style lang="scss" scoped>
$blue: #88b8f2;

.planet-hud {
  position: fixed;
  inset: 0;
  // Sized like the canvas (see .scene in App.vue), so the projection lines up
  height: 100vh;
  height: 100lvh;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  color: white;
}

// Shown and hidden by class, in time
.place,
.arc-label {
  opacity: 0;
}

.place {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  text-shadow: 0 1px 10px rgba(9, 1, 24, 0.9);
  transition: opacity 0.6s ease;

  .dot {
    position: absolute;
    width: 0.55rem;
    height: 0.55rem;
    margin: -0.275rem 0 0 -0.275rem;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 12px 3px $blue;
  }

  .name,
  .region {
    position: absolute;
    left: 1rem;
    white-space: nowrap;
    transform: translateX(-0.4rem);
    transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .name {
    top: -1.05rem;
    font-family: 'Funnel Display', Helvetica, Arial, sans-serif;
    font-size: 1.35rem;
    font-weight: 700;
  }

  .region {
    top: 0.45rem;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: $blue;
  }

  &.is-shown {
    opacity: 1;

    .name,
    .region {
      transform: none;
    }
  }
}

.arc-label {
  position: absolute;
  left: 0;
  top: 0;
  font-size: 0.75rem;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(9, 1, 24, 0.9);
  will-change: transform;
  // Moved every frame, so only its opacity eases
  transition: opacity 0.5s ease;

  .dot {
    position: absolute;
    width: 0.5rem;
    height: 0.5rem;
    margin: -0.25rem 0 0 -0.25rem;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 10px 3px $blue;
  }

  .text {
    position: absolute;
    top: -0.55rem;
    left: 0.6rem;
  }

  &.is-left .text {
    left: auto;
    right: 0.6rem;
  }

  &.is-below .text {
    top: 0.5rem;
    left: 0;
    transform: translateX(-50%);
  }

  &.is-shown {
    opacity: 1;
  }
}
</style>
