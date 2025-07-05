import BatchContext from "@interfaces/batch_context";
import { VisionProviderSettings } from "@interfaces/settings";
import VisionResult from "@interfaces/vision_result";

export default abstract class VisionProvider {
    protected config: VisionProviderSettings;
    protected static names: string[] = [];

    constructor(config: VisionProviderSettings) {
        this.config = config;
    }

    abstract describeImage(imagePath: string, prompt: string, lastDescription: string): Promise<VisionResult>;
    abstract describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult>;
}
