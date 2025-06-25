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

// TODO uncomment
// onMounted(() => {
//     timeline.value = createTimeline({ autoplay: false })
//         .set('[data-animate="container"]', {
//             opacity: [
//                 { from: 0, to: 1 }
//             ],
//             filter: [
//                 { to: 'blur(0)' }
//             ],
//         })
//         .add('[data-animate="title"]', {
//             y: {
//                 from: '1.8rem',
//                 duration: 800,
//                 to: 0
//             },
//             easing: 'easeIn',
//             opacity: [
//                 { from: 0, to: 1, duration: 400, delay: stagger(100) }
//             ],
//             filter: [
//                 { from: 'blur(12px)', delay: stagger(100) }
//             ],
//         })
//         .add('[data-animate="title-break"]', {
//             easing: 'easeOutQuint',
//             duration: 2500,
//             opacity: [
//                 { from: 0, to: 1, duration: 1000 }
//             ],
//             width: {
//                 from: '0%',
//                 to: '90%',
//             },
//         }, 600)
//         .add('[data-animate="subtitle"]', {
//             easing: 'easeIn',
//             duration: 1000,
//             delay: stagger(400),
//             opacity: [
//                 { from: 0, to: 1 }
//             ],
//             filter: [
//                 { from: 'blur(20px)'}
//             ]
//         }, 900);

//     setTimeout(() => {
//         timeline.value.play()
//     }, 1000)
// });

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
        </section>
    </Transition>
</template>

<style scoped>
.hero {
    @apply text-center p-2 flex justify-center items-center h-[100vh];
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
