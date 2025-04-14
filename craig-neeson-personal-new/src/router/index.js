import { createRouter, createWebHistory } from 'vue-router'
import HelloWorld from '../components/HelloWorld.vue'
import About from '../views/About.vue'

// Define routes
const routes = [
  { path: '/', component: HelloWorld, props: { msg: 'Welcome to Your Vue.js App' } },
  { path: '/about', component: About }
]

// Create router instance
const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

