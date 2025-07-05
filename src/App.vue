<script setup lang="ts">
import { computed, onMounted, provide } from 'vue';
import { useSettingsStore } from './managers/store';
import OnboardingComponent from '@components/OnboardingComponent.vue';
import SettingsViewer from '@components/SettingsViewer.vue';
import Tabs from '@components/Tabs.vue'; // Added import
import VisionGeneration from '@components/VisionGeneration.vue';
import TtsGeneration from '@components/TtsGeneration.vue';
import ContinuousMode from '@components/ContinuousMode.vue';
import SystemStatus from '@components/SystemStatus.vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n() 
import SoundManager from '@managers/sound_manager';
import VideoPlayer from '@components/VideoPlayer.vue';
const soundManager = new SoundManager

const settingsStore = useSettingsStore();
const showOnboarding = computed(() => !settingsStore.isInitialized);

// Tab configuration
const tabs = [
    { title: t('vision_generation_title'), component: VisionGeneration},
    { title: t('tts_generation_title'), component: TtsGeneration },
    { title: t('video_player_title'), component: VideoPlayer},
    { title: t('settings_title'), component: SettingsViewer },
        { title: t('continuous_title'), component: ContinuousMode},
];

provide('soundManager', soundManager);
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