import ProcessingStats from "./processing_stats";

export default interface TTSProcessingResult {
    videoFile: string;
    audioDescriptionFile: string;
    stats: ProcessingStats;
}
