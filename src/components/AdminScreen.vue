<template>
  <main class="admin-page">
    <header class="admin-header">
      <div><p class="eyebrow"><ShieldCheck :size="17" /> Управление</p><h1>Админ-панель</h1><p>Состояние аккаунтов и учебной активности.</p></div>
      <div class="admin-actions"><button class="secondary" @click="$emit('app')"><BookOpen :size="17" /> В приложение</button><button class="icon-button" @click="$emit('logout')" title="Выйти"><LogOut :size="18" /></button></div>
    </header>

    <section v-if="loading" class="admin-loading"><span></span><p>Собираем статистику…</p></section>
    <template v-else-if="!error">
      <section class="admin-stats">
        <div><Users :size="19" /><span><b>{{ users.length }}</b><small>пользователей</small></span></div>
        <div><ClipboardCheck :size="19" /><span><b>{{ totalSessions }}</b><small>тестов завершено</small></span></div>
        <div><Target :size="19" /><span><b>{{ averageAccuracy }}%</b><small>средняя точность</small></span></div>
        <div><Gauge :size="19" /><span><b>{{ simulations }}</b><small>симуляций</small></span></div>
      </section>

      <section class="admin-table-wrap">
        <div class="admin-table-heading"><div><h2>Пользователи</h2><p>Данные обновляются из Supabase при открытии панели.</p></div><button class="icon-button" @click="load" title="Обновить"><RefreshCw :size="17" /></button></div>
        <div class="admin-columns"><span>Аккаунт</span><span>Роль</span><span>Тесты</span><span>Точность</span><span>Симуляции</span><span>Регистрация</span></div>
        <div v-for="item in users" :key="item.user_id" class="admin-row">
          <span class="admin-user"><i>{{ item.display_name.slice(0, 1).toUpperCase() }}</i><span><b>{{ item.display_name }}</b><small>{{ item.email }}</small></span></span>
          <span><em :class="item.role">{{ item.role === 'admin' ? 'Админ' : 'Ученик' }}</em></span>
          <span><b>{{ item.sessions }}</b></span>
          <span><b>{{ item.accuracy }}%</b></span>
          <span><b>{{ item.simulation_count }}</b><small v-if="item.simulation_count"> · {{ item.average_grade }} б.</small></span>
          <span>{{ formatDate(item.joined_at) }}</span>
        </div>
      </section>
    </template>
    <section v-else class="admin-error"><CircleAlert :size="22" /><div><b>Не удалось открыть панель</b><p>{{ error }}</p></div><button class="secondary" @click="load">Повторить</button></section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { BookOpen, CircleAlert, ClipboardCheck, Gauge, LogOut, RefreshCw, ShieldCheck, Target, Users } from 'lucide-vue-next'

const props = defineProps({ loadUsers: Function })
defineEmits(['app', 'logout'])
const users = ref([])
const loading = ref(true)
const error = ref('')
const totalSessions = computed(() => users.value.reduce((sum, user) => sum + user.sessions, 0))
const simulations = computed(() => users.value.reduce((sum, user) => sum + user.simulation_count, 0))
const averageAccuracy = computed(() => users.value.length ? Math.round(users.value.reduce((sum, user) => sum + user.accuracy, 0) / users.value.length) : 0)

async function load() {
  loading.value = true
  error.value = ''
  try { users.value = await props.loadUsers() } catch (reason) { error.value = reason.message } finally { loading.value = false }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

onMounted(load)
</script>

<style scoped>
.admin-page { max-width: 1180px; margin: auto; padding: 55px 28px 80px; }
.admin-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 30px; margin-bottom: 40px; }.admin-header h1 { font-size: 50px; margin: 8px 0; }.admin-header > div:first-child > p:last-child { margin: 0; color: #66716e; font-size: 13px; }.admin-actions { display: flex; gap: 8px; }
.admin-stats { display: grid; grid-template-columns: repeat(4,1fr); border: 1px solid #dce2dd; background: white; margin-bottom: 28px; }.admin-stats > div { min-height: 106px; padding: 22px; border-left: 1px solid #e5e9e5; display: flex; align-items: center; gap: 13px; color: #2d7f77; }.admin-stats > div:first-child { border-left: 0; }.admin-stats span { display: flex; flex-direction: column; }.admin-stats b { color: #182321; font: 700 28px 'Source Serif 4', serif; }.admin-stats small { color: #78817f; font-size: 9px; text-transform: uppercase; font-weight: 800; }
.admin-table-wrap { border: 1px solid #dce2dd; background: white; overflow: hidden; }.admin-table-heading { min-height: 88px; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; }.admin-table-heading h2 { margin: 0 0 5px; font: 700 25px 'Source Serif 4', serif; }.admin-table-heading p { margin: 0; color: #78817f; font-size: 11px; }.admin-columns,.admin-row { display: grid; grid-template-columns: minmax(220px,1.4fr) 80px 65px 80px 110px 105px; gap: 16px; align-items: center; }.admin-columns { min-height: 40px; padding: 0 22px; background: #edf1ed; color: #78817f; font-size: 9px; text-transform: uppercase; font-weight: 800; }.admin-row { min-height: 72px; padding: 10px 22px; border-top: 1px solid #e7ebe7; font-size: 12px; }.admin-user { display: flex; align-items: center; gap: 11px; min-width: 0; }.admin-user > i { width: 36px; height: 36px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: #173f3a; color: white; font-style: normal; font-weight: 800; }.admin-user > span { min-width: 0; display: flex; flex-direction: column; }.admin-user small { overflow: hidden; text-overflow: ellipsis; color: #78817f; }.admin-row em { padding: 4px 7px; border-radius: 3px; background: #edf1ed; color: #66716e; font-size: 9px; font-style: normal; font-weight: 800; }.admin-row em.admin { color: #8a6812; background: #fff4cf; }.admin-row > span:last-child { color: #66716e; }
.admin-loading { min-height: 320px; display: grid; place-content: center; justify-items: center; color: #66716e; font-size: 12px; }.admin-loading span { width: 30px; height: 30px; border: 3px solid #dce5e1; border-top-color: #2d7f77; border-radius: 50%; animation: spin .8s linear infinite; }.admin-error { padding: 24px; border: 1px solid #e3bbb7; background: #fff3f1; display: flex; gap: 13px; align-items: center; color: #a3423d; }.admin-error div { flex: 1; }.admin-error p { margin: 4px 0 0; font-size: 12px; }
@media (max-width: 760px) { .admin-page { padding: 28px 14px 60px; }.admin-header { align-items: center; }.admin-header h1 { font-size: 37px; }.admin-actions .secondary { width: 42px; padding: 0; font-size: 0; }.admin-stats { grid-template-columns: repeat(2,1fr); }.admin-stats > div:nth-child(3) { border-left: 0; border-top: 1px solid #e5e9e5; }.admin-stats > div:nth-child(4) { border-top: 1px solid #e5e9e5; }.admin-table-wrap { overflow-x: auto; }.admin-table-heading,.admin-columns,.admin-row { min-width: 850px; } }
</style>
