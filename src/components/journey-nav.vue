<script lang="ts" setup>
import { chapters } from '@/scene/choreography';

defineProps<{
  /** Index into `chapters` of the beat on screen. */
  active: number;
  /** Fades in once the scene is up, after the hero's intro. */
  ready: boolean;
}>();

const emit = defineEmits<{
  /** A chapter index, or 'content' to skip the journey. */
  navigate: [target: number | 'content'];
}>();
</script>

<template>
  <nav class="journey-nav" aria-label="Journey">
    <ol :class="{ 'is-ready': ready }">
      <li v-for="(chapter, index) in chapters" :key="chapter.label">
        <button
          type="button"
          :class="{ 'is-active': index === active }"
          :aria-current="index === active ? 'step' : undefined"
          @click="emit('navigate', index)"
        >
          <span class="label">{{ chapter.label }}</span>
          <span class="mark" aria-hidden="true" />
        </button>
      </li>
      <li>
        <button type="button" class="is-skip" @click="emit('navigate', 'content')">
          <span class="label">About me</span>
          <span class="mark" aria-hidden="true" />
        </button>
      </li>
    </ol>
  </nav>
</template>

<style lang="scss" scoped>
.journey-nav {
  @apply fixed right-6 lg:right-10 top-1/2 -translate-y-1/2 z-30 hidden md:block;
}

ol {
  @apply flex flex-col items-end gap-1;

  opacity: 0;
  transform: translateX(12px);
  transition: opacity 1s ease 2.4s, transform 1s cubic-bezier(0.22, 1, 0.36, 1) 2.4s;

  &.is-ready {
    opacity: 1;
    transform: none;
  }
}

button {
  @apply flex items-center justify-end gap-3 py-1.5 pl-4 text-xs uppercase tracking-[0.25em] text-slate-200;

  .label {
    opacity: 0;
    transform: translateX(6px);
    transition: opacity 0.4s ease, transform 0.4s ease;
    text-shadow: 0 1px 12px rgba(9, 1, 24, 0.9);
  }

  .mark {
    @apply block h-px w-3 rounded-full bg-slate-200;

    opacity: 0.4;
    transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease;
  }

  &:hover,
  &:focus-visible {
    .label {
      opacity: 0.7;
      transform: none;
    }

    .mark {
      opacity: 0.8;
    }
  }

  &:focus-visible {
    @apply outline-none;

    .label {
      @apply underline underline-offset-4;
    }
  }

  &.is-active {
    .label {
      opacity: 0.9;
      transform: none;
    }

    .mark {
      @apply w-8;

      opacity: 1;
    }
  }

  &.is-skip .mark {
    @apply w-1 h-1;
  }
}
</style>
