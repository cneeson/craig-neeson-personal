<template>
  <primitive :object="root" />
</template>

<script lang="ts" setup>
import { BufferGeometry, Group, Mesh, PerspectiveCamera, ShaderMaterial, SphereGeometry, WebGLRenderer } from 'three';
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
import { placeCamera, poseOf, shots, type ShotName } from '@/scene/shots';
import { camera } from '@/scene/camera';
import { warmShaders } from '@/scene/warm';

const emit = defineEmits<{
  /** The tiles can't load, so the city should be dropped. */
  failed: [];
}>();

/**
 * Belfast by day, from Google's photorealistic 3D tiles. Mounted once the planet is up, so where the glide from
 * orbit comes out of the clouds loads in the background while the reader is still on the planet, then the rest
 * (see photo-city.ts).
 */
const { scene } = useTres();
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
  keepers.forEach(keeper => (keeper.material as ShaderMaterial).dispose());
  sky.geometry.dispose();
  skyMaterial.dispose();
  showAttribution(false);
  sceneState.cityReady = false;
});

/** Moves everything in the city on to `elapsed` (s), as seen from `view`. */
const animate = (view: PerspectiveCamera, elapsed: number) => {
  sky.position.copy(view.position);
  cloudShadowUniforms.uCloudTime.value = elapsed;
  water.update(elapsed);
  starlings.update(elapsed, view, renderer);
  train.update(cityState.trainAway);
  plane.update(elapsed % PLANE_EVERY);
  ferry.update(shownFor);
  riverBoat.update((elapsed + 40) % BOAT_EVERY);
  traffic.update(elapsed, view, renderer, photoCity.group);
  offices.update(cityState.offices, elapsed, true);
  // The offices' outlines too, for Nitec's through the telescope
  telescope.update(cityState.scope, elapsed, view.aspect, sky, [photoCity.group, offices.object]);
};

/**
 * The tile shader (fading between levels of detail, and not) is let go whenever the last tile using it is unloaded,
 * and compiled again for the next tile drawn, stalling that frame, as tiles come and go all the time. Two materials
 * kept aside, never drawn, hold on to it.
 */
const keepTileShaders = () => {
  let tile: Mesh | undefined;
  photoCity.group.traverse(child => {
    const material = (child as Mesh).material as ShaderMaterial | undefined;
    if (!tile && material?.defines && 'FEATURE_FADE' in material.defines) tile = child as Mesh;
  });
  if (!tile) return [];
  const original = tile.material as ShaderMaterial;
  return [0, 1].map(fade => {
    const material = new ShaderMaterial().copy(original);
    Object.assign(material, {
      // Not the tile's photo, which goes when it does
      uniforms: { ...original.uniforms, map: { value: null } },
      defines: { ...original.defines, FEATURE_FADE: fade },
      onBeforeCompile: original.onBeforeCompile,
      customProgramCacheKey: original.customProgramCacheKey,
    });
    const keeper = new Mesh((tile as Mesh).geometry, material);
    keeper.visible = false;
    root.add(keeper);
    return keeper;
  });
};
let keepers: Mesh[] = [];

/**
 * Gets the city's shaders ready as soon as the tiles at the first shot have loaded (see warmShaders), so they aren't
 * compiled on the frame it's first shown, under the clouds on the way in. Without the planet, and its lights, as it's
 * hidden in the city. The tiles are drawn as they are, rather than all of them.
 */
let isWarm = false;
const warmUp = (elapsed: number) => {
  isWarm = true;
  keepers = keepTileShaders();
  const view = new PerspectiveCamera(camera.fov, camera.aspect, 0.3, 4000);
  placeCamera(view, poseOf(firstShot(), 0, performance.now() / 1000), camera.aspect);
  view.updateMatrixWorld();
  // Its first move draws the heights under the traffic, getting that shader ready too
  animate(view, elapsed);
  const planet = scene.value.children.filter(child => child !== root && child.getObjectByProperty('isLight', true));
  warmShaders(renderer, scene.value, view, { object: root, skip: photoCity.group, hide: planet })
    .catch(() => undefined)
    // Only needed a tile's vertices to draw them
    .then(() => keepers.forEach(keeper => (keeper.geometry = new BufferGeometry())));
};

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
  if (photoCity.isReady && !isWarm && !isActive) warmUp(elapsed);
  root.visible = isActive;
  showAttribution(isActive);
  if (!isActive) return;
  shownFor += delta;
  animate(camera as PerspectiveCamera, elapsed);
});
</script>
