<template>
  <primitive :object="root" />
</template>

<script lang="ts" setup>
import { Group, Mesh, PerspectiveCamera, SphereGeometry, WebGLRenderer } from 'three';
import { onBeforeUnmount } from 'vue';
import { useLoop, useTres } from '@tresjs/core';
import { createPhotoCity } from '@/scene/belfast/photo-city';
import { cloudShadowUniforms, createDaySkyMaterial } from '@/scene/belfast/photo-materials';
import { createWater, SkyUniforms } from '@/scene/belfast/water';
import { createStarlings } from '@/scene/belfast/starlings';
import { createTrain } from '@/scene/belfast/train';
import { createTelescope } from '@/scene/belfast/telescope';
import { createPlane } from '@/scene/belfast/plane';
import { createFerry, createRiverBoat } from '@/scene/belfast/boats';
import { createTraffic } from '@/scene/belfast/traffic';
import { createOfficeHighlights } from '@/scene/belfast/offices';
import { attribution } from '@/scene/belfast/attribution';
import { sceneState } from '@/scene/state';
import { isInBelfast } from '@/scene/choreography';
import { cityDestination, cityState, firstShot, route } from '@/scene/director';
import { poseOf, shots, type ShotName } from '@/scene/shots';
import { camera } from '@/scene/camera';

const emit = defineEmits<{
  /** The tiles can't load, so the city should be dropped. */
  failed: [];
}>();

/**
 * Belfast by day, from Google's photorealistic 3D tiles. Mounted once the planet is up, so where the glide from
 * orbit comes out of the clouds loads in the background while the reader is still on the planet, then the rest
 * (see photo-city.ts).
 */
const renderer = useTres().renderer as WebGLRenderer;

const root = new Group();
root.visible = false;

const skyMaterial = createDaySkyMaterial();
const sky = new Mesh(new SphereGeometry(800, 32, 16), skyMaterial);
sky.renderOrder = -1;
sky.frustumCulled = false;

const telescope = createTelescope(renderer);
const photoCity = createPhotoCity(renderer, process.env.VUE_APP_GOOGLE_MAPS_API_KEY ?? '', error => {
  console.warn('Belfast tiles failed to load', error);
  emit('failed');
}, telescope);
// Shares the sky's uniforms, so its reflections match the sky
const water = createWater(skyMaterial.uniforms as SkyUniforms, renderer.capabilities.getMaxAnisotropy());
const starlings = createStarlings();
const train = createTrain(skyMaterial.uniforms.uSun);
const plane = createPlane(skyMaterial.uniforms.uSun);
const ferry = createFerry(skyMaterial.uniforms.uSun);
const riverBoat = createRiverBoat(skyMaterial.uniforms.uSun);
const traffic = createTraffic(skyMaterial.uniforms.uSun);
const offices = createOfficeHighlights();
root.add(sky, photoCity.group, water.mesh, starlings.object, train.object, plane.object, ferry.object,
  riverBoat.object, traffic.object, offices.object, telescope.overlay);

/** Visited in the background once it's shown, in about the order a reader would go. */
const PREFETCH = (['hello', 'craft', 'overview', 'coleraine', 'liberty', 'flexera', 'locum', 'ankorstore', 'ocula', 'docks', 'arena', 'lagan'] as ShotName[])
  .map(name => poseOf(shots[name], 0, 0));

/** Seconds between the plane's take-offs, and the tour boat's trips down the Lagan. */
const PLANE_EVERY = 90;
const BOAT_EVERY = 110;
/** How long the city's been shown (s), for the ferry coming in. */
let shownFor = 0;

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
  plane.dispose();
  ferry.dispose();
  riverBoat.dispose();
  traffic.dispose();
  offices.dispose();
  sky.geometry.dispose();
  skyMaterial.dispose();
  showAttribution(false);
  sceneState.cityReady = false;
});

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta, elapsed }) => {
  const isFlying = isInBelfast(sceneState.progress);
  const destination = cityDestination();
  const { scope } = cityState;
  // The telescope's views load while it's up (both while it whips from one to the other)
  const stop = route.mode === 'experience' ? route.stop : null;
  const sights = stop === 'coleraine' || stop === 'antrim' ? [...new Set([stop, scope.sight])] : [];
  photoCity.update(camera as PerspectiveCamera, isFlying, delta, {
    ahead: photoCity.isReady ? (destination ? [destination] : []) : [poseOf(firstShot(), 0, performance.now() / 1000)],
    prefetch: PREFETCH,
    isMoving: !!destination,
    activeViews: telescope.camerasFor(sights),
  });
  sceneState.cityReady = photoCity.isReady;

  const isActive = isFlying && photoCity.isReady;
  root.visible = isActive;
  showAttribution(isActive);
  if (!isActive) return;
  shownFor += delta;
  sky.position.copy(camera.position);
  cloudShadowUniforms.uCloudTime.value = elapsed;
  water.update(elapsed);
  starlings.update(elapsed, camera as PerspectiveCamera, renderer);
  train.update(cityState.trainAway);
  plane.update(elapsed % PLANE_EVERY);
  ferry.update(shownFor);
  riverBoat.update((elapsed + 40) % BOAT_EVERY);
  traffic.update(elapsed, camera as PerspectiveCamera, renderer, photoCity.group);
  offices.update(cityState.offices, elapsed, true);
  // The offices' outlines too, for Nitec's through the telescope
  telescope.update(scope, elapsed, (camera as PerspectiveCamera).aspect, sky, [photoCity.group, offices.object]);
});
</script>
