<script lang="ts">
import { defineComponent } from 'vue';
import Letters from '@/animations/letters.vue';

export default defineComponent({
    name: 'BelfastFlythroughIntro'
});

</script>
<script lang="ts" setup>
import { onMounted } from 'vue';
import { createTimeline, stagger } from 'animejs';

onMounted(() => {
    setTimeout(() => {
        createTimeline()
        .add('[data-animate="intro"]', {
            y: {
                from: '1.8rem',
                duration: 300
            },
            easing: 'easeIn',
            opacity: [
                { from: 0, to: 1, duration: 50, delay: stagger(50) }
            ],
            filter: [
                { from: 'blur(2px)', delay: stagger(50) }
            ],
        })
        .add('[data-animate="belfast"]', {
            y: {
                from: '1.8rem',
                duration: 600
            },
            easing: 'easeIn',
            opacity: [
                { from: 0, to: 1, duration: 200 }
            ],
        }, 2000)
        .add('[data-animate="northernIreland"]', {
            y: {
                from: '1.8rem',
                duration: 600
            },
            easing: 'easeIn',
            opacity: [
                { from: 0, to: 1, duration: 50, delay: stagger(50) }
            ],
            filter: [
                { from: 'blur(2px)', delay: stagger(50) }
            ],
        }, 3000)
    }, 1000)
});
</script>

<template>
    <section class="text">
        <Letters 
            is="h1"
            class="normal-text" 
            animate-key="intro" 
            str="I am a software developer based in"
        />
        <Letters 
            is="h1"
            class="belfast" 
            animate-key="belfast" 
            str="Belfast"
        />
        <Letters 
            is="h1"
            class="normal-text " 
            animate-key="northernIreland" 
            str="Northern Ireland"
        />
    </section>
</template>

<style scoped>
.text {
    z-index: 1;
    @apply absolute flex gap-2 items-center;
    top: 12%;
    left: 50%;
    transform: translate(-50%, -50%);

}

.normal-text {
    @apply text-4xl font-extrabold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent;
}

.belfast {
    @apply text-6xl font-extrabold;

    text-shadow: 0 0 60px rgba(0, 0, 0, 0.2);
    -webkit-text-fill-color: transparent;
	-webkit-text-stroke: 1px hsla(0, 0%, 100%, 0.7);
}
</style>
