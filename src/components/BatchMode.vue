<template>
  <div class="process-video-container">
    <h2>Process Local Video</h2>
    <p>Select a video file to process.</p>
    
    <div class="file-controls">
      <button 
        class="btn btn-primary" 
        @click="openFile"
        :disabled="isProcessing"
      >
        {{ selectedFile ? 'Change Video File' : 'Select Video File' }}
      </button>
      
      <button 
        class="btn btn-secondary" 
        @click="saveFile"
        :disabled="!selectedFile || isProcessing"
      >
        Save Processed Video
      </button>
    </div>

    <div v-if="selectedFile" class="selected-file">
      <h3>Selected File:</h3>
      <p class="file-path">{{ selectedFile }}</p>
    </div>

    <div v-if="saveLocation" class="save-location">
      <h3>Save Location:</h3>
      <p class="file-path">{{ saveLocation }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ToastMessage from './ToastMessage.vue'
import { VideoService } from '@services/video'

// Reactive state
const selectedFile = ref<string | null>(null)
const saveLocation = ref<string | null>(null)
const isProcessing = ref(false)

// File operations
const openFile = async () => {
  try {
    const filePath = await window.ipcRenderer.openFileDialog()
    if (filePath) {
      selectedFile.value = filePath
      console.log('Selected file:', filePath)
    }
  } catch (error) {
    console.error('Error opening file:', error)
  }
}

const saveFile = async () => {
  try {
    const defaultName = selectedFile.value 
      ? selectedFile.value.replace(/\.[^/.]+$/, '_processed.mp4')
      : 'processed_video.mp4'
    
    const filePath = await window.ipcRenderer.saveFileDialog(defaultName)
    if (filePath) {
      saveLocation.value = filePath
      console.log('Save location:', filePath)
      // Here you would implement the actual processing logic
    }
  } catch (error) {
    console.error('Error saving file:', error)
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
</style>
