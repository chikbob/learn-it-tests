import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

if (import.meta.env.PROD) registerSW({ immediate: true })
