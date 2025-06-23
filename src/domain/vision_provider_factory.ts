import { OpenAIVisionProvider } from "@domain/openai_vision_provider";
import { GeminiVisionProvider } from "@domain/gemini_vision_provider";
import { VisionProviderSettings } from "@interfaces/settings";
import VisionProvider from "./vision_provider";

const providers = [
    OpenAIVisionProvider,
    GeminiVisionProvider
];

export class VisionProviderFactory {
    static getList(): string[] {
        return providers.flatMap(provider => provider.names);
    }

    static createProvider(providerName: string, config: VisionProviderSettings): VisionProvider {
        for (const provider of providers) {
            if (provider.names.some(name => name.toLowerCase() === providerName.toLowerCase())) {
                return new provider(config);
            }
        }
        throw new Error(`Vision provider "${providerName}" not implemented.`);
    }
}
