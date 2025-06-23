<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import { gsap } from "gsap";
import { Observer } from 'gsap/Observer';

export default defineComponent({
    name: 'Experience'
});

export const totalTransitionDuration = 2000;
</script>
<script lang="ts" setup>
import Heading from './heading.vue';
import JobItem from './job-item.vue';

const props = defineProps<{
}>();

onMounted(() => {
let sections = gsap.utils.toArray(".carousel-item");
let dragRatio = 1;
let scrollTo;

let scrollTween = gsap.to(sections, {
  xPercent: -100 * (sections.length - 1),
  ease: "none", // <-- IMPORTANT!
  scrollTrigger: {
    start: window.innerHeight > 1000 ? 'top 25%' : 'top 2%',
    trigger: ".carousel",
    pin: true,
    scrub: 0.1,
    onRefresh: (self) => {
      dragRatio =
        (self.end - self.start) /
        ((sections.length - 1) * sections[0].offsetWidth);
    },
    snap: directionalSnap(1 / (sections.length - 1)),
    end: "+=3000"
  }
});

Observer.create({
  target: ".experience-heading",
  type: "wheel,touch,pointer",
  onPress: (self) => {
    self.startScroll = scrollTween.scrollTrigger.scroll();
    scrollTo = gsap.quickTo(scrollTween.scrollTrigger, "scroll", {
      duration: 0.5,
      ease: "power3"
    });
  },
  onDrag: (self) => {
    scrollTo(self.startScroll + (self.startX - self.x) * dragRatio);
  }
});

// helper function for causing the sections to always snap in the direction of the scroll (next section) rather than whichever section is "closest" when scrolling stops.
function directionalSnap(increment) {
  let snapFunc = gsap.utils.snap(increment);
  return (raw, self) => {
    let n = snapFunc(raw);
    return Math.abs(n - raw) < 1e-4 || (n < raw) === self.direction < 0 ? n : self.direction < 0 ? n - increment : n + increment;
  };
}

});

</script>

<template>
    <div class="experience" data-speed="0.8">
      <Heading class="experience-heading">Experience</Heading>

      <div class="carousel">
        <div class="carousel-item">
          <JobItem
            class="item1"
            employer='Ankorstore'
            role='Senior Frontend Engineer'
            startDate='2021-10-01'
            isCurrent
            href='https://www.ankorstore.com/'
            imgSrc='images/employers/aks.png'
            imgAlt='ankorstore-logo'
            :keyPoints="[
                `Joined Ankorstore during a period of rapid growth, scaling from 50 to 400 employees in one year. Attracted to their mission to support brick-and-mortar shops against large online competitors. `,
                `Worked with Vue and Nuxt to develop features for marketplace, order-fulfillment, and backoffice platforms, focusing on shipping and logistics. Key projects included enabling users to compare and select carrier quotes, track shipments, and visualize stock movements. `,
                `Participated in company-wide projects such as re-brandings, Vue to Nuxt migrations, offer-system implementations, and new business model changes.`,
                `Collaborated closely with product and data engineers to deliver analytics tracking for all features, allowing a data-driven approach to product development.`,
            ]"
          />
        </div>


        <div class="carousel-item">
          <JobItem
            class="item2"
            employer='Locate a Locum'
            role='Software Developer'
            startDate='2019-10-01'
            endDate='2021-10-01'
            href='https://locatealocum.com/'
            imgSrc='images/employers/lal.png'
            imgAlt='lal-logo'
            :keyPoints="[
                `Led the modernization of UI for this healthcare start-up's web and mobile apps, setting ambitious yet achievable technical goals that transformed UI development.`,
                'Worked with developers to set front-end standards and upskilled team members to enable faster feature development and tackle existing tech debt more effectively.',
                'Drove key architecture changes to allow us to move the LAL platform from a legacy web-app stack to a partially serverside-rendered React stack.',
                `Established LALs first fully documented React component library, working with a newly hired UX designer to refresh the Locate a Locum brand.`,
                `Developed maintainable patterns for data retrieval and caching from our API, promoting better separation of server and client state and reducing boilerplate code.`,
                'Identified opportunities to abstract duplicated data-fetching code into NPM packages which are now shared between React and React Native repos.',
                'Introduced TypeScript to UI repositories, enhancing code robustness and reducing bugs. Currently, 40% of the main codebase is in TS.',
                'Alongside process improvement, I delivered new web and mobile modules for employee leave management, scheduling, clock-in, and payroll processing.'
            ]"
          />
        </div>


        <div class="carousel-item">
          <JobItem
            class="item3"
            employer='Flexera'
            role='UI Engineer & Associate UI Engineer'
            startDate='2018-09-01'
            endDate='2019-11-01'
            href='https://www.flexera.com/'
            imgSrc='images/employers/flexera.png'
            imgAlt='flexera-logo'
            :keyPoints="[
                'Worked as part of a global team to build UIs for 8 different products, used by many of the worlds Fortune 50 companies.',
                'Worked in close collaboration with UX designers to create Flexera\'s first component library with the aim of bringing visual consistency and behaviour to many newly acquired products.',
                'Standardised design token usage and UI behaviours via a component library, balancing design consistency and flexibility for future use cases.',
                'Worked with various acquisition teams, gaining exposure to different UI development approaches and technology stacks.',
                'Worked across many interesting and technically challenging products including a portal to visualise one of the worlds largest technology asset datasets, a dashboard to visualise and optimise Azure, AWS & GCP cloud resource costs, and a network-security monitoring system.'
            ]"
          />
        </div>


        <div class="carousel-item">
          <JobItem
            class="item4"
            employer='Nitec Solutions'
            role='Software Developer'
            startDate='2017-11-01'
            endDate='2018-10-01'
            href='https://www.nitec.com/'
            imgSrc='images/employers/nitec.png'
            imgAlt='nitec-solutions-logo'
            :keyPoints="[
                'Worked in a small consultancy team to deliver full-stack solutions for many businesses in Northern Ireland.',
                'Delivered end-to-end sales, billing and production management systems for two large concrete factories. The systems integrated directly with production-line firmware and tracked vehicles in real-time, allowing coordinators to have a birds eye view of their operations.',
                'Developed internal processes, including CI pipelines, private package registries, and a modular front-end component system using vanilla JavaScript and Handlebars.'
            ]"
          />
        </div>


        <div class="carousel-item">
          <JobItem
            class="item5"
            employer='Liberty Information Technology'
            role='Associate Software Engineer'
            startDate='2017-06-01'
            endDate='2017-12-01'
            href='https://www.liberty-it.co.uk/'
            imgSrc='images/employers/lit.png'
            imgAlt='lit-logo'
            :keyPoints="[
                'Worked on an integrations team to build the highly scalable infrastructure behind a greenfield insurance product.',
                'Gained exposure to many different languages (Kotlin, TypeScript & Scala) and AWS resources (Lambda, SQS & SNS) due to the sprawling micro-service architecture.',
                'Had my first experience of Agile at scale, LIT had adopted the SAFe Agile methodology.',
            ]"
          />
        </div>


        <div class="carousel-item">
          <JobItem
            class="item6"
            employer='Nitec Solutions'
            role='Placement Developer'
            startDate='2015-06-01'
            endDate='2016-10-01'
            href='https://www.nitec.com/'
            imgSrc='images/employers/nitec.png'
            imgAlt='nitec-solutions-logo'
            :keyPoints="[
                'Gained exposure to older stacks (classic ASP, Microsoft Silverlight) as well as newer ones (.NET MVC apps, SPAs) due to the varying range of client projects and setups.',
                'Developed an agent program and UI to monitor backup status of client servers and desktops. Later, built the first version of a customer portal for real-time backup visualization, which remains in daily use by many of Nitec\'s customers.',
                'Helped to build a custom document management solution for an occupational therapy clinic in Belfast.',
                'Helped to build a production management system for Northern Irelands largest plastics manufacturer.',
            ]"
          />
        </div>

        <div class="carousel-item">
          <JobItem
            class="item7"
            employer='Nitec Solutions'
            role='Placement Student'
            startDate='2012-07-01'
            endDate='2012-09-01'
            href='https://www.nitec.com/'
            imgSrc='images/employers/nitec.png'
            imgAlt='nitec-solutions-logo'
          />
        </div>
    </div>

    </div>
</template>

<style scoped>
.experience {
 /* @apply ml-5; */
}

h2 {
  @apply text-3xl text-white;
}

.right {
  @apply flex-1 flex flex-col gap-5 flex-wrap max-h-[300px];
}

hr {
  @apply my-8;
}

.carousel {
  @apply w-[700vw] md:w-[450vw] h-[100vh] flex flex-wrap gap-6;
}

.carousel-item {
  @apply w-[100vw] md:w-[50vw] md:max-w-[670px];
  height: fit-content;
}
</style>
