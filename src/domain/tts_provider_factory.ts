import { TTSProviderSettings } from "@interfaces/settings";
import { ElevenLabsTTSProvider } from "./elevenlabs_tts_provider";
import { OpenAITTSProvider } from "./openai_tts_provider";
import { GeminiTTSProvider } from "./gemini_tts_provider";
import { TTSProvider } from "./tts_provider";

const providers = [
    OpenAITTSProvider,
    GeminiTTSProvider,
    ElevenLabsTTSProvider
];

export class TTSProviderFactory {
    static getList(): string[] {
        return providers.flatMap(provider => provider.names);
    }


    static createProvider(providerName: string, config: TTSProviderSettings): TTSProvider {
        for (const provider of providers) {
            if (provider.names.some(name => name.toLowerCase() === providerName.toLowerCase())) {
                return new provider(config);
            }
        }
        throw new Error(`TTS provider "${providerName}" not implemented.`);
    }
}
