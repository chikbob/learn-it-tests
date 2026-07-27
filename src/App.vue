<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Clock3, History, RotateCcw, ShieldCheck, Sparkles, Target, Trash2, Trophy, X } from 'lucide-vue-next'
import { difficultyLabels, questions, sections } from './questions'

const screen = ref('home')
const track = ref('it')
const selectedSection = ref('networks')
const mode = ref('diagnostic')
const quiz = ref([])
const index = ref(0)
const selected = ref(null)
const answers = ref([])

const emptyProgress = () => ({ sessions: 0, correct: 0, total: 0, mistakes: [], mastery: {}, history: [], activeQuiz: null })
const stored = JSON.parse(localStorage.getItem('learnit-progress') || 'null')
const progress = ref({ ...emptyProgress(), ...(stored || {}) })

const availableSections = computed(() => Object.entries(sections).filter(([key]) => track.value === 'security' || key !== 'security'))
const current = computed(() => quiz.value[index.value])
const isExam = computed(() => mode.value === 'exam')
const answered = computed(() => answers.value[index.value] !== undefined)
const isCorrect = computed(() => answered.value && answers.value[index.value] === current.value.correct)
const totalAccuracy = computed(() => progress.value.total ? Math.round(progress.value.correct / progress.value.total * 100) : 0)
const sessionScore = computed(() => answers.value.filter((a, i) => a === quiz.value[i]?.correct).length)
const wrongQuestions = computed(() => quiz.value.filter((q, i) => answers.value[i] !== q.correct))
const resultsBySection = computed(() => {
  const map = {}
  quiz.value.forEach((q, i) => {
    map[q.section] ||= { total: 0, correct: 0 }
    map[q.section].total++
    if (answers.value[i] === q.correct) map[q.section].correct++
  })
  return Object.entries(map).map(([key, value]) => ({ key, ...value, percent: Math.round(value.correct / value.total * 100) }))
})

const modes = [
  { id: 'diagnostic', icon: Target, title: 'Диагностика', note: 'Все разделы, разбор после ответа', count: 30 },
  { id: 'thematic', icon: BookOpen, title: 'По теме', note: '70% выбранной темы, 30% связанных', count: 15 },
  { id: 'exam', icon: Clock3, title: 'Симуляция', note: '40 вопросов по весам экзамена', count: 40 },
]

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5)
}

function allocateCounts(weights, count) {
  const rows = Object.entries(weights).map(([key, ratio]) => ({ key, exact: ratio * count, value: Math.floor(ratio * count) }))
  let remaining = count - rows.reduce((sum, row) => sum + row.value, 0)
  rows.sort((a, b) => (b.exact - b.value) - (a.exact - a.value))
  rows.forEach(row => { if (remaining-- > 0) row.value++ })
  return Object.fromEntries(rows.map(row => [row.key, row.value]))
}

function balancedPick(pool, count) {
  const targets = { surface: .35, understanding: .35, application: .25, trick: .05 }
  const allocation = allocateCounts(targets, Math.min(count, pool.length))
  const picked = []
  Object.entries(allocation).forEach(([level, amount]) => {
    picked.push(...shuffle(pool.filter(q => q.difficulty === level)).slice(0, amount))
  })
  const rest = shuffle(pool.filter(q => !picked.includes(q)))
  return shuffle([...picked, ...rest].slice(0, Math.min(count, pool.length)))
}

function weightedPool(pool, weights, count) {
  const picked = []
  Object.entries(allocateCounts(weights, count)).forEach(([section, amount]) => {
    picked.push(...balancedPick(pool.filter(q => q.section === section), amount))
  })
  return shuffle([...picked, ...balancedPick(pool.filter(q => !picked.includes(q)), count - picked.length)]).slice(0, count)
}

function persist() {
  localStorage.setItem('learnit-progress', JSON.stringify(progress.value))
}

function startQuiz(kind = mode.value) {
  mode.value = kind
  let pool = questions.filter(q => track.value === 'security' || q.section !== 'security')
  let count = modes.find(m => m.id === kind)?.count || 12
  if (kind === 'thematic') {
    const primary = shuffle(pool.filter(q => q.section === selectedSection.value))
    const related = shuffle(pool.filter(q => q.section !== selectedSection.value))
    pool = [...primary.slice(0, Math.ceil(count * .7)), ...related.slice(0, Math.floor(count * .3))]
  }
  if (kind === 'mistakes') {
    pool = questions.filter(q => progress.value.mistakes.includes(q.id))
    count = pool.length
  }
  if (kind === 'exam' || kind === 'diagnostic') {
    const weights = track.value === 'security'
      ? { security: .24, databases: .20, algorithms: .20, modeling: .14, networks: .10, information: .07, graphics: .05 }
      : { networks: .24, databases: .22, algorithms: .22, modeling: .16, graphics: .08, information: .08 }
    quiz.value = weightedPool(pool, weights, count)
  } else quiz.value = balancedPick(pool, count)
  index.value = 0
  answers.value = []
  selected.value = null
  screen.value = 'quiz'
  progress.value.activeQuiz = { ids: quiz.value.map(q => q.id), mode: kind, track: track.value, selectedSection: selectedSection.value, index: 0, answers: [] }
  persist()
}

function resumeQuiz() {
  const active = progress.value.activeQuiz
  if (!active) return
  quiz.value = active.ids.map(id => questions.find(q => q.id === id)).filter(Boolean)
  mode.value = active.mode
  track.value = active.track
  selectedSection.value = active.selectedSection
  index.value = active.index
  answers.value = active.answers
  selected.value = answers.value[index.value] ?? null
  screen.value = 'quiz'
}

function choose(optionIndex) {
  if (answered.value) return
  selected.value = optionIndex
}

function confirm() {
  if (selected.value === null || answered.value) return
  answers.value[index.value] = selected.value
  answers.value = [...answers.value]
  progress.value.activeQuiz = { ...progress.value.activeQuiz, answers: answers.value }
  persist()
  if (isExam.value) next()
}

function next() {
  if (!answered.value && selected.value !== null) confirm()
  if (index.value < quiz.value.length - 1) {
    index.value++
    selected.value = answers.value[index.value] ?? null
    progress.value.activeQuiz = { ...progress.value.activeQuiz, index: index.value }
    persist()
  } else finish()
}

function finish() {
  const wrongIds = wrongQuestions.value.map(q => q.id)
  const resolved = quiz.value.filter((q, i) => answers.value[i] === q.correct).map(q => q.id)
  const mastery = { ...progress.value.mastery }
  wrongIds.forEach(id => { mastery[id] = 0 })
  resolved.forEach(id => {
    if (progress.value.mistakes.includes(id)) mastery[id] = (mastery[id] || 0) + 1
  })
  const remainingMistakes = [...new Set([...progress.value.mistakes, ...wrongIds])].filter(id => (mastery[id] || 0) < 2)
  const sectionResults = Object.fromEntries(resultsBySection.value.map(row => [row.key, { correct: row.correct, total: row.total }]))
  progress.value = {
    sessions: progress.value.sessions + 1,
    correct: progress.value.correct + sessionScore.value,
    total: progress.value.total + quiz.value.length,
    mistakes: remainingMistakes,
    mastery,
    history: [{ id: Date.now(), date: new Date().toISOString(), mode: mode.value, track: track.value, topic: mode.value === 'thematic' ? selectedSection.value : null, score: sessionScore.value, total: quiz.value.length, sections: sectionResults }, ...progress.value.history].slice(0, 50),
    activeQuiz: null
  }
  persist()
  screen.value = 'results'
}

function goHome() {
  screen.value = 'home'
  selected.value = null
}

function clearProgress() {
  if (!window.confirm('Удалить историю, результаты и журнал ошибок?')) return
  progress.value = emptyProgress()
  localStorage.removeItem('learnit-progress')
  screen.value = 'home'
}

function modeLabel(id) {
  return modes.find(item => item.id === id)?.title || 'Работа над ошибками'
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
</script>

<template>
  <div class="app-shell">
    <main v-if="screen === 'home'" class="home">
      <section class="intro">
        <div>
          <p class="eyebrow"><Sparkles :size="16" /> Подготовка к магистратуре</p>
          <h1>Тренируй знания.<br><span>Понимай ошибки.</span></h1>
          <p class="lead">Вопросы по программе вступительного экзамена: от базовых терминов до SQL, кода и расчета подсетей.</p>
        </div>
        <div class="progress-panel">
          <div class="progress-title"><span>Твой прогресс</span><strong>{{ progress.sessions }} {{ progress.sessions === 1 ? 'сессия' : 'сессий' }}</strong></div>
          <div class="big-stat">{{ totalAccuracy }}<small>%</small></div>
          <p>Общая точность</p>
          <div class="meter"><span :style="{ width: totalAccuracy + '%' }"></span></div>
          <div class="mini-stats"><span><b>{{ progress.correct }}</b> верных</span><span><b>{{ progress.mistakes.length }}</b> на повтор</span></div>
        </div>
      </section>

      <section class="setup">
        <div class="section-heading"><div><p class="step">01</p><h2>Выбери направление</h2></div></div>
        <div class="segmented">
          <button :class="{ active: track === 'it' }" @click="track = 'it'"><BookOpen :size="20" /> Информационные технологии</button>
          <button :class="{ active: track === 'security' }" @click="track = 'security'"><ShieldCheck :size="20" /> Информационная безопасность</button>
        </div>

        <div class="section-heading"><div><p class="step">02</p><h2>Режим тренировки</h2></div><span>Ответы сохраняются на устройстве</span></div>
        <div class="mode-grid">
          <button v-for="item in modes" :key="item.id" class="mode-card" :class="{ active: mode === item.id }" @click="mode = item.id">
            <span class="mode-icon"><component :is="item.icon" :size="22" /></span>
            <span class="mode-copy"><strong>{{ item.title }}</strong><small>{{ item.note }}</small></span>
            <span class="count">{{ item.count }}</span>
          </button>
        </div>

        <div v-if="mode === 'thematic'" class="topics">
          <label>Основная тема</label>
          <div class="topic-list">
            <button v-for="([key, item]) in availableSections" :key="key" :class="{ active: selectedSection === key }" @click="selectedSection = key">
              <span :style="{ background: item.color }"></span>{{ item.short }}
            </button>
          </div>
        </div>

        <div class="actions">
          <button class="primary" @click="startQuiz()">Начать тест <ArrowRight :size="19" /></button>
          <button v-if="progress.activeQuiz" class="secondary" @click="resumeQuiz"><Clock3 :size="18" /> Продолжить тест</button>
          <button v-if="progress.mistakes.length" class="secondary" @click="startQuiz('mistakes')"><RotateCcw :size="18" /> Повторить ошибки <b>{{ progress.mistakes.length }}</b></button>
        </div>
      </section>

      <section v-if="progress.history.length" class="history-section">
        <div class="section-heading"><div><History :size="20" /><h2>История прохождений</h2></div><button class="clear-button" @click="clearProgress"><Trash2 :size="16" /> Очистить историю</button></div>
        <div class="history-list">
          <div v-for="session in progress.history.slice(0, 8)" :key="session.id" class="history-row">
            <span>{{ formatDate(session.date) }}</span>
            <strong>{{ modeLabel(session.mode) }}<small>{{ session.track === 'security' ? 'ИБ' : 'ИТ' }}<template v-if="session.topic"> · {{ sections[session.topic].short }}</template></small></strong>
            <b>{{ session.score }}/{{ session.total }}</b>
            <i>{{ Math.round(session.score / session.total * 100) }}%</i>
          </div>
        </div>
      </section>
    </main>

    <main v-else-if="screen === 'quiz' && current" class="quiz-page">
      <div class="quiz-top">
        <button class="icon-button" @click="goHome" title="Выйти"><ArrowLeft :size="21" /></button>
        <div class="quiz-progress"><div><span>{{ modeLabel(mode) }}</span><b>{{ index + 1 }} / {{ quiz.length }}</b></div><div class="meter"><span :style="{ width: ((index + 1) / quiz.length * 100) + '%' }"></span></div></div>
      </div>
      <article class="question-card">
        <div class="question-meta"><span :style="{ color: sections[current.section].color }">{{ sections[current.section].label }}</span><i>{{ difficultyLabels[current.difficulty] }}</i></div>
        <h2>{{ current.text }}</h2>
        <pre v-if="current.code"><code>{{ current.code }}</code></pre>
        <div class="options">
          <button v-for="(option, optionIndex) in current.options" :key="option" @click="choose(optionIndex)" :disabled="answered" :class="{ selected: selected === optionIndex, correct: answered && optionIndex === current.correct, wrong: answered && selected === optionIndex && optionIndex !== current.correct }">
            <span>{{ ['А','Б','В','Г'][optionIndex] }}</span><b>{{ option }}</b><Check v-if="answered && optionIndex === current.correct" :size="19" /><X v-else-if="answered && selected === optionIndex" :size="19" />
          </button>
        </div>
        <div v-if="answered && !isExam" class="explanation" :class="{ success: isCorrect }">
          <div><Check v-if="isCorrect" :size="20" /><CircleAlert v-else :size="20" /><strong>{{ isCorrect ? 'Верно' : 'Нужно повторить' }}</strong></div>
          <p>{{ current.explanation }}</p>
        </div>
        <div class="question-actions">
          <span v-if="!answered">Выбери один вариант</span><span v-else>{{ isCorrect ? '+1 к результату' : 'Вопрос добавлен в повторение' }}</span>
          <button v-if="!answered" class="primary" :disabled="selected === null" @click="confirm">Ответить</button>
          <button v-else class="primary" @click="next">{{ index === quiz.length - 1 ? 'Завершить' : 'Следующий' }} <ChevronRight :size="18" /></button>
        </div>
      </article>
    </main>

    <main v-else class="results-page">
      <section class="result-hero">
        <p class="eyebrow"><Trophy :size="16" /> Тест завершен</p>
        <h1>{{ sessionScore }} из {{ quiz.length }}</h1>
        <p>{{ sessionScore / quiz.length >= .8 ? 'Отличный результат. Основные темы уже держатся уверенно.' : sessionScore / quiz.length >= .6 ? 'Хорошая база. Разбор ошибок поможет быстро поднять результат.' : 'Диагностика сработала: теперь понятно, что повторять в первую очередь.' }}</p>
      </section>
      <section class="result-content">
        <div class="breakdown">
          <h2>Результат по разделам</h2>
          <div v-for="row in resultsBySection" :key="row.key" class="result-row">
            <span class="dot" :style="{ background: sections[row.key].color }"></span><strong>{{ sections[row.key].label }}</strong><div class="meter"><span :style="{ width: row.percent + '%', background: sections[row.key].color }"></span></div><b>{{ row.correct }}/{{ row.total }}</b>
          </div>
        </div>
        <aside class="next-card">
          <Target :size="24" /><h3>{{ wrongQuestions.length ? 'Следующий шаг' : 'Без ошибок' }}</h3>
          <p>{{ wrongQuestions.length ? `${wrongQuestions.length} вопросов отправлено в персональное повторение.` : 'Все ответы верны. Можно переходить к симуляции экзамена.' }}</p>
          <button v-if="wrongQuestions.length" class="primary" @click="startQuiz('mistakes')"><RotateCcw :size="18" /> Разобрать ошибки</button>
          <button class="secondary" @click="goHome">На главную</button>
        </aside>
      </section>
      <section v-if="wrongQuestions.length" class="mistake-review">
        <h2>Короткий разбор</h2>
        <details v-for="q in wrongQuestions" :key="q.id">
          <summary>{{ q.text }} <ChevronRight :size="18" /></summary>
          <p><b>Правильный ответ:</b> {{ q.options[q.correct] }}</p><p>{{ q.explanation }}</p>
        </details>
      </section>
    </main>
  </div>
</template>
