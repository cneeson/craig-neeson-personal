<template>
  <Transition>
      <div class="loader">
          <div class="spinner">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
      </div>
  </Transition>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: String,
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.loader {
  height: 100vh;
  width: 100vw;
  @apply flex items-center justify-center;
}

/* we will explain what these classes do next! */
.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
  filter: blur(10px);
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
  filter: blur(10px);
}

.spinner {
   width: 44.8px;
   height: 44.8px;
   animation: spinner-y0fdc1 2.8s infinite ease;
   transform-style: preserve-3d;
}

.spinner > div {
   background-color: rgba(229,231,235,0.2);
   height: 100%;
   position: absolute;
   width: 100%;
   border: 2.2px solid #e5e7eb;
}

.spinner div:nth-of-type(1) {
   transform: translateZ(-22.4px) rotateY(180deg);
}

.spinner div:nth-of-type(2) {
   transform: rotateY(-270deg) translateX(50%);
   transform-origin: top right;
}

.spinner div:nth-of-type(3) {
   transform: rotateY(270deg) translateX(-50%);
   transform-origin: center left;
}

.spinner div:nth-of-type(4) {
   transform: rotateX(90deg) translateY(-50%);
   transform-origin: top center;
}

.spinner div:nth-of-type(5) {
   transform: rotateX(-90deg) translateY(50%);
   transform-origin: bottom center;
}

.spinner div:nth-of-type(6) {
   transform: translateZ(22.4px);
}

@keyframes spinner-y0fdc1 {
   0% {
      transform: rotate(45deg) rotateX(-25deg) rotateY(25deg);
   }

   50% {
      transform: rotate(45deg) rotateX(-385deg) rotateY(25deg);
   }

   100% {
      transform: rotate(45deg) rotateX(-385deg) rotateY(385deg);
   }
}
</style>
