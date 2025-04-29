<script lang="ts">
import { defineComponent } from 'vue';
import Letters from '@/animations/letters.vue';

export default defineComponent({
    name: 'Hero'
});
</script>
<script lang="ts" setup>
import { onMounted } from 'vue';
import { createTimeline, stagger } from 'animejs';

onMounted(() => {
    createTimeline()
        .add('[data-animate="title"]', {
            y: {
                from: '1.8rem',
                duration: 800
            },
            easing: 'easeIn',
            opacity: [
                { from: 0, to: 1, duration: 400, delay: stagger(100) }
            ],
            filter: [
                { from: 'blur(12px)', delay: stagger(100) }
            ],
        })
        .add('[data-animate="title-break"]', {
            easing: 'easeOutQuint',
            duration: 2500,
            opacity: [
                { from: 0, to: 1, duration: 1000 }
            ],
            width: {
                from: '0%',
                to: '90%',
            },
        }, 600)
        .add('[data-animate="subtitle"]', {
            easing: 'easeIn',
            duration: 1000,
            delay: stagger(400),
            opacity: [
                { from: 0, to: 1 }
            ],
            filter: [
                { from: 'blur(20px)'}
            ]
        }, 900);
});
</script>

<template>
    <section class="hero">
        <div>
            <Letters 
                is="h1"
                class="text-slate-50 text-6xl pb-6 mx-7" 
                animate-key="title" 
                str="Craig Neeson"  
            />
            <hr class="border-b border-solid border-slate-600 opacity-0 mx-auto" data-animate="title-break">
            <h2 class="text-slate-300 text-5xl mt-5 flex gap-2">
                <span class="opacity-0" data-animate="subtitle">Senior</span>
                <span class="opacity-0" data-animate="subtitle">Frontend</span>
                <span class="opacity-0" data-animate="subtitle">Developer</span>
            </h2>
        </div>
    </section>
</template>

<style scoped>
.hero {
    z-index: 1;
    @apply text-center p-2 flex justify-center items-center;
}
</style>
