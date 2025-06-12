<script setup lang="ts">
import {VideoService } from '@services/video';
import { ref, onMounted } from 'vue';
import DependencyCheckResult from '@interfaces/dependency_check_result';

const ffmpegStatus = ref('Checking ffmpeg status install...');
const ffprobeStatus = ref('Checking ffprobe status install...');

onMounted(async () => {
  const ffmpeg: DependencyCheckResult = await VideoService.isFfmpegInstalled();
  if (!ffmpeg.status) {
    ffmpegStatus.value = `Ffmpeg is not installed: ${ffmpeg.stdout}`;
    return;
  }

  ffmpegStatus.value = `Ffmpeg is installed: ${ffmpeg.stdout}`;

    const ffprobe: DependencyCheckResult = await VideoService.isFfprobeInstalled();
  if (!ffprobe.status) {
    ffprobeStatus.value = `ffprobe is not installed: ${ffprobe.stdout}`;
    return;
  }

  ffprobeStatus.value = `Ffprobe is installed: ${ffprobe.stdout}`;
});

</script>

<template>
  <h2>System Status</h2>
  <footer>
  <p>{{ ffmpegStatus }}</p>
  <p>{{ ffprobeStatus }}</p>
  </footer>
</template>

<style scoped></style>
