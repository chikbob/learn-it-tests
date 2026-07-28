<template>
  <main class="profile-page">
    <div class="profile-header">
      <button class="icon-button" @click="$emit('home')" title="На главную"><ArrowLeft :size="21" /></button>
      <div><p class="eyebrow"><UserRound :size="16" /> Аккаунт</p><h1>Профиль</h1></div>
    </div>
    <section class="profile-layout">
      <div class="profile-summary">
        <span>{{ user.name.slice(0, 1).toUpperCase() }}</span>
        <h2>{{ user.name }}</h2>
        <p>{{ user.email }}</p>
        <small><Cloud :size="14" /> Прогресс синхронизируется</small>
      </div>
      <form class="password-form" @submit.prevent="submit">
        <div><p class="step">Безопасность</p><h2>{{ passwordRecovery ? 'Задайте новый пароль' : 'Изменить пароль' }}</h2><p>{{ passwordRecovery ? 'Ссылка подтверждена. Новый пароль заменит текущий на всех устройствах.' : 'Мы отправим защищенную ссылку на почту аккаунта.' }}</p></div>
        <template v-if="passwordRecovery">
          <label>Новый пароль<input v-model="password" type="password" autocomplete="new-password" minlength="6" placeholder="Минимум 6 символов" required /></label>
          <label>Повторите пароль<input v-model="confirmation" type="password" autocomplete="new-password" minlength="6" placeholder="Введите пароль еще раз" required /></label>
        </template>
        <p v-if="error" class="profile-message error"><CircleAlert :size="16" /> {{ error }}</p>
        <p v-if="successMessage" class="profile-message success"><CircleCheck :size="16" /> {{ successMessage }}</p>
        <button class="primary" :disabled="loading || Boolean(successMessage)">{{ loading ? 'Подождите…' : passwordRecovery ? 'Сохранить пароль' : 'Отправить ссылку' }} <Mail v-if="!loading && !passwordRecovery" :size="17" /><KeyRound v-else-if="!loading" :size="17" /></button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { ArrowLeft, CircleAlert, CircleCheck, Cloud, KeyRound, Mail, UserRound } from 'lucide-vue-next'

const props = defineProps({ user: Object, passwordRecovery: Boolean, requestPasswordReset: Function, updatePassword: Function })
defineEmits(['home'])
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

async function submit() {
  error.value = ''
  successMessage.value = ''
  if (props.passwordRecovery && password.value !== confirmation.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  loading.value = true
  try {
    const wasRecovery = props.passwordRecovery
    if (wasRecovery) await props.updatePassword(password.value)
    else await props.requestPasswordReset(props.user.email)
    password.value = ''
    confirmation.value = ''
    successMessage.value = wasRecovery ? 'Пароль успешно изменен' : 'Письмо отправлено. Проверьте входящие и папку «Спам».'
  } catch (reason) {
    error.value = reason.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.profile-page { max-width: 900px; margin: auto; padding: 55px 28px 80px; }
.profile-header { display: flex; gap: 22px; align-items: flex-start; margin-bottom: 36px; }
.profile-header h1 { font-size: 48px; margin: 8px 0; }
.profile-layout { display: grid; grid-template-columns: 280px 1fr; gap: 45px; align-items: start; }
.profile-summary { border-top: 4px solid #e4c570; background: white; padding: 28px; text-align: center; }
.profile-summary > span { width: 68px; height: 68px; margin: auto; display: grid; place-items: center; border-radius: 50%; background: #173f3a; color: white; font: 700 30px 'Source Serif 4', serif; }
.profile-summary h2 { margin: 15px 0 4px; font: 700 24px 'Source Serif 4', serif; }
.profile-summary p { margin: 0; color: #66716e; font-size: 12px; overflow-wrap: anywhere; }
.profile-summary small { margin-top: 22px; padding-top: 16px; border-top: 1px solid #e5e9e5; display: flex; justify-content: center; align-items: center; gap: 6px; color: #2d7f77; font-size: 10px; font-weight: 700; }
.password-form { display: grid; gap: 18px; background: white; border: 1px solid #dce2dd; padding: 30px; }
.password-form h2 { margin: 10px 0 6px; font: 700 26px 'Source Serif 4', serif; }
.password-form > div > p:last-child { margin: 0; color: #78817f; font-size: 12px; }
.password-form label { display: grid; gap: 7px; color: #44504c; font-size: 10px; text-transform: uppercase; font-weight: 800; }
.password-form input { height: 46px; border: 1px solid #d3dad5; border-radius: 4px; padding: 0 12px; font: 600 14px Manrope, sans-serif; outline: 0; }
.password-form input:focus { border-color: #2d7f77; box-shadow: 0 0 0 3px rgba(45,127,119,.1); }
.profile-message { margin: 0; display: flex; gap: 7px; align-items: center; font-size: 12px; }.profile-message.error { color: #a3423d; }.profile-message.success { color: #28704d; }
.password-form .primary { justify-self: start; }
@media (max-width: 700px) { .profile-page { padding: 30px 14px 60px; }.profile-header h1 { font-size: 38px; }.profile-layout { grid-template-columns: 1fr; gap: 20px; }.password-form { padding: 22px 18px; }.password-form .primary { width: 100%; } }
</style>
