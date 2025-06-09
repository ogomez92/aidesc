<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSettingsStore } from './managers/store';
import OnboardingComponent from '@components/OnboardingComponent.vue';
import SettingsViewer from '@components/SettingsViewer.vue';

const settingsStore = useSettingsStore();
const showOnboarding = computed(() => !settingsStore.isInitialized);

onMounted(() => {
    settingsStore.loadSettings();
});
</script>

<template>
    <div v-if="showOnboarding">
        <OnboardingComponent />
    </div>
    <div v-else>
        <p>No onboarding</p>
    </div>
    <SettingsViewer />
</template>