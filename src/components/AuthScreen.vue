<template>
  <main class="auth-page">
    <section class="auth-intro">
      <p class="eyebrow"><GraduationCap :size="17" /> LearnIT Tests</p>
      <h1>Подготовка начинается<br><span>с одной попытки.</span></h1>
      <p>Создай аккаунт, подтверди почту и продолжай подготовку с любого устройства.</p>
      <div class="auth-features">
        <span><ChartNoAxesColumnIncreasing :size="18" /> История прогресса</span>
        <span><Trophy :size="18" /> Лучший балл</span>
        <span><RotateCcw :size="18" /> Работа над ошибками</span>
      </div>
    </section>
    <section class="auth-form-panel">
      <div class="auth-tabs">
        <button :class="{ active: formMode === 'login' }" @click="switchMode('login')">Вход</button>
        <button :class="{ active: formMode === 'register' }" @click="switchMode('register')">Регистрация</button>
      </div>
      <form @submit.prevent="submit">
        <div><h2>{{ formMode === 'login' ? 'С возвращением' : 'Создать аккаунт' }}</h2><p>{{ formMode === 'login' ? 'Войди по подтвержденной электронной почте.' : 'Имя будет отображаться в таблице лидеров.' }}</p></div>
        <label v-if="formMode === 'register'">Имя<input v-model="name" autocomplete="name" maxlength="30" placeholder="Например, Алексей" required /></label>
        <label>Email<input v-model="email" type="email" autocomplete="email" placeholder="name@example.com" required /></label>
        <label>Пароль
          <span class="password-input"><input v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="formMode === 'login' ? 'current-password' : 'new-password'" :minlength="formMode === 'register' ? 8 : 6" maxlength="128" :placeholder="formMode === 'register' ? 'Минимум 8 символов' : 'Введите пароль'" required /><button type="button" @click="showPassword = !showPassword" :title="showPassword ? 'Скрыть пароль' : 'Показать пароль'"><EyeOff v-if="showPassword" :size="18" /><Eye v-else :size="18" /></button></span>
        </label>
        <p v-if="error" class="auth-error"><CircleAlert :size="16" /> <span>{{ error }}</span></p>
        <p v-if="success" class="auth-success"><MailCheck :size="17" /> {{ success }}</p>
        <button class="primary auth-submit" :disabled="loading || registrationCoolingDown">{{ submitLabel }} <ArrowRight v-if="!loading && !registrationCoolingDown" :size="18" /></button>
        <small><LockKeyhole :size="13" /> Аккаунт и прогресс синхронизируются через Supabase. Пароль не хранится в приложении.</small>
      </form>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ArrowRight, ChartNoAxesColumnIncreasing, CircleAlert, Eye, EyeOff, GraduationCap, LockKeyhole, MailCheck, RotateCcw, Trophy } from 'lucide-vue-next'

const props = defineProps({ login: Function, register: Function })
const emit = defineEmits(['authenticated'])
const formMode = ref('login')
const name = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref('')
const cooldownUntil = ref(Number(localStorage.getItem('learnit-signup-cooldown')) || 0)
const now = ref(Date.now())
const registrationCoolingDown = computed(() => formMode.value === 'register' && cooldownUntil.value > now.value)
const cooldownMinutes = computed(() => Math.max(1, Math.ceil((cooldownUntil.value - now.value) / 60000)))
const submitLabel = computed(() => {
  if (loading.value) return 'Подождите…'
  if (registrationCoolingDown.value) return `Повторить через ${cooldownMinutes.value} мин.`
  return formMode.value === 'login' ? 'Войти' : 'Создать аккаунт'
})
const cooldownTimer = window.setInterval(() => {
  now.value = Date.now()
  if (cooldownUntil.value && cooldownUntil.value <= now.value) {
    cooldownUntil.value = 0
    localStorage.removeItem('learnit-signup-cooldown')
  }
}, 30000)

onBeforeUnmount(() => window.clearInterval(cooldownTimer))

function switchMode(mode) {
  formMode.value = mode
  error.value = ''
  success.value = ''
}

async function submit() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    if (formMode.value === 'register') {
      const result = await props.register(name.value, email.value, password.value)
      if (result.pendingConfirmation) {
        formMode.value = 'login'
        password.value = ''
        success.value = 'Мы отправили письмо. Перейдите по ссылке, чтобы подтвердить аккаунт.'
      } else emit('authenticated', result)
    } else {
      const account = await props.login(email.value, password.value)
      emit('authenticated', account)
    }
  } catch (reason) {
    error.value = reason.message
    if (reason.code === 'email_rate_limit') {
      cooldownUntil.value = Date.now() + reason.retryAfter * 1000
      now.value = Date.now()
      localStorage.setItem('learnit-signup-cooldown', String(cooldownUntil.value))
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-success {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #28704d;
  background: #edf7f1;
  border-left: 3px solid #3b8a61;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
}
</style>
