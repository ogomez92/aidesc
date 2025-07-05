<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, Ref } from 'vue';
import { useSettingsStore } from '@managers/store';
import { Settings, VisionProviderSettings, TTSProviderSettings } from '@interfaces/settings';
import NotificationBar from './NotificationBar.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const availableSources: Ref<CaptureSource[]> = ref([]);
import { VisionProviderFactory } from '@domain/vision_provider_factory';
import { ipcRenderer } from 'electron';
import VisionResult from '@interfaces/vision_result';
const settingsStore = useSettingsStore();
const localSettings = ref<Settings>({
    ...settingsStore.settings
});
ipcRenderer.on('global-shortcut', (event, shortcut) => {
    if (shortcut === 'continuousScreenshot') {
        getScreenshot();
    }
});

const lastDescription = ref('');
let continuousTimeout: any = 0;
const visionProviderSettings = localSettings.value.visionProviders.find(p => p.name === localSettings.value.visionProvider);

if (!visionProviderSettings) {
    throw new Error('Could not find active vision provider');
}

const vision = VisionProviderFactory.createProvider(localSettings.value.visionProvider, visionProviderSettings);

const isProcessing = ref(false);

const showNotification = ref(false);

// Toast state
const notificationMessage = ref('');

const saveSettings = () => {
    settingsStore.setSettings(localSettings.value as Settings);
};

const toggleProcessing = () => {
    isProcessing.value = !isProcessing.value;

    if (isProcessing) {
        if (localSettings.value.continuousDescribeEvery !== 0) {
            continuousTimeout = setTimeout(() => getScreenshot(), localSettings.value.continuousDescribeEvery * 1000);
        }
    } else {
        clearTimeout(continuousTimeout);
    }
};

onMounted(async () => {
    try {
        const captureSources: CaptureSource[] = await window.ipcRenderer.getCaptureSources();
        availableSources.value.push(...captureSources)
        Object.assign(localSettings, settingsStore.settings);
    } catch (error) {
        console.error('Error fetching capture sources:', error);
        notificationMessage.value = t('error_fetching_sources', { error });
        showNotification.value = true;
    }
});

const getScreenshot = (async () => {
    if (!isProcessing) {
        console.warn('Continuous mode is not active, skipping screenshot capture.');
        notificationMessage.value = t('continuous_mode_not_active');
        return;
    }

    try {
        // Why describe the Aidesc window? No point.
        if (document.hasFocus()) {
            continuousTimeout = setTimeout(() => getScreenshot(), localSettings.value.continuousDescribeEvery * 1000);
            return;
        }

        const screenshotPath = await window.ipcRenderer.captureScreen(localSettings.value.continuousSource)
        const descriptionResult: VisionResult = await vision.describeImage(screenshotPath, localSettings.value.continuousPrompt, lastDescription.value)
        lastDescription.value = descriptionResult.description;

        if (localSettings.value.continuousOutputToAria) {
            notificationMessage.value = lastDescription.value;
            showNotification.value = true;
        }

        if (localSettings.value.continuousOutputToClipboard) {
            window.ipcRenderer.setClipboard(lastDescription.value);
        }
        console.log(lastDescription.value)
        if (localSettings.value.continuousDescribeEvery !== 0) {
            continuousTimeout = setTimeout(() => getScreenshot(), localSettings.value.continuousDescribeEvery * 1000);
        }
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        notificationMessage.value = t('error_screen_capture', { error });
        showNotification.value = true;
    }
});

</script>

<template>
    <div class="settings-container">
        <h1 class="continuous-title">{{ $t('continuous_title') }}</h1>

        <NotificationBar v-if="showNotification" :visible="showNotification" :message="notificationMessage" />

        <div class="settings-section">
            <div class="form-group">
                <label class="form-label">{{ $t('continuous_source') }}</label>
                <div class="radio-group">
                    <label v-for="sourceKey in availableSources" :key="sourceKey.id" class="radio-label">
                        <input type="radio" :value="sourceKey.id" v-model="localSettings.continuousSource"
                            class="form-radio" @change="saveSettings" />
                        {{ sourceKey.name }}
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">{{ $t('continuous_time') }}</label>
                <div class="text-input">
                    <label for="continuousTimeEntry" class="form-label">{{
                        $t('continuous_time') }}</label>
                    <input id="continuousTimeEntry" v-model.number="localSettings.continuousDescribeEvery" type="number"
                        min="0" class="form-input" aria-describedby="continuousTime-desc" />
                    <small id="continuousTime-desc" class="form-description">
                        {{ $t('settings_continuous_time_desc') }}
                    </small>

                </div>
            </div>

            <div class="form-group">
                <label for="continuousPrompt" class="form-label">{{ $t('continuous_prompt') }}</label>
                <textarea id="continuousPrompt" v-model="localSettings.continuousPrompt" class="form-textarea" rows="4"
                    @blur="saveSettings"></textarea>
            </div>

            <div class="form-actions">
                <button :disabled="localSettings.continuousSource === ''" @click="toggleProcessing"
                    :class="['btn', isProcessing ? 'btn-danger' : 'btn-success']">
                    {{ isProcessing ? $t('stop_processing') : $t('start_processing') }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.settings-container {
    background-color: #1a202c;
    color: #e2e8f0;
    padding: 2rem;
    border-radius: 12px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 600px;
    margin: 2rem auto;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.continuous-title {
    font-size: 2.25rem;
    font-weight: 700;
    margin-bottom: 2rem;
    text-align: center;
    color: #fff;
    letter-spacing: -0.025em;
}

.settings-section {
    background-color: #2d3748;
    padding: 2rem;
    border-radius: 8px;
}

.form-group {
    margin-bottom: 1.75rem;
}

.form-label {
    display: block;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #a0aec0;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
}

.radio-group {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.radio-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-size: 1rem;
    color: #cbd5e0;
    position: relative;
    padding-left: 2rem;
}

.form-radio {
    position: absolute;
    opacity: 0;
    cursor: pointer;
}

.radio-label .form-radio+*::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #4a5568;
    background-color: #1a202c;
    transition: all 0.2s ease-in-out;
}

.radio-label .form-radio:checked+*::before {
    background-color: #4299e1;
    border-color: #4299e1;
}

.radio-label .form-radio:checked+*::after {
    content: '';
    position: absolute;
    left: 7px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #1a202c;
}

.form-textarea {
    width: 100%;
    background-color: #1a202c;
    border: 1px solid #4a5568;
    border-radius: 8px;
    color: #e2e8f0;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.form-textarea:focus {
    outline: none;
    border-color: #4299e1;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
}

.form-actions {
    display: flex;
    justify-content: center;
    margin-top: 2.5rem;
}

.btn {
    padding: 0.75rem 2rem;
    border-radius: 8px;
    border: none;
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    transition: all 0.3s ease;
    letter-spacing: 0.05em;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.btn-success {
    background: linear-gradient(45deg, #48bb78, #38a169);
}

.btn-danger {
    background: linear-gradient(45deg, #f56565, #e53e3e);
}

.btn-success:hover {
    background: linear-gradient(45deg, #38a169, #2f855a);
}

.text-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
</style>
