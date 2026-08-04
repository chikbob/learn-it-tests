<template>
  <main class="home">
    <div class="user-bar">
      <span class="user-avatar">{{ user.name.slice(0, 1).toUpperCase() }}</span>
      <span><small>Аккаунт</small><strong>{{ user.name }}</strong></span>
      <div class="user-actions">
        <button v-if="user.isAdmin" class="top-action admin" @click="$emit('admin')" title="Админ-панель"><Settings :size="18" /><span>Админ</span></button>
        <button class="top-action" @click="$emit('profile')" title="Профиль"><UserRound :size="18" /><span>Профиль</span></button>
        <button class="top-action" @click="$emit('leaderboard')" title="Таблица лидеров"><Trophy :size="18" /><span>Лидеры</span></button>
        <button class="top-action logout" @click="$emit('logout')" title="Выйти из аккаунта"><LogOut :size="18" /></button>
      </div>
    </div>
    <div v-if="!isOnline || pendingSyncCount" class="offline-notice" role="status">
      <WifiOff v-if="!isOnline" :size="18" />
      <CloudUpload v-else :size="18" />
      <span><b>{{ isOnline ? 'Загружаем результаты' : 'Работаем офлайн' }}</b>{{ isOnline ? 'История синхронизируется с аккаунтом.' : 'Можно проходить тесты. Результаты загрузятся, когда появится интернет.' }}</span>
    </div>
    <section class="intro">
      <div>
        <p class="eyebrow"><Sparkles :size="16" /> Подготовка к магистратуре</p>
        <h1>Тренируй знания.<br><span>Понимай ошибки.</span></h1>
        <p class="lead">Вопросы по программе вступительного экзамена: от базовых терминов до SQL, кода и расчета подсетей.</p>
      </div>
      <div class="progress-panel">
        <div class="progress-title"><span>Твой прогресс</span><strong>{{ progress.sessions }} сессий</strong></div>
        <div class="big-stat">{{ totalAccuracy }}<small>%</small></div>
        <p>Общая точность</p>
        <div class="meter"><span :style="{ width: totalAccuracy + '%' }"></span></div>
        <div class="mini-stats"><span><b>{{ totalAccuracy }}%</b> общая точность</span><span><b>{{ examAccuracy }}%</b> средняя точность экзаменов</span></div>
      </div>
    </section>

    <section class="setup">
      <div class="section-heading"><div><p class="step">01</p><h2>Выбери направление</h2></div></div>
      <div class="segmented">
        <button :class="{ active: track === 'it' }" @click="$emit('update:track', 'it')"><BookOpen :size="20" /> Информационные технологии</button>
        <button :class="{ active: track === 'security' }" @click="$emit('update:track', 'security')"><ShieldCheck :size="20" /> Информационная безопасность</button>
      </div>

      <div class="section-heading"><div><p class="step">02</p><h2>Режим тренировки</h2></div><span>Прогресс и избранное связаны с аккаунтом</span></div>
      <div class="mode-grid">
        <button v-for="item in modes" :key="item.id" class="mode-card" :class="{ active: mode === item.id }" :disabled="item.id === 'favorites' && !item.count" @click="$emit('update:mode', item.id)">
          <span class="mode-icon"><component :is="item.icon" :size="22" /></span>
          <span class="mode-copy"><strong>{{ item.title }}</strong><small>{{ item.note }}</small></span>
          <span class="count">{{ item.count }}</span>
        </button>
      </div>

      <div v-if="mode === 'thematic'" class="topics">
        <label>Тема теста</label>
        <div class="topic-list">
          <button v-for="([key, item]) in availableSections" :key="key" :class="{ active: selectedSection === key }" @click="$emit('update:selectedSection', key)"><span :style="{ background: item.color }"></span>{{ item.short }}</button>
        </div>
      </div>

      <div class="actions">
        <button class="primary" :disabled="mode === 'favorites' && !progress.favorites.length" @click="$emit('start')">Начать тест <ArrowRight :size="19" /></button>
        <button class="secondary" @click="$emit('catalog')"><LibraryBig :size="18" /> Справочник вопросов</button>
        <button v-if="progress.activeQuiz" class="secondary" @click="$emit('resume')"><Clock3 :size="18" /> Продолжить тест</button>
        <button v-if="progress.mistakes.length" class="secondary" @click="$emit('mistakes')"><RotateCcw :size="18" /> Повторить ошибки <b>{{ progress.mistakes.length }}</b></button>
      </div>
    </section>

    <section v-if="progress.history.length" class="history-section">
      <div class="section-heading"><div><History :size="20" /><h2>История прохождений</h2></div><button class="clear-button" @click="$emit('clear')"><Trash2 :size="16" /> Очистить историю</button></div>
      <div class="history-toolbar">
        <label>Режим
          <select v-model="historyMode">
            <option value="all">Все прохождения</option>
            <option value="diagnostic">Диагностика</option>
            <option value="thematic">По теме</option>
            <option value="exam">Экзамен</option>
            <option value="mistakes">Работа над ошибками</option>
            <option value="favorites">Избранное</option>
            <option value="technical">Технические вопросы</option>
            <option value="humanities">Гуманитарные вопросы</option>
            <option value="marathon">Марафон</option>
          </select>
        </label>
        <span>{{ filteredHistory.length }} {{ filteredHistory.length === 1 ? 'результат' : 'результатов' }}</span>
      </div>
      <div class="history-list">
        <button v-for="session in pagedHistory" :key="session.id" class="history-row" @click="$emit('review', session)">
          <span>{{ formatDate(session.date) }}</span>
          <strong>{{ modeLabel(session.mode) }}<small>{{ session.track === 'security' ? 'ИБ' : 'ИТ' }}<template v-if="session.topic && sections[session.topic]"> · {{ sections[session.topic].short }}</template><em v-if="session.syncStatus === 'pending'"><CloudUpload :size="12" /> Загрузится при подключении к интернету</em></small></strong>
          <b>{{ session.grade ? `${session.grade} б.` : `${session.score}/${session.total}` }}</b>
          <i>{{ Math.round(session.score / session.total * 100) }}% <ChevronRight :size="15" /></i>
        </button>
        <p v-if="!filteredHistory.length" class="empty-state">В этом режиме пока нет завершенных тестов.</p>
      </div>
      <nav v-if="historyPages > 1" class="history-pagination" aria-label="Страницы истории">
        <button :disabled="historyPage === 1" @click="historyPage--"><ChevronLeft :size="16" /> Назад</button>
        <button v-for="page in historyPages" :key="page" :class="{ active: historyPage === page }" @click="historyPage = page">{{ page }}</button>
        <button :disabled="historyPage === historyPages" @click="historyPage++">Вперёд <ChevronRight :size="16" /></button>
      </nav>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clock3, CloudUpload, History, LibraryBig, LogOut, RotateCcw, Settings, ShieldCheck, Sparkles, Trash2, Trophy, UserRound, WifiOff } from 'lucide-vue-next'
import { sections } from '../questions'

const props = defineProps({ user: Object, progress: Object, totalAccuracy: Number, examAccuracy: Number, modes: Array, track: String, mode: String, selectedSection: String, availableSections: Array, modeLabel: Function, isOnline: Boolean, syncing: Boolean, pendingSyncCount: Number })
defineEmits(['update:track', 'update:mode', 'update:selectedSection', 'start', 'resume', 'mistakes', 'catalog', 'clear', 'review', 'leaderboard', 'profile', 'admin', 'logout'])

const historyMode = ref('all')
const historyPage = ref(1)
const historyPageSize = 10
const filteredHistory = computed(() => props.progress.history.filter(session => historyMode.value === 'all' || session.mode === historyMode.value))
const historyPages = computed(() => Math.max(1, Math.ceil(filteredHistory.value.length / historyPageSize)))
const pagedHistory = computed(() => filteredHistory.value.slice((historyPage.value - 1) * historyPageSize, historyPage.value * historyPageSize))
watch(historyMode, () => { historyPage.value = 1 })

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
</script>

<style scoped>
.user-actions { display: flex; align-items: center; gap: 7px; }
.offline-notice { margin: -22px 0 32px; padding: 12px 14px; border-left: 3px solid #d0a944; background: #fff9e9; color: #5d4b20; display: flex; align-items: center; gap: 10px; }.offline-notice span { display: grid; gap: 2px; font-size: 11px; }.offline-notice b { font-size: 12px; }.history-row small em { margin-left: 10px; color: #9b6f13; display: inline-flex; align-items: center; gap: 4px; font-style: normal; font-weight: 700; }
.top-action { min-height: 42px; padding: 0 13px; border: 1px solid #bbc7c2; border-radius: 5px; background: transparent; color: #173f3a; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; font-size: 12px; font-weight: 800; }.top-action:hover { background: #edf3f1; }.top-action.admin { color: #80610f; border-color: #d9c47f; }.top-action.logout { width: 42px; padding: 0; color: #8d413b; border-color: #d8c7c3; }
.history-pagination { margin-top: 16px; display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; }.history-pagination button { min-height: 36px; padding: 0 11px; border: 1px solid #d5dcd7; border-radius: 4px; background: #fff; color: #46534e; display: inline-flex; align-items: center; gap: 4px; justify-content: center; font-size: 11px; font-weight: 800; cursor: pointer; }.history-pagination button.active { background: #173f3a; border-color: #173f3a; color: #fff; }.history-pagination button:disabled { opacity: .45; cursor: default; }
@media (max-width: 760px) {
  .user-bar { display: grid; grid-template-columns: 44px minmax(60px,1fr) auto; gap: 10px; }
  .user-actions { gap: 4px; padding: 3px; border: 1px solid #d5ddd8; border-radius: 6px; background: #fff; }
  .top-action { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 4px; }
  .top-action span { display: none; }
  .top-action.admin,.top-action.logout { width: 44px; border: 0; }
  .offline-notice { margin-top: -18px; }.history-row small em { margin: 4px 0 0; display: flex; }
}
@media (max-width: 390px) {
  .user-bar { grid-template-columns: 44px minmax(0,1fr); }
  .user-actions { grid-column: 1 / -1; justify-content: flex-end; }
}
</style>
