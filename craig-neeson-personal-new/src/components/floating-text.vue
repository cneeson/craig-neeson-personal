<script lang="ts">
import { defineComponent } from 'vue';
import Letters from '@/animations/letters.vue';

export default defineComponent({
    name: 'FloatingText'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import { toRef, watch, ref, nextTick, computed } from 'vue';
import { createTimeline, stagger } from 'animejs';

const props = defineProps<{
    text: string;
}>();

const text = toRef(props, 'text');

const timeline = ref();

watch(text, async (newText) => {
    if (newText) {
        await nextTick()
        
        timeline.value = createTimeline({ autoplay: true })
            .add('[data-animate="floating-text"]', {
                y: {
                    from: '1.8rem',
                    duration: 100,
                    to: 0
                },
                easing: 'easeIn',
                opacity: [
                    { from: 0, to: 1, duration: 50, delay: stagger(15) }
                ],
                filter: [
                    { from: 'blur(12px)', delay: stagger(15) }
                ],
            });
    }
}, { immediate: true })

const lines = computed(() => {
    return text.value.split('\n');
});

</script>

<template>
    <!-- <Transition> -->
        <section class="floating-text">
            <div>
                <Letters
                    v-for="line in lines"
                    :key="line"
                    is="h1"
                    class="letters" 
                    animate-key="floating-text"
                    :str="line"
                />
            </div>
        </section>
    <!-- </Transition> -->
</template>

<style scoped>
.floating-text {
    @apply p-2 flex justify-start items-center;

    .letters{
        @apply text-slate-50 text-3xl mb-2;
    }
}
/* 
.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
  filter: blur(0);
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  filter: blur(12px);
} */
</style>
