<template>
  <TresGroup :position="position">
    <TresPointLight
        ref="lightRef"
        :position="[0, .02, 0]"
        color="white"
        :intensity="0"
        :decay="3"
    />
    <Billboard :position="[0, .015, 0]">
      <Suspense>
        <Text3D
          :text="label"
          :font="fontPath"
          :size="0.006"
          :height="0.0025"
          :bevel-enabled="false"
          :emissive="false"
        >
          <TresMeshBasicMaterial :opacity="0" :transparent="true" ref="textRef"  />
        </Text3D>
      </Suspense>
    </Billboard>
    <GLTFModel :path="modelPath" :scale="0.003" :position="[0, .001, 0]" draco ref="modelRef" />
  </TresGroup>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'CityMarker',
});
</script>

<script lang="ts" setup>
import { GLTFModel, Billboard, Text3D } from '@tresjs/cientos'

const modelPath = `${process.env.BASE_URL}models/map_pin/scene.gltf`
const fontPath = `${process.env.BASE_URL}fonts/Funnel_Display.json`

defineProps<{
  position: [number, number, number];
  label: string;
}>();

const lightRef = ref(undefined);
const modelRef = ref(undefined);
const textRef = ref(undefined);

const show = () => {
  modelRef.value.instance.position.x = 0.001;
};
const hide = () => {
  modelRef.value.instance.position.x = 999;
};

defineExpose({
  lightRef,
  modelRef,
  textRef,
  show,
  hide,
});
</script>
