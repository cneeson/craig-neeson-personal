<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { employerBeats, route } from '@/scene/director';
import { navigate } from '@/services/navigation';
import { stops } from '@/data/journey';
import CompanyLogo from './company-logo.vue';

/**
 * Experience: a timeline along the bottom, from university to now. Each entry flies to where it happened, where
 * its card (city-signs.vue) opens the details; the first goes back up to the overview of them all.
 */
const isShown = computed(() => route.isIntroDone && route.mode === 'experience');
const isOverview = computed(() => route.stop === 'overview');
const startYear = (dates: string) => dates.match(/\d{4}/)?.[0] ?? dates;

const list = ref<HTMLElement>();
// Keeps the current entry in view where the timeline scrolls (on narrow screens)
watch(() => route.step, async () => {
  await nextTick();
  list.value?.querySelector('[aria-current]')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
});
</script>

<template>
  <section class="experience" :class="{ 'is-shown': isShown }" aria-label="Experience">
    <div class="intro panel-card" :class="{ 'is-shown': isShown && isOverview }">
      <p class="eyebrow">Experience</p>
      <h2 class="title">From the north coast to Lanyon Place.</h2>
      <p class="text">University, then six teams, five of them here in Belfast. Pick one on the timeline, or step through them in order.</p>
    </div>

    <nav class="timeline" aria-label="Timeline">
      <ol ref="list" data-scrolls>
        <li>
          <button type="button" class="entry is-all" :aria-current="isOverview ? 'step' : undefined" @click="navigate('experience', 'overview')">
            <span class="all">All</span>
            <span class="year">Overview</span>
          </button>
        </li>
        <li v-for="beat in employerBeats" :key="beat">
          <button
            type="button"
            class="entry"
            :aria-current="route.stop === beat ? 'step' : undefined"
            :aria-label="`${stops[beat].name}, ${stops[beat].dates}`"
            @click="navigate('experience', beat)"
          >
            <CompanyLogo :stop="stops[beat]" :size="15" />
            <span class="year">{{ startYear(stops[beat].dates) }}</span>
          </button>
        </li>
      </ol>
    </nav>
  </section>
</template>

<style lang="scss" scoped>
$blue: #88b8f2;

.experience {
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

.intro {
  bottom: calc(var(--chrome-bottom) + 1rem);
}

.timeline {
  @apply fixed inset-x-0 z-30 flex justify-center;

  bottom: var(--menu-bottom);
  height: 76px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s ease, visibility 0s linear 0.6s;
  background: linear-gradient(to top, rgba(9, 1, 24, 0.85), rgba(9, 1, 24, 0.4) 70%, transparent);

  .is-shown & {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: opacity 0.6s ease, transform 0.6s ease;
  }

  ol {
    @apply relative flex items-center gap-1 px-4 overflow-x-auto max-w-full;

    scrollbar-width: none;

    // The line the entries sit on
    &::before {
      content: '';
      position: absolute;
      inset-inline: 2rem;
      top: 50%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(136, 184, 242, 0.5) 10%, rgba(136, 184, 242, 0.5) 90%, transparent);
    }
  }
}

.entry {
  @apply relative flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-white/70 transition;

  min-width: 6.5rem;
  height: 60px;
  background: rgba(9, 1, 24, 0.75);
  border: 1px solid rgba(136, 184, 242, 0.18);

  &:hover,
  &:focus-visible {
    @apply text-white;

    border-color: rgba(136, 184, 242, 0.5);
  }

  &[aria-current='step'] {
    @apply text-white;

    background: rgba(42, 35, 122, 0.9);
    border-color: $blue;
    box-shadow: 0 0 20px rgba(136, 184, 242, 0.35);
  }

  .company-logo {
    mask-position: center;
  }

  .all {
    @apply text-sm font-bold leading-none;
  }

  .year {
    @apply font-mono text-[10px] tracking-[0.15em] uppercase text-[#88b8f2];
  }
}

.title {
  @apply text-xl lg:text-2xl font-bold mt-1;
}

.text {
  @apply mt-2 text-sm lg:text-base text-white/85 leading-relaxed;
}
</style>
