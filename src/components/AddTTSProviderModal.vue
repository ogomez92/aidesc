        <script setup lang="ts">
        import { ref, nextTick, watch } from 'vue';
        import { TtsModels } from '../enums/models';

        // Props
        interface Props {
          isVisible: boolean;
        }

        const props = defineProps<Props>();

        // Emits
        interface Emits {
          (e: 'close'): void;
          (e: 'add-provider', provider: {
            name: string;
            apiKey: string;
            model: string;
            speedFactor: number;
            voice: string;
          }): void;
        }

        const emit = defineEmits<Emits>();

        // Template ref for auto-focus
        const dialogPanel = ref<HTMLDivElement | null>(null);

        // Form data
        const newTtsProvider = ref({
          name: '',
          apiKey: '',
          speedFactor: 1.0,
          model: '',
          voice: ''
        });

        // Get available model names from enums
        const ttsModelOptions = Object.values(TtsModels);

        // Methods
        const addTtsProvider = () => {
          if (newTtsProvider.value.name && newTtsProvider.value.model) {
            emit('add-provider', { ...newTtsProvider.value });

            // Reset form
            newTtsProvider.value = {
              name: '',
              apiKey: '',
              speedFactor: 1.0,
              model: '',
              voice: ''
            };
          }
        };

        const closeModal = () => {
          emit('close');
        };

        const focusDialogPanel = () => {
          nextTick(() => {
            dialogPanel.value?.focus();
          });
        };

        // Watch for visibility changes to focus
        watch(() => props.isVisible, (visible) => {
          if (visible) {
            focusDialogPanel();
          }
        });
</script>

<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div tabindex="-1" ref="dialogPanel" class="modal-content" role="dialog" aria-labelledby="tts-modal-title"
      aria-modal="true">
      <h3 id="tts-modal-title" class="modal-title">Add TTS Provider</h3>
      <form @submit.prevent="addTtsProvider">
        <div class="form-group">
          <fieldset>
            <legend class="form-label">Provider Name</legend>
            <div class="radio-group">
              <label v-for="(option) in ttsModelOptions" :key="option" class="radio-label">
                <input v-model="newTtsProvider.name" :value="option.toLowerCase()" type="radio" name="tts-provider-name"
                  class="form-radio" required />
                {{ option }}
              </label>
            </div>
          </fieldset>
        </div>

        <div class="form-group">
          <label for="tts-speedfactor" class="form-label">Speed Factor</label>
          <input id="tts-speedfactor" v-model.number="newTtsProvider.speedFactor" type="number" step="0.1" min="0.1"
            max="3.0" class="form-input" placeholder="1.0" />
        </div>

        <div class="form-group">
          <label for="tts-apikey" class="form-label">API Key</label>
          <input aria-required id="tts-apikey" v-model="newTtsProvider.apiKey" type="password" class="form-input"
            placeholder="API key" />
        </div>

        <div class="form-group">
          <label for="tts-model" class="form-label">Model</label>
          <input id="tts-model" v-model="newTtsProvider.model" type="text" required class="form-input"
            placeholder="e.g., tts-1-hd, eleven_multilingual_v2" />
        </div>

        <div class="form-group">
          <label for="tts-voice" class="form-label">Voice</label>
          <input id="tts-voice" v-model="newTtsProvider.voice" type="text" class="form-input"
            placeholder="e.g., alloy, nova" />
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">Add Provider</button>
          <button type="button" @click="closeModal" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 1.5rem;
  text-align: center;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  background-color: #ffffff;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-radio {
  width: auto;
  margin-right: 0.5rem;
  transform: scale(1.1);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-label {
  display: flex;
  align-items: center;
  font-weight: 400;
  color: #2c3e50;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.radio-label:hover {
  background-color: #f8f9fa;
}

fieldset {
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  padding: 1rem;
  margin: 0;
}

legend {
  padding: 0 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-primary:hover {
  background-color: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background-color: #7f8c8d;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(149, 165, 166, 0.3);
}

@media (max-width: 768px) {
  .modal-content {
    margin: 1rem;
    max-width: calc(100% - 2rem);
  }
}
</style>
