import { easeToTarget } from "@/services/three";
import { RenderLoop, TresInstance } from "@tresjs/core";
import { Camera } from "three";
import { ComputedRef } from "vue";
import { ShallowRef } from "vue";

export enum Stage {
    FocusEarth = 'focus-earth',
    ScrollToEarth = 'scroll-to-earth',
    IntroduceNI = 'introduce-ni',
    ViewProjectLocations = 'view-project-locations'
}

interface StageActionOptions {
    renderLoop: RenderLoop;
    camera: ComputedRef<Camera>;
    refs: {
        earth: ShallowRef<TresInstance>;
        earthCloud: ShallowRef<TresInstance>;
        stars: ShallowRef<TresInstance>;
        nameHero: ShallowRef<TresInstance>;
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
        actions: ({ renderLoop: { elapsed }, refs: { isNameHeroVisible, nameHero }, camera }) => {
            isNameHeroVisible.value = true;

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
        }
    },
    {
        key: Stage.ScrollToEarth,
        condition: {
            from: 0.001,
            to: 0.015
        },
        actions: ({ camera, scrollPercent, refs: { isNameHeroVisible } }) => {
            camera.value.rotation.x = -scrollPercent.value * 25;
            camera.value.position.z = 10 + (scrollPercent.value * 50);

            isNameHeroVisible.value = scrollPercent.value < 0.0001
            // heroText.value = undefined;
        }
    },
    {
        key: Stage.IntroduceNI,
        condition: {
            from: 0.015,
            to: 0.03
        },
        actions: ({ camera, scrollPercent }) => {
            // heroText.value = HeroText.RoleAndLocation;
            camera.value.position.z = 10 + (scrollPercent.value * 50);
        }
    },
    {
        key: Stage.ViewProjectLocations,
        condition: {
            from: 0.03,
            to: 1
        },
        actions: ({ camera, scrollPercent }) => {
            if (scrollPercent.value > 0.012) {
                // heroText.value = HeroText.ProjectLocations;
            } else {
                // heroText.value = undefined;
            }

            camera.value.position.z = 10 + (scrollPercent.value * 50);
        }
    }
];