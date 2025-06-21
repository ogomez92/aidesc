<template>
  <div class="process-video-container">
    <h2>{{ $t('vision_generation_title') }}</h2>
  </div>
  <p>{{ $t('vision_generation_instructions') }}</p>
  <div v-if="!continueClicked" class="file-controls">
    <button class="btn btn-primary" @click="openFile">
      {{ selectedFile ? t('tts_generation_change_file') : t('tts_generation_select_file') }}
    </button>
    <div v-if="selectedFile" class="selected-file">
      <h3>{{  $t('generation_selected_file') }}</h3>
      <p class="file-path">{{ selectedFile }}</p>
      <p class="file-path">{{ fileDuration }}</p>
    </div>
    
    <p class="confirmation">{{ confirmMessage }}</p>
    <button :disabled="!selectedFile" class="btn btn-secondary" @click="clickContinue">
      {{ $t('button_continue') }}
    </button>
  </div>
  <VideoRecorder @recording_finished="handleCameraVideo" />
  <VisionWorker v-if="continueClicked" :file="selectedFile || ''" :instantMode="instantMode"
    :segments="selectedSegmentsFile" />
  <ToastMessage v-if="showToast" :message="toastMessage" :type="toastType" :visible="showToast"
    @dismiss="dismissToast" />

</template>

<script setup lang="ts">
import { useSettingsStore } from '@managers/store';
import VisionWorker from '@components/VisionWorker.vue';
import { Settings } from '@interfaces/settings';
import { ref } from 'vue'
import ToastMessage from './ToastMessage.vue'
import { VideoService } from '@services/video'
import VideoRecorder from '@components/VideoRecorder.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const settingsStore = useSettingsStore();

const settings: Settings = settingsStore.settings;
// Reactive state
const selectedFile = ref<string | null>(null)
const selectedSegmentsFile = ref<string | null>(null)
const fileDuration = ref<string | null>(null)
const instantMode = ref(false);
const toastType = ref<'warning' | 'info'>('info');
const continueClicked = ref(false);
const toastMessage = ref('');
const showToast = ref(false);
const videoFromCamera = ref<string | null>(null);
const dismissToast = () => {
  showToast.value = false;
};

const clickContinue = () => {
  instantMode.value = false;
  continueClicked.value = true;
}

const handleCameraVideo = async (videoURL: string) => {
  try {
    videoFromCamera.value = videoURL;
    const fs = await import('fs');
    const path = await import('path');

    const tempDir = await window.ipcRenderer.invoke('get-temp-path', 'aidesc-temp');
    const videoFilePath = path.join(tempDir, 'camera_video.webm'); // Ensure correct file extension

    // Fetch the blob data using the Object URL
    const response = await fetch(videoURL);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Convert arrayBuffer to Buffer and write to a file
    fs.writeFileSync(videoFilePath, await Buffer.from(arrayBuffer));

    // the conversion to mp4 is necessary because otherwise ffprobe can't get the duration
    await VideoService.convertToMp4(videoFilePath, path.join(tempDir, 'camera_video.mp4'));
    selectedFile.value = path.join(tempDir, 'camera_video.mp4');
    instantMode.value = true;
    continueClicked.value = true;
  } catch (error) {
    toastMessage.value = t('camera_fail_save', {error});
    toastType.value = "warning";
    showToast.value = true;
    instantMode.value = true;
    selectedFile.value = null;
  }
};

const confirmMessage = ref('');

// File operations
const openFile = async () => {
  try {
    const filePath = await window.ipcRenderer.openFileDialog();
    if (filePath) {
      selectedFile.value = filePath
      try {
        const duration: number = await VideoService.getDuration(filePath);
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        fileDuration.value = `${t('generation_duration')} ${minutes} min ${seconds} sec`;
        if (minutes > 20) {
          toastType.value = "warning";
          toastMessage.value = t('generation_long_file_warning');
          showToast.value = true;
        }
        const segments = VideoService.calculateNumberOfSegments(duration, settings);
        if (selectedSegmentsFile.value !== null) {
          confirmMessage.value = t('videoProcessed', { segments, visionProvider: t('settings.visionProvider') })
        }
      } catch (error) {
        toastMessage.value = t('generation_video_duration_check_fail', {error})
        toastType.value = "warning";
        showToast.value = true;
        selectedFile.value = null;
      }
    }
  } catch (error) {
    toastMessage.value = t('generation_fail_open', {error})
    toastType.value = "warning";
    showToast.value = true;
    selectedFile.value = null;
  }
}
</script>

<style scoped>
.process-video-container {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 1rem;
  color: #333;
}

.file-controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 2rem 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.selected-file,
.save-location {
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.selected-file h3,
.save-location h3 {
  margin: 0 0 0.5rem 0;
  color: #495057;
  font-size: 1rem;
}

.file-path {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: #6c757d;
  word-break: break-all;
}

.confirmation {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #6c757d;
}
</style>
