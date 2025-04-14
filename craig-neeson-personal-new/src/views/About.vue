<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-3xl font-bold text-blue-700 mb-6">About Page</h1>
    <p class="text-gray-700 mb-4">
      This is the about page of our Vue.js application built with Vue 3, Vue Router, Pinia, and Tailwind CSS.
    </p>
    <div class="bg-blue-100 p-4 rounded-lg shadow">
      <h2 class="text-xl font-semibold text-blue-800 mb-2">Counter Demo</h2>
      <p class="mb-2">Current count: <span class="font-bold">{{ counter.count }}</span></p>
      <p class="mb-4">Double count: <span class="font-bold">{{ counter.doubleCount }}</span></p>
      <div class="flex space-x-2">
        <button 
          @click="counter.increment()" 
          class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Increment
        </button>
        <button 
          @click="counter.decrement()" 
          class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
        >
          Decrement
        </button>
        <button 
          @click="counter.reset()" 
          class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useCounterStore } from '../stores/counter'

export default {
  name: 'AboutView',
  setup() {
    const counter = useCounterStore()
    
    return {
      counter
    }
  }
}
</script>

