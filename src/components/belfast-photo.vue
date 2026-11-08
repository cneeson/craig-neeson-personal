<template>
  <primitive :object="root" />
</template>

<script lang="ts" setup>
import { Group, Mesh, PerspectiveCamera, SphereGeometry } from 'three';
import { onBeforeUnmount } from 'vue';
import { useRenderLoop, useTresContext } from '@tresjs/core';
import { createPhotoCity } from '@/scene/belfast/photo-city';
import { createDaySkyMaterial } from '@/scene/belfast/photo-materials';
import { attribution } from '@/scene/belfast/attribution';
import { GOOGLE_MAPS_API_KEY } from '@/scene/belfast/mode';
import { sceneState } from '@/scene/state';
import { flightProgressAt, isInBelfast, windows } from '@/scene/choreography';
import { camera } from '@/scene/camera';

const emit = defineEmits<{
  /** The tiles can't load, so the night city should take over. */
  failed: [];
}>();

/**
 * Belfast by day, from Google's photorealistic 3D tiles, for the flythrough. Mounted once the planet is
 * up, so the start of the flight loads in the background while the reader is still on the opening beats,
 * then the rest (see photo-city.ts).
 */
const { renderer } = useTresContext();

const root = new Group();
root.visible = false;

const skyMaterial = createDaySkyMaterial();
const sky = new Mesh(new SphereGeometry(800, 32, 16), skyMaterial);
sky.renderOrder = -1;
sky.frustumCulled = false;

const photoCity = createPhotoCity(renderer.value, GOOGLE_MAPS_API_KEY, error => {
  console.warn('Belfast tiles failed to load; showing the night city instead', error);
  emit('failed');
});
root.add(sky, photoCity.group);

let frame = 0;
const showAttribution = (isShown: boolean) => {
  if (!attribution.element) return;
  attribution.element.style.opacity = isShown ? '1' : '0';
  // The providers change with what's in view; no need to check every frame
  if (isShown && attribution.text && frame++ % 30 === 0) attribution.text.textContent = photoCity.attributions();
};

onBeforeUnmount(() => {
  photoCity.dispose();
  sky.geometry.dispose();
  skyMaterial.dispose();
  showAttribution(false);
  sceneState.cityReady = false;
});

const { onLoop } = useRenderLoop();
onLoop(({ delta }) => {
  const { progress } = sceneState;
  const isFlying = isInBelfast(progress);
  // Past the flight, the reader would come back into it from the end
  const direction = progress >= windows.belfast[1] ? -1 : 1;
  photoCity.update(camera as PerspectiveCamera, isFlying, flightProgressAt(progress), direction, delta);
  sceneState.cityReady = photoCity.isReady;

  const isActive = isFlying && photoCity.isReady;
  root.visible = isActive;
  showAttribution(isActive);
  if (isActive) sky.position.copy(camera.position);
});
</script>
