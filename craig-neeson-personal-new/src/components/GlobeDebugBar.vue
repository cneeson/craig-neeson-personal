<template>
    <div class="absolute right-[160px] bottom-5 flex gap-3">
        <button
            @click="logCoords" 
            class="bg-green-200 p-3 z-10"
        >
            Log Coords
        </button>
        <button
            @click="resetRoll" 
            class="bg-green-200 p-3 z-10"
        >
            Reset Roll
        </button>
    </div>
  </template>
  
  <script lang="ts">
  import { Viewer, Math } from 'cesium';
import { defineComponent, toRef } from 'vue';
  
  export default defineComponent({
    name: 'GlobeDebugBar',
  });
  </script>

  <script lang="ts" setup>
const props = defineProps<{
    viewer: Viewer | null;
}>();

const viewer = toRef(props, 'viewer');

const logCoords = () => {
    if (!viewer.value) return;

    const camera = viewer.value.scene.camera;
    const position = camera.positionCartographic;
    const lng = Math.toDegrees(position.longitude);
    const lat = Math.toDegrees(position.latitude);
    const altitude = position.height;

    console.log({
        lat,
        lng,
        altitude,
        tilt: camera.pitch,
        heading: camera.heading,
        roll: camera.roll,
    });
};

const resetRoll = () => {
    if (!viewer.value) return;

    const camera = viewer.value.scene.camera;
    const heading = camera.heading;
    const pitch = camera.pitch;
    const roll = 0; // Reset roll to 0

    camera.setView({
        orientation: {
            heading,
            pitch,
            roll,
        },
    });
};
</script>
  
  <!-- Add "scoped" attribute to limit CSS to this component only -->
  <style scoped>

  </style>
  