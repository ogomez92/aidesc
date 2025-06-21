<template>
  <div class="process-video-container">
    <h2>{{ $t('tts_generation_title') }}</h2>
  </div>
  <p>{{ $t('tts_generation_instructions') }}</p>
  <div v-if="!continueClicked" class="file-controls">
    <button class="btn btn-primary" @click="openFile">
      {{ selectedFile ? t('tts_generation_change_file') : t('tts_generation_select_file') }}
    </button>
    <button class="btn btn-primary" @click="openSegmentsFile">
      {{ selectedSegmentsFile ? t('tts_generation_reupload_segments') : t('tts_generation_upload_segments') }}
    </button>

    <div v-if="selectedFile" class="selected-file">
      <h3>{{ $t('generation_selected_file') }}</h3>
      <p class="file-path">{{ selectedFile }}</p>
      <p class="file-path">{{ fileDuration }}</p>
    </div>
    <div v-if="selectedSegmentsFile" class="selected-file">
      <h3>{{ $t('generation_selected_segments') }}</h3>
      <p class="file-path">{{ selectedSegmentsFile }}</p>
    </div>

    <p class="confirmation">{{ confirmMessage }}</p>
    <button :disabled="!selectedFile || !selectedSegmentsFile" class="btn btn-secondary" @click="clickContinue">
      {{ $t('generation_generate_speech') + $t(settings.ttsProvider)}}     </button>
  </div>
  <TtsWorker v-if="continueClicked" :file="selectedFile || ''" :segments="segmentsData" />
  <ToastMessage v-if="showToast" :message="toastMessage" :type="toastType" :visible="showToast"
    @dismiss="dismissToast" />

</template>

<script setup lang="ts">
import { useSettingsStore } from '@managers/store';
import TtsWorker from '@components/TtsWorker.vue';
import { Settings } from '@interfaces/settings';
import { ref } from 'vue'
import VisionSegment from '@interfaces/vision_segment';
import ToastMessage from './ToastMessage.vue'
import { VideoService } from '@services/video'
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const settingsStore = useSettingsStore();

const settings: Settings = settingsStore.settings;
// Reactive state
const selectedFile = ref<string | null>(null)
const selectedSegmentsFile = ref<string | null>(null)
const segmentsData = ref<VisionSegment[]>([]);
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
    const filePath = await window.ipcRenderer.openFileDialog();
    if (filePath) {
      selectedFile.value = filePath
      try {
        const duration: number = await VideoService.getDuration(filePath);
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        fileDuration.value = `Duration: ${minutes} min ${seconds} sec`;
        if (minutes > 20) {
          toastType.value = "warning";
          toastMessage.value = t('generation_long_file_warning')
          showToast.value = true;
        }
        const segments = VideoService.calculateNumberOfSegments(duration, settings);
        if (selectedSegmentsFile.value !== null) {
          confirmMessage.value = `The video has been successfully processed. It will be divided into ${segments} segments for description. Please press continue to start generating vision segments with ${settings.visionProvider} or import a previously generated segments.json file`;
        }
        else {
          confirmMessage.value = `The video has been loaded and segments imported. Press continue to generate tts segments with ${settings.ttsProvider}`;
        }
      } catch (error) {
        toastMessage.value = t('generation_video_duration_check_fail', { error })
        toastType.value = "warning";
        showToast.value = true;
        selectedFile.value = null;
      }
    }
  } catch (error) {
    toastMessage.value = t('generation_fail_open', { error })
    toastType.value = "warning";
    showToast.value = true;
    selectedFile.value = null;
  }
}

const openSegmentsFile = async () => {
  const fs = await import('fs');

  try {
    const filePath = await window.ipcRenderer.openFileDialog()
    if (filePath) {
      const data = fs.readFileSync(filePath, 'utf8');
      const fileData: VisionSegment[] = JSON.parse(data);

      if (Array.isArray(fileData)) {
        selectedSegmentsFile.value = filePath
        segmentsData.value = fileData
        toastMessage.value = t('generation_import_segments_success', { segmentsAmount: segmentsData.value.length, filePath })
        toastType.value = "info";
        showToast.value = true;
      } else {
        throw new Error('Invalid segments file format. Expected an array of segments.');
      }
    }
  } catch (error) {
    selectedSegmentsFile.value = null;
    toastMessage.value = t('generation_fail_import_segments', {error});
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
