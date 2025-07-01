<script lang="ts">
import { defineComponent, onMounted } from 'vue';

export default defineComponent({
    name: 'Skills'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import SkillItem from './skill-item.vue'
import Divider from '../components/divider.vue';
import Heading from './heading.vue';

const props = defineProps<{
}>();
</script>

<template>
    <div class="skills">
      <div class="left">
        <Heading>Skills</Heading>
        <p class="mb-2">
          I'm passionate about UI development and have extensive experience designing and building web and mobile interfaces. With deep expertise in JavaScript/TypeScript, I'm comfortable working in both vanilla JS and modern frameworks.
        </p>
        <p>
          I've led frontend architecture from scratch and thrive in collaborative environments—whether owning the entire UI or contributing as part of a team tackling complex design challenges.
        </p>
      </div>

      <Divider class="h-[300px] hidden md:block" />

      <div class="right">
        <SkillItem icon="images/skills/ts.svg">Typescript</SkillItem>
        <SkillItem icon="images/skills/js.svg">Javascript</SkillItem>
        <SkillItem icon="images/skills/react.svg">React</SkillItem>
        <SkillItem icon="images/skills/vue.svg">Vue</SkillItem>
        <SkillItem icon="images/skills/nuxt.svg">Nuxt</SkillItem>
        <SkillItem icon="images/skills/css.svg">CSS</SkillItem>
        <SkillItem icon="images/skills/html.svg">HTML</SkillItem>
        <SkillItem icon="images/skills/tailwind.svg">Tailwind</SkillItem>
        <SkillItem icon="images/skills/threejs.svg">ThreeJS</SkillItem>
        <SkillItem icon="images/skills/node.svg">Node</SkillItem>
      </div>
    </div>
</template>

<style scoped>
.skills {
  @apply flex justify-around gap-12 items-center flex-wrap;
  margin-bottom: 14.5rem;
}

h2 {
  @apply text-3xl mb-6 text-white;
}

.left {
  max-width: 600px;
  min-width: 300px;
  flex: 1;
  @apply pr-8 lg:pr-0;

  p {
    @apply text-white text-base lg:text-lg;
  }
}

.right {
  @apply flex-1 flex flex-col gap-5 flex-wrap max-h-[300px] min-w-[420px] max-w-[600px];
}

</style>
