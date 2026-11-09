<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { differenceInYears } from 'date-fns';
import { createCaption } from '@/scene/captions';
import { modes, route } from '@/scene/director';
import { navigate } from '@/services/navigation';

/**
 * About: a few words at each stop, written in word by word as the camera arrives. Under the cranes, backing down
 * the dock, then out over the planet with the arcs to where the work has gone.
 */
const yearsExperience = differenceInYears(new Date(), new Date('2017-06-01'));
const stops = modes.about;

const root = ref<HTMLElement>();
const box = ref<HTMLElement>();
const isShown = computed(() => route.isIntroDone && route.mode === 'about');
const isLast = computed(() => route.step === stops.length - 1);

// The captions share one place, which takes the height of the one shown, so a short one leaves no gap
let current: HTMLElement | undefined;
const fit = () => {
  if (box.value && current) box.value.style.height = `${current.offsetHeight}px`;
};
const resizes = new ResizeObserver(fit);

onMounted(() => {
  const captions = [...(root.value?.querySelectorAll<HTMLElement>('[data-caption]') ?? [])]
    .map(element => ({ stop: element.dataset.caption, element, ...createCaption(element) }));
  watch(() => [isShown.value, route.stop, route.isArriving], () => {
    captions.forEach(caption => (
      isShown.value && route.isArriving && caption.stop === route.stop ? caption.show() : caption.hide()
    ));
    const shown = captions.find(caption => caption.stop === route.stop)?.element;
    if (!shown || shown === current) return;
    current = shown;
    resizes.disconnect();
    resizes.observe(current);
    fit();
  }, { immediate: true });
});

onBeforeUnmount(() => resizes.disconnect());
</script>

<template>
  <section ref="root" class="about panel-card" :class="{ 'is-shown': isShown }" aria-label="About me">
    <!-- v-once: the captions are split into words for their entrance, so Vue mustn't re-render them -->
    <div ref="box" v-once class="captions" aria-live="polite">
      <p class="caption" data-caption="hello">
        <span class="block mb-2">Hi, I'm <strong>Craig.</strong> 👋</span>
        For <strong>{{ yearsExperience }} years</strong> I've been building the interfaces that bring ideas to life,
        and help people get the most out of the products they use.
      </p>
      <p class="caption" data-caption="craft">
        My craft is <strong>UI:</strong> scalable component systems, accessible interactions, and motion that
        gives a product its character.
      </p>
      <p class="caption" data-caption="reach">
        Built in <strong>Belfast,</strong> shipped with teams across <strong>Ireland, Europe</strong> and the
        <strong>US.</strong>
      </p>
    </div>

    <div class="controls">
      <ol class="dots" aria-label="Steps">
        <li v-for="(stop, i) in stops" :key="stop">
          <button
            type="button"
            :aria-label="`Step ${i + 1}`"
            :aria-current="route.step === i ? 'step' : undefined"
            @click="navigate('about', i)"
          />
        </li>
      </ol>
      <button v-if="route.step > 0" type="button" class="text-button" @click="navigate('about', route.step - 1)">Back</button>
      <button v-if="!isLast" type="button" class="pill-button" @click="navigate('about', route.step + 1)">Next</button>
      <button v-else type="button" class="pill-button" @click="navigate('experience')">See my experience →</button>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.captions {
  display: grid;
  align-items: start;
  transition: height 0.5s ease;
  // Clipped as it shrinks under the caption going, but not the words rising in below the last line
  overflow: clip;
  overflow-clip-margin: 0.6em;
}

.caption {
  @apply text-lg md:text-xl lg:text-2xl leading-snug;

  // All captions share one grid cell so they cross-fade in place
  grid-area: 1 / 1;
  visibility: hidden;
  text-wrap: balance;

  strong {
    font-weight: 700;
  }

  :deep(.word) {
    display: inline-block;
  }
}
</style>
