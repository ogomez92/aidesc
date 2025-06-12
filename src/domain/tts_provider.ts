import { TTSProviderSettings } from "@interfaces/settings";
import TTSResult from "@interfaces/tts_result";

export abstract class TTSProvider {
    protected config: TTSProviderSettings;

    constructor(config: TTSProviderSettings) {
        this.config = config;
    }

    abstract textToSpeech(text: string, outputPath: string): Promise<TTSResult>;
}
