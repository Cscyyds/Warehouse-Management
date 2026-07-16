<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
  marker?: string
}>()
</script>

<template>
  <header class="page-header">
    <div>
      <div class="page-header__eyebrow">{{ eyebrow }}</div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </div>
    <div v-if="marker" class="page-header__marker mono-label">{{ marker }}</div>
  </header>
</template>
