<script setup lang="ts">
import VideoService from '@services/video.ts';
import { ref, onMounted } from 'vue';
import DependencyCheckResult from '@interfaces/dependency_check_result';

const ffmpegStatus = ref('Checking ffmpeg status install...');
const ffprobeStatus = ref('Checking ffprobe status install...');

onMounted(async () => {
  const ffmpeg: DependencyCheckResult = VideoService.isFfmpegInstalled();
  if (!ffmpeg.result) {
    ffmpegStatus.value = `Ffmpeg is not installed: ${ffmpeg.stdout}`;
    return;
  }

  ffmpegStatus.value = `Ffmpeg is installed: ${ffmpeg.stdout}`;

    const ffprobe: DependencyCheckResult = VideoService.isFfprobeInstalled();
  if (!ffprobe.result) {
    ffprobeStatus.value = `ffprobe is not installed: ${ffprobe.stdout}`;
    return;
  }

  ffprobeStatus.value = `Ffprobe is installed: ${ffprobe.stdout}`;
});

</script>

<template>
  <h2>System Status</h2>
  <p>{{ ffmpegStatus }}</p>
  <p>{{ ffprobeStatus }}</p>
</template>

<style scoped></style>
