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
}

export interface Settings {
    captureIntervalSeconds: number;
    contextWindowSize: number;
    defaultPrompt: string;
    changePrompt: string;
    batchPrompt: string;
    visionProvider: string;
    ttsProvider: string;
    visionProviders: Array<VisionProviderSettings>;
    ttsProviders: Array<TTSProviderSettings>;
    ttsSpeedFactor: number;
    batchWindowDuration: number;
    framesInBatch: number;
}
