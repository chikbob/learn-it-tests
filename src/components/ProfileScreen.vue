<template>
  <main class="profile-page">
    <div class="profile-header">
      <button class="icon-button" @click="$emit('home')" title="На главную"><ArrowLeft :size="21" /></button>
      <div><p class="eyebrow"><UserRound :size="16" /> Аккаунт</p><h1>Профиль</h1></div>
    </div>
    <section class="account-overview">
      <span class="profile-avatar">{{ user.name.slice(0, 1).toUpperCase() }}</span>
      <div class="profile-identity">
        <small>Участник LearnIT Tests</small>
        <h2>{{ user.name }}</h2>
        <p><Mail :size="15" /> {{ user.email }}</p>
      </div>
      <span class="sync-status"><Cloud :size="15" /> Данные синхронизированы</span>
    </section>

    <section class="profile-stats" aria-label="Статистика подготовки">
      <div><span><Layers3 :size="18" /></span><b>{{ progress.sessions }}</b><small>тестов завершено</small></div>
      <div><span><Target :size="18" /></span><b>{{ totalAccuracy }}%</b><small>общая точность</small></div>
      <div><span><CheckCircle2 :size="18" /></span><b>{{ examAccuracy }}%</b><small>средняя точность экзаменов</small></div>
      <div><span><Star :size="18" /></span><b>{{ progress.favorites.length }}</b><small>в избранном</small></div>
    </section>

    <section class="settings-section identity-settings">
      <div class="security-copy">
        <span><BadgeCheck :size="20" /></span>
        <div><p class="step">Личные данные</p><h2>Отображаемое имя</h2><p>Это имя видно в приложении и таблице лидеров. Оно не обязано быть уникальным.</p></div>
      </div>
      <form class="password-form" @submit.prevent="submitName">
        <label>Имя<input v-model="displayName" maxlength="30" autocomplete="name" placeholder="От 2 до 30 символов" required /></label>
        <p v-if="nameError" class="profile-message error"><CircleAlert :size="16" /> {{ nameError }}</p>
        <p v-if="nameSuccess" class="profile-message success"><CircleCheck :size="16" /> {{ nameSuccess }}</p>
        <button class="secondary" :disabled="nameLoading || displayName.trim() === user.name">{{ nameLoading ? 'Сохраняем…' : 'Сохранить имя' }} <Save v-if="!nameLoading" :size="17" /></button>
      </form>
    </section>

    <section class="settings-section security-section">
      <div class="security-copy">
        <span><ShieldCheck :size="20" /></span>
        <div><p class="step">Безопасность</p><h2>{{ passwordRecovery ? 'Задайте новый пароль' : 'Пароль аккаунта' }}</h2><p>{{ passwordRecovery ? 'Ссылка подтверждена. Новый пароль заменит текущий на всех устройствах.' : 'Изменение подтверждается ссылкой, отправленной на почту аккаунта.' }}</p></div>
      </div>
      <form class="password-form" @submit.prevent="submit">
        <template v-if="passwordRecovery">
          <label>Новый пароль<input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Минимум 8 символов" required /></label>
          <label>Повторите пароль<input v-model="confirmation" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Введите пароль еще раз" required /></label>
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
import { ArrowLeft, BadgeCheck, CheckCircle2, CircleAlert, CircleCheck, Cloud, KeyRound, Layers3, Mail, Save, ShieldCheck, Star, Target, UserRound } from 'lucide-vue-next'

const props = defineProps({ user: Object, progress: Object, totalAccuracy: Number, examAccuracy: Number, passwordRecovery: Boolean, requestPasswordReset: Function, updatePassword: Function, updateDisplayName: Function })
defineEmits(['home'])
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const displayName = ref(props.user.name)
const nameLoading = ref(false)
const nameError = ref('')
const nameSuccess = ref('')

async function submitName() {
  nameError.value = ''
  nameSuccess.value = ''
  nameLoading.value = true
  try {
    displayName.value = await props.updateDisplayName(displayName.value)
    nameSuccess.value = 'Имя обновлено на всех устройствах'
  } catch (reason) {
    nameError.value = reason.message
  } finally {
    nameLoading.value = false
  }
}

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
.profile-page { max-width: 980px; margin: auto; padding: 55px 28px 80px; }
.profile-header { display: flex; gap: 22px; align-items: flex-start; margin-bottom: 36px; }
.profile-header h1 { font-size: 48px; margin: 8px 0; }
.account-overview { min-height: 136px; padding: 28px 30px; border-top: 4px solid #e4c570; background: white; display: flex; align-items: center; gap: 20px; }
.profile-avatar { width: 72px; height: 72px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: #173f3a; color: white; font: 700 31px 'Source Serif 4 Variable', serif; }
.profile-identity { min-width: 0; flex: 1; }.profile-identity > small { color: #2d7f77; font-size: 11px; text-transform: uppercase; font-weight: 800; }.profile-identity h2 { margin: 5px 0 7px; font: 700 28px 'Source Serif 4 Variable', serif; }.profile-identity p { margin: 0; color: #66716e; display: flex; align-items: center; gap: 7px; font-size: 12px; overflow-wrap: anywhere; }
.sync-status { padding: 9px 11px; border: 1px solid #cfe0d9; border-radius: 4px; color: #28704d; background: #edf7f1; display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 800; }
.profile-stats { margin: 18px 0 34px; display: grid; grid-template-columns: repeat(4,1fr); border: 1px solid #dce2dd; background: white; }
.profile-stats > div { min-height: 112px; padding: 20px; border-left: 1px solid #e5e9e5; display: grid; grid-template-columns: 32px 1fr; align-content: center; column-gap: 10px; }.profile-stats > div:first-child { border-left: 0; }.profile-stats span { width: 32px; height: 32px; grid-row: 1/3; display: grid; place-items: center; border-radius: 4px; background: #e9f1ee; color: #2d7f77; }.profile-stats b { font: 700 25px 'Source Serif 4 Variable', serif; }.profile-stats small { color: #66716e; font-size: 11px; text-transform: uppercase; font-weight: 700; }
.settings-section { border-top: 1px solid #dce2dd; padding-top: 30px; display: grid; grid-template-columns: minmax(260px,.8fr) minmax(360px,1.2fr); gap: 55px; }
.identity-settings { margin-bottom: 34px; }
.security-copy { display: flex; align-items: flex-start; gap: 13px; }.security-copy > span { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 5px; display: grid; place-items: center; background: #e9f1ee; color: #2d7f77; }.security-copy h2 { margin: 7px 0; font: 700 26px 'Source Serif 4 Variable', serif; }.security-copy p:last-child { margin: 0; color: #66716e; font-size: 12px; line-height: 1.65; }
.password-form { display: grid; gap: 18px; background: white; border: 1px solid #dce2dd; padding: 26px; }
.password-form label { display: grid; gap: 7px; color: #44504c; font-size: 11px; text-transform: uppercase; font-weight: 800; }
.password-form input { height: 46px; border: 1px solid #d3dad5; border-radius: 4px; padding: 0 12px; font: 600 14px 'Manrope Variable', sans-serif; outline: 0; }
.password-form input:focus { border-color: #2d7f77; box-shadow: 0 0 0 3px rgba(45,127,119,.1); }
.profile-message { margin: 0; display: flex; gap: 7px; align-items: center; font-size: 12px; }.profile-message.error { color: #a3423d; }.profile-message.success { color: #28704d; }
.password-form .primary, .password-form .secondary { justify-self: start; }
@media (max-width: 700px) { .profile-page { padding: 30px 14px 60px; }.profile-header h1 { font-size: 38px; }.account-overview { padding: 22px 18px; flex-wrap: wrap; }.profile-avatar { width: 60px; height: 60px; }.sync-status { width: 100%; justify-content: center; }.profile-stats { grid-template-columns: repeat(2,1fr); }.profile-stats > div:nth-child(3) { border-left: 0; border-top: 1px solid #e5e9e5; }.profile-stats > div:nth-child(4) { border-top: 1px solid #e5e9e5; }.settings-section { grid-template-columns: 1fr; gap: 20px; }.password-form { padding: 22px 18px; }.password-form .primary, .password-form .secondary { width: 100%; } }
</style>
