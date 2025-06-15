<script setup lang="ts">
import VisionSegment from '@interfaces/vision_segment';
import { ref, Ref, onMounted, defineProps } from 'vue';
import { VideoProcessor } from '@domain/video_processor';
import { useSettingsStore } from '@managers/store';
import ToastMessage from '@components/ToastMessage.vue';
import EventType from '@enums/event_type';
import NotificationBar from '@components/NotificationBar.vue';
import TTSProcessingResult from '@interfaces/tts_processing_result';

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
            toastMessage.value = `Audio track saved!`;
            toastType.value = "info";
            showToast.value = true;
        }
    } catch (error) {
        toastMessage.value = `Failed to save audio track. Error was: ${error}`;
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
    // const duration: number = await VideoService.getDuration(props.file);
    // const minutes = Math.floor(duration / 60);
    // const seconds = Math.floor(duration % 60);
    // fileDuration.value = `${minutes} min ${seconds} sec`;

    try {
        videoProcessor.on(EventType.Progress, (notification: string) => {
            notificationMessage.value = notification;
            showNotification.value = true;
        });

        const result: TTSProcessingResult = await videoProcessor.generateTtsSegments(props.segments);
        notificationMessage.value = `Generated audio track successfully!`;
        showNotification.value = true;
        audioTrack.value = result.audioDescriptionFilePath
    } catch (error) {
        toastMessage.value = `Failed to generate audio segments. Error was: ${error}`;
        toastType.value = "warning";
        showToast.value = true;
    }
})
</script>

<template>
    <div class="batch-worker">
        <p>Video file: {{ props.file }}</p>
        <p>File duration: {{ fileDuration }}</p>
        <div v-if="visionSegmentsArray.length > 0">
            <p> Segments loaded (number of segments: {{ visionSegmentsArray.length }})</p>
        </div>
        <div v-if="audioTrack">
            <p role="alert">Audio track generated!</p>
            <a href="#" @click.prevent="saveAudioTrack">Download for Later</a>
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
