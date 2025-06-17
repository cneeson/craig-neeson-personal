import { easeToTarget } from "@/services/three";
import { RenderLoop, TresInstance } from "@tresjs/core";
import { Camera } from "three";
import { ComputedRef } from "vue";
import { ShallowRef } from "vue";

const DEBUG_SKIP_FIRST_STAGE = true;

export enum Stage {
    FocusEarth = 'focus-earth',
    ScrollToNi = 'scroll-to-ni',
    IntroduceNI = 'introduce-ni',
    ViewProjectLocations = 'view-project-locations',
    PreFadeScene = 'pre-fade-scene',
    FadeScene = 'fade-scene',
}

interface StageActionOptions {
    renderLoop: RenderLoop;
    camera: ComputedRef<Camera>;
    emit: (event: string) => void;
    refs: {
        fadeFactor: ShallowRef<number>;
        text: ShallowRef<string | undefined>;
        niHighlight: ShallowRef<TresInstance>;
        earth: ShallowRef<TresInstance>;
        earthCloud: ShallowRef<TresInstance>;
        stars: ShallowRef<TresInstance>;
        nameHero: ShallowRef<TresInstance>;
        sun: ShallowRef<TresInstance>;
        cityRefs: {
            london: ShallowRef<TresInstance>;
            paris: ShallowRef<TresInstance>;
            berlin: ShallowRef<TresInstance>;
            madrid: ShallowRef<TresInstance>;
            rome: ShallowRef<TresInstance>;
        };
        isNameHeroVisible: ShallowRef<boolean>;
    };
    scrollPercent: ShallowRef<number>;
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
        actions: ({ renderLoop: { elapsed }, refs: { isNameHeroVisible, nameHero, text, niHighlight, cityRefs, fadeFactor, earth }, camera }) => {
            isNameHeroVisible.value = true;

            if (DEBUG_SKIP_FIRST_STAGE) {
                camera.value.position.y = 0;
                nameHero.value.instance.position.y = 0;

                return;
            }

            if (camera.value.position.y > 0.001) {
                const options = {
                    target: 0,
                    elapsed,
                    factor: 0.2
                };
                camera.value.position.y = easeToTarget({
                    current: camera.value.position.y,
                    ...options,
                });
                nameHero.value.instance.position.y = easeToTarget({
                    current: nameHero.value.instance.position.y,
                    ...options,
                });
            }

            // Defaults
            text.value = undefined;
            earth.value.position.y = -1.1;
            niHighlight.value.intensity = easeToTarget({
                current: niHighlight.value.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            Object.values(cityRefs).forEach(cityRef => cityRef.value.visible = false);
            fadeFactor.value = 0;
        }
    },
    {
        key: Stage.ScrollToNi,
        condition: {
            from: 0.001,
            to: 0.015
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { isNameHeroVisible, earth, text, niHighlight, cityRefs, fadeFactor } }) => {
            camera.value.rotation.x = -scrollPercent.value * 25;
            camera.value.position.z = 10 + (scrollPercent.value * 50);
            earth.value.rotation.y = -scrollPercent.value * 22;

            isNameHeroVisible.value = scrollPercent.value < 0.0001

            // Defaults
            text.value = undefined;
            niHighlight.value.intensity = easeToTarget({
                current: niHighlight.value.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            earth.value.position.y = -1.1;
            Object.values(cityRefs).forEach(cityRef => cityRef.value.visible = false);
            fadeFactor.value = 0;
        }
    },
    {
        key: Stage.IntroduceNI,
        condition: {
            from: 0.015,
            to: 0.025
        },
        actions: ({ camera, renderLoop: { elapsed }, scrollPercent, refs: { earth, text, niHighlight, cityRefs, fadeFactor } }) => {
            camera.value.position.z = 10 + (scrollPercent.value * 50);
            earth.value.rotation.y = -scrollPercent.value * 22;

            text.value = `I am a frontend developer\nbased in Northern Ireland`;
            niHighlight.value.intensity = easeToTarget({
                current: niHighlight.value.intensity,
                target: 0.15,
                elapsed,
                factor: 0.2,
            });

            // Defaults
            earth.value.position.y = -1.1;
            Object.values(cityRefs).forEach(cityRef => cityRef.value.visible = false);
            fadeFactor.value = 0;
        }
    },
    {
        key: Stage.ViewProjectLocations,
        condition: {
            from: 0.025,
            to: 0.05
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niHighlight, cityRefs, fadeFactor } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;

            text.value = `For 8 years I have worked with companies\nacross Ireland, Europe and the US to deliver\nawesome user-experiences.`;

            Object.values(cityRefs).forEach(cityRef => cityRef.value.visible = true);

            // Defaults
            earth.value.position.y = -1.1;
            niHighlight.value.intensity = easeToTarget({
                current: niHighlight.value.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            fadeFactor.value = 0;
        }
    },
    {
        key: Stage.PreFadeScene,
        condition: {
            from: 0.05,
            to: 0.055
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niHighlight, cityRefs, fadeFactor } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;
            camera.value.position.z = 10 - (0.025 * 50) + (scrollPercent.value * 50);

            // Defaults
            text.value = undefined;
            earth.value.position.y = -1.1;
            niHighlight.value.intensity = easeToTarget({
                current: niHighlight.value.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            Object.values(cityRefs).forEach(cityRef => cityRef.value.visible = false);
        }
    },
    {
        key: Stage.FadeScene,
        condition: {
            from: 0.055,
            to: 1
        },
        actions: ({ camera, scrollPercent, renderLoop: { elapsed }, refs: { earth, text, niHighlight, cityRefs, fadeFactor } }) => {
            earth.value.rotation.y = -scrollPercent.value * 22;
            camera.value.position.z = 10 - (0.025 * 50) + (scrollPercent.value * 50);
            fadeFactor.value = scrollPercent.value;
            console.log(fadeFactor.value)

            camera.value.rotation.x = easeToTarget({
                current: camera.value.rotation.x,
                target: -0.25,
                elapsed,
                factor: 0.2,
            });

            // Defaults
            niHighlight.value.intensity = easeToTarget({
                current: niHighlight.value.intensity,
                target: 0,
                elapsed,
                factor: 0.2,
            });
            Object.values(cityRefs).forEach(cityRef => cityRef.value.visible = false);
            text.value = undefined;
        }
    },
];