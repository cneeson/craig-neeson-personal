import { easeToTarget } from "@/services/three";
import { RenderLoop, TresInstance } from "@tresjs/core";
import { Camera } from "three";
import { ComputedRef } from "vue";
import { ShallowRef } from "vue";

// TODO eventually enable this
const DEBUG_SKIP_FIRST_STAGE = true;

export enum Stage {
    FocusEarth = 'focus-earth',
    ScrollToNi = 'scroll-to-ni',
    IntroduceNI = 'introduce-ni',
    ScrollFromNI = 'scroll-from-ni',
    ScrollToProjectLocations = 'scroll-to-project-locations',
    ViewProjectLocations = 'view-project-locations',
    ScrollAwayFromProjectLocations = 'scroll-away-from-project-locations',
    PreFadeScene = 'pre-fade-scene',
    FadeScene = 'fade-scene',
}

interface Marker {
    lightRef: TresInstance;
    textRef: TresInstance;
    modelRef: TresInstance;
    show: () => void;
    hide: () => void;
}

interface StageActionOptions {
    renderLoop: RenderLoop;
    camera: ComputedRef<Camera>;
    emit: (event: string) => void;
    refs: {
        isLowBloom: ShallowRef<boolean>;
        fadeFactor: ShallowRef<number>;
        text: ShallowRef<string | undefined>;
        niMarker: ShallowRef<Marker>;
        earth: ShallowRef<TresInstance>;
        earthCloud: ShallowRef<TresInstance>;
        stars: ShallowRef<TresInstance>;
        nameHero: ShallowRef<TresInstance>;
        sun: ShallowRef<TresInstance>;
        cityRefs: {
            london: ShallowRef<Marker>;
            paris: ShallowRef<Marker>;
            berlin: ShallowRef<Marker>;
            madrid: ShallowRef<Marker>;
            rome: ShallowRef<Marker>;
        };
        isNameHeroVisible: ShallowRef<boolean>;
    };
    scrollPercent: ShallowRef<number>;
}

const showMarker = (marker: ShallowRef<Marker>, elapsed: number, intensity: number = 0.03) => {
    marker.value.lightRef.intensity = easeToTarget({
        current: marker.value.lightRef.intensity,
        target: intensity,
        elapsed,
        factor: 0.4,
    });
    marker.value.textRef.opacity = easeToTarget({
        current: marker.value.textRef.opacity,
        target: 1,
        elapsed,
        factor: 0.4,
    });
    marker.value.show();
}

const hideMarker = (marker: ShallowRef<Marker>, elapsed: number) => {
    marker.value.lightRef.intensity = easeToTarget({
        current: marker.value.lightRef.intensity,
        target: 0.0,
        elapsed,
        factor: 0.8,
    });
    marker.value.textRef.opacity = easeToTarget({
        current: marker.value.textRef.opacity,
        target: 0,
        elapsed,
        factor: 0.8,
    });
    marker.value.hide();
}

interface StageConfiguration {
    key: Stage,
    condition: {
        from: number,
        to: number
    },
    actions: (options: StageActionOptions) => void
}

export const stages: StageConfiguration[] = [
    {
        key: Stage.FocusEarth,
        condition: {
            from: 0,
            to: 0.001
        },
        actions: ({ renderLoop: { elapsed }, refs: { isLowBloom, isNameHeroVisible, nameHero, text, niMarker, cityRefs, fadeFactor, earth }, camera }) => {

            // isNameHeroVisible.value = true;
            if (DEBUG_SKIP_FIRST_STAGE) {
                camera.value.position.y = 0;
                // nameHero.value.instance.position.y = 0;

                return;
            }

            if (camera.value.position.y > 0.001) {
                const options = {
                    target: 0,
                    elapsed,
                    factor: 0.5
                };
                camera.value.position.y = easeToTarget({
                    current: camera.value.position.y,
                    ...options,
                });
                // nameHero.value.instance.position.y = easeToTarget({
                //     current: nameHero.value.instance.position.y,
                //     ...options,
                // });
            }

            // Defaults
            text.value = undefined;
            earth.value.position.y = -1.1;
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            fadeFactor.value = 0;
            isLowBloom.value = true;
        }
    },
    {
        key: Stage.ScrollToNi,
        condition: {
            from: 0.001,
            to: 0.015
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { isLowBloom, isNameHeroVisible, earth, text, niMarker, cityRefs, fadeFactor } }) => {
            camera.value.rotation.x = -scrollPercent.value * 25;
            camera.value.position.z = 10 + (scrollPercent.value * 50);
            earth.value.rotation.y = -scrollPercent.value * 22;

            isNameHeroVisible.value = scrollPercent.value < 0.0001

            // Defaults
            text.value = undefined;
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            earth.value.position.y = -1.1;
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            fadeFactor.value = 0;
            isLowBloom.value = true;
            hideMarker(niMarker, elapsed);
        }
    },
    {
        key: Stage.IntroduceNI,
        condition: {
            from: 0.015,
            to: 0.02
        },
        actions: ({ camera, renderLoop: { elapsed }, scrollPercent, refs: { earth, isLowBloom, niMarker, cityRefs, fadeFactor } }) => {
            camera.value.position.z = 10 + (scrollPercent.value * 50);
            earth.value.rotation.y = -scrollPercent.value * 22;

            showMarker(niMarker, elapsed);

            // Defaults
            earth.value.position.y = -1.1;
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            fadeFactor.value = 0;
            isLowBloom.value = false;
        }
    },
    {
        key: Stage.ScrollFromNI,
        condition: {
            from: 0.02,
            to: 0.025
        },
        actions: ({ camera, renderLoop: { elapsed }, scrollPercent, refs: { earth, isLowBloom, niMarker, cityRefs, fadeFactor } }) => {
            camera.value.position.z = 10 + (scrollPercent.value * 50);
            earth.value.rotation.y = -scrollPercent.value * 22;

            // Defaults
            earth.value.position.y = -1.1;
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            fadeFactor.value = 0;
            isLowBloom.value = false;
            hideMarker(niMarker, elapsed);
        }
    },
    {
        key: Stage.ScrollToProjectLocations,
        condition: {
            from: 0.025,
            to: 0.028
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niMarker, cityRefs, fadeFactor, isLowBloom } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;

            // Defaults
            earth.value.position.y = -1.1;
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            fadeFactor.value = 0;
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            isLowBloom.value = false;
            hideMarker(niMarker, elapsed);
        }
    },
    {
        key: Stage.ViewProjectLocations,
        condition: {
            from: 0.028,
            to: 0.04
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niMarker, cityRefs, fadeFactor, isLowBloom } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;

            Object.values(cityRefs).forEach(cityRef => showMarker(cityRef, elapsed, 0.015));


            // Defaults
            earth.value.position.y = -1.1;
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            fadeFactor.value = 0;
            isLowBloom.value = false;
            hideMarker(niMarker, elapsed);
        }
    },
    {
        key: Stage.ScrollAwayFromProjectLocations,
        condition: {
            from: 0.04,
            to: 0.05
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niMarker, cityRefs, fadeFactor, isLowBloom } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;

            // Defaults
            earth.value.position.y = -1.1;
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            fadeFactor.value = 0;
            isLowBloom.value = true;
            hideMarker(niMarker, elapsed);
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
        }
    },
    {
        key: Stage.PreFadeScene,
        condition: {
            from: 0.05,
            to: 0.055
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niMarker, cityRefs, fadeFactor, isLowBloom } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;
            camera.value.position.z = 10 - (0.025 * 50) + (scrollPercent.value * 50);

            // Defaults
            text.value = undefined;
            earth.value.position.y = -1.1;
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            isLowBloom.value = true;
            hideMarker(niMarker, elapsed);
            if (scrollPercent.value > -0.3) {
                camera.value.rotation.x = easeToTarget({
                    current: camera.value.rotation.x,
                    target: -0.369465,
                    elapsed,
                    factor: 0.1,
                });
            }
        }
    },
    {
        key: Stage.FadeScene,
        condition: {
            from: 0.055,
            to: 1
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niMarker, cityRefs, fadeFactor, isLowBloom } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;
            camera.value.position.z = 10 - (0.025 * 50) + (scrollPercent.value * 50);
            fadeFactor.value = scrollPercent.value;

            camera.value.rotation.x = easeToTarget({
                current: camera.value.rotation.x,
                target: -0.25,
                elapsed,
                factor: 0.1,
            });

            // Defaults
            niMarker.value.lightRef.intensity = easeToTarget({
                current: niMarker.value.lightRef.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            Object.values(cityRefs).forEach(cityRef => hideMarker(cityRef, elapsed));
            text.value = undefined;
            isLowBloom.value = true;
            hideMarker(niMarker, elapsed);
        }
    },
];