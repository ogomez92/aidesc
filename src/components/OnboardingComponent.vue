<script setup lang="ts">
import SettingsViewer from './SettingsViewer.vue';
</script>

<template>
  <h1>{{$t('onboarding_welcome') }}</h1>
  <p>{{ $t('onboarding_settings_confirm') }}</p>
<p>{{ $t('onboarding_necessary_steps') }}</p>
<SettingsViewer />
</template>

<style scoped></style>
