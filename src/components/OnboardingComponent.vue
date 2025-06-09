<script setup lang="ts">
import SettingsViewer from './SettingsViewer.vue';
</script>

<template>
  <h1>Welcome!</h1>
  <p>Let's start by confirming your settings.</p>
<p>You need to add, at least, one API key for a vision model and another for a tts model, unless you plan to use ARIA or clipboard output as your tts model.</p>
  <SettingsViewer />
</template>

<style scoped></style>
