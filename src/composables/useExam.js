import { computed, ref } from 'vue'
import { BookOpen, Clock3, Target } from 'lucide-vue-next'
import { questions, sections } from '../questions'

const emptyProgress = () => ({ sessions: 0, correct: 0, total: 0, mistakes: [], mastery: {}, history: [], activeQuiz: null })

export function useExam() {
  const screen = ref('home')
  const track = ref('it')
  const selectedSection = ref('networks')
  const mode = ref('diagnostic')
  const quiz = ref([])
  const index = ref(0)
  const selected = ref(null)
  const answers = ref([])
  const stored = JSON.parse(localStorage.getItem('learnit-progress') || 'null')
  const progress = ref({ ...emptyProgress(), ...(stored || {}) })
  if (progress.value.activeQuiz?.mode === 'exam' && progress.value.activeQuiz.ids.length !== 30) {
    progress.value.activeQuiz = null
    localStorage.setItem('learnit-progress', JSON.stringify(progress.value))
  }

  const modes = [
    { id: 'diagnostic', icon: Target, title: 'Диагностика', note: 'Все разделы, разбор после ответа', count: 30 },
    { id: 'thematic', icon: BookOpen, title: 'По теме', note: '15 вопросов только выбранной темы', count: 15 },
    { id: 'exam', icon: Clock3, title: 'Симуляция', note: '30 вопросов, результат по шкале 1–100', count: 30 },
  ]

  const availableSections = computed(() => Object.entries(sections).filter(([key]) => track.value === 'security' || key !== 'security'))
  const current = computed(() => quiz.value[index.value])
  const isExam = computed(() => mode.value === 'exam')
  const answered = computed(() => answers.value[index.value] !== undefined)
  const isCorrect = computed(() => answered.value && answers.value[index.value] === current.value?.correct)
  const totalAccuracy = computed(() => progress.value.total ? Math.round(progress.value.correct / progress.value.total * 100) : 0)
  const sessionScore = computed(() => answers.value.filter((answer, i) => answer === quiz.value[i]?.correct).length)
  const examGrade = computed(() => quiz.value.length ? Math.max(1, Math.round(sessionScore.value / quiz.value.length * 100)) : 1)
  const wrongQuestions = computed(() => quiz.value.filter((question, i) => answers.value[i] !== question.correct))
  const resultsBySection = computed(() => {
    const map = {}
    quiz.value.forEach((question, i) => {
      map[question.section] ||= { total: 0, correct: 0 }
      map[question.section].total++
      if (answers.value[i] === question.correct) map[question.section].correct++
    })
    return Object.entries(map).map(([key, value]) => ({ key, ...value, percent: Math.round(value.correct / value.total * 100) }))
  })

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

  function balancedPick(pool, count, targets = { surface: .35, understanding: .35, application: .25, trick: .05 }) {
    const allocation = allocateCounts(targets, Math.min(count, pool.length))
    const picked = []
    Object.entries(allocation).forEach(([level, amount]) => {
      picked.push(...shuffle(pool.filter(question => question.difficulty === level)).slice(0, amount))
    })
    return shuffle([...picked, ...shuffle(pool.filter(question => !picked.includes(question)))]).slice(0, Math.min(count, pool.length))
  }

  function sectionPick(pool, count, section) {
    const targets = section === 'databases'
      ? { surface: .10, understanding: .20, application: .60, trick: .10 }
      : undefined
    return balancedPick(pool, count, targets)
  }

  function weightedPool(pool, weights, count) {
    const picked = []
    Object.entries(allocateCounts(weights, count)).forEach(([section, amount]) => {
      picked.push(...sectionPick(pool.filter(question => question.section === section), amount, section))
    })
    return shuffle([...picked, ...balancedPick(pool.filter(question => !picked.includes(question)), count - picked.length)]).slice(0, count)
  }

  function persist() {
    localStorage.setItem('learnit-progress', JSON.stringify(progress.value))
  }

  function startQuiz(kind = mode.value) {
    mode.value = kind
    let pool = questions.filter(question => track.value === 'security' || question.section !== 'security')
    let count = modes.find(item => item.id === kind)?.count || 12
    if (kind === 'thematic') pool = pool.filter(question => question.section === selectedSection.value)
    if (kind === 'mistakes') {
      pool = questions.filter(question => progress.value.mistakes.includes(question.id))
      count = pool.length
    }
    if (kind === 'exam' || kind === 'diagnostic') {
      const weights = track.value === 'security'
        ? { security: .24, databases: .20, algorithms: .20, modeling: .14, networks: .10, information: .07, graphics: .05 }
        : { networks: .24, databases: .22, algorithms: .22, modeling: .16, graphics: .08, information: .08 }
      quiz.value = weightedPool(pool, weights, count)
    } else if (kind === 'thematic') quiz.value = sectionPick(pool, count, selectedSection.value)
    else quiz.value = balancedPick(pool, count)
    index.value = 0
    answers.value = []
    selected.value = null
    screen.value = 'quiz'
    progress.value.activeQuiz = { ids: quiz.value.map(question => question.id), mode: kind, track: track.value, selectedSection: selectedSection.value, index: 0, answers: [] }
    persist()
  }

  function resumeQuiz() {
    const active = progress.value.activeQuiz
    if (!active) return
    quiz.value = active.ids.map(id => questions.find(question => question.id === id)).filter(Boolean)
    mode.value = active.mode
    track.value = active.track
    selectedSection.value = active.selectedSection
    index.value = active.index
    answers.value = active.answers
    selected.value = answers.value[index.value] ?? null
    screen.value = 'quiz'
  }

  function choose(optionIndex) {
    if (!answered.value) selected.value = optionIndex
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
    const wrongIds = wrongQuestions.value.map(question => question.id)
    const resolved = quiz.value.filter((question, i) => answers.value[i] === question.correct).map(question => question.id)
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
      history: [{ id: Date.now(), date: new Date().toISOString(), mode: mode.value, track: track.value, topic: mode.value === 'thematic' ? selectedSection.value : null, score: sessionScore.value, grade: isExam.value ? examGrade.value : null, total: quiz.value.length, sections: sectionResults }, ...progress.value.history].slice(0, 50),
      activeQuiz: null,
    }
    persist()
    screen.value = 'results'
  }

  function goHome() {
    screen.value = 'home'
    selected.value = null
  }

  function setTrack(value) {
    track.value = value
    if (value === 'it' && selectedSection.value === 'security') selectedSection.value = 'networks'
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

  return { screen, track, selectedSection, mode, quiz, index, selected, answers, progress, modes, availableSections, current, isExam, answered, isCorrect, totalAccuracy, sessionScore, examGrade, wrongQuestions, resultsBySection, startQuiz, resumeQuiz, choose, confirm, next, goHome, setTrack, clearProgress, modeLabel }
}
