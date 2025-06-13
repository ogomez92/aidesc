<template>
  <div class="process-video-container">
    <h2>Process Local Video</h2>
    <p>Select a video file to process.</p>
  </div>
  <div v-if="!continueClicked" class="file-controls">
    <button class="btn btn-primary" @click="openFile">
      {{ selectedFile ? 'Change Video File' : 'Select Video File' }}
    </button>
    <button class="btn btn-primary" @click="openSegmentsFile">
      Import Segments.json file
    </button>

    <div v-if="selectedFile" class="selected-file">
      <h3>Selected File:</h3>
      <p class="file-path">{{ selectedFile }}</p>
      <p class="file-path">{{ fileDuration }}</p>
    </div>
    <div v-if="selectedSegmentsFile" class="selected-file">
      <h3>Selected segments:</h3>
      <p class="file-path">{{ selectedSegmentsFile }}</p>
    </div>

    <p class="confirmation">{{ confirmMessage }}</p>
    <button :disabled="!selectedFile" class="btn btn-secondary" @click="clickContinue">
      Continue
    </button>
  </div>
  <BatchWorker :file="selectedFile" :segments="selectedSegmentsFile" />
  <ToastMessage v-if="showToast" :message="toastMessage" :type="toastType" :visible="showToast"
    @dismiss="dismissToast" />

</template>

<script setup lang="ts">
import { useSettingsStore } from '@managers/store';
import { Settings } from '@interfaces/settings';
import { ref } from 'vue'
import AudioSegment from '@interfaces/audio_segment';
import ToastMessage from './ToastMessage.vue'
import { VideoService } from '@services/video'

const settingsStore = useSettingsStore();

const settings: Settings = settingsStore.settings;
// Reactive state
const selectedFile = ref<string | null>(null)
const selectedSegmentsFile = ref<string | null>(null)
const fileDuration = ref<string | null>(null)
const toastType = ref<'warning' | 'info'>('info');
const continueClicked = ref(false);
const toastMessage = ref('');
const showToast = ref(false);
const dismissToast = () => {
  showToast.value = false;
};

const clickContinue = () => {
  continueClicked.value = true;
}

const confirmMessage = ref('');

// File operations
const openFile = async () => {
  try {
    const filePath = await window.ipcRenderer.openFileDialog()
    if (filePath) {
      selectedFile.value = filePath
      try {
        const duration: number = await VideoService.getDuration(filePath);
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        fileDuration.value = `Duration: ${minutes} min ${seconds} sec`;
        if (duration > 20) {
          toastType.value = "warning";
          toastMessage.value = "Warning: Longer videos are more expensive to describe, especially for voice generation. Consider using a shorter video or using a voice provider that does not require AI."
          showToast.value = true;
        }
        const segments = VideoService.calculateNumberOfSegments(duration, settings);

        confirmMessage.value = `The video has been successfully processed. It will be divided into ${segments} segments for description. Please press continue to start generating vision segments with ${settings.visionProvider} or import a previously generated segments.json file`;
      } catch (error) {
        toastMessage.value = `Failed to get video duration. The file type might not be supported by ffmpeg. The error was: ${error}`;
        toastType.value = "warning";
        showToast.value = true;
        selectedFile.value = '';
      }
    }
  } catch (error) {
    toastMessage.value = `Failed to open file. The error was: ${error}`;
    toastType.value = "warning";
    showToast.value = true;
    selectedFile.value = '';
  }
}

const openSegmentsFile = async () => {
  const fs = await import('fs');

  try {
    const filePath = await window.ipcRenderer.openFileDialog()
    selectedFile.value = filePath
    if (filePath) {
      const data = fs.readFileSync(filePath, 'utf8');
      const segmentsData = JSON.parse(data);

      if (Array.isArray(segmentsData.segments)) {
        const segments: AudioSegment[] = segmentsData.segments;
        toastMessage.value = `Successfully imported ${segments.length} audio segments from ${filePath}`;
        toastType.value = "info";
        showToast.value = true;
      } else {
        throw new Error('Invalid segments file format. Expected an array of segments.');
      }
    }
  } catch (error) {
    selectedSegmentsFile.value = '';
    toastMessage.value = `Failed to import segments file. The error was: ${error}`;
    toastType.value = "warning";
    showToast.value = true;
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
