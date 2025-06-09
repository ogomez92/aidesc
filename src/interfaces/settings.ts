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
    speedFactor: number;
}

export interface Settings {
    contextWindowSize: number;
    defaultPrompt: string;
    changePrompt: string;
    batchPrompt: string;
    visionProvider: string;
    ttsProvider: string;
    visionProviders: Array<VisionProviderSettings>;
    ttsProviders: Array<TTSProviderSettings>;
    batchWindowDuration: number;
    framesInBatch: number;
}
