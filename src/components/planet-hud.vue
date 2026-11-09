<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { PerspectiveCamera, Vector3 } from 'three';
import { FADE, windowOpacity, windows } from '@/scene/choreography';
import { onOverlayFrame } from '@/scene/overlay';
import { ARCS } from '@/scene/planet/arcs';
import { EARTH_POSITION, earthToWorld, onEarth, PLACES } from '@/scene/planet/geo';
import { sceneState } from '@/scene/state';
import { prefersReducedMotion } from '@/services/device';

/**
 * The heads-up display over the planet: the forecast as the camera backs away over the Arctic, the lock-on to
 * Belfast once the clouds part, and the labels where the arcs land. Positioned every frame from the render loop
 * (`onOverlayFrame`) so it stays pinned to the planet, and shown and hidden in time rather than scrubbed.
 */

const BELFAST = onEarth(PLACES.belfast.lat, PLACES.belfast.lon).multiplyScalar(1.01);
const ENDS = ARCS.map(arc => ({ ...arc, at: onEarth(PLACES[arc.to].lat, PLACES[arc.to].lon).multiplyScalar(1.01) }));

const root = ref<HTMLElement>();
const forecast = ref<HTMLElement>();
const lockOn = ref<HTMLElement>();
const latitude = ref<HTMLElement>();
const longitude = ref<HTMLElement>();
const labels = ref<HTMLElement[]>([]);

const shown = new WeakMap<HTMLElement, boolean>();
/** Shows or hides an element (by class, so its entrance plays in time). Returns whether it just appeared. */
const toggle = (element: HTMLElement | undefined, isShown: boolean) => {
  if (!element || shown.get(element) === isShown) return false;
  shown.set(element, isShown);
  element.classList.toggle('is-shown', isShown);
  return isShown;
};

/** The coordinates count up to Belfast's as it locks on. */
const countCoordinates = () => {
  const coordinates = { lat: 0, lon: 0 };
  const write = () => {
    if (latitude.value) latitude.value.textContent = `${coordinates.lat.toFixed(3)}° N`;
    if (longitude.value) longitude.value.textContent = `${coordinates.lon.toFixed(3)}° W`;
  };
  gsap.killTweensOf(coordinates);
  gsap.to(coordinates, {
    lat: PLACES.belfast.lat,
    lon: -PLACES.belfast.lon,
    duration: prefersReducedMotion ? 0 : 1.4,
    ease: 'expo.out',
    onUpdate: write,
    onComplete: write,
  });
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

    toggle(forecast.value, windowOpacity(progress, windows.forecast) > 0.5);

    const isLocked = pin(lockOn.value, BELFAST, camera, width, height);
    if (toggle(lockOn.value, isLocked && windowOpacity(progress, windows.northernIreland, FADE) > 0.5)) {
      countCoordinates();
    }

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
    <div ref="forecast" class="forecast panel">
      <span class="eyebrow">Forecast · Northern Ireland</span>
      <span class="headline">☁️ Cloudy.</span>
      <span class="aside">Let me clear that for you.</span>
    </div>

    <div ref="lockOn" class="lock-on">
      <span class="reticle">
        <span v-for="corner in 4" :key="corner" class="corner" />
      </span>
      <span class="leader" />
      <div class="callout panel">
        <span class="eyebrow">Northern Ireland</span>
        <span class="headline">Home</span>
        <span class="aside">A small place with a long history of building things.</span>
        <span class="coordinates"><span ref="latitude">0.000° N</span> <span ref="longitude">0.000° W</span></span>
      </div>
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

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(136, 184, 242, 0.45);
  border-radius: 0.375rem;
  background: rgba(9, 1, 24, 0.55);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 24px rgba(136, 184, 242, 0.2);
}

.eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: $blue;
}

.headline {
  font-family: 'Funnel Display', Helvetica, Arial, sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
}

.aside {
  font-size: 0.8rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.8);
}

// Shown and hidden by class, in time
.forecast,
.callout,
.reticle,
.leader,
.arc-label {
  opacity: 0;
  transition: opacity 0.4s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), clip-path 0.6s ease;
}

.forecast {
  position: absolute;
  left: 50%;
  top: 22%;
  transform: translate(-50%, 0.75rem);
  min-width: 16rem;
}

.forecast.is-shown {
  opacity: 1;
  transform: translate(-50%, 0);
}

.lock-on {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}

.reticle {
  position: absolute;
  width: 2.75rem;
  height: 2.75rem;
  margin: -1.375rem 0 0 -1.375rem;
  transform: scale(2.4) rotate(45deg);

  .corner {
    position: absolute;
    width: 0.7rem;
    height: 0.7rem;
    border: 2px solid $blue;
    filter: drop-shadow(0 0 4px $blue);

    &:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; }
    &:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; }
    &:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; }
    &:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; }
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 4px;
    height: 4px;
    margin: -2px 0 0 -2px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 8px 2px $blue;
  }
}

.leader {
  position: absolute;
  left: 1.6rem;
  top: -1.6rem;
  width: 3rem;
  height: 1px;
  background: $blue;
  transform-origin: left center;
  transform: rotate(-35deg) scaleX(0);
  transition-delay: 0.3s;
}

.callout {
  position: absolute;
  left: 4.1rem;
  top: -5.2rem;
  width: 17rem;
  transform: translateY(-50%);
  clip-path: inset(0 100% 0 0);
  transition-delay: 0.45s;
}

.coordinates {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: $blue;
  font-variant-numeric: tabular-nums;
}

.lock-on.is-shown {
  .reticle {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }

  .leader {
    opacity: 1;
    transform: rotate(-35deg) scaleX(1);
  }

  .callout {
    opacity: 1;
    clip-path: inset(0 0 0 0);
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

@media (max-width: 767px) {
  // Above the reticle, as the country sits low on a phone screen
  .callout {
    width: 13rem;
    left: -6.5rem;
    top: auto;
    bottom: 2.4rem;
    transform: none;
  }

  .leader {
    display: none;
  }
}
</style>
