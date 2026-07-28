import { createApp } from 'vue'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource-variable/source-serif-4/wght.css'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/sw.js')
    window.setInterval(() => registration.update(), 60 * 60 * 1000)
  })
}
