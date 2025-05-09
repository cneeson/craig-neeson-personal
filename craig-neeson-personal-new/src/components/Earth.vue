<template>
  <TresMesh ref="earthRef" receive-shadow>
    <TresSphereGeometry :args="[1, 32, 32]" />
    <TresMeshStandardMaterial
      :map="earthTexture.map"
    />
  </TresMesh>
</template>

<script lang="ts">
import { useLoop, useTexture } from '@tresjs/core';
import { defineComponent, ref, useTemplateRef, defineExpose } from 'vue';

export default defineComponent({
  name: 'Earth',
});
</script>

<script lang="ts" setup>
// defineProps<{
//     stage: string,
// }>();

const earthTexture = await useTexture({
  map: '/textures/earth/diffuse_map.jpg',
})

const earthRef = ref();

defineExpose({
  ref: earthRef
});

// const { onBeforeRender } = useLoop()

// onBeforeRender(({ elapsed }) => {
//   if (earthRef.value) {
//     earthRef.value.rotation.y += elapsed * 0.00005
//     earthRef.value.rotation.z = elapsed * 0.00005
//     earthRef.value.rotation.x = elapsed * 0.00005
//   }
// })

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.stage-selector {

  p {
    @apply text-slate-50;

    z-index: 1;
  }

  button {
    @apply bg-purple-200 p-3;
    z-index: 1;
  }

  .prev {
    @apply absolute left-5 bottom-5;
  }

  .right {
    @apply absolute right-5 bottom-5 items-center;
  }
}
</style>
