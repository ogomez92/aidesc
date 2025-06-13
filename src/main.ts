import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import englishTranslation from '@assets/locale/en.json';
import { createPinia } from 'pinia';
import App from './App.vue';

import './style.css';
const i18n = createI18n({
  locale: 'en', // Set default locale
  messages: {
    en: englishTranslation,
  },
});

const app = createApp(App);
const pinia = createPinia();
app.use(i18n);
app.use(pinia)
    .mount('#app')
    .$nextTick(() => {
        postMessage({ payload: 'removeLoading' }, '*');
    });