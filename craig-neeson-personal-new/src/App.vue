<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation Bar -->
    <nav class="bg-blue-600 text-white shadow-md">
      <div class="max-w-6xl mx-auto px-4">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <img alt="Vue logo" src="./assets/logo.png" class="h-8 w-8 mr-2">
            <span class="font-bold text-lg">Vue Project</span>
          </div>
          <div class="flex space-x-4 items-center">
            <router-link 
              to="/" 
              class="px-3 py-2 rounded-md hover:bg-blue-700 transition"
              active-class="bg-blue-700 font-medium"
            >
              Home
            </router-link>
            <router-link 
              to="/about" 
              class="px-3 py-2 rounded-md hover:bg-blue-700 transition"
              active-class="bg-blue-700 font-medium"
            >
              About
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto mt-6 p-4">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
