<script lang="ts">

import coordinates from '@/services/coordinates';
import { totalTransitionDuration } from '@/views/hero.vue';
import { defineComponent, onMounted, ref, toRef, watch } from 'vue';

export default defineComponent({
    name: 'GlobeGoogle'
});

export enum MapStatus {
    LOADING = 'loading',
    READY = 'ready',
    BELFAST_FLYTHROUGH = 'belfast_flythrough',
}
</script>
<script lang="ts" setup>

const props = defineProps<{
    status: MapStatus,
}>();

const status = toRef(props, 'status');

const MAP_ID = 'google-map';

const emit = defineEmits(['ready', 'arrived-in-belfast']);

const map = ref<any>(undefined);

onMounted(async () => {
    const { Map3DElement, MapMode, Model3DElement } = await google.maps.importLibrary("maps3d");

    const highOrbit = { ...coordinates.orbit, altitude: 1500000 };

    map.value = new Map3DElement({
        center: highOrbit,
        range: 500000, 
        tilt: 75,
        mode: MapMode.SATELLITE,
    });

    const model = new Model3DElement({
        src: '/cloud.glb',
        position: { lat: 54.59590431592686, lng: -5.9349654492234025, altitude: 100 },
        orientation: { heading: 0, tilt: 270, roll: 90 },
        scale: .15,
        altitudeMode: "CLAMP_TO_GROUND",
    });

    map.value.addEventListener('gmp-steadychange', (e: any) => {
        setTimeout(() => {
            emit('ready');
            status.value = MapStatus.READY;
            map.value.removeEventListener('gmp-steadychange');
        }, 1000);
    }, { once: true });

    document.getElementById(MAP_ID)?.appendChild(map.value); 
    map.value.append(model);
});

const setCameraToOrbit = () => {
    if (!map.value) return;

    const lowOrbit = {
        center: { ...coordinates.orbit, altitude: 1500000 },
        range: 500000, 
        tilt: 60, 
    };

    map.value.flyCameraTo({
        endCamera: lowOrbit,
        durationMillis: 6000,
    });

    map.value.addEventListener('gmp-animationend', () => {
        map.value.flyCameraAround({
            camera: lowOrbit,
            durationMillis: 100000,
            rounds: 1
        });
    }, { once: true });
};

const startBelfastFlythrough = () => {
    if (!map.value) return;

    const belfastStart = {
        center: { ...coordinates.belfast.start, altitude: 25 },
        tilt: 81.07918407868647, 
        range: 4121.80785132805,
        heading: -57.278971168940515,
        roll: 9.897000384123345e-10
    };

    const belfastEnd = {
        center: { ...coordinates.belfast.end, altitude: 50 },
        tilt: 70, 
        range: 319.47618209356733,
        heading: 70.44261012228799,
    };

    map.value.flyCameraTo({
        endCamera: belfastStart,
        durationMillis: 10000,
    });

    map.value.addEventListener('gmp-animationend', () => {
        emit('arrived-in-belfast');
    }, { once: true });
};

const removeEvents = () => {
    map.value.stopCameraAnimation();
    map.value.removeEventListener('gmp-steadychange');
    map.value.removeEventListener('gmp-animationend');
    map.value.stopCameraAnimation();
};

watch(status, () => {
    removeEvents();

    switch (status.value) {
        case MapStatus.READY:
            setTimeout(() => {
                setCameraToOrbit();
            }, totalTransitionDuration);
            break;
        case MapStatus.BELFAST_FLYTHROUGH:
            startBelfastFlythrough();
            break;
    }
});


</script>

<template>
    <div 
        :id="MAP_ID" 
        class="map-container"
        :class="{
            'map-container--belfast-flythrough': status === MapStatus.BELFAST_FLYTHROUGH,
        }"
    />
</template>

<style>
.map-container {
    mix-blend-mode: difference;

    gmp-map-3d {
        display: block;
        height: 100vh;
        width: 100vw;
        filter: saturate(1.2);
        opacity: 1;
        animation-name: fadeInOpacity;
        animation-iteration-count: 1;
        animation-timing-function: ease-in;
        animation-duration: 2s;
    }
}

@keyframes fadeInOpacity {
	0% {
		opacity: 0;
	}
	100% {
		opacity: 1;
	}
}
</style>
