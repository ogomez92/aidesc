import { TTSProviderSettings } from "@interfaces/settings";
import { ElevenLabsTTSProvider } from "./elevenlabs_tts_provider";
import { OpenAITTSProvider } from "./openai_tts_provider";
import { TTSProvider } from "./tts_provider";

export class TTSProviderFactory {
    static createProvider(providerName: string, config: TTSProviderSettings): TTSProvider {
        switch (providerName.toLowerCase()) {
            case 'openai':
                return new OpenAITTSProvider(config);
            case 'eleven':
            case 'elevenlabs':
                return new ElevenLabsTTSProvider(config);
            default:
                throw new Error(`TTS provider "${providerName}" not implemented.`);
        }
    }
}

