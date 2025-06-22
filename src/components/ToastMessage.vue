<template>
  <Transition name="toast">
    <div v-if="isVisible && visible" :class="['toast', `toast--${type}`]">
      <div class="toast__content">
        <div class="toast__header">
          <div class="toast__icon">
            <span v-if="type === 'warning'">{{ $t('a11y_warning') }}</span>
            <span v-else>{{ $t('a11y_info') }}</span>
          </div>
          <button type="button" class="toast__close" @click="dismiss" aria-label="Dismiss notification">
            ✕
          </button>
        </div>
        <div class="toast__message" >
          {{ message }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  message: string;
  type: 'warning' | 'info';
  visible: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  dismiss: [];
}>();

const isVisible = ref(false);

const dismiss = () => {
  isVisible.value = false;
  setTimeout(() => {
    emit('dismiss');
  }, 300); // Wait for fade-out animation
};

// Auto-dismiss after 5 seconds

// Watch for visibility changes
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    isVisible.value = true;
  } else {
    isVisible.value = false;
  }
}, { immediate: true });

</script>

<style scoped>
.toast {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 9999;
  min-width: 300px;
  max-width: 500px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast--info {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
}

.toast--warning {
  background: linear-gradient(135deg, #f39c12, #e67e22);
  color: white;
}

.toast__content {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 0.75rem;
}
.toast__header {
  display: flex;
  justify-content: space-between;
}

.toast__icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.toast__message {
  flex: 1;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word; /* Permite el quiebre de palabras largas */
  white-space: pre-line;  /* Respeta saltos de línea y espacios */
  overflow-wrap: break-word; /* Soporte adicional para quiebre de palabras */
}

.toast__close {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.125rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.toast__close:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.toast__close:focus {
  outline: 2px solid rgba(255, 255, 255, 0.8);
  outline-offset: 2px;
}

/* Transition animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .toast {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    min-width: auto;
    max-width: none;
  }
}
</style>
