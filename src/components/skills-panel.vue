<script setup lang="ts">
import { computed } from 'vue';
import { modes, route } from '@/scene/director';
import { navigate } from '@/services/navigation';
import ActionLink from './action-link.vue';
import { iconUrl, skills } from '@/data/skills';

/** Skills: what's stood about the city at each stop, listed here too (for narrow screens that can't see it all). */
const stops = modes.skills;
const copy: Record<typeof stops[number], { title: string, text: string }> = {
  docks: {
    title: 'Every day',
    text: "Deep in JavaScript and TypeScript, at home in vanilla JS and in the frameworks. I've led frontend architecture from scratch, and I'm just as happy as part of a team.",
  },
  arena: {
    title: 'Tonight at the SSE Arena',
    text: "The headliners and the support: a full bill, and I've played every one of them on production stages.",
  },
  lagan: {
    title: 'And the craft',
    text: 'Accessible, well-built HTML and CSS underneath, and the motion and 3D on top, like this site.',
  },
};
const isShown = computed(() => route.isIntroDone && route.mode === 'skills');
const stop = computed(() => stops[route.step] ?? 'docks');
const listed = computed(() => (stop.value === 'arena' ? [] : skills.filter(skill => skill.stop === stop.value)));
</script>

<template>
  <section class="skills panel-card" :class="{ 'is-shown': isShown }" aria-label="Skills">
    <p class="eyebrow">Skills · {{ route.step + 1 }} of {{ stops.length }}</p>
    <Transition name="swap" mode="out-in">
      <div :key="stop">
        <h2 class="title">{{ copy[stop].title }}</h2>
        <p class="text">{{ copy[stop].text }}</p>
        <ul v-if="listed.length" class="list">
          <li v-for="skill in listed" :key="skill.name">
            <img v-if="skill.icon" :src="iconUrl(skill.icon)" alt="" width="18" height="18">
            {{ skill.name }}
          </li>
        </ul>
      </div>
    </Transition>
    <div class="controls">
      <button v-if="route.step > 0" type="button" class="text-button" @click="navigate('skills', route.step - 1)">Back</button>
      <ActionLink v-if="route.step < stops.length - 1" @click="navigate('skills', route.step + 1)">Next</ActionLink>
      <ActionLink v-else @click="navigate('contact')">Get in touch</ActionLink>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.title {
  @apply text-xl lg:text-2xl font-semibold mt-1;
}

.text {
  @apply mt-2 text-sm lg:text-base text-white/85 leading-relaxed;
}

.list {
  @apply mt-3 flex flex-wrap gap-2;

  li {
    @apply flex items-center gap-2 px-3 py-1 rounded-full text-sm;

    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(136, 184, 242, 0.3);
  }

  img {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }
}
</style>
