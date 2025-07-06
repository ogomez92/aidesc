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
            const visionProviderFound = state.settings.visionProviders.length > 0;

            return visionProviderFound;
        },
    },

    actions: {
        // add a reset settings action
        resetSettings() {
            this.setSettings(defaultSettings as Settings);
        },

        setSettings(settings: Settings) {
            this.settings = settings;
            localStorage.setItem('settings', JSON.stringify(settings));
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
