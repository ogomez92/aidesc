<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
  file: string;
  segments: string | null;
}>();
</script>

<template>
  <div class="batch-worker">
  </div>
</template>

<style scoped>
.batch-worker {
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 2rem 0;
}
</style>
