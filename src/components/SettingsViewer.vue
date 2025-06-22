<<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useSettingsStore } from '@managers/store';

import { Settings, VisionProviderSettings, TTSProviderSettings } from '@interfaces/settings';
import ToastMessage from './ToastMessage.vue';
import AddVisionProviderModal from './AddVisionProviderModal.vue';
import AddTTSProviderModal from './AddTTSProviderModal.vue';
import ResetConfirmationModal from './ResetConfirmationModal.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const settingsStore = useSettingsStore();

const localSettings = ref<Settings>({
    ...settingsStore.settings
});

// Modal states
const showVisionProviderModal = ref(false);
const showTtsProviderModal = ref(false);
const showResetConfirmModal = ref(false);

const visionProvidersArray = computed((): VisionProviderSettings[] => {
    return localSettings.value.visionProviders || [];
});

const ttsProvidersArray = computed((): TTSProviderSettings[] => {
    return localSettings.value.ttsProviders || [];
});

// Get available model names from enums
// Methods
const handleAddTtsProvider = (provider: {
    name: string; apiKey: string; model: string; speedFactor: number;
    voice: string
}) => {
    localSettings.value.ttsProviders.push(provider);
    showTtsProviderModal.value = false;
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
    settingsStore.setSettings(localSettings.value as Settings);

    // Show success toast
    toastType.value = 'info';
    toastMessage.value = t('settings_saved');
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

const resetSettings = () => {
    settingsStore.resetSettings();

    toastMessage.value = 'Settings reset to default values';
    toastType.value = 'info';
    showToast.value = true;
};

const handleResetConfirmation = () => {
    resetSettings();
    showResetConfirmModal.value = false;
};

// Methods for modal handling
const openVisionProviderModal = () => {
    showVisionProviderModal.value = true;
};

const handleAddVisionProvider = (provider: {
    name: string; apiKey: string; model: string; maxTokens: number
}) => {
    localSettings.value.visionProviders.push(provider);
    showVisionProviderModal.value = false;
};

const openTtsProviderModal = () => {
    showTtsProviderModal.value = true;
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
                    <h1 class="settings-title">{{ $t('settings_title') }}</h1>

                    <form @submit.prevent="saveSettings" class="settings-form">
                        <!-- General Settings Section -->
                        <fieldset>
                            <legend>{{ $t('settings_usage_legend') }}</legend>
                            <section class="settings-section">
                                <h2 class="section-title">{{ $t('settings_usage_legend') }}</h2>

                                <div class="form-group">
                                    <label for="batchWindowDuration" class="form-label">{{
                                        $t('settings_batch_window_duration') }}</label>
                                    <input id="batchWindowDuration" v-model.number="localSettings.batchWindowDuration"
                                        type="number" min="1" class="form-input"
                                        aria-describedby="batchWindowDuration-desc" />
                                    <small id="batchWindowDuration-desc" class="form-description">
                                        {{ $t('settings_batch_window_desc') }}
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label for="framesInBatch" class="form-label">{{ $t('settings_frames_in_batch')
                                        }}</label>
                                    <input id="framesInBatch" v-model.number="localSettings.framesInBatch" type="number"
                                        min="1" class="form-input" aria-describedby="framesInBatch-desc" />
                                    <small id="framesInBatch-desc" class="form-description">
                                        {{ $t('settings_frames_in_batch_desc') }}
                                    </small>
                                </div>
                            </section>
                        </fieldset>
                        <!-- Vision Provider Settings -->
                        <fieldset>
                            <legend>{{ $t('settings_ai_providers') }}</legend>

                            <section class="settings-section">
                                <h2 class="section-title">{{ $t('settings_vision_providers') }}</h2>

                                <div class="provider-controls">
                                    <button type="button" @click="openVisionProviderModal" class="btn btn-primary"
                                        aria-haspopup="dialog">
                                        {{ $t('settings_add_vision_provider') }}
                                    </button>
                                </div>

                                <div class="form-group">
                                    <label for="visionProvider" class="form-label">{{ $t('settings_active_vision')
                                        }}</label>
                                    <select id="visionProvider" v-model="localSettings.visionProvider"
                                        class="form-select" aria-describedby="visionProvider-desc">
                                        <option v-for="provider in visionProvidersArray" :key="provider.name"
                                            :value="provider.name">
                                            {{ provider.name }}
                                        </option>
                                    </select>
                                    <small id="visionProvider-desc" class="form-description">
                                        {{ $t('settings_active_vision_desc') }}
                                    </small>
                                </div>

                                <table class="providers-table" v-if="visionProvidersArray.length > 0">
                                    <caption>{{ $t('settings_vision_providers') }}</caption>
                                    <thead>
                                        <tr>
                                            <th>{{ $t('settings_provider_name') }}</th>
                                            <th>{{ $t('settings_provider_model') }}</th>
                                            <th>{{ $t('settings_max_tokens') }}</th>
                                            <th>{{ $t('settings_api_key') }}</th>
                                            <th>{{ $t('settings_actions') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="provider in visionProvidersArray" :key="provider.name">
                                            <td>{{ provider.name }}</td>
                                            <td>{{ provider.model }}</td>
                                            <td>{{ provider.maxTokens }}</td>
                                            <td>{{ provider.apiKey }}</td>
                                            <td>
                                                <button type="button" @click="removeVisionProvider(provider.name)"
                                                    class="btn btn-danger btn-sm"
                                                    :aria-label="`${t('settings_remove')} ${provider.name} vision provider`">
                                                    {{ $t('settings_remove') }}
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </section>

                            <!-- TTS Provider Settings -->
                            <section class="settings-section">
                                <h2 class="section-title">{{ $t('settings_tts_providers') }}</h2>

                                <div class="provider-controls">
                                    <button type="button" @click="openTtsProviderModal" class="btn btn-primary"
                                        aria-haspopup="dialog">
                                        {{ $t('settings_add_tts_provider') }}
                                    </button>
                                </div>

                                <div class="form-group">
                                    <label for="ttsProvider" class="form-label">{{ $t('settings_active_tts') }}</label>
                                    <select id="ttsProvider" v-model="localSettings.ttsProvider" class="form-select"
                                        aria-describedby="ttsProvider-desc">
                                        <option v-for="provider in ttsProvidersArray" :key="provider.name"
                                            :value="provider.name">
                                            {{ provider.name }}
                                        </option>
                                    </select>
                                    <small id="ttsProvider-desc" class="form-description">
                                        {{ $t('settings_active_tts_desc') }}
                                    </small>
                                </div>

                                <table class="providers-table" v-if="ttsProvidersArray.length > 0">
                                    <caption>Tts providers</caption>
                                    <thead>
                                        <tr>
                                            <th>{{ $t('settings_provider_name') }}Name</th>
                                            <th>{{ $t('settings_model') }}</th>
                                            <th>{{ $t('settings_voice') }}</th>
                                            <th>{{ $t('settings_speed_factor') }}</th>
                                            <th>{{ $t('settings_api_key') }}Key</th>
                                            <th>{{ $t('settings_actions') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="provider in ttsProvidersArray" :key="provider.name">
                                            <td>{{ provider.name }}</td>
                                            <td>{{ provider.model }}</td>
                                            <td>{{ provider.voice }}</td>
                                            <td>{{ provider.speedFactor }}</td>
                                            <td>{{ provider.apiKey }}</td>
                                            <td>
                                                <button type="button" @click="removeTtsProvider(provider.name)"
                                                    class="btn btn-danger btn-sm"
                                                    :aria-label="`${t('settings_remove')} ${provider.name} TTS provider`">
                                                    {{ $t('settings_remove') }}
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
                                    <label for="batchPrompt" class="form-label">{{ $t('settings_batch_prompt')
                                        }}</label>
                                    <textarea id="batchPrompt" v-model="localSettings.batchPrompt" rows="4"
                                        class="form-textarea" aria-describedby="batchPrompt-desc"></textarea>
                                    <small id="batchPrompt-desc" class="form-description">
                                        {{ $t('settings_batch_prompt_desc') }}
                                    </small>
                                </div>
                            </fieldset>
                        </section>
                        <!-- Output Settings -->
                        <section class="settings-section">
                            <h2 class="section-title">{{$t('settings_outputs')}}</h2>
                            <fieldset>
                                <legend>{{ $t('settings_outputs') }}</legend>
                                <div class="form-group">
                                    <div class="form-check">
                                        <input type="checkbox" id="ariaLiveRegion"
                                            v-model="localSettings.continuousOutputToAria" class="form-check-input">
                                        <label for="ariaLiveRegion" class="form-check-label">{{
                                            $t('settings_aria_live_region') }}</label>
                                    </div>
                                    <div class="form-check">
                                        <input type="checkbox" id="clipboard"
                                            v-model="localSettings.continuousOutputToClipboard"
                                            class="form-check-input">
                                        <label for="clipboard" class="form-check-label">{{ $t('settings_clipboard')
                                            }}</label>
                                    </div>
                                    <div class="form-check">
                                        <input type="checkbox" id="textToSpeech"
                                            v-model="localSettings.continuousOutputToTts" class="form-check-input">
                                        <label for="textToSpeech" class="form-check-label">{{
                                            $t('settings_text_to_speech') }}</label>
                                    </div>
                                </div>
                            </fieldset>
                        </section>

                        <!-- Action Buttons -->
                        <div class="form-actions">
                            <button type="submit" class="btn btn-success">
                                {{ $t('settings_save') }}
                            </button>
                            <button type="button" @click="exportSettings" class="btn btn-secondary">
                                {{ $t('settings_export') }}
                            </button>
                            <button type="button" @click="showResetConfirmModal = true" class="btn btn-danger">
                                {{ $t('settings_reset') }}
                            </button>
                        </div>
                    </form> <!-- Reset Confirmation Modal -->
                    <ResetConfirmationModal :is-visible="showResetConfirmModal" @close="closeResetConfirmModal"
                        @confirm="handleResetConfirmation" />

                    <!-- Vision Provider Modal -->
                    <AddVisionProviderModal :is-visible="showVisionProviderModal" @close="closeVisionProviderModal"
                        @add-provider="handleAddVisionProvider" /> <!-- TTS Provider Modal -->
                    <AddTTSProviderModal :is-visible="showTtsProviderModal" @close="closeTtsProviderModal"
                        @add-provider="handleAddTtsProvider" />

                    <!-- Toast Message -->
                    <ToastMessage role="alert" v-if="showToast" :message="toastMessage" :type="toastType"
                        :visible="showToast" @dismiss="dismissToast" />
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

            .btn-info {
                background-color: #17a2b8;
                color: white;
            }

            .btn-info:hover {
                background-color: #138496;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(23, 162, 184, 0.3);
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
