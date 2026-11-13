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
    <button type="button" class="brand" aria-label="Craig Neeson, home" @click="navigate('home')">Craig <i>Neeson</i></button>
    <ul>
      <li v-for="item in items" :key="item.mode" :class="{ 'is-home': item.mode === 'home' }">
        <button
          type="button"
          :aria-current="route.mode === item.mode ? 'page' : undefined"
          @click="navigate(item.mode)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
          <!-- The label twice, the hidden copy in the current page's italic, so the menu keeps its width as that moves -->
          <span class="label" :data-label="item.label">{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss" scoped>
$ink: #f4efe6;

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
  @apply text-xl lg:text-2xl;

  font-family: 'Fraunces', Georgia, serif;
  font-variation-settings: 'opsz' 144, 'wght' 700;
  color: $ink;
  text-shadow: 0 2px 12px rgba(9, 1, 24, 0.8);

  // The surname set apart, as in the title
  i {
    font-variation-settings: 'opsz' 144, 'wght' 300;
  }
}

ul {
  @apply flex gap-2 lg:gap-4;
}

li.is-home {
  display: none;
}

// Just the words: the page you're on in Instrument Serif's italic, the face kept for emphasis
li button {
  @apply relative px-3 py-2 text-sm lg:text-base font-medium text-white/70 transition-colors;

  letter-spacing: 0.01em;
  text-shadow: 0 1px 8px rgba(9, 1, 24, 0.9);

  svg {
    display: none;
  }

  .label {
    display: inline-grid;
    justify-items: center;

    &::after {
      content: attr(data-label);
      height: 0;
      overflow: hidden;
      visibility: hidden;
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: 1.2em;
      letter-spacing: 0;
    }
  }

  &:hover,
  &:focus-visible {
    color: $ink;
  }

  &:focus-visible {
    outline: none;
    text-decoration: underline;
    text-underline-offset: 0.3em;
  }

  &[aria-current='page'] {
    color: $ink;

    .label {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-weight: 400;
      font-size: 1.2em;
      line-height: 1;
      letter-spacing: 0;

      // Here the hidden copy's the roman
      &::after {
        font-family: 'Satoshi', Helvetica, Arial, sans-serif;
        font-style: normal;
        font-weight: 500;
        font-size: calc(1em / 1.2);
        letter-spacing: 0.01em;
      }
    }
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
    border-top: 1px solid rgba(244, 239, 230, 0.12);
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

    // A thin ring of ink round the page you're on, the label as the others (too small for the italic)
    &[aria-current='page'] {
      box-shadow: inset 0 0 0 1px rgba($ink, 0.45);

      .label {
        font: inherit;
        letter-spacing: inherit;
      }
    }

    .label::after {
      display: none;
    }
  }
}
</style>
