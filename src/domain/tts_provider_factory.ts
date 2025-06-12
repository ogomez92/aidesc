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

