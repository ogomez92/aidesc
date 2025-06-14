<script setup lang="ts">
import VisionSegment from '@interfaces/vision_segment';
import { VideoService } from '@services/video';
import { ref, Ref, onMounted, defineProps } from 'vue';
import { VideoProcessor } from '@domain/video_processor';
import { useSettingsStore } from '@managers/store';
import VisionProcessingResult from '@interfaces/vision_processing_result';
import ToastMessage from '@components/ToastMessage.vue';
import EventType from '@enums/event_type';
import NotificationBar from '@components/NotificationBar.vue';

const settingsStore = useSettingsStore();

const segmentsArray: Ref<VisionSegment[]> = ref([]);
const fileDuration = ref<string | null>(null)
const toastType = ref<'warning' | 'info'>('info');
const toastMessage = ref('');
const showToast = ref(false);
const showNotification = ref(false);
const notificationMessage = ref('');
const dismissToast = () => {
    showToast.value = false;
};

const saveSegmentsToFile = (async () => {
    const path = await import('path');
    
    const fs = await import('fs');
    try {
        const filePath = await window.ipcRenderer.saveFileDialog(`segments_${path.basename(props.file,path.extname(props.file))}.json`);
        if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(segmentsArray.value, null, 2), { encoding: 'utf8' });

            toastMessage.value = `Segments saved to ${filePath}`;
            toastType.value = "info";
            showToast.value = true;
        }
    } catch (error) {
        toastMessage.value = `Failed to save segments. Error was: ${error}`;
        toastType.value = "warning";
        showToast.value = true;
    }
})

const props = defineProps<{
    file: string;
    segments: string | null;
}>();

onMounted(async () => {
    const videoProcessor = new VideoProcessor(settingsStore.settings);
    const fs = await import('fs');
    const duration: number = await VideoService.getDuration(props.file);
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    fileDuration.value = `${minutes} min ${seconds} sec`;
    if (props.segments) {
        try {
            const segmentsData = JSON.parse(fs.readFileSync(props.segments, 'utf-8'));
            segmentsArray.value = segmentsData;
        } catch (error) {
            console.error('Error reading segments file:', error);
            toastMessage.value = `Failed to load segments. Error was: ${error}`;
            toastType.value = "warning";
            showToast.value = true;
        }
    } else {
        videoProcessor.on(EventType.Progress, (notification: string) => {
            notificationMessage.value = notification;
            showNotification.value = true;
        });

        try {
            const result: VisionProcessingResult = await videoProcessor.generateVisionSegments(props.file);
            notificationMessage.value = `Generated ${result.segments.length} vision segments successfully!`;
            segmentsArray.value = result.segments;
            showNotification.value = true;
        } catch (error) {
            toastMessage.value = `Failed to generate description segments. Error was: ${error}`;
            toastType.value = "warning";
            showToast.value = true;
        }
    }

    
})
</script>

<template>
    <div class="batch-worker">
        <p>Video file: {{ props.file }}</p>
        <p>File duration: {{ fileDuration }}</p>
        <div v-if="segmentsArray.length > 0">
            <p> Segments loaded (number of segments: {{ segmentsArray.length }})</p>
            <a href="#" @click.prevent="saveSegmentsToFile">Download for Later</a>
        </div>
        <p v-else>Generating segments...</p>
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
