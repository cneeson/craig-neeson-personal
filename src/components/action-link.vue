<script setup lang="ts">
/**
 * The site's buttons: words and an arrow, no box. The main action on a screen (`ring`) holds its arrow in a ring that
 * fills with ink on hover, the arrow slipping out through one side and back in through the other; the rest are just
 * the words, the arrow nudging on. Either way the words underline on hover. A link with `href`, otherwise a button.
 */
withDefaults(defineProps<{ href?: string, ring?: boolean, icon?: 'arrow' | 'download' }>(), { icon: 'arrow' });

const paths = {
  arrow: 'M4 12h15M13 6l6 6-6 6',
  download: 'M12 4v13m0 0-5.5-5.5M12 17l5.5-5.5M5 21h14',
};
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="action-link"
    :class="[{ 'is-ring': ring }, `is-${icon}`]"
  >
    <span class="label"><slot /></span>
    <span class="mark" aria-hidden="true">
      <svg v-for="copy in ring ? 2 : 1" :key="copy" viewBox="0 0 24 24"><path :d="paths[icon]" /></svg>
    </span>
  </component>
</template>

<style lang="scss" scoped>
$ink: #f4efe6;
$ease: cubic-bezier(0.65, 0, 0.35, 1);

.action-link {
  @apply inline-flex items-center gap-2 text-sm lg:text-base font-medium;

  color: $ink;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 10px rgba(9, 1, 24, 0.8);

  &:focus-visible {
    outline: none;
  }
}

.label {
  position: relative;
  padding: 0.3em 0;

  &::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    bottom: 0.15em;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: right;
    transition: transform 0.45s $ease;
  }
}

.mark {
  display: grid;
  place-items: center;

  svg {
    grid-area: 1 / 1;
    width: 1.1em;
    height: 1.1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.45s $ease;
  }
}

.action-link:hover,
.action-link:focus-visible {
  .label::after {
    transform: scaleX(1);
    transform-origin: left;
  }

  .mark svg {
    transform: translateX(0.25em);
  }
}

.is-download:hover .mark svg,
.is-download:focus-visible .mark svg {
  transform: translateY(0.15em);
}

// The main action: the arrow in a ring
.is-ring {
  @apply gap-3 lg:gap-4;

  .mark {
    position: relative;
    // At least a thumb's width on phones
    width: max(2.9em, 44px);
    height: max(2.9em, 44px);
    border-radius: 50%;
    border: 1px solid rgba($ink, 0.45);
    overflow: hidden;
    transition: background-color 0.35s, border-color 0.35s, color 0.35s;

    svg + svg {
      transform: translateX(-180%);
    }
  }

  &.is-download .mark svg + svg {
    transform: translateY(-180%);
  }

  &:hover,
  &:focus-visible {
    .mark {
      background: $ink;
      border-color: $ink;
      color: #090118;
    }

    .mark svg:first-child {
      transform: translateX(180%);
    }

    .mark svg + svg {
      transform: translateX(0);
    }

    &.is-download .mark svg:first-child {
      transform: translateY(180%);
    }

    &.is-download .mark svg + svg {
      transform: translateY(0);
    }
  }

  &:focus-visible .mark {
    outline: 2px solid rgba($ink, 0.6);
    outline-offset: 3px;
  }
}

.action-link:not(.is-ring):focus-visible .label {
  outline: 2px solid rgba($ink, 0.6);
  outline-offset: 2px;
}
</style>
