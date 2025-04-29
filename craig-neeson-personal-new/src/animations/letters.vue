<script lang="ts">
import { defineComponent, defineProps } from 'vue';

export default defineComponent({
    name: 'Letters'
});
</script>
<script lang="ts" setup>
defineProps<{
    str: string,
    animateKey: string,
}>();
</script>

<template>
    <div class="flex justify-center">
        <div v-for="letter in Array.from(str)" :data-animate="animateKey" :key="letter" class="opacity-0">
            {{ letter === ' ' ? '&nbsp;' : letter }}
        </div>
    </div>
</template>