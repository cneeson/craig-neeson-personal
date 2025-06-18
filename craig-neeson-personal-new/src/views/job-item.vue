<script lang="ts">
import { computed, defineComponent } from 'vue';
import { format, formatDistanceToNow } from 'date-fns'

export default defineComponent({
    name: 'JobItem'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>


const props =defineProps<{
  employer: string;
  role: string;
  startDate: string;
  endDate: string;
  href: string;
  imgSrc: string;
  imgAlt: string;
  keyPoints: string[];
  isCurrent?: boolean;
}>();

const startFormatted = computed(() => {
  return format(new Date(props.startDate), 'MMM yyyy');
});

const endFormatted = computed(() => {
  return format(new Date(props.endDate), 'MMM yyyy');
});

const timeSinceStart = computed(() => {
  return formatDistanceToNow(new Date(props.startDate));
});
</script>

<template>
    <div class="job-item">
      <div class="flex items-center mb-4">
          <div class="w-20 mr-4">
              <img :src="imgSrc" :alt="imgAlt" class="w-full rounded-md" />
          </div>
          <div>
              <a :href="href" target='_blank' class="hover:underline text-white font-bold">
                  <h4 class="mb-1 text-lg">{{employer}}</h4>
              </a>
              <h5 class="mb-1">{{role}}</h5>
              <p class="text-sm">
                {{`${startFormatted} - ${isCurrent ? 'Present' : endFormatted} | ${timeSinceStart}`}}
              </p>
          </div>
      </div>

      <ul>
        <li v-for="point in keyPoints" :key="point">
          <p>{{ point }}</p>
        </li>
      </ul>
    </div>
</template>

<style scoped>
.job-item {
  @apply text-white;

  line-height: 1.61;

  ul {
    @apply list-disc;
    
    li {
      @apply mb-2;
    }
  }
}
</style>
