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

const props = defineProps<{
}>();

</script>

<template>
    <div class="skills" data-speed="0.8">
      <div class="left">
        <h2>Skills</h2>
        <p>
          Working on UI code is my passion in software development. I have extensive experience architecting and implementing UIs for the web and mobile using a variety of development setups. I have a deep knowledge of JavaScript/Typescript and am just as comfortable working in vanilla JS as with a UI framework. I have architected web projects from the ground up and enjoy working with teams to strategise around solutions to some of the more challenging parts of UI design. I have experience working both as an individual contributor who owns the full frontend, and also as one of many team-players who all have a stake in the codebase.
        </p>
      </div>

      <Divider />

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
