import { computed, onBeforeUnmount, ref } from 'vue'
import { BookOpen, Clock3, Star, Target } from 'lucide-vue-next'
import { questions, sections } from '../questions'
import { supabase } from '../lib/supabase'

const emptyProgress = () => ({ sessions: 0, correct: 0, total: 0, mistakes: [], favorites: [], mastery: {}, history: [], activeQuiz: null, pendingSimulations: [] })
const validQuestionIds = new Set(questions.map(question => question.id))

function sanitizeProgress(value = {}) {
  const sanitized = { ...emptyProgress(), ...value }
  sanitized.mistakes = sanitized.mistakes.filter(id => validQuestionIds.has(id))
  sanitized.favorites = sanitized.favorites.filter(id => validQuestionIds.has(id))
  sanitized.history = Array.isArray(sanitized.history) ? sanitized.history : []
  sanitized.pendingSimulations = Array.isArray(sanitized.pendingSimulations) ? sanitized.pendingSimulations : []
  if (sanitized.activeQuiz?.ids.some(id => !validQuestionIds.has(id))) sanitized.activeQuiz = null
  return sanitized
}

export function useExam(initialUserId = null) {
  let userId = initialUserId
  let progressSyncId = 0
  let syncPromise = null
  let syncRequested = false
  let pullPromise = null
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
  const isOnline = ref(navigator.onLine)
  const syncing = ref(false)
  const progressKey = () => userId ? `learnit-progress:${userId}` : 'learnit-progress'
  const stored = JSON.parse(localStorage.getItem(progressKey()) || 'null')
  const progress = ref(sanitizeProgress(stored || {}))
  const pendingSyncCount = computed(() => progress.value.history.filter(session => session.syncStatus === 'pending').length)
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
    const result = [...list]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  const familyPatterns = {
    algorithms: [['sorting', /сортиров/], ['solid', /solid|srp|ocp|lsp|isp|dip/], ['oop', /ооп|класс|объект|наслед|полиморф|инкапсул|абстракц/], ['complexity', /сложност|o\(/], ['code', /код|программ|python|javascript|c\+\+|pl\/i/], ['structures', /стек|очеред|дерев|граф|массив|список/]],
    databases: [['joins', /join/], ['aggregation', /count|sum|avg|group by|having|агрегат/], ['null', /null/], ['write', /insert|update|delete/], ['structure', /ключ|нормал|таблиц|ddl|create|alter/], ['query', /select|where|order by|between|like|distinct|запрос/]],
    networks: [['osi', /osi|уровн/], ['subnet', /подсет|маск|broadcast|\/\d{2}/], ['addressing', /ip.?адрес|ipv4|ipv6|адресац/], ['transport', /tcp|udp|порт/], ['services', /dns|dhcp|http|https|arp|icmp/], ['devices', /коммутатор|маршрутизатор|устройств|mac/], ['standards', /ieee|802|ethernet|wi.?fi/]],
    modeling: [['newton', /ньютон/], ['euler', /эйлер/], ['laplace', /лаплас/], ['stability', /устойчив|сходим|погрешн/], ['model-types', /модел|адекват|имитацион|аналитич/], ['equations', /уравнен|гаусс|численн/]],
    graphics: [['raster-vector', /растр|вектор|пиксел/], ['formats', /формат|jpeg|png|gif|svg|cdr|psd|tiff/], ['color', /rgb|cmyk|цвет/], ['editors', /photoshop|coreldraw|редактор/], ['print', /dpi|разрешен|печат/], ['tools', /сло|маск|контур|крив/]],
    information: [['units', /бит|байт|килобайт|мегабайт/], ['text', /текст|кодиров|utf|символ/], ['formats', /формат|расширен|pdf|docx|txt|архив/], ['api', /api|json|xml|http/], ['types', /тип данных|логическ|целочисл/], ['processing', /алгоритм|обработ|резерв|сжат/]],
    security: [['crypto', /шифр|хеш|крипто/], ['access', /доступ|аутентиф|авториз/], ['threats', /атак|угроз|уязвим/], ['protection', /защит|межсетев|антивирус/]],
  }

  function questionFamily(question) {
    const content = `${question.text} ${question.code || ''}`.toLocaleLowerCase('ru')
    const match = familyPatterns[question.section]?.find(([, pattern]) => pattern.test(content))
    return `${question.section}:${match?.[0] || content.replace(/[^a-zа-я0-9]+/gi, ' ').split(' ').slice(0, 4).join('-')}`
  }

  function takeDiverse(candidates, amount, usedFamilies) {
    const shuffled = shuffle(candidates)
    const selected = []
    for (const question of shuffled) {
      const family = questionFamily(question)
      if (!usedFamilies.has(family)) {
        selected.push(question)
        usedFamilies.add(family)
      }
      if (selected.length === amount) return selected
    }
    selected.push(...shuffled.filter(question => !selected.includes(question)).slice(0, amount - selected.length))
    return selected
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
    const usedFamilies = new Set()
    Object.entries(allocation).forEach(([level, amount]) => {
      picked.push(...takeDiverse(pool.filter(question => question.difficulty === level && !picked.includes(question)), amount, usedFamilies))
    })
    picked.push(...takeDiverse(pool.filter(question => !picked.includes(question)), Math.min(count, pool.length) - picked.length, usedFamilies))
    return shuffle(picked).slice(0, Math.min(count, pool.length))
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

  function saveLocal() {
    localStorage.setItem(progressKey(), JSON.stringify(progress.value))
  }

  function hasPendingChanges() {
    return progress.value.pendingSimulations.length > 0 || progress.value.history.some(session => session.syncStatus === 'pending')
  }

  async function runSync() {
    if (!userId || !navigator.onLine) return
    syncRequested = true
    if (syncPromise) return syncPromise
    syncPromise = (async () => {
      syncing.value = true
      while (syncRequested && userId && navigator.onLine) {
        syncRequested = false
        const ownerId = userId
        const completedAttempts = new Set()
        for (const attempt of progress.value.pendingSimulations) {
          const { error } = await supabase.rpc('record_simulation_result', { p_attempt_id: attempt.id, p_grade: attempt.grade })
          if (error) throw error
          completedAttempts.add(attempt.id)
        }
        const snapshot = JSON.parse(JSON.stringify(progress.value))
        snapshot.pendingSimulations = snapshot.pendingSimulations.filter(attempt => !completedAttempts.has(attempt.id))
        snapshot.history = snapshot.history.map(session => ({ ...session, syncStatus: 'synced' }))
        const { error } = await supabase.from('progress').upsert({ user_id: ownerId, data: snapshot, updated_at: new Date().toISOString() })
        if (error) throw error
        if (ownerId !== userId) return
        progress.value.pendingSimulations = progress.value.pendingSimulations.filter(attempt => !completedAttempts.has(attempt.id))
        const syncedIds = new Set(snapshot.history.map(session => session.id))
        progress.value.history = progress.value.history.map(session => syncedIds.has(session.id) ? { ...session, syncStatus: 'synced' } : session)
        saveLocal()
      }
    })().catch(error => {
      console.error('Progress sync failed:', error.message)
    }).finally(() => {
      syncing.value = false
      syncPromise = null
    })
    return syncPromise
  }

  async function pullRemoteProgress() {
    if (!userId || !navigator.onLine || syncing.value || hasPendingChanges()) return
    if (pullPromise) return pullPromise
    const ownerId = userId
    pullPromise = (async () => {
      const { data, error } = await supabase.from('progress').select('data').eq('user_id', ownerId).maybeSingle()
      if (error) throw error
      if (!data?.data || ownerId !== userId || hasPendingChanges()) return
      const remote = sanitizeProgress(data.data)
      const localHistoryIds = new Set(progress.value.history.map(session => session.id))
      const hasNewRemoteSession = remote.history.some(session => !localHistoryIds.has(session.id))
      if (remote.sessions > progress.value.sessions || (remote.sessions === progress.value.sessions && hasNewRemoteSession)) {
        const activeQuiz = progress.value.activeQuiz || remote.activeQuiz
        progress.value = { ...remote, activeQuiz }
        saveLocal()
      }
    })().catch(error => {
      console.error('Progress refresh failed:', error.message)
    }).finally(() => {
      pullPromise = null
    })
    return pullPromise
  }

  async function synchronizeNow() {
    isOnline.value = navigator.onLine
    if (!userId || !isOnline.value) return
    if (hasPendingChanges()) await runSync()
    else await pullRemoteProgress()
  }

  function persist() {
    saveLocal()
    if (userId && navigator.onLine) void runSync()
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
    if (kind === 'exam') {
      const recentIds = new Set(progress.value.history.filter(session => session.mode === 'exam').slice(0, 3).flatMap(session => session.questionIds || []))
      const freshPool = pool.filter(question => !recentIds.has(question.id))
      if (freshPool.length >= count * 2) pool = freshPool
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
      history: [{ id: attemptId, date: new Date().toISOString(), mode: completedMode, track: track.value, topic: completedMode === 'thematic' ? selectedSection.value : null, score: sessionScore.value, grade: completedMode === 'exam' ? completedGrade : null, total: quiz.value.length, sections: sectionResults, questionIds: quiz.value.map(question => question.id), answers: [...answers.value], syncStatus: 'pending' }, ...progress.value.history].slice(0, 50),
      activeQuiz: null,
      pendingSimulations: completedMode === 'exam' ? [...progress.value.pendingSimulations, { id: attemptId, grade: completedGrade }] : [...progress.value.pendingSimulations],
    }
    persist()
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
    const syncId = ++progressSyncId
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
    progress.value = sanitizeProgress(saved ? JSON.parse(saved) : {})
    try {
      if (nextUserId && navigator.onLine) {
        const progressRequest = supabase.from('progress').select('data').eq('user_id', nextUserId).maybeSingle()
        const { data, error } = await Promise.race([
          progressRequest,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Progress sync timeout')), 10000)),
        ])
        if (error) throw error
        if (data?.data) {
          const remote = sanitizeProgress(data.data)
          const hasLocalQueue = hasPendingChanges()
          if (!hasLocalQueue && (remote.sessions || 0) >= progress.value.sessions) {
            progress.value = remote
            localStorage.setItem(userKey, JSON.stringify(progress.value))
          } else persist()
        }
      }
    } catch (error) {
      console.error('Progress sync failed:', error.message)
    } finally {
      if (syncId === progressSyncId) {
        screen.value = 'home'
        progressReady.value = true
      }
    }
  }

  function clearProgress() {
    if (!window.confirm('Удалить историю, результаты и журнал ошибок?')) return
    const favorites = [...progress.value.favorites]
    const pendingSimulations = [...progress.value.pendingSimulations]
    progress.value = { ...emptyProgress(), favorites, pendingSimulations }
    localStorage.removeItem(progressKey())
    persist()
    screen.value = 'home'
  }

  function modeLabel(id) {
    return modes.value.find(item => item.id === id)?.title || 'Работа над ошибками'
  }

  function handleOnline() {
    isOnline.value = true
    void synchronizeNow()
  }

  function handleOffline() {
    isOnline.value = false
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible') void synchronizeNow()
  }

  const syncTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void synchronizeNow()
  }, 10000)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('focus', synchronizeNow)
  document.addEventListener('visibilitychange', handleVisibility)
  onBeforeUnmount(() => {
    window.clearInterval(syncTimer)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('focus', synchronizeNow)
    document.removeEventListener('visibilitychange', handleVisibility)
  })

  return { screen, track, selectedSection, mode, quiz, index, selected, answers, progress, progressReady, reviewSession, modes, availableSections, current, isExam, answered, isCorrect, totalAccuracy, sessionScore, resultTotal, examGrade, wrongQuestions, resultsBySection, isOnline, syncing, pendingSyncCount, startQuiz, resumeQuiz, choose, confirm, next, goHome, openHistory, setTrack, setUser, clearProgress, toggleFavorite, modeLabel }
}
