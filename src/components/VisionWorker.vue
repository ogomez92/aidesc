<script setup lang="ts">
import VisionSegment from '@interfaces/vision_segment';
import { VideoService } from '@services/video';
import { inject, ref, Ref, onMounted } from 'vue';
import { VideoProcessor } from '@domain/video_processor';
import { useSettingsStore } from '@managers/store';
import VisionProcessingResult from '@interfaces/vision_processing_result';
import ToastMessage from '@components/ToastMessage.vue';
import EventType from '@enums/event_type';
import NotificationBar from '@components/NotificationBar.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const settingsStore = useSettingsStore();
const soundManager = inject('soundManager');

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
        const filePath = await window.ipcRenderer.saveFileDialog(`${path.basename(props.file, path.extname(props.file))}_description.json`);
        if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(segmentsArray.value, null, 2), { encoding: 'utf8' });

            toastMessage.value = t('generation_segmentsSaved', {filePath})
            toastType.value = "info";
            showToast.value = true;
        }
    } catch (error) {
        toastMessage.value = t('generation_segments_fail', {error});
        toastType.value = "warning";
        showToast.value = true;
    }
})

const props = defineProps<{
    file: string;
    instantMode: boolean;
    segments: string | null;
}>();

onMounted(async () => {
    try {
        const videoProcessor = new VideoProcessor(settingsStore.settings);
        const duration: number = await VideoService.getDuration(props.file);
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        fileDuration.value = `${minutes} min ${seconds} sec`;

        videoProcessor.on(EventType.Progress, (notification: string) => {
            notificationMessage.value = notification;
            showNotification.value = true;
        });

        const result: VisionProcessingResult = await videoProcessor.generateVisionSegments(props.file);
        if (!props.instantMode) {
            notificationMessage.value = t('generation_segments_generated', {segmentsAmount: result.segments.length})
            showNotification.value = true;
            segmentsArray.value = result.segments;
            await soundManager.playSound('done');
        } else {
            notificationMessage.value = result.segments.map(segment => segment.description).join('\n');
            showNotification.value = true;
            const fs = await import('fs');
            fs.unlinkSync(props.file);
        }
    } catch (error) {
        toastMessage.value = t('generation_description_fail', {error})
        toastType.value = "warning";
        showToast.value = true;
    }
})
</script>

<template>
    <div class="batch-worker">
        <p>{{ $t('generation_selected_file') }} {{ props.file }}</p>
        <p>{{ $t('generation_duration') }} {{ fileDuration }}</p>
        <div v-if="segmentsArray.length > 0">
            <p> {{ $t('generation_segments_loaded', { segmentsAmount: segmentsArray.length }) }}).</p>
            <a href="#" @click.prevent="saveSegmentsToFile">{{  $t('generation_segments_download') }}</a>
        </div>
        <p v-else>{{  $t('generation_generating_segments') }}</p>
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
