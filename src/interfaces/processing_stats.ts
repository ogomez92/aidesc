export default interface ProcessingStats {
    totalFrames: number;
    totalBatches: number;
    totalVisionInputCost: number;
    totalVisionOutputCost: number;
    totalTTSCost: number;
    totalCost: number;
}
