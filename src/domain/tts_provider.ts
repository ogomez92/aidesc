import { TTSProviderSettings } from "@interfaces/settings";

export abstract class TTSProvider {
    protected config: TTSProviderSettings;

    constructor(config: TTSProviderSettings) {
        this.config = config;
    }

}
