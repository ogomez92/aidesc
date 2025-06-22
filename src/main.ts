import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createPinia } from 'pinia';
import App from './App.vue';
const translations = import.meta.glob('@assets/locale/*.json', { eager: true });
import './style.css';

type Translation = { [key: string]: string };

function loadTranslations() {
  const loadedTranslations: { [key: string]: Translation } = {};

  for (const path in translations) {
    const match = path.match(/([\w-]+)(?=\.json$)/);
    const lang = match ? match[0] : null;

    if (lang) {
      loadedTranslations[lang] = (translations[path] as { default: Translation }).default;
    } else {
      console.warn(`No valid language code found in path: ${path}`);
    }
  }

  return loadedTranslations;
}

const loadedTranslations = loadTranslations();
const i18n = createI18n({
  locale: navigator.language, // Set default locale
  fallbackLocale: 'en',
  legacy: false, // you must set `false`, to use Composition API
  messages: loadedTranslations,
});

const app = createApp(App);
const pinia = createPinia();
app.use(i18n);
app.use(pinia)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*');
  });