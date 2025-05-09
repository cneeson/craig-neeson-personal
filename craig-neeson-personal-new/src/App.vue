<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'App',
});
</script>
<script lang="ts" setup>
import Hero from './views/hero.vue';
import GlobeGoogle, { MapStatus } from './components/GlobeGoogle.vue';
import Loader from './components/Loader.vue';
import StageSelector from './components/StageSelector.vue';
import BelfastFlythroughIntro from './components/BelfastFlythroughIntro.vue';
import TresScene from './components/TresScene.vue';
import { TresCanvas } from '@tresjs/core'

enum Stage {
  Loading = 'loading',
  Intro = 'intro',
  BelfastFlythrough = 'belfast_flythrough',
  BelfastFlythroughTour = 'belfast_flythrough_tour',
}

const stagesInOrder = [
  Stage.Loading,
  Stage.Intro,
  Stage.BelfastFlythrough
];

const mapStatus = {
  [Stage.Loading]: MapStatus.LOADING,
  [Stage.Intro]: MapStatus.READY,
  [Stage.BelfastFlythrough]: MapStatus.BELFAST_FLYTHROUGH,
  [Stage.BelfastFlythroughTour]: MapStatus.BELFAST_FLYTHROUGH,
};

const stage = ref(Stage.Loading);

const onGlobeReady = () => {
  stage.value = Stage.Intro;
}

const moveToNextStage = () => {
  const currentStageIndex = stagesInOrder.findIndex((thisStage) => thisStage === stage.value);
  stage.value = stagesInOrder[currentStageIndex + 1];
}

const moveToPrevStage = () => {
  const currentStageIndex = stagesInOrder.findIndex((thisStage) => thisStage === stage.value);
  stage.value = stagesInOrder[currentStageIndex - 1];
}

</script>

<template>
    <TresCanvas preset="realistic">
      <Suspense>
        <TresScene/>
      </Suspense>
    </TresCanvas>
  <!-- <StageSelector :stage="stage" @next="moveToNextStage" @prev="moveToPrevStage">
    <Loader v-show="stage === Stage.Loading" class="loader" />
    <Hero v-if="stage === Stage.Intro" class="hero" />
    <GlobeGoogle :status="mapStatus[stage]" @ready="onGlobeReady" @arrived-in-belfast="stage = Stage.BelfastFlythroughTour" />
    <BelfastFlythroughIntro v-if="stage === Stage.BelfastFlythroughTour" />
  </StageSelector> -->
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&display=swap');

.hero {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.loader {
  z-index: 1;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

html, body {
  height: 100%;
  width: 100%;
}

#app {
  font-family: Funnel Display, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100%;
  width: 100%;
}
</style>
