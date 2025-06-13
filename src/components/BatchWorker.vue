<script setup lang="ts">
import VisionSegment from '@interfaces/vision_segment';
import { VideoService } from '@services/video';
import { ref, onMounted, defineProps } from 'vue';

let segmentsArray: VisionSegment[] = [];
const fileDuration = ref<string | null>(null)
const toastType = ref<'warning' | 'info'>('info');
const toastMessage = ref('');
const showToast = ref(false);
const dismissToast = () => {
    showToast.value = false;
};

const props = defineProps<{
    file: string;
    segments: string | null;
}>();

onMounted(async () => {
    const fs = await import('fs');
    const duration: number = await VideoService.getDuration(props.file);
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    fileDuration.value = `${minutes} min ${seconds} sec`;
    if (props.segments) {
        try {
            const segmentsData = JSON.parse(fs.readFileSync(props.segments, 'utf-8'));
            segmentsArray = segmentsData['segments'];
        } catch (error) {
            console.error('Error reading segments file:', error);
            toastMessage.value = `Failed to load segments. Error was: ${error}`;
            toastType.value = "warning";
            showToast.value = true;
        }
    } else {
    }
})
</script>

<template>
    <div class="batch-worker">
        <p>Video file: {{ props.file }}</p>
        <p>File duration: {{ fileDuration }}</p>
        <p v-if="segmentsArray.length > 0">Segments loaded</p>
        <p v-else>Generating segments...</p>

    </div>
      <ToastMessage v-if="showToast" :message="toastMessage" :type="toastType" :visible="showToast"
    @dismiss="dismissToast" />

</template>

<style scoped>
.batch-worker {
    padding: 2rem;
    background: #f8f9fa;
    border-radius: 8px;
    margin: 2rem 0;
}
</style>
