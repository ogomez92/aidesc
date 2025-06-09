<script setup lang="ts">
import { nextTick, watch } from 'vue';

// Props
interface Props {
  isVisible: boolean;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'close'): void;
  (e: 'confirm'): void;
}

const emit = defineEmits<Emits>();

// Methods
const closeModal = () => {
  emit('close');
};

const confirmReset = () => {
  emit('confirm');
};

// Handle escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

// Focus management
watch(() => props.isVisible, async (newValue) => {
  if (newValue) {
    document.addEventListener('keydown', handleKeydown);
    await nextTick();
    // Focus the modal content for accessibility
    const modalContent = document.querySelector('.modal-content') as HTMLElement;
    modalContent?.focus();
  } else {
    document.removeEventListener('keydown', handleKeydown);
  }
});
</script>

<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content" role="dialog" aria-labelledby="reset-modal-title" aria-modal="true" tabindex="-1">
      <h3 id="reset-modal-title" class="modal-title">Reset Settings</h3>
      <p class="modal-text">
        Are you sure you want to reset all settings to their default values? This action cannot be undone.
      </p>
      <div class="modal-actions">
        <button type="button" @click="confirmReset" class="btn btn-danger">
          Yes, Reset
        </button>
        <button type="button" @click="closeModal" class="btn btn-secondary">
          Cancel
        </button>
      </div>
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
  z-index: 9999;
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

.modal-text {
  color: #2c3e50;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  text-align: center;
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

.btn-danger {
  background-color: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background-color: #c0392b;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3);
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