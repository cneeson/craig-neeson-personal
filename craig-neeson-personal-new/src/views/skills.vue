<script lang="ts">
import { defineComponent } from 'vue';

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
    <div class="skills" data-lag="0.8">
      <div class="left">
        <Heading>Skills</Heading>
        <p>
          I'm passionate about UI development and have extensive experience designing and building web and mobile interfaces. With deep expertise in JavaScript/TypeScript, I'm comfortable working in both vanilla JS and modern frameworks.
        </p>
        <p>
          I've led frontend architecture from scratch and thrive in collaborative environments—whether owning the entire UI or contributing as part of a team tackling complex design challenges.
        </p>
      </div>

      <Divider class="h-[300px]" />

      <div class="right">
        <SkillItem icon="images/skills/ts.svg">Typescript</SkillItem>
        <SkillItem icon="images/skills/js.svg">Javascript</SkillItem>
        <SkillItem icon="images/skills/react.svg">React</SkillItem>
        <SkillItem icon="images/skills/vue.svg">Vue</SkillItem>
        <SkillItem icon="images/skills/nuxt.svg">Nuxt</SkillItem>
        <SkillItem icon="images/skills/css.svg">CSS</SkillItem>
        <SkillItem icon="images/skills/html.svg">HTML</SkillItem>
        <SkillItem icon="images/skills/tailwind.svg">Tailwind</SkillItem>
        <SkillItem icon="images/skills/node.svg">Node</SkillItem>
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
  @apply flex-1 flex flex-col gap-5 flex-wrap max-h-[300px];
}
</style>
