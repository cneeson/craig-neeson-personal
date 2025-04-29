<script lang="ts">

import coordinates from '@/services/coordinates';
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

const emit = defineEmits(['ready']);

const map = ref<any>(undefined);

onMounted(async () => {
    const { Map3DElement, MapMode } = await google.maps.importLibrary("maps3d");

    const highOrbit = { ...coordinates.orbit, altitude: 3000000 };

    map.value = new Map3DElement({
        center: highOrbit,
        range: 500000, 
        tilt: 60,
        mode: MapMode.SATELLITE,
    });

    map.value.addEventListener('gmp-steadychange', (e: any) => {
        emit('ready');
        status.value = MapStatus.READY;
        map.value.removeEventListener('gmp-steadychange');
    }, { once: true });

    document.getElementById(MAP_ID)?.appendChild(map.value); 
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
        durationMillis: 4000,
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
        center: { ...coordinates.belfast.harlandWolf, altitude: 500 },
        tilt: 67.5, 
        range: 1000,
    };

    map.value.flyCameraTo({
        endCamera: belfastStart,
        durationMillis: 6000,
    });
};

const removeEvents = () => {
    map.value.removeEventListener('gmp-steadychange');
    map.value.removeEventListener('gmp-animationend');
};

watch(status, () => {
    removeEvents();

    switch (status.value) {
        case MapStatus.READY:
            setCameraToOrbit();
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
            'opacity-0': status === MapStatus.LOADING,
        }" 
    />
</template>

<style>
gmp-map-3d {
    display: block;
    height: 100vh;
    width: 100vw;

    filter: saturate(1.2);
}
</style>
