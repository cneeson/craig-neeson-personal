<script setup lang="ts">
// Debug (only with ?debug): move the city camera by hand and read off its pose, to place shots.
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { MathUtils } from 'three';
import { cameraNudge } from '@/scene/camera-nudge';
import { cityPoseAt, route } from '@/scene/director';
import type { Pose } from '@/scene/shots';

type Control = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'turnLeft' | 'turnRight' | 'tiltUp' | 'tiltDown';

const isOn = ref(false);
const pose = reactive<Pose>({ x: 0, y: 0, z: 0, pitch: 0, heading: 0, zoom: 1 });
const copied = ref(false);

/** Units (10 m) or degrees per second, held; Shift for five times as fast. */
const SPEED = { move: 20, climb: 10, turn: 20 };
const keys: Record<string, Control> = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', KeyR: 'up', KeyF: 'down',
  KeyQ: 'turnLeft', KeyE: 'turnRight', KeyT: 'tiltUp', KeyG: 'tiltDown',
  ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
};
const held = new Set<Control>();
let isFast = false;
let frame = 0;
let last = 0;

const toggle = () => {
  isOn.value = !isOn.value;
  if (isOn.value) {
    Object.assign(pose, cityPoseAt());
    cameraNudge.pose = pose;
  } else {
    cameraNudge.pose = null;
    held.clear();
  }
};

const round = (value: number) => Math.round(value * 10) / 10;
const text = () => `{ x: ${round(pose.x)}, y: ${round(pose.y)}, z: ${round(pose.z)}, pitch: ${round(pose.pitch)}, heading: ${round(MathUtils.euclideanModulo(pose.heading, 360))} }`;
const copy = async () => {
  await navigator.clipboard?.writeText(text());
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1200);
};

const tick = (now: number) => {
  frame = requestAnimationFrame(tick);
  const delta = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!isOn.value || !held.size) return;
  const fast = isFast ? 5 : 1;
  const heading = MathUtils.degToRad(pose.heading);
  const [forward, right] = [[Math.sin(heading), -Math.cos(heading)], [Math.cos(heading), Math.sin(heading)]];
  const step = SPEED.move * fast * delta;
  const go = (direction: number[], amount: number) => { pose.x += direction[0] * amount; pose.z += direction[1] * amount; };
  if (held.has('forward')) go(forward, step);
  if (held.has('back')) go(forward, -step);
  if (held.has('right')) go(right, step);
  if (held.has('left')) go(right, -step);
  if (held.has('up')) pose.y += SPEED.climb * fast * delta;
  if (held.has('down')) pose.y -= SPEED.climb * fast * delta;
  if (held.has('turnRight')) pose.heading += SPEED.turn * fast * delta;
  if (held.has('turnLeft')) pose.heading -= SPEED.turn * fast * delta;
  if (held.has('tiltUp')) pose.pitch = Math.min(pose.pitch + SPEED.turn * fast * delta, 89);
  if (held.has('tiltDown')) pose.pitch = Math.max(pose.pitch - SPEED.turn * fast * delta, -89);
};

// Ahead of the site's own keys (arrows step between stops), so they move the camera instead while it's on
const onKeyDown = (event: KeyboardEvent) => {
  isFast = event.shiftKey;
  const control = keys[event.code];
  if (!isOn.value || !control) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  held.add(control);
};
const onKeyUp = (event: KeyboardEvent) => {
  isFast = event.shiftKey;
  const control = keys[event.code];
  if (control) held.delete(control);
};
const onBlur = () => held.clear();

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  last = performance.now();
  frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('keyup', onKeyUp, true);
  window.removeEventListener('blur', onBlur);
  cancelAnimationFrame(frame);
  cameraNudge.pose = null;
});

const press = (control: Control) => held.add(control);
const release = (control: Control) => held.delete(control);
const pad: [Control, string][][] = [
  [['turnLeft', 'Turn ←'], ['forward', '↑'], ['turnRight', 'Turn →'], ['up', 'Up']],
  [['left', '←'], ['back', '↓'], ['right', '→'], ['down', 'Down']],
  [['tiltUp', 'Tilt ↑'], ['tiltDown', 'Tilt ↓']],
];
</script>

<template>
  <div v-if="route.isIntroDone" class="debug-camera">
    <button type="button" class="toggle" :class="{ 'is-on': isOn }" @click="toggle">
      Camera {{ isOn ? 'on' : 'off' }}
    </button>
    <template v-if="isOn">
      <div v-for="(row, index) in pad" :key="index" class="row">
        <button
          v-for="[control, label] in row"
          :key="control"
          type="button"
          @pointerdown="press(control)"
          @pointerup="release(control)"
          @pointerleave="release(control)"
          @pointercancel="release(control)"
        >
          {{ label }}
        </button>
      </div>
      <code>{{ text() }}</code>
      <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy pose' }}</button>
      <p>WASD / arrows move, R/F up/down, Q/E turn, T/G tilt, Shift ×5</p>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.debug-camera {
  position: fixed;
  top: 84px;
  right: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 230px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(9, 1, 24, 0.8);
  color: #f4efe6;
  font: 500 12px/1.3 'Satoshi', sans-serif;
  backdrop-filter: blur(6px);
  touch-action: none;
  user-select: none;
}

.row {
  display: flex;
  gap: 4px;
}

button {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(244, 239, 230, 0.12);

  &.is-on {
    background: #f4efe6;
    color: #090118;
  }
}

code {
  padding: 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  font: 11px/1.4 ui-monospace, monospace;
  user-select: all;
}

p {
  opacity: 0.6;
  font-size: 11px;
}
</style>
