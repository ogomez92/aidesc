<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted, watch } from 'vue';
import { useSettingsStore } from '@managers/store';
import { VisionModels, TtsModels } from '../enums/models';

import { Settings, VisionProviderSettings, TTSProviderSettings } from '@interfaces/settings';
import ToastMessage from './ToastMessage.vue';

const settingsStore = useSettingsStore();

// Create a reactive local settings object with proper typing
const localSettings = ref<Settings>({
    ...settingsStore.settings
});

// Modal states
const showVisionProviderModal = ref(false);
const showTtsProviderModal = ref(false);
const showResetConfirmModal = ref(false);

// Template refs for auto-focus
const firstVisionRadio = ref<HTMLInputElement | null>(null);
const firstTtsRadio = ref<HTMLInputElement | null>(null);

// Form data for new providers
const newVisionProvider = ref({
    name: '',
    apiKey: '',
    model: '',
    maxTokens: 3000
});

const newTtsProvider = ref({
    name: '',
    apiKey: '',
    model: '',
    voice: ''
});

// Computed arrays for table display
const visionProvidersArray = computed((): VisionProviderSettings[] => {
    return localSettings.value.visionProviders || [];
});

const ttsProvidersArray = computed((): TTSProviderSettings[] => {
    return localSettings.value.ttsProviders || [];
});

// Get available model names from enums
const visionModelOptions = computed(() => Object.values(VisionModels));
const ttsModelOptions = computed(() => Object.values(TtsModels));

// Methods
const addVisionProvider = () => {
    if (newVisionProvider.value.name && newVisionProvider.value.model) {
        localSettings.value.visionProviders.push({
            name: newVisionProvider.value.name,
            apiKey: newVisionProvider.value.apiKey,
            model: newVisionProvider.value.model,
            maxTokens: newVisionProvider.value.maxTokens
        });

        // Reset form
        newVisionProvider.value = {
            name: '',
            apiKey: '',
            model: '',
            maxTokens: 3000
        };

        showVisionProviderModal.value = false;
    }
};

const addTtsProvider = () => {
    if (newTtsProvider.value.name && newTtsProvider.value.model) {
        localSettings.value.ttsProviders.push({
            name: newTtsProvider.value.name,
            apiKey: newTtsProvider.value.apiKey,
            model: newTtsProvider.value.model,
            voice: newTtsProvider.value.voice
        });

        // Reset form
        newTtsProvider.value = {
            name: '',
            apiKey: '',
            model: '',
            voice: ''
        };

        showTtsProviderModal.value = false;
    }
};

const removeVisionProvider = (providerName: string) => {
    const index = localSettings.value.visionProviders.findIndex(provider => provider.name === providerName);
    if (index !== -1) {
        localSettings.value.visionProviders.splice(index, 1);
    }
};

const removeTtsProvider = (providerName: string) => {
    const index = localSettings.value.ttsProviders.findIndex(provider => provider.name === providerName);
    if (index !== -1) {
        localSettings.value.ttsProviders.splice(index, 1);
    }
};

// Toast state
const showToast = ref(false);
const toastMessage = ref('');
const toastType = ref<'warning' | 'info'>('info');

const saveSettings = () => {
    settingsStore.setSettings(localSettings as unknown as typeof settingsStore.settings);
    
    // Show success toast
    toastMessage.value = 'Settings saved successfully!';
    toastType.value = 'info';
    showToast.value = true;
};

const exportSettings = async () => {
    try {
        const settingsJson = JSON.stringify(localSettings.value, null, 2);
        await navigator.clipboard.writeText(settingsJson);
        
        // Show success toast
        toastMessage.value = 'Settings exported to clipboard!';
        toastType.value = 'info';
        showToast.value = true;
    } catch (error) {
        console.error('Failed to export settings:', error);
        
        // Show error toast
        toastMessage.value = 'Failed to export settings to clipboard';
        toastType.value = 'warning';
        showToast.value = true;
    }
};

// Methods for modal handling
const openVisionProviderModal = () => {
    showVisionProviderModal.value = true;
    nextTick(() => {
        firstVisionRadio.value?.focus();
    });
};

const openTtsProviderModal = () => {
    showTtsProviderModal.value = true;
    nextTick(() => {
        firstTtsRadio.value?.focus();
    });
};

const closeVisionProviderModal = () => {
    showVisionProviderModal.value = false;
};

const closeTtsProviderModal = () => {
    showTtsProviderModal.value = false;
};

const closeResetConfirmModal = () => {
    showResetConfirmModal.value = false;
};

const dismissToast = () => {
    showToast.value = false;
};

// Escape key handler
const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        if (showVisionProviderModal.value) {
            closeVisionProviderModal();
        } else if (showTtsProviderModal.value) {
            closeTtsProviderModal();
        } else if (showResetConfirmModal.value) {
            closeResetConfirmModal();
        }
    }
};

// Add/remove escape key listener
const addEscapeListener = () => {
    document.addEventListener('keydown', handleEscapeKey);
};

const removeEscapeListener = () => {
    document.removeEventListener('keydown', handleEscapeKey);
};

// Watch for modal state changes to manage escape listener
watch([showVisionProviderModal, showTtsProviderModal, showResetConfirmModal], ([vision, tts, reset]) => {
    if (vision || tts || reset) {
        addEscapeListener();
    } else {
        removeEscapeListener();
    }
});

// Clean up on component unmount
onUnmounted(() => {
    removeEscapeListener();
});


onMounted(() => {
    Object.assign(localSettings, settingsStore.settings);
});
</script>

<template>
    <div class="settings-container">
        <h1 class="settings-title">Application Settings</h1>

        <form @submit.prevent="saveSettings" class="settings-form">
            <!-- General Settings Section -->
            <fieldset>
                <legend>Time and AI usage</legend>
                <section class="settings-section">
                    <h2 class="section-title">General Settings</h2>

                    <div class="form-group">
                        <label for="batchWindowDuration" class="form-label">Batch Window Duration</label>
                        <input id="batchWindowDuration" v-model.number="localSettings.batchWindowDuration" type="number"
                            min="1" class="form-input" aria-describedby="batchWindowDuration-desc" />
                        <small id="batchWindowDuration-desc" class="form-description">
                            Duration of each batch window in seconds
                        </small>
                    </div>

                    <div class="form-group">
                        <label for="framesInBatch" class="form-label">Frames in Batch</label>
                        <input id="framesInBatch" v-model.number="localSettings.framesInBatch" type="number" min="1"
                            class="form-input" aria-describedby="framesInBatch-desc" />
                        <small id="framesInBatch-desc" class="form-description">
                            Number of frames to process in each batch
                        </small>
                    </div>
                    <div class="form-group">
                        <label for="contextWindow" class="form-label">Context Window Size</label>
                        <input id="contextWindow" v-model.number="localSettings.contextWindowSize" type="number" min="1"
                            class="form-input" aria-describedby="contextWindow-desc" />
                        <small id="contextWindow-desc" class="form-description">
                            Number of previous frames to include for context (increases AI load the more frames it
                            includes)
                        </small>
                    </div>

                </section>
            </fieldset>
            <!-- Vision Provider Settings -->
            <fieldset>
                <legend>Providers</legend>

                <section class="settings-section">
                    <h2 class="section-title">Vision Providers</h2>

                    <div class="provider-controls">
                        <button type="button" @click="openVisionProviderModal" class="btn btn-primary"
                            aria-label="Add new vision provider">
                            Add Vision Provider
                        </button>
                    </div>

                    <div class="form-group">
                        <label for="visionProvider" class="form-label">Active Vision Provider</label>
                        <select id="visionProvider" v-model="localSettings.visionProvider" class="form-select"
                            aria-describedby="visionProvider-desc">
                            <option v-for="provider in visionProvidersArray" :key="provider.name"
                                :value="provider.name">
                                {{ provider.name }}
                            </option>
                        </select>
                        <small id="visionProvider-desc" class="form-description">
                            Select the vision provider to be used
                        </small>
                    </div>

                    <table class="providers-table" v-if="visionProvidersArray.length > 0">
                        <thead>
                            <tr>
                                <th>Provider Name</th>
                                <th>Model</th>
                                <th>Max Tokens</th>
                                <th>API Key</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="provider in visionProvidersArray" :key="provider.name">
                                <td>{{ provider.name }}</td>
                                <td>{{ provider.model }}</td>
                                <td>{{ provider.maxTokens }}</td>
                                <td>{{ provider.apiKey ? '••••••••' : 'Not set' }}</td>
                                <td>
                                    <button type="button" @click="removeVisionProvider(provider.name)"
                                        class="btn btn-danger btn-sm"
                                        :aria-label="`Remove ${provider.name} vision provider`">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <!-- TTS Provider Settings -->
                <section class="settings-section">
                    <h2 class="section-title">Text-to-Speech Providers</h2>

                    <div class="provider-controls">
                        <button type="button" @click="openTtsProviderModal" class="btn btn-primary"
                            aria-label="Add new TTS provider">
                            Add TTS Provider
                        </button>
                    </div>

                    <div class="form-group">
                        <label for="ttsProvider" class="form-label">Active TTS Provider</label>
                        <select id="ttsProvider" v-model="localSettings.ttsProvider" class="form-select"
                            aria-describedby="ttsProvider-desc">
                            <option v-for="provider in ttsProvidersArray" :key="provider.name" :value="provider.name">
                                {{ provider.name }}
                            </option>
                        </select>
                        <small id="ttsProvider-desc" class="form-description">
                            Select the TTS provider to be used
                        </small>
                    </div>

                    <div class="form-group">
                        <label for="ttsSpeedFactor" class="form-label">TTS Speed Factor</label>
                        <input id="ttsSpeedFactor" v-model.number="localSettings.ttsSpeedFactor" type="number" min="0.1"
                            max="3" step="0.1" class="form-input" aria-describedby="ttsSpeedFactor-desc" />
                        <small id="ttsSpeedFactor-desc" class="form-description">
                            Speed multiplier for TTS playback (0.1-3.0)
                        </small>
                    </div>

                    <table class="providers-table" v-if="ttsProvidersArray.length > 0">
                        <thead>
                            <tr>
                                <th>Provider Name</th>
                                <th>Model</th>
                                <th>Voice</th>
                                <th>API Key</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="provider in ttsProvidersArray" :key="provider.name">
                                <td>{{ provider.name }}</td>
                                <td>{{ provider.model }}</td>
                                <td>{{ provider.voice }}</td>
                                <td>{{ provider.apiKey ? '••••••••' : 'Not set' }}</td>
                                <td>
                                    <button type="button" @click="removeTtsProvider(provider.name)"
                                        class="btn btn-danger btn-sm"
                                        :aria-label="`Remove ${provider.name} TTS provider`">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            </fieldset>
            <!-- Prompt Settings -->
            <section class="settings-section">
                <h2 class="section-title">Prompts</h2>
                <fieldset>
                    <legend>Prompts</legend>
                    <div class="form-group">
                        <label for="defaultPrompt" class="form-label">Default Prompt</label>
                        <textarea id="defaultPrompt" v-model="localSettings.defaultPrompt" rows="4"
                            class="form-textarea" aria-describedby="defaultPrompt-desc"></textarea>
                        <small id="defaultPrompt-desc" class="form-description">
                            The default prompt used for processing
                        </small>
                    </div>

                    <div class="form-group">
                        <label for="changePrompt" class="form-label">Change Prompt</label>
                        <textarea id="changePrompt" v-model="localSettings.changePrompt" rows="4" class="form-textarea"
                            aria-describedby="changePrompt-desc"></textarea>
                        <small id="changePrompt-desc" class="form-description">
                            Prompt used to describe changes between frames
                        </small>
                    </div>

                    <div class="form-group">
                        <label for="batchPrompt" class="form-label">Batch Prompt</label>
                        <textarea id="batchPrompt" v-model="localSettings.batchPrompt" rows="4" class="form-textarea"
                            aria-describedby="batchPrompt-desc"></textarea>
                        <small id="batchPrompt-desc" class="form-description">
                            Prompt used for batch processing
                        </small>
                    </div>
                </fieldset>
            </section>

            <!-- Action Buttons -->
            <div class="form-actions">
                <button type="submit" class="btn btn-success">
                    Save Settings
                </button>
                <button type="button" @click="exportSettings" class="btn btn-secondary">
                    Export Settings
                </button>
            </div>
        </form>

        <!-- Vision Provider Modal -->
        <div v-if="showVisionProviderModal" class="modal-overlay" @click.self="closeVisionProviderModal">
            <div class="modal-content" role="dialog" aria-labelledby="vision-modal-title" aria-modal="true">
                <h3 id="vision-modal-title" class="modal-title">Add Vision Provider</h3>
                <form @submit.prevent="addVisionProvider">
                    <div class="form-group">
                        <fieldset>
                            <legend class="form-label">Provider Name</legend>
                            <div class="radio-group">
                                <label v-for="(option, index) in visionModelOptions" :key="option" class="radio-label">
                                    <input :ref="index === 0 ? 'firstVisionRadio' : undefined"
                                        v-model="newVisionProvider.name" :value="option.toLowerCase()" type="radio"
                                        name="vision-provider-name" class="form-radio" required />
                                    {{ option }}
                                </label>
                            </div>
                        </fieldset>
                    </div>

                    <div class="form-group">
                        <label for="vision-apikey" class="form-label">API Key</label>
                        <input id="vision-apikey" v-model="newVisionProvider.apiKey" type="password" class="form-input"
                            placeholder="Optional API key" />
                    </div>

                    <div class="form-group">
                        <label for="vision-model" class="form-label">Model</label>
                        <input id="vision-model" v-model="newVisionProvider.model" type="text" required
                            class="form-input" placeholder="e.g., gpt-4o, gemini-2.0-flash" />
                    </div>

                    <div class="form-group">
                        <label for="vision-tokens" class="form-label">Max Tokens</label>
                        <input id="vision-tokens" v-model.number="newVisionProvider.maxTokens" type="number" min="1"
                            class="form-input" />
                    </div>

                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">Add Provider</button>
                        <button type="button" @click="closeVisionProviderModal" class="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- TTS Provider Modal -->
        <div v-if="showTtsProviderModal" class="modal-overlay" @click.self="closeTtsProviderModal">
            <div class="modal-content" role="dialog" aria-labelledby="tts-modal-title" aria-modal="true">
                <h3 id="tts-modal-title" class="modal-title">Add TTS Provider</h3>
                <form @submit.prevent="addTtsProvider">
                    <div class="form-group">
                        <fieldset>
                            <legend class="form-label">Provider Name</legend>
                            <div class="radio-group">
                                <label v-for="(option, index) in ttsModelOptions" :key="option" class="radio-label">
                                    <input :ref="index === 0 ? 'firstTtsRadio' : undefined"
                                        v-model="newTtsProvider.name" :value="option.toLowerCase()" type="radio"
                                        name="tts-provider-name" class="form-radio" required />
                                    {{ option }}
                                </label>
                            </div>
                        </fieldset>
                    </div>

                    <div class="form-group">
                        <label for="tts-apikey" class="form-label">API Key</label>
                        <input id="tts-apikey" v-model="newTtsProvider.apiKey" type="password" class="form-input"
                            placeholder="Optional API key" />
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
                        <button type="button" @click="closeTtsProviderModal" class="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Toast Message -->
        <ToastMessage
            v-if="showToast"
            :message="toastMessage"
            :type="toastType"
            :visible="showToast"
            @dismiss="dismissToast"
        />
    </div>
</template>

<style scoped>
.settings-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.settings-title {
    font-size: 2.5rem;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 2rem;
    text-align: center;
}

.settings-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.settings-section {
    background: #ffffff;
    border: 1px solid #e1e8ed;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.section-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #34495e;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid #3498db;
    padding-bottom: 0.5rem;
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

.form-input,
.form-select,
.form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e1e8ed;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
    background-color: #ffffff;
}

.form-checkbox {
    width: auto;
    margin-right: 0.5rem;
    transform: scale(1.2);
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

.form-input:focus,
.form-select:focus,
.form-textarea:focus,
.form-checkbox:focus,
.form-radio:focus {
    outline: none;
    border-color: #3498db;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-textarea {
    resize: vertical;
    min-height: 100px;
}

.form-description {
    display: block;
    color: #7f8c8d;
    font-size: 0.85rem;
    margin-top: 0.25rem;
}

.provider-controls {
    margin-bottom: 1.5rem;
}

.providers-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    background: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.providers-table th,
.providers-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #e1e8ed;
}

.providers-table th {
    background-color: #f8f9fa;
    font-weight: 600;
    color: #2c3e50;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.providers-table tbody tr:hover {
    background-color: #f8f9fa;
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

.btn-success {
    background-color: #27ae60;
    color: white;
}

.btn-success:hover {
    background-color: #219a52;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(39, 174, 96, 0.3);
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

.btn-danger {
    background-color: #e74c3c;
    color: white;
}

.btn-danger:hover {
    background-color: #c0392b;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3);
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
}

.form-actions {
    display: flex;
    gap: 1rem;
    padding-top: 2rem;
    border-top: 1px solid #e1e8ed;
    justify-content: center;
}

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

@media (max-width: 768px) {
    .settings-container {
        padding: 1rem;
    }

    .settings-section {
        padding: 1.5rem;
    }

    .form-actions {
        flex-direction: column;
    }

    .modal-content {
        margin: 1rem;
        max-width: calc(100% - 2rem);
    }

    .providers-table {
        font-size: 0.875rem;
    }

    .providers-table th,
    .providers-table td {
        padding: 0.75rem 0.5rem;
    }
}
</style>
