<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'

const { scene } = await useGLTF(`${process.env.BASE_URL}models/map_pin/scene.gltf`, { draco: true })

</script>

<template>
  <primitive :object="scene" />
</template>