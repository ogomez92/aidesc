export class VisionProviderFactory {
    static createProvider(providerName: string, config: VisionProviderSettings): VisionProvider {
        switch (providerName.toLowerCase()) {
            case 'openai':
                return new OpenAIVisionProvider(config);
            case 'gemini':
                return new GeminiVisionProvider(config);
            default:
                throw new Error(`Vision provider "${providerName}" not implemented.`);
        }
    }
}
