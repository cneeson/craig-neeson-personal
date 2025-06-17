<script lang="ts">
import { defineComponent } from 'vue';
import Divider from '../components/divider.vue';

export default defineComponent({
    name: 'Contact'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>

const props = defineProps<{
}>();

</script>

<template>
    <div class="skills" data-speed="0.8">
      <div class="left">
        <h2>Get in touch</h2>
        <p>
          I am currently open to hybrid Senior Frontend Developer roles based in Dublin and Belfast. I'd love to hear from you.
        </p>
      </div>

      <Divider />

      <div class="right">
        <a href="https://www.linkedin.com/in/craig-neeson-b2808278" target="_blank">
            <img src="images/contacts/linkedin.svg" alt="LinkedIn" class="linkedin">
        </a>
        <a href="mailto:craigneeson@hotmail.co.uk" target="_blank">
            <img src="images/contacts/email.svg" alt="Email">
        </a>
        <a href="https://github.com/cneeson" target="_blank">
            <img src="images/contacts/github.svg" alt="GitHub">
        </a>
      </div>
    </div>
</template>

<style scoped>
.skills {
  @apply flex justify-around gap-12 items-center;
  margin-bottom: 14.5rem;
}

h2 {
    @apply text-3xl mb-6 text-white;
}

.left {
  max-width: 600px;

  p {
    @apply text-white ml-4 text-lg;
  }
}

.right {
  @apply flex-1 flex gap-6 flex-wrap justify-around;

  img {
    @apply hover:scale-125 transition-all duration-100 h-[52px] w-[52px] cursor-pointer;

    &.linkedin {
        @apply h-[62px] w-[62px];
    }
  }
}
</style>
