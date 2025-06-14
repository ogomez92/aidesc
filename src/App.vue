<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSettingsStore } from './managers/store';
import OnboardingComponent from '@components/OnboardingComponent.vue';
import SettingsViewer from '@components/SettingsViewer.vue';
import Tabs from '@components/Tabs.vue'; // Added import
import BatchMode from '@components/BatchMode.vue'; // Added import
import SystemStatus from '@components/SystemStatus.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n() 

const settingsStore = useSettingsStore();
const showOnboarding = computed(() => !settingsStore.isInitialized);

// Tab configuration
const tabs = [
    { title: 'Generate Description', component: BatchMode},
    { title: 'Settings', component: SettingsViewer },
];

onMounted(() => {
    settingsStore.loadSettings();
});
</script>

<template>
    <div v-if="showOnboarding">
        <OnboardingComponent />
    </div>
    <div v-else>
        <Tabs :tabs="tabs" />
    </div>
    <SystemStatus />
</template>