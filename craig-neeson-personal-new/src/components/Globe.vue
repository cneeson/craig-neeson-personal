<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';

export default defineComponent({
    name: 'Hero'
});
</script>
<script lang="ts" setup>

import { Ion, Viewer, IonGeocodeProviderType, createGooglePhotorealistic3DTileset, Cartesian3, HeadingPitchRoll, Terrain, Math, createOsmBuildingsAsync, EasingFunction, Transforms, HeadingPitchRange, DirectionalLight } from 'cesium';
import "cesium/Build/Cesium/Widgets/widgets.css";

const isLoaded = ref(false);

const coords: { [K in string]: [number, number] } = {
    harlandWolff: [-5.904742278849488, 54.60500887036064]
};

// TODO do not commit this
Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyZmM4MjQyNS01OWU3LTQ1ODctYmYwNC0wMTM2ZDA3MjdhZWMiLCJpZCI6Mjk0MzYwLCJpYXQiOjE3NDQ3MzQzNzB9.tVk5ab2cSNJwpDjCiV2PvV1IkSq8hqvPKx02ipIC4ts';

onMounted(async () => {
    // Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
    // const viewer = new Viewer('cesiumContainer', {
    // terrain: Terrain.fromWorldTerrain(),
    // });    

    // // Fly the camera to San Francisco at the given longitude, latitude, and height.
    // viewer.camera.flyTo({
    // destination: Cartesian3.fromDegrees(-122.4175, 37.655, 400),
    // orientation: {
    //     heading: Math.toRadians(0.0),
    //     pitch: Math.toRadians(-15.0),
    // }
    // });

    // // Add Cesium OSM Buildings, a global 3D buildings layer.
    // const buildingTileset = await createOsmBuildingsAsync();
    // viewer.scene.primitives.add(buildingTileset);   

    const viewer = new Viewer("cesiumContainer", {
        timeline: false,
        animation: true,
        sceneModePicker: false,
        baseLayerPicker: false,

        
        geocoder: IonGeocodeProviderType.GOOGLE,
        // The globe does not need to be displayed,
        // since the Photorealistic 3D Tiles include terrain
        // globe: false,
    });

        // Enable rendering the sky
    viewer.scene.skyAtmosphere.show = true;

    // Add Photorealistic 3D Tiles
    try {
        const tileset = await createGooglePhotorealistic3DTileset({
            // Only the Google Geocoder can be used with Google Photorealistic 3D Tiles.  Set the `geocode` property of the viewer constructor options to IonGeocodeProviderType.GOOGLE.
            onlyUsingWithGoogleGeocoder: true,
        });
        viewer.scene.primitives.add(tileset);
    } catch (error) {
        console.log(`Error loading Photorealistic 3D Tiles tileset.
        ${error}`);
    }

    // Point the camera at the Googleplex
    viewer.scene.camera.setView({
        destination: Cartesian3.fromDegrees(
            // Belfast
            -5.894127406782433,
            54.606218370948184,
            300,
        ),
        orientation: new HeadingPitchRoll(
            4.6550106925119925,
            -0.2863894863138836,
            1.3561760425773173e-7,
        ),
    }); 

    setTimeout(() => {
        isLoaded.value = true;
    }, 5000)

    // Lock camera to a point
    // const center = Cartesian3.fromDegrees(...coords.harlandWolff, 50);
    // const transform = Transforms.eastNorthUpToFixedFrame(center);
    // viewer.scene.camera.lookAtTransform(
    //     transform,
    //     new HeadingPitchRange(0, -Math.PI / 8, 800)
    // );

    // // Orbit this point
    // viewer.clock.onTick.addEventListener(function (clock) {
    //     viewer.scene.camera.rotateRight(0.005);
    // });
});


</script>

<template>
    <div id="cesiumContainer" class="h-[100vh] w-[100vw]" />
</template>

<style scoped>

</style>
