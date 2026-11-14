<script lang="ts" setup>
import { computed, ref } from 'vue';
import { route } from '@/scene/director';
import ActionLink from './action-link.vue';
import AttributionsModal from './attributions-modal.vue';

/** Contact, hovering over Belfast: how to get in touch, the CV, and the credits. */
const isShown = computed(() => route.isIntroDone && route.mode === 'contact');
const isAttributionsOpen = ref(false);

const links = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/craig-neeson-b2808278',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    label: 'Email',
    href: 'mailto:craigneeson@hotmail.co.uk',
    path: 'M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v.511l9 5.4 9-5.4V6H3zm18 2.844-8.486 5.092a1 1 0 0 1-1.028 0L3 8.844V18h18V8.844z',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/cneeson',
    path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
];
</script>

<template>
  <section class="contact panel-card" :class="{ 'is-shown': isShown }" aria-label="Contact" data-scrolls>
    <div class="top">
      <p class="eyebrow">Contact</p>
      <!-- Up here on phones, out of the way; under the links on wider screens -->
      <button type="button" class="credits md:hidden" @click="isAttributionsOpen = true">Credits</button>
    </div>
    <h2 class="title">Let's build something together.</h2>
    <p class="text">
      <span class="hidden md:inline">I'm currently open to hybrid Senior Frontend Developer roles based in Dublin and
        Belfast. I'd love to hear from you, and please feel free to take a copy of my CV with you.</span>
      <span class="md:hidden">Open to hybrid Senior Frontend roles in Dublin and Belfast. I'd love to hear from you.</span>
    </p>
    <div class="actions">
      <ActionLink primary icon="download" href="docs/craig-neeson-cv.pdf" download>
        <span class="hidden md:inline">Download my CV</span><span class="md:hidden">My CV</span>
      </ActionLink>
      <ul class="links">
        <li v-for="link in links" :key="link.label">
          <a :href="link.href" target="_blank" rel="noopener" class="link" :aria-label="link.label">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path :d="link.path" />
            </svg>
            <span class="hidden md:inline">{{ link.label }}</span>
          </a>
        </li>
      </ul>
    </div>
    <button type="button" class="credits hidden md:block" @click="isAttributionsOpen = true">Credits & attributions</button>
  </section>
  <AttributionsModal :is-open="isAttributionsOpen" @close="isAttributionsOpen = false" />
</template>

<style lang="scss" scoped>
.title {
  @apply text-2xl lg:text-3xl font-semibold mt-1;
}

.text {
  @apply mt-2 md:mt-3 text-sm lg:text-base text-white/85 leading-relaxed;
}

.top {
  @apply flex items-baseline justify-between;
}

// The CV and the links side by side at the bottom on phones, the links under it on wider screens
.actions {
  @apply mt-auto md:mt-5 flex items-center gap-5 md:flex-col md:items-start md:gap-6;
}

.links {
  @apply flex gap-5 md:gap-6;
}

.link {
  @apply flex flex-col items-center gap-2 text-xs text-slate-300 transition;

  svg {
    @apply w-6 h-6 md:w-7 md:h-7 text-white transition-transform;
  }

  &:hover,
  &:focus-visible {
    @apply text-white;

    svg {
      transform: scale(1.12);
      filter: drop-shadow(0 0 12px rgba(136, 184, 242, 0.7));
    }
  }
}

.credits {
  @apply text-xs text-white/60 underline underline-offset-4;

  @media (min-width: 768px) {
    @apply mt-6;
  }

  &:hover,
  &:focus-visible {
    @apply text-white;
  }
}
</style>
