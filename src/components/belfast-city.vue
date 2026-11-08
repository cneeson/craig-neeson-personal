<template>
  <primitive :object="root" />
</template>

<script lang="ts" setup>
import {
  BufferAttribute, BufferGeometry, CanvasTexture, Group, LinearMipmapLinearFilter, Mesh, NoColorSpace,
  PerspectiveCamera, PlaneGeometry, Points, SphereGeometry, SRGBColorSpace, Texture, TextureLoader,
  Vector3, WebGLRenderTarget,
} from 'three';
import { onBeforeUnmount } from 'vue';
import { useRenderLoop, useTresContext } from '@tresjs/core';
import type { CityData, CityRequest } from '@/scene/belfast/city.worker';
import { bounds } from '@/scene/belfast/geo';
import { drawRoads } from '@/scene/belfast/roads';
import { createLandmarks } from '@/scene/belfast/landmarks';
import {
  cityUniforms, createBuildingMaterial, createGroundMaterial, createLampMaterial, createSkyMaterial,
  createTrafficMaterial,
} from '@/scene/belfast/materials';
import { flightAt } from '@/scene/belfast/flight';
import { isMobile } from '@/services/device';
import { sceneState } from '@/scene/state';
import { isInBelfast } from '@/scene/choreography';
import { camera } from '@/scene/camera';

/**
 * Belfast at night, for the flythrough. Mounted once the planet is up, so it loads in the
 * background while the reader is still on the opening beats: the data is decoded and the
 * buildings extruded in a worker, then everything is drawn once off screen so the first real
 * frame over the city doesn't stall on shader compiles and GPU uploads.
 */
const { renderer, invalidate } = useTresContext();
let isUnmounted = false;

const root = new Group();
root.visible = false;

const sky = new Mesh(new SphereGeometry(800, 32, 16), createSkyMaterial());
sky.renderOrder = -1;
sky.frustumCulled = false;
root.add(sky, createLandmarks());

const disposables: { dispose(): void }[] = [];
let worker: Worker | undefined;

const base = `${process.env.BASE_URL}belfast/`;

const loadCity = () => new Promise<CityData>((resolve, reject) => {
  worker = new Worker(new URL('../scene/belfast/city.worker.ts', import.meta.url));
  worker.onmessage = (event: MessageEvent<CityData>) => resolve(event.data);
  worker.onerror = reject;
  const request: CityRequest = { url: new URL(`${base}city.bin`, location.href).href, roadTextureSize: isMobile ? 2048 : 4096 };
  worker.postMessage(request);
});

const roadTexture = (data: CityData) => {
  let texture: Texture;
  if (data.roadImage) {
    texture = new Texture(data.roadImage);
  } else {
    const size = isMobile ? 2048 : 4096;
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [size, size];
    drawRoads(canvas.getContext('2d') as CanvasRenderingContext2D, data.roads, size);
    texture = new CanvasTexture(canvas);
  }
  // Both textures are laid out with the north edge in the first row
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = renderer.value.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
};

const build = (data: CityData, mask: Texture) => {
  const buildings = new BufferGeometry();
  buildings.setAttribute('position', new BufferAttribute(data.positions, 3));
  buildings.setAttribute('info', new BufferAttribute(data.info, 2));
  buildings.setIndex(new BufferAttribute(data.index, 1));
  buildings.computeBoundingSphere();

  const [width, depth] = [bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ];
  // Wider than the data, so the ground carries on into the haze
  const groundGeometry = new PlaneGeometry(width * 3, depth * 3).rotateX(-Math.PI / 2)
    .translate(bounds.minX + width / 2, 0, bounds.minZ + depth / 2);
  const roads = roadTexture(data);

  const lamps = new BufferGeometry();
  lamps.setAttribute('position', new BufferAttribute(data.lamps, 3));
  lamps.computeBoundingSphere();

  const cars = new BufferGeometry();
  const carCount = data.carMotion.length / 3;
  // Positions are worked out in the shader; this only sets the draw count
  cars.setAttribute('position', new BufferAttribute(new Float32Array(carCount * 3), 3));
  cars.setAttribute('segment', new BufferAttribute(data.carSegments, 4));
  cars.setAttribute('motion', new BufferAttribute(data.carMotion, 3));

  const meshes = [
    new Mesh(groundGeometry, createGroundMaterial(roads, mask)),
    new Mesh(buildings, createBuildingMaterial()),
    new Points(lamps, createLampMaterial()),
    new Points(cars, createTrafficMaterial()),
  ];
  meshes[3].frustumCulled = false;
  meshes.forEach(mesh => {
    root.add(mesh);
    disposables.push(mesh.geometry, mesh.material as { dispose(): void });
  });
  disposables.push(roads, mask);
};

/** Draws the city once into a tiny target from the start of the flight, compiling and uploading everything. */
const warmUp = () => {
  const view = new PerspectiveCamera(50, 1, 0.3, 1000);
  const target = new Vector3();
  flightAt(0.2, view.position, target);
  view.lookAt(target);
  const renderTarget = new WebGLRenderTarget(16, 16);
  const previous = renderer.value.getRenderTarget();
  root.visible = true;
  renderer.value.setRenderTarget(renderTarget);
  renderer.value.render(root, view);
  renderer.value.setRenderTarget(previous);
  root.visible = false;
  renderTarget.dispose();
};

(async () => {
  try {
    const [data, mask] = await Promise.all([
      loadCity(),
      new TextureLoader().loadAsync(`${base}ground.png`),
    ]);
    mask.flipY = false;
    mask.colorSpace = NoColorSpace;
    mask.needsUpdate = true;
    if (isUnmounted) return;
    build(data, mask);
    warmUp();
    sceneState.cityReady = true;
    invalidate();
  } catch (error) {
    // The clouds stay over the city if it can't load
    console.error('Belfast failed to load', error);
  } finally {
    worker?.terminate();
  }
})();

onBeforeUnmount(() => {
  isUnmounted = true;
  worker?.terminate();
  disposables.forEach(item => item.dispose());
  sceneState.cityReady = false;
});

const { onLoop } = useRenderLoop();
onLoop(({ elapsed }) => {
  const isActive = sceneState.cityReady && isInBelfast(sceneState.progress);
  root.visible = isActive;
  if (!isActive) return;
  cityUniforms.uTime.value = elapsed;
  cityUniforms.uPointScale.value = renderer.value.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  sky.position.copy(camera.position);
});
</script>
