<script lang="ts">
import { defineComponent } from 'vue';
import Divider from '../components/divider.vue';
import Heading from './heading.vue';

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
    <div class="contact" data-speed="0.8">
      <div class="left">
        <Heading>Contact</Heading>
        <p class="mb-4">
          I am currently open to hybrid Senior Frontend Developer roles based in Dublin and Belfast. I'd love to hear from you.
        </p>
        
        <p class="mb-10">
          Please feel free to take a copy of my CV with you.
        </p>
        <a href="docs/craig-neeson-cv.pdf" download>
          <button class="btn ml-4">
            <i class="animation"></i>Download my CV<i class="animation"></i>
          </button>
        </a>
      </div>

      <Divider class="h-[215px] hidden md:block" />

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
.contact {
  @apply flex justify-around gap-12 items-center flex-wrap;
}

h2 {
    @apply text-3xl mb-6 text-white;
}

.left {
  flex: 1;
  
  p {
    @apply text-white text-base lg:text-lg;
  }
}

.right {
  @apply flex-1 flex gap-6 flex-wrap justify-around;

  min-width: 300px;

  img {
    @apply hover:scale-125 transition-all duration-100 h-[52px] w-[52px] cursor-pointer;

    &.linkedin {
        @apply h-[62px] w-[62px];
    }
  }
}

button {
  outline: 0;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  background: #191752;
  min-width: 200px;
  border: 0;
  border-radius: 1rem;
  box-shadow: 0px 0px 22px 1px rgba(255,255,255,0.9);
  box-sizing: border-box;
  padding: 16px 20px;
  color: #fff;
  font-size: 1.25rem;
  font-family: Funnel Display, Helvetica, Arial, sans-serif;
  font-weight: 600;
  overflow: hidden;
  cursor: pointer;
}

button:hover {
  opacity: .95;
}

button .animation {
  border-radius: 100%;
  animation: ripple 0.6s linear infinite;
}

@keyframes ripple {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.1), 0 0 0 20px rgba(255, 255, 255, 0.1), 0 0 0 40px rgba(255, 255, 255, 0.1), 0 0 0 60px rgba(255, 255, 255, 0.1);


  }

  100% {
    box-shadow: 0 0 0 20px rgba(255, 255, 255, 0.1), 0 0 0 40px rgba(255, 255, 255, 0.1), 0 0 0 60px rgba(255, 255, 255, 0.1), 0 0 0 80px rgba(255, 255, 255, 0);
  }
}
</style>
