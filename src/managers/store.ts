import { defineStore } from 'pinia';
import { Settings } from '@interfaces/settings';
import defaultSettings from '@assets/defaultSettings.json';

export const useSettingsStore = defineStore('settings', {
    state: () => {
        let settings: Settings;
        try {
            const storedSettings = localStorage.getItem('settings');
            settings = storedSettings ? JSON.parse(storedSettings) : defaultSettings;
        } catch {
            settings = defaultSettings as Settings;
        }
        return {
            settings
        };
    },

    getters: {
        isInitialized: (state): boolean => {
    const visionProviders = state.settings.visionProviders;
    const ttsProviders = state.settings.ttsProviders;

    const visionApiKeySet = visionProviders.some(provider =>
        provider.apiKey && provider.apiKey.trim() !== ''
    );
    const ttsApiKeySet = ttsProviders.some(provider =>
        provider.apiKey && provider.apiKey.trim() !== ''
    );

    return visionApiKeySet && ttsApiKeySet;
},
    },

actions: {
    setSettings(settings: Settings) {
        this.settings = settings;
    },

    loadSettings() {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('settings') || '');
            this.setSettings(savedSettings);
        } catch {
            this.setSettings(defaultSettings as Settings);
        }
    },
},
});
