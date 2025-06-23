<script setup lang="ts">
import { ref, watch } from 'vue';
import { VisionProviderFactory } from '@domain/vision_provider_factory';

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
    baseURL?: string;
    maxTokens: number;
  }): void;
}

const emit = defineEmits<Emits>();

// Ref for dialog element
const dialogRef = ref<HTMLDialogElement | null>(null);

// Form data
const newVisionProvider = ref({
  name: '',
  baseURL: '',
  apiKey: '',
  model: '',
  maxTokens: 3000
});

// Get available model names from enums
const visionModelOptions = VisionProviderFactory.getList();

// Methods
const addVisionProvider = () => {
  if (newVisionProvider.value.name && newVisionProvider.value.model) {
    emit('add-provider', { ...newVisionProvider.value });

    // Reset form
    newVisionProvider.value = {
      name: '',
      baseURL: '',
      apiKey: '',
      model: '',
      maxTokens: 3000
    };
  }
};

const closeModal = () => {
  emit('close');
};

// Watch for visibility changes to open/close dialog
watch(() => props.isVisible, (visible) => {
  const dialog = dialogRef.value;
  if (!dialog) return;
  if (visible) {
    if (!dialog.open) dialog.showModal();
  } else {
    if (dialog.open) dialog.close();
  }
});
</script>

<template>
  <dialog ref="dialogRef" class="modal-content" @close="closeModal">
    <h3 id="vision-modal-title" class="modal-title">{{ $t('setting_add_vision_provider') }}</h3>
    <form @submit.prevent="addVisionProvider">
      <div class="form-group">
        <fieldset>
          <legend class="form-label">{{ $t('modal_vision_provider_name') }}</legend>
          <div class="radio-group">
            <label v-for="(option) in visionModelOptions" :key="option" class="radio-label">
              <input v-model="newVisionProvider.name" :value="option.toLowerCase()" type="radio"
                name="vision-provider-name" class="form-radio" required />
              {{ $t(option) }}
            </label>
          </div>
        </fieldset>
      </div>

      <div class="form-group">
        <label for="vision-apikey" class="form-label">{{ $t('setting_api_key') }}</label>
        <input aria-required id="vision-apikey" v-model="newVisionProvider.apiKey" type="password" class="form-input"
          placeholder="API key" />
      </div>

      <div class="form-group">
        <label for="vision-model" class="form-label">{{ $t('setting_model') }}</label>
        <input id="vision-model" v-model="newVisionProvider.model" type="text" required class="form-input"
          placeholder="e.g., gpt-4o, gemini-2.0-flash" />
      </div>

      <div class="form-group">
        <label for="vision-tokens" class="form-label">{{ $t('setting_max_tokens') }}</label>
        <input id="vision-tokens" v-model.number="newVisionProvider.maxTokens" type="number" min="1"
          class="form-input" />
      </div>
      
      <div v-if="newVisionProvider.name === 'openailike'" class="form-group">
        <label for="base-url" class="form-label">{{ $t('setting_baseurl') }}</label>
        <textarea id="base-url" v-model="newVisionProvider.baseURL" type="text" class="form-input"
          placeholder="http://localhost:11400" />
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">{{ $t('button_add') }}</button>
        <button type="button" @click="closeModal" class="btn btn-secondary">
          {{ $t('button_cancel') }}
        </button>
      </div>
    </form>
  </dialog>
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