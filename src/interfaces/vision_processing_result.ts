import ProcessingStats from "./processing_stats";
import VisionSegment from "./vision_segment";

export default interface VisionProcessingResult {
    stats: ProcessingStats;
    frameErrorFound: boolean;
    segments: VisionSegment[];
}
