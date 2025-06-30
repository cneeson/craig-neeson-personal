<script lang="ts">
import { defineComponent } from 'vue';
import Letters from '@/animations/letters.vue';

export default defineComponent({
    name: 'Hero'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import { onMounted, toRefs, ref } from 'vue';
import { createTimeline, stagger } from 'animejs';

const props = defineProps<{
    isVisible: boolean;
}>();

const {isVisible} = toRefs(props);

const timeline = ref();

onMounted(() => {
    timeline.value = createTimeline({ autoplay: false })
        .add('[data-animate="title"]', {
            y: {
                from: '1.8rem',
                duration: 800,
                to: 0
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
        }, 900)
        .add('[data-animate="scroll-indicator"]', {
            y: {
                from: '1.8rem',
                duration: 800,
                to: 0
            },
            easing: 'easeIn',
            opacity: [
                { from: 0, to: 1, duration: 400, delay: stagger(100) }
            ],
            filter: [
                { from: 'blur(12px)', delay: stagger(100) }
            ],
        }, 2000)
        .add('[data-animate="scroll-indicator"] p', {
            keyframes: {
                '0%'  : { rotate: 0, scale: 1 },
                '25%'  : { rotate: 5, scale: 1.2 },
                '50%' : { rotate: 0, scale: 1 },
                '75%'  : { rotate: -5, scale: 1.2 },
                '100%': { rotate: 0, scale: 1 },
            },
            duration: 750,
            loop: true,
            loopDelay: 2000
        });

    setTimeout(() => {
        timeline.value.play()
    }, 1000)
});

</script>

<template>
    <Transition>
        <section class="hero" v-show="isVisible" data-speed="0.5">
            <div class="hero-content">
                <Letters 
                    is="h1"
                    class="text-slate-50 pb-6 mx-7 font-extrabold title" 
                    animate-key="title"
                    str="Craig Neeson"
                />
                <hr class="border-b border-solid border-slate-600 opacity-0 mx-auto" data-animate="title-break">
                <h2 class="text-slate-300 text-5xl mt-5 flex justify-center gap-2 subtitle">
                    <span class="opacity-0" data-animate="subtitle">Senior</span>
                    <span class="opacity-0" data-animate="subtitle">Frontend</span>
                    <span class="opacity-0" data-animate="subtitle">Developer</span>
                </h2>
            </div>
            <div class="scroll-indicator hero-content opacity-0" data-animate="scroll-indicator">
                <p>
                    Scroll
                </p>
                <img src="images/arrow-down.svg" alt="arrow-down" />
            </div>
        </section>
    </Transition>
</template>

<style scoped>
.hero {
    @apply text-center p-2 flex justify-center items-center h-[100vh] relative;
}

.scroll-indicator {
    @apply absolute bottom-6 left-0 right-0 flex flex-col gap-3 justify-center items-center text-white font-bold text-2xl;
}

.scroll-indicator img {
    @apply w-8 h-8;
}

.title {
    @apply text-4xl md:text-5xl lg:text-6xl;
}

.subtitle {
    @apply text-2xl md:text-3xl lg:text-4xl;
}

.letters {
    font-weight: 600;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
  filter: blur(0);
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  filter: blur(12px);
}
</style>
