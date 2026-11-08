<template>
  <TresGroup ref="groupRef" :position="position" :visible="false">
    <TresSprite ref="glowRef" :position="[0, 0.004, 0]" :scale="[0.03, 0.03, 1]">
      <TresSpriteMaterial
        :map="glowTexture"
        :transparent="true"
        :opacity="0"
        :depth-write="false"
        :blending="AdditiveBlending"
      />
    </TresSprite>
    <TresSprite ref="pingRef" :position="[0, 0.004, 0]" :scale="[0.012, 0.012, 1]">
      <TresSpriteMaterial
        :map="pingTexture"
        :transparent="true"
        :opacity="0"
        :depth-write="false"
        :blending="AdditiveBlending"
      />
    </TresSprite>
    <Billboard :position="[0, 0.015, 0]">
      <Suspense>
        <Text3D
          :text="label"
          :font="fontPath"
          :size="0.006"
          :height="0.0025"
          :bevel-enabled="false"
          center
        >
          <TresMeshBasicMaterial ref="textMaterialRef" :opacity="0" :transparent="true" :depth-write="false" />
        </Text3D>
      </Suspense>
    </Billboard>
    <TresGroup ref="pinRef" :scale="0.0001">
      <primitive :object="pin" :scale="0.003" :position="[0, 0.001, 0]" />
    </TresGroup>
  </TresGroup>
</template>

<script lang="ts">
import { defineComponent, shallowRef } from 'vue';
import { AdditiveBlending, CanvasTexture, Group, MeshBasicMaterial, Sprite, SpriteMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Billboard, Text3D } from '@tresjs/cientos'

const modelPath = `${process.env.BASE_URL}models/map_pin/scene.gltf`
const fontPath = `${process.env.BASE_URL}fonts/Funnel_Display.json`

// One soft radial gradient shared by every marker's halo
const createGlowTexture = () => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.25, 'rgba(190, 220, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(190, 220, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
};
const glowTexture = createGlowTexture();

// A thin soft-edged ring for the "you are here" ping
const createPingTexture = () => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.78, 'rgba(190, 220, 255, 0)');
  gradient.addColorStop(0.9, 'rgba(190, 220, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(190, 220, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
};
const pingTexture = createPingTexture();

const PING_PERIOD = 2.4;

// Load the pin once and clone it per marker (an Object3D can only have one parent)
let pinModel: Promise<Group> | undefined;
const loadPin = () => (pinModel ??= new GLTFLoader().loadAsync(modelPath).then(gltf => gltf.scene));

export default defineComponent({
  name: 'CityMarker',
});
</script>

<script lang="ts" setup>
defineProps<{
  position: [number, number, number];
  label: string;
}>();

const groupRef = shallowRef<Group>();
const glowRef = shallowRef<Sprite>();
const pingRef = shallowRef<Sprite>();
// Markers shown together ping out of step with each other
const pingOffset = Math.random() * PING_PERIOD;
const pinRef = shallowRef<Group>();
const textMaterialRef = shallowRef<MeshBasicMaterial>();

/**
 * Drives the whole marker from a single 0 → 1 value (called from the render loop, with the
 * scene's elapsed time for the ping).
 */
const setOpacity = (opacity: number, glow = 1, elapsed = 0) => {
  if (!groupRef.value) return;

  groupRef.value.visible = opacity > 0.001;
  if (!groupRef.value.visible) return;

  if (textMaterialRef.value) textMaterialRef.value.opacity = opacity;
  if (glowRef.value) (glowRef.value.material as SpriteMaterial).opacity = opacity * glow;
  if (pingRef.value) {
    // Expands and fades out, easing off as it goes
    const phase = ((elapsed + pingOffset) % PING_PERIOD) / PING_PERIOD;
    const spread = 1 - (1 - phase) ** 3;
    pingRef.value.scale.set(0.012 + spread * 0.04, 0.012 + spread * 0.04, 1);
    (pingRef.value.material as SpriteMaterial).opacity = opacity * glow * (1 - phase) ** 2 * 0.5;
  }
  // Pins "pop" in (ease-out-back) rather than fading, as the GLTF materials are opaque
  const t = opacity - 1;
  pinRef.value?.scale.setScalar(Math.max(0.0001, 1 + 2.7 * t * t * t + 1.7 * t * t));
};

// Exposed before the await below, otherwise the parent's ref has no setOpacity until the pin loads
defineExpose({ setOpacity });

const pin = (await loadPin()).clone();
</script>
