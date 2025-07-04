<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    name: 'Experience'
});

</script>
<script lang="ts" setup>
import Heading from './heading.vue';
import JobItem from './job-item.vue';

</script>

<template>
    <div class="experience">
      <Heading class="experience-heading">Experience</Heading>

      <div class="experience__items">
        <div class="experience__item" data-animate="slide-in">
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
                `Worked with Vue and Nuxt to develop features for marketplace, order-fulfillment, and backoffice platforms, focusing on shipping and logistics. `,
                `Key projects included developing tools to track shipments, visualize stock movements and visualise prospective shops in an interactive map view. `,
                `Participated in company-wide projects such as re-brandings, Vue to Nuxt migrations, sale and event-related implementations, and new business model changes.`,
                `Collaborated closely with product and data engineers to deliver analytics tracking for all features, allowing a data-driven approach to product development.`,
            ]"
          />
        </div>

        <div class="experience__item" data-animate="slide-in">
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
                'Led the modernization of UI for this healthcare start-up’s web and mobile apps, setting ambitious technical goals that transformed development.',
                'Set front-end standards and upskilled the team to accelerate delivery and reduce tech debt.',
                'Drove architecture changes to shift the LAL platform from a legacy stack to a server-rendered React stack.',
                'Built LAL’s first fully documented React component library with a new UX designer, refreshing the brand.',
                'Created maintainable patterns for API data retrieval and caching, reducing boilerplate and improving state separation.',
                'Abstracted repeated data-fetching logic into shared NPM packages for React and React Native.',
                'Introduced TypeScript to UI repos, boosting code robustness; 40% of the codebase is now in TS.',
                'Delivered new modules for leave management, scheduling, clock-in, and payroll across web and mobile.'
            ]"
          />
        </div>

        <div class="experience__item" data-animate="slide-in">
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


        <div class="experience__item" data-animate="slide-in">
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


        <div class="experience__item" data-animate="slide-in">
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


        <div class="experience__item" data-animate="slide-in">
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

        <div class="experience__item" data-animate="slide-in">
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

<style lang="scss" scoped>
.experience {
  margin-bottom: 14.5rem;
}

hr {
  @apply my-8;
}

.experience__items {
  @apply flex flex-col gap-4;

  .experience__item {
    @apply mx-4 mb-6;
  }
}

.experience-heading {
  @apply ml-2;
}
</style>
