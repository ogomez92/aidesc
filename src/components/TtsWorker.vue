<script setup lang="ts">
import VisionSegment from '@interfaces/vision_segment';
import { ref, Ref, onMounted, defineProps } from 'vue';
import { VideoProcessor } from '@domain/video_processor';
import { useSettingsStore } from '@managers/store';
import ToastMessage from '@components/ToastMessage.vue';
import EventType from '@enums/event_type';
import NotificationBar from '@components/NotificationBar.vue';
import TTSProcessingResult from '@interfaces/tts_processing_result';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const settingsStore = useSettingsStore();

const visionSegmentsArray: Ref<VisionSegment[]> = ref([]);
const fileDuration = ref<string | null>(null)
const audioTrack = ref('');
const toastType = ref<'warning' | 'info'>('info');
const toastMessage = ref('');
const showToast = ref(false);
const showNotification = ref(false);
const notificationMessage = ref('');
const dismissToast = () => {
    showToast.value = false;
};

const saveAudioTrack = (async () => {
    const path = await import('path');

    const fs = await import('fs');
    try {
        const filePath = await window.ipcRenderer.saveFileDialog(`description_${path.basename(props.file, path.extname(props.file))}.mp3`);
        if (filePath) {
            await fs.promises.copyFile(audioTrack.value, filePath);
            toastMessage.value = t('generation_audio_track_saved')
            toastType.value = "info";
            showToast.value = true;
        }
    } catch (error) {
        toastMessage.value = t('generation_audio_track_save_fail', { error })
        toastType.value = "warning";
        showToast.value = true;
    }
})

const saveCombinedAudio = (async () => {
    const path = await import('path');
    const fs = await import('fs');

    showToast.value = true;
    toastMessage.value = t('generation_combining')

    const videoProcessor = new VideoProcessor(settingsStore.settings);
    const pathToVideo = await videoProcessor.combineAudioWithVideo(props.file, audioTrack.value)

    try {
        const filePath = await window.ipcRenderer.saveFileDialog(`${path.basename(props.file, path.extname(props.file))}_described_mix.mp4`);
        if (filePath) {
            await fs.promises.copyFile(pathToVideo, filePath);
            toastMessage.value = t('generation_audio_track_saved')
            toastType.value = "info";
            showToast.value = true;
        }
    } catch (error) {
        toastMessage.value = t('generation_audio_track_save_fail', { error })
        toastType.value = "warning";
        showToast.value = true;
    }
})

const props = defineProps<{
    file: string;
    segments: VisionSegment[];
}>();

onMounted(async () => {
    const videoProcessor = new VideoProcessor(settingsStore.settings);

    try {
        videoProcessor.on(EventType.Progress, (notification: string) => {
            notificationMessage.value = notification;
            showNotification.value = true;
        });

        const result: TTSProcessingResult = await videoProcessor.generateTtsSegments(props.segments);
        notificationMessage.value = t('generation_audio_success');
        showNotification.value = true;
        audioTrack.value = result.audioDescriptionFilePath
    } catch (error) {
        toastMessage.value = t('generation_tts_segments_fail', {error});
        toastType.value = "warning";
        showToast.value = true;
    }
})
</script>

<template>
    <div class="batch-worker">
        <p>{{ $t('generation_selected_file') }} {{ props.file }}</p>
        <p>{{ $t('generation_duration') }} {{ fileDuration }}</p>
        <div v-if="visionSegmentsArray.length > 0">
            <p> {{  $t('generation_segments_loaded', {segmentsAmount: visionSegmentsArray.length}) }})</p>
        </div>
        <div v-if="audioTrack">
            <p role="alert">{{ $t('generation_audio_success') }}</p>
            <a href="#" @click.prevent="saveAudioTrack">{{  $t('generation_download_description') }}</a>
            <a href="#" @click.prevent="saveCombinedAudio">{{  $t('generation_download_mix') }}</a>
        </div>
    </div>
    <ToastMessage v-if="showToast" :message="toastMessage" :type="toastType" :visible="showToast"
        @dismiss="dismissToast" />
    <NotificationBar v-if="showNotification" :message="notificationMessage" :visible="showNotification" />
</template>

<style scoped>
.batch-worker {
    padding: 2rem;
    background: #f8f9fa;
    border-radius: 8px;
    margin: 2rem 0;
}
</style>
