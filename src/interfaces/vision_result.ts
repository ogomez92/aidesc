export default interface VisionResult {
    description: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}
