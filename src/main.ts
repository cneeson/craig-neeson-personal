import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'

// Import Tailwind CSS
import './assets/tailwind.css'

// Create the app instance
const app = createApp(App)

// Create and use Pinia for state management
const pinia = createPinia()
app.use(pinia)

// Use the router
app.use(router)

// Mount the app
app.mount('#app')
