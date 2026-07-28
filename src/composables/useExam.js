import { computed, ref } from 'vue'
import { BookOpen, Clock3, Star, Target } from 'lucide-vue-next'
import { questions, sections } from '../questions'
import { supabase } from '../lib/supabase'

const emptyProgress = () => ({ sessions: 0, correct: 0, total: 0, mistakes: [], favorites: [], mastery: {}, history: [], activeQuiz: null })

export function useExam(initialUserId = null) {
  let userId = initialUserId
  const screen = ref('home')
  const track = ref('it')
  const selectedSection = ref('networks')
  const mode = ref('diagnostic')
  const quiz = ref([])
  const index = ref(0)
  const selected = ref(null)
  const answers = ref([])
  const reviewSession = ref(null)
  const progressReady = ref(false)
  const progressKey = () => userId ? `learnit-progress:${userId}` : 'learnit-progress'
  const stored = JSON.parse(localStorage.getItem(progressKey()) || 'null')
  const progress = ref({ ...emptyProgress(), ...(stored || {}) })
  if (progress.value.activeQuiz?.mode === 'exam' && progress.value.activeQuiz.ids.length !== 30) {
    progress.value.activeQuiz = null
    localStorage.setItem(progressKey(), JSON.stringify(progress.value))
  }

  const modes = computed(() => [
    { id: 'diagnostic', icon: Target, title: 'Диагностика', note: 'Все разделы, разбор после ответа', count: 30 },
    { id: 'thematic', icon: BookOpen, title: 'По теме', note: '15 вопросов только выбранной темы', count: 15 },
    { id: 'exam', icon: Clock3, title: 'Симуляция', note: '30 вопросов, результат по шкале 1–100', count: 30 },
    { id: 'favorites', icon: Star, title: 'Избранное', note: 'Тест по вопросам, отмеченным звездочкой', count: progress.value.favorites.length },
  ])

  const availableSections = computed(() => Object.entries(sections).filter(([key]) => track.value === 'security' || key !== 'security'))
  const current = computed(() => quiz.value[index.value])
  const isExam = computed(() => mode.value === 'exam')
  const answered = computed(() => answers.value[index.value] !== undefined)
  const isCorrect = computed(() => answered.value && answers.value[index.value] === current.value?.correct)
  const totalAccuracy = computed(() => progress.value.total ? Math.round(progress.value.correct / progress.value.total * 100) : 0)
  const sessionScore = computed(() => reviewSession.value?.score ?? answers.value.filter((answer, i) => answer === quiz.value[i]?.correct).length)
  const resultTotal = computed(() => reviewSession.value?.total ?? quiz.value.length)
  const examGrade = computed(() => reviewSession.value?.grade ?? (resultTotal.value ? Math.max(1, Math.round(sessionScore.value / resultTotal.value * 100)) : 1))
  const wrongQuestions = computed(() => quiz.value.filter((question, i) => answers.value[i] !== question.correct))
  const resultsBySection = computed(() => {
    if (reviewSession.value && !quiz.value.length) {
      return Object.entries(reviewSession.value.sections || {}).map(([key, value]) => ({ key, ...value, percent: Math.round(value.correct / value.total * 100) }))
    }
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
    localStorage.setItem(progressKey(), JSON.stringify(progress.value))
    if (userId) {
      const ownerId = userId
      const snapshot = JSON.parse(JSON.stringify(progress.value))
      void supabase.from('progress').upsert({ user_id: ownerId, data: snapshot, updated_at: new Date().toISOString() }).then(({ error }) => {
        if (error) console.error('Progress sync failed:', error.message)
      })
    }
  }

  function recordSimulation(attemptId, grade) {
    if (!userId) return
    void supabase.rpc('record_simulation_result', { p_attempt_id: attemptId, p_grade: grade }).then(({ error }) => {
      if (error) console.error('Simulation rating sync failed:', error.message)
    })
  }

  function startQuiz(kind = mode.value) {
    reviewSession.value = null
    mode.value = kind
    let pool = questions.filter(question => track.value === 'security' || question.section !== 'security')
    let count = modes.value.find(item => item.id === kind)?.count || 12
    if (kind === 'thematic') pool = pool.filter(question => question.section === selectedSection.value)
    if (kind === 'mistakes') {
      pool = questions.filter(question => progress.value.mistakes.includes(question.id))
      count = pool.length
    }
    if (kind === 'favorites') {
      pool = questions.filter(question => progress.value.favorites.includes(question.id))
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
    reviewSession.value = null
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
    const attemptId = Date.now()
    const completedMode = mode.value
    const completedGrade = examGrade.value
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
      favorites: [...progress.value.favorites],
      mastery,
      history: [{ id: attemptId, date: new Date().toISOString(), mode: completedMode, track: track.value, topic: completedMode === 'thematic' ? selectedSection.value : null, score: sessionScore.value, grade: completedMode === 'exam' ? completedGrade : null, total: quiz.value.length, sections: sectionResults, questionIds: quiz.value.map(question => question.id), answers: [...answers.value] }, ...progress.value.history].slice(0, 50),
      activeQuiz: null,
    }
    persist()
    if (completedMode === 'exam') recordSimulation(attemptId, completedGrade)
    screen.value = 'results'
  }

  function goHome() {
    screen.value = 'home'
    selected.value = null
  }

  function openHistory(session) {
    reviewSession.value = session
    mode.value = session.mode
    track.value = session.track
    selectedSection.value = session.topic || 'networks'
    quiz.value = (session.questionIds || []).map(id => questions.find(question => question.id === id)).filter(Boolean)
    answers.value = [...(session.answers || [])]
    selected.value = null
    screen.value = 'results'
  }

  function setTrack(value) {
    track.value = value
    if (value === 'it' && selectedSection.value === 'security') selectedSection.value = 'networks'
  }

  function toggleFavorite(questionId) {
    const favorites = new Set(progress.value.favorites)
    if (favorites.has(questionId)) favorites.delete(questionId)
    else favorites.add(questionId)
    progress.value.favorites = [...favorites]
    persist()
  }

  async function setUser(nextUserId) {
    progressReady.value = false
    userId = nextUserId
    quiz.value = []
    answers.value = []
    reviewSession.value = null
    const userKey = progressKey()
    let saved = localStorage.getItem(userKey)
    if (!saved && nextUserId && localStorage.getItem('learnit-progress')) {
      saved = localStorage.getItem('learnit-progress')
      localStorage.setItem(userKey, saved)
      localStorage.removeItem('learnit-progress')
    }
    progress.value = { ...emptyProgress(), ...(saved ? JSON.parse(saved) : {}) }
    try {
      if (nextUserId) {
        const { data, error } = await supabase.from('progress').select('data').eq('user_id', nextUserId).single()
        if (error && error.code !== 'PGRST116') throw error
        if (data?.data) {
          const remote = { ...emptyProgress(), ...data.data }
          if ((remote.sessions || 0) >= progress.value.sessions) {
            progress.value = remote
            localStorage.setItem(userKey, JSON.stringify(progress.value))
          } else persist()
        }
      }
    } catch (error) {
      console.error('Progress sync failed:', error.message)
    } finally {
      screen.value = 'home'
      progressReady.value = true
    }
  }

  function clearProgress() {
    if (!window.confirm('Удалить историю, результаты и журнал ошибок?')) return
    const favorites = [...progress.value.favorites]
    progress.value = { ...emptyProgress(), favorites }
    localStorage.removeItem(progressKey())
    persist()
    screen.value = 'home'
  }

  function modeLabel(id) {
    return modes.value.find(item => item.id === id)?.title || 'Работа над ошибками'
  }

  return { screen, track, selectedSection, mode, quiz, index, selected, answers, progress, progressReady, reviewSession, modes, availableSections, current, isExam, answered, isCorrect, totalAccuracy, sessionScore, resultTotal, examGrade, wrongQuestions, resultsBySection, startQuiz, resumeQuiz, choose, confirm, next, goHome, openHistory, setTrack, setUser, clearProgress, toggleFavorite, modeLabel }
}
