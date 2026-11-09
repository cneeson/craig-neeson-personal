<script setup lang="ts">
import { route, type Mode } from '@/scene/director';
import { navigate } from '@/services/navigation';

/** The menu: along the top on wider screens, and along the bottom, in reach of a thumb, on phones. */
const items: { mode: Mode, label: string, icon: string }[] = [
  { mode: 'home', label: 'Home', icon: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z' },
  { mode: 'about', label: 'About', icon: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4 3.6-7 8-7s8 3 8 7z' },
  { mode: 'experience', label: 'Experience', icon: 'M9 4h6a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3V6a2 2 0 0 1 2-2zm0 3h6V6H9z' },
  { mode: 'skills', label: 'Skills', icon: 'M8 6 2 12l6 6 1.4-1.4L4.8 12l4.6-4.6zm8 0-1.4 1.4 4.6 4.6-4.6 4.6L16 18l6-6z' },
  { mode: 'contact', label: 'Contact', icon: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V17h16V7.4l-8 5.3z' },
];
</script>

<template>
  <nav class="site-menu" :class="{ 'is-shown': route.isIntroDone }" aria-label="Site">
    <button type="button" class="brand" @click="navigate('home')">Craig Neeson</button>
    <ul>
      <li v-for="item in items" :key="item.mode" :class="{ 'is-home': item.mode === 'home' }">
        <button
          type="button"
          :aria-current="route.mode === item.mode ? 'page' : undefined"
          @click="navigate(item.mode)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
          <span>{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss" scoped>
$blue: #88b8f2;

.site-menu {
  @apply fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 lg:px-10 py-4;

  opacity: 0;
  visibility: hidden;
  transform: translateY(-12px);
  transition: opacity 0.8s ease, transform 0.8s ease, visibility 0s linear 0.8s;
  background: linear-gradient(to bottom, rgba(9, 1, 24, 0.55), transparent);

  &.is-shown {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: opacity 0.8s ease, transform 0.8s ease;
  }
}

.brand {
  @apply text-lg lg:text-xl font-extrabold tracking-tight;

  text-shadow: 0 2px 12px rgba(9, 1, 24, 0.8);
}

ul {
  @apply flex gap-1;
}

li.is-home {
  display: none;
}

li button {
  @apply relative px-4 py-2 rounded-full text-sm lg:text-base text-white/80 transition;

  text-shadow: 0 1px 8px rgba(9, 1, 24, 0.9);

  svg {
    display: none;
  }

  &:hover,
  &:focus-visible {
    @apply text-white;

    background: rgba(255, 255, 255, 0.08);
  }

  &[aria-current='page'] {
    @apply text-white;

    background: rgba(42, 35, 122, 0.7);
    box-shadow: inset 0 0 0 1px rgba(136, 184, 242, 0.55), 0 0 18px rgba(136, 184, 242, 0.3);
  }
}

// Phones: a bar of icons along the bottom
@media (max-width: 767px) {
  .site-menu {
    top: auto;
    bottom: 0;
    height: var(--menu-bottom);
    padding: 0 0 env(safe-area-inset-bottom);
    transform: translateY(12px);
    background: rgba(9, 1, 24, 0.82);
    border-top: 1px solid rgba(136, 184, 242, 0.2);
    backdrop-filter: blur(10px);
  }

  .brand {
    display: none;
  }

  ul {
    @apply w-full justify-around gap-0;
  }

  li.is-home {
    display: block;
  }

  li button {
    @apply flex flex-col items-center gap-1 px-2 py-1.5 text-[11px] rounded-xl;

    svg {
      display: block;
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    &[aria-current='page'] {
      background: transparent;
      box-shadow: none;
      color: $blue;
    }
  }
}
</style>
