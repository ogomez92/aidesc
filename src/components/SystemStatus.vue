<script setup lang="ts">
import { VideoService } from '@services/video';
import { ref, onMounted } from 'vue';
import CliHelper from '@helpers/cli';
import DependencyCheckResult from '@interfaces/dependency_check_result';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const ffmpegStatus = ref('Checking ffmpeg status install...');
const ffprobeStatus = ref('Checking ffprobe status install...');

onMounted(async () => {
  const ffmpeg: DependencyCheckResult = await VideoService.isFfmpegInstalled();
  if (!ffmpeg.status) {
    ffmpegStatus.value = `${t('dep_ffmpeg_not_installed')}: ${ffmpeg.stdout}`;
    return;
  }

  ffmpegStatus.value = `${t('dep_ffmpeg_installed')}: ${CliHelper.extractVersionNumber(ffmpeg.stdout)}`;

  const ffprobe: DependencyCheckResult = await VideoService.isFfprobeInstalled();
  if (!ffprobe.status) {
    ffprobeStatus.value = `${t('dep_ffprobe_not_installed')}: ${ffprobe.stdout}`;
    return;
  }

  ffprobeStatus.value = `${t('dep_ffprobe_installed')}: ${CliHelper.extractVersionNumber(ffprobe.stdout)}`;
});
</script>

<template>
  <h2>{{ $t('system_status_title') }}</h2>
  <footer>
    <h3>{{ ffmpegStatus }}</h3>
    <h3>{{ ffprobeStatus }}</h3>
  </footer>
</template>

<style scoped></style>
