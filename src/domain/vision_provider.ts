import BatchContext from "@interfaces/batch_context";
import { VisionProviderSettings } from "@interfaces/settings";
import VisionResult from "@interfaces/vision_result";

export default abstract class VisionProvider {
    protected config: VisionProviderSettings;

    constructor(config: VisionProviderSettings) {
        this.config = config;
    }

    abstract describeImage(imagePath: string, prompt: string): Promise<VisionResult>;
    abstract compareImages(image1Path: string, image2Path: string, prompt: string): Promise<VisionResult>;
    abstract describeBatch(imagePaths: string[], lastBatchContext: BatchContext | null, prompt: string): Promise<VisionResult>;
}
