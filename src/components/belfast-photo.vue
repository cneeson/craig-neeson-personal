<template>
  <primitive :object="root" />
</template>

<script lang="ts" setup>
import { Group, Mesh, PerspectiveCamera, SphereGeometry } from 'three';
import { onBeforeUnmount } from 'vue';
import { useRenderLoop, useTresContext } from '@tresjs/core';
import { createPhotoCity } from '@/scene/belfast/photo-city';
import { createDaySkyMaterial } from '@/scene/belfast/photo-materials';
import { createWater, SkyUniforms } from '@/scene/belfast/water';
import { createStarlings } from '@/scene/belfast/starlings';
import { createTrain } from '@/scene/belfast/train';
import { createTelescope } from '@/scene/belfast/telescope';
import { attribution } from '@/scene/belfast/attribution';
import { sceneState } from '@/scene/state';
import { flightProgressAt, isInBelfast, windows } from '@/scene/choreography';
import { camera } from '@/scene/camera';

const emit = defineEmits<{
  /** The tiles can't load, so the city should be dropped. */
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

const telescope = createTelescope(renderer.value);
const photoCity = createPhotoCity(renderer.value, process.env.VUE_APP_GOOGLE_MAPS_API_KEY ?? '', error => {
  console.warn('Belfast tiles failed to load', error);
  emit('failed');
}, telescope);
// Shares the sky's uniforms, so its reflections match the sky
const water = createWater(skyMaterial.uniforms as SkyUniforms, renderer.value.capabilities.getMaxAnisotropy());
const starlings = createStarlings();
const train = createTrain(skyMaterial.uniforms.uSun);
root.add(sky, photoCity.group, water.mesh, starlings.object, train.object, telescope.overlay);

let frame = 0;
const showAttribution = (isShown: boolean) => {
  if (!attribution.element) return;
  attribution.element.style.opacity = isShown ? '1' : '0';
  // The providers change with what's in view; no need to check every frame
  if (isShown && attribution.text && frame++ % 30 === 0) attribution.text.textContent = photoCity.attributions();
};

onBeforeUnmount(() => {
  photoCity.dispose();
  water.dispose();
  starlings.dispose();
  train.dispose();
  telescope.dispose();
  sky.geometry.dispose();
  skyMaterial.dispose();
  showAttribution(false);
  sceneState.cityReady = false;
});

const { onLoop } = useRenderLoop();
onLoop(({ delta, elapsed }) => {
  const { progress } = sceneState;
  const isFlying = isInBelfast(progress);
  // Past the flight, the reader would come back into it from the end
  const direction = progress >= windows.belfast[1] ? -1 : 1;
  photoCity.update(
    camera as PerspectiveCamera, isFlying, flightProgressAt(progress), direction, delta,
    telescope.camerasAt(progress),
  );
  sceneState.cityReady = photoCity.isReady;

  const isActive = isFlying && photoCity.isReady;
  root.visible = isActive;
  showAttribution(isActive);
  if (!isActive) return;
  sky.position.copy(camera.position);
  water.update(elapsed);
  starlings.update(elapsed, camera as PerspectiveCamera, renderer.value);
  train.update(progress);
  telescope.update(progress, elapsed, (camera as PerspectiveCamera).aspect, sky, photoCity.group);
});
</script>
