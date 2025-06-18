export interface VisionProviderSettings {
    name: string;
    apiKey?: string | undefined;
    model: string;
    maxTokens: number;
}

export interface TTSProviderSettings {
    name: string;
    apiKey?: string | undefined;
    model: string;
    voice: string;
    voiceInstructionsPrompt?: string;
    speedFactor: number;
}

export interface Settings {
    batchPrompt: string;
    visionProvider: string;
    ttsProvider: string;
    visionProviders: Array<VisionProviderSettings>;
    ttsProviders: Array<TTSProviderSettings>;
    batchWindowDuration: number;
    framesInBatch: number;
}
