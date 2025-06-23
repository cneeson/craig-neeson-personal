<script lang="ts">
import { computed, defineComponent } from 'vue';
import { format, formatDistanceStrict } from 'date-fns'

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
  return formatDistanceStrict(new Date(props.startDate), props.endDate ? new Date(props.endDate) : new Date());
});
</script>

<template>
    <div class="job-item">
      <div class="flex items-center mb-5">
          <div class="w-[65px] mr-4">
              <img :src="imgSrc" :alt="imgAlt" class="w-full rounded-md" />
          </div>
          <div>
              <a :href="href" target='_blank' class="hover:underline text-white font-bold">
                  <h4 class="text-lg">{{employer}}</h4>
              </a>
              <h5 class="mb-1">{{role}}</h5>
              <p class="text-xs">
                {{`${startFormatted} - ${isCurrent ? 'Present' : endFormatted} | ${timeSinceStart}`}}
              </p>
          </div>
      </div>

      <ul>
        <li v-for="point in keyPoints" :key="point">
          <p class="text-sm lg:text-base">{{ point }}</p>
        </li>
      </ul>
    </div>
</template>

<style scoped>
.job-item {
  background: rgba(169, 169, 169, 0.2);
  border-radius: 5px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(169, 169, 169, 0.3);

  @apply text-white p-7;

  line-height: 1.61;

  ul {
    @apply list-disc ml-4;
    
    li {
      @apply mb-3;
    }
  }
}
</style>
