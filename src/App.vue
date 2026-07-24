<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Clock3, RotateCcw, ShieldCheck, Sparkles, Target, Trophy, X } from 'lucide-vue-next'
import { difficultyLabels, questions, sections } from './questions'

const screen = ref('home')
const track = ref('it')
const selectedSection = ref('networks')
const mode = ref('diagnostic')
const quiz = ref([])
const index = ref(0)
const selected = ref(null)
const answers = ref([])

const saved = JSON.parse(localStorage.getItem('learnit-progress') || '{"sessions":0,"correct":0,"total":0,"mistakes":[]}')
const progress = ref(saved)

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
  { id: 'diagnostic', icon: Target, title: 'Диагностика', note: 'Все разделы, разбор после ответа', count: 15 },
  { id: 'thematic', icon: BookOpen, title: 'По теме', note: 'Фокус на выбранном разделе', count: 12 },
  { id: 'exam', icon: Clock3, title: 'Симуляция', note: 'Ответы и разбор только в конце', count: 20 },
]

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5)
}

function balancedPick(pool, count) {
  const targets = { surface: .35, understanding: .35, application: .25, trick: .05 }
  const picked = []
  Object.entries(targets).forEach(([level, ratio]) => {
    const amount = Math.max(level === 'trick' ? 1 : 0, Math.round(count * ratio))
    picked.push(...shuffle(pool.filter(q => q.difficulty === level)).slice(0, amount))
  })
  const rest = shuffle(pool.filter(q => !picked.includes(q)))
  return shuffle([...picked, ...rest].slice(0, Math.min(count, pool.length)))
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
  quiz.value = balancedPick(pool, count)
  index.value = 0
  answers.value = []
  selected.value = null
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
  if (isExam.value) next()
}

function next() {
  if (!answered.value && selected.value !== null) confirm()
  if (index.value < quiz.value.length - 1) {
    index.value++
    selected.value = answers.value[index.value] ?? null
  } else finish()
}

function finish() {
  const wrongIds = wrongQuestions.value.map(q => q.id)
  const resolved = quiz.value.filter((q, i) => answers.value[i] === q.correct).map(q => q.id)
  progress.value = {
    sessions: progress.value.sessions + 1,
    correct: progress.value.correct + sessionScore.value,
    total: progress.value.total + quiz.value.length,
    mistakes: [...new Set([...progress.value.mistakes.filter(id => !resolved.includes(id)), ...wrongIds])]
  }
  localStorage.setItem('learnit-progress', JSON.stringify(progress.value))
  screen.value = 'results'
}

function goHome() {
  screen.value = 'home'
  selected.value = null
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <button class="brand" @click="goHome" aria-label="На главную">
        <span class="brand-mark">L</span><span>Learn<span>IT</span></span>
      </button>
      <div class="header-status">
        <span><Trophy :size="16" /> {{ totalAccuracy }}% точность</span>
        <span class="avatar">А</span>
      </div>
    </header>

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
          <button v-if="progress.mistakes.length" class="secondary" @click="startQuiz('mistakes')"><RotateCcw :size="18" /> Повторить ошибки <b>{{ progress.mistakes.length }}</b></button>
        </div>
      </section>
    </main>

    <main v-else-if="screen === 'quiz' && current" class="quiz-page">
      <div class="quiz-top">
        <button class="icon-button" @click="goHome" title="Выйти"><ArrowLeft :size="21" /></button>
        <div class="quiz-progress"><div><span>{{ modes.find(m => m.id === mode)?.title || 'Работа над ошибками' }}</span><b>{{ index + 1 }} / {{ quiz.length }}</b></div><div class="meter"><span :style="{ width: ((index + 1) / quiz.length * 100) + '%' }"></span></div></div>
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
