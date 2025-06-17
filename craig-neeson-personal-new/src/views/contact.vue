<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'Contact'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>

const props = defineProps<{
}>();

</script>

<template>
    <div class="contact">Contact</div>
</template>

<style scoped>

</style>
