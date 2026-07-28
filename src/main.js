import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/sw.js')
    window.setInterval(() => registration.update(), 60 * 60 * 1000)
  })
}
