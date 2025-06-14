import AudioSegment from "./audio_segment";
import ProcessingStats from "./processing_stats";

export default interface TTSProcessingResult {
    audioDescriptionFilePath: string;
    audioSegments: AudioSegment[];
    stats: ProcessingStats;
}
