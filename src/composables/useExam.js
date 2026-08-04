import { computed, onBeforeUnmount, ref } from 'vue'
import { BookOpen, BrainCircuit, Clock3, Cpu, Infinity as InfinityIcon, Star, Target } from 'lucide-vue-next'
import { questions, sections } from '../questions'
import { supabase } from '../lib/supabase'
import { readJson, writeJson } from '../lib/storage'
import { updateMistakeProgress } from '../lib/mistakeProgress'

const questionBankVersion = 3
const examDurationSeconds = 120 * 60
const emptyProgress = () => ({ questionBankVersion, sessions: 0, correct: 0, total: 0, mistakes: [], favorites: [], favoriteChanges: {}, mastery: {}, history: [], activeQuiz: null, pendingSimulations: [] })
const hasQuestion = questionId => questions.some(question => question.id === questionId)

function sanitizeProgress(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {}
  const bankChanged = value.questionBankVersion !== questionBankVersion
  const sanitized = { ...emptyProgress(), ...value }
  sanitized.questionBankVersion = questionBankVersion
  sanitized.sessions = Number.isSafeInteger(sanitized.sessions) && sanitized.sessions >= 0 ? sanitized.sessions : 0
  sanitized.correct = Number.isSafeInteger(sanitized.correct) && sanitized.correct >= 0 ? sanitized.correct : 0
  sanitized.total = Number.isSafeInteger(sanitized.total) && sanitized.total >= sanitized.correct ? sanitized.total : sanitized.correct
  sanitized.mistakes = !bankChanged && Array.isArray(sanitized.mistakes)
    ? [...new Set(sanitized.mistakes.filter(hasQuestion))]
    : []
  sanitized.favorites = !bankChanged && Array.isArray(sanitized.favorites) ? sanitized.favorites.filter(hasQuestion) : []
  sanitized.favoriteChanges = !bankChanged && sanitized.favoriteChanges && typeof sanitized.favoriteChanges === 'object' && !Array.isArray(sanitized.favoriteChanges) ? sanitized.favoriteChanges : {}
  sanitized.mastery = !bankChanged && sanitized.mastery && typeof sanitized.mastery === 'object' && !Array.isArray(sanitized.mastery) ? sanitized.mastery : {}
  sanitized.history = Array.isArray(sanitized.history)
    ? sanitized.history.map(session => bankChanged ? {
      ...session,
      topic: sections[session.topic] ? session.topic : null,
      sections: Object.fromEntries(Object.entries(session.sections || {}).filter(([key]) => sections[key])),
      questionIds: [],
      answers: [],
    } : session)
    : []
  sanitized.pendingSimulations = Array.isArray(sanitized.pendingSimulations) ? sanitized.pendingSimulations : []
  if (bankChanged || sanitized.activeQuiz?.ids.some(id => !hasQuestion(id))) sanitized.activeQuiz = null
  return sanitized
}

export function useExam(initialUserId = null) {
  let userId = initialUserId
  let progressSyncId = 0
  let syncPromise = null
  let syncRequested = false
  let pullPromise = null
  let syncFailures = 0
  let nextSyncAttemptAt = 0
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
  const examRemaining = ref(examDurationSeconds)
  const progressKey = () => userId ? `learnit-progress:${userId}` : 'learnit-progress'
  const stored = readJson(progressKey())
  const progress = ref(sanitizeProgress(stored || {}))
  const pendingSyncCount = computed(() => progress.value.history.filter(session => session.syncStatus === 'pending').length)
  if (progress.value.activeQuiz?.mode === 'exam' && progress.value.activeQuiz.ids.length !== 50) {
    progress.value.activeQuiz = null
    writeJson(progressKey(), progress.value)
  }

  const modes = computed(() => [
    { id: 'diagnostic', icon: Target, title: 'Диагностика', note: 'Все разделы, разбор после ответа', count: 30 },
    { id: 'thematic', icon: BookOpen, title: 'По теме', note: '15 вопросов только выбранной темы', count: 15 },
    { id: 'exam', icon: Clock3, title: 'Экзамен', note: '50 вопросов · 120 минут · без подсказок', count: 50 },
    { id: 'favorites', icon: Star, title: 'Избранное', note: 'Тест по вопросам, отмеченным звездочкой', count: progress.value.favorites.length },
    { id: 'technical', icon: Cpu, title: 'Технические вопросы', note: '30 технических вопросов с мгновенной проверкой', count: 30 },
    { id: 'humanities', icon: BrainCircuit, title: 'Гуманитарные вопросы', note: '30 гуманитарных вопросов с мгновенной проверкой', count: 30 },
    { id: 'marathon', icon: InfinityIcon, title: 'Марафон', note: 'Все доступные вопросы в случайном порядке', count: questions.filter(question => question.audience === 'common' || question.audience === track.value).length },
  ])

  const availableSections = computed(() => Object.entries(sections).filter(([key]) => questions.some(question => question.section === key && (question.audience === 'common' || question.audience === track.value))))
  const current = computed(() => quiz.value[index.value])
  const isExam = computed(() => mode.value === 'exam')
  const immediateFeedback = computed(() => ['diagnostic', 'thematic', 'favorites', 'mistakes', 'technical', 'humanities', 'marathon'].includes(mode.value))
  const answered = computed(() => answers.value[index.value] !== undefined)
  const isCorrect = computed(() => answered.value && answers.value[index.value] === current.value?.correct)
  const totalAccuracy = computed(() => progress.value.total ? Math.round(progress.value.correct / progress.value.total * 100) : 0)
  const examAccuracy = computed(() => {
    const exams = progress.value.history.filter(session => session.mode === 'exam')
    return exams.length ? Math.round(exams.reduce((sum, session) => sum + (session.grade || Math.round(session.score / session.total * 100)), 0) / exams.length) : 0
  })
  const formattedExamTime = computed(() => {
    const minutes = Math.floor(examRemaining.value / 60)
    const seconds = examRemaining.value % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })
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
    systems: [['structure', /структур|элемент|связ|иерарх/], ['analysis', /анализ|декомпоз|синтез/], ['control', /управлен|обратн|воздейств/], ['models', /модел|черн|бел|сер.*ящик/], ['properties', /эмерджент|целост|устойчив|эффектив/]],
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

  const officialSections = () => ['communications', 'history', 'psychology', 'softskills', 'algorithms', 'graphics', 'modeling', track.value === 'security' ? 'security' : 'databases', 'information', 'networks']
  const availablePool = () => questions.filter(question => question.audience === 'common' || question.audience === track.value)

  async function syncFavoriteChanges() {
    if (!userId || !navigator.onLine) return
    const changes = Object.entries(progress.value.favoriteChanges || {})
    for (const [questionId, enabled] of changes) {
      const numericId = Number(questionId)
      const request = enabled
        ? supabase.from('question_favorites').upsert({ user_id: userId, question_id: numericId }, { ignoreDuplicates: true })
        : supabase.from('question_favorites').delete().eq('user_id', userId).eq('question_id', numericId)
      const { error } = await request
      if (error) throw error
      delete progress.value.favoriteChanges[questionId]
    }
    const { data, error } = await supabase.from('question_favorites').select('question_id').eq('user_id', userId)
    if (error) throw error
    progress.value.favorites = (data || []).map(row => Number(row.question_id)).filter(hasQuestion)
  }

  function saveLocal() {
    writeJson(progressKey(), progress.value)
  }

  function hasPendingChanges() {
    return progress.value.pendingSimulations.length > 0 || progress.value.history.some(session => session.syncStatus === 'pending') || Object.keys(progress.value.favoriteChanges || {}).length > 0
  }

  function recordSyncSuccess() {
    syncFailures = 0
    nextSyncAttemptAt = 0
  }

  function recordSyncFailure() {
    syncFailures++
    nextSyncAttemptAt = Date.now() + Math.min(5 * 60 * 1000, 10000 * (2 ** Math.min(syncFailures - 1, 5)))
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
        await syncFavoriteChanges()
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
        recordSyncSuccess()
      }
    })().catch(error => {
      recordSyncFailure()
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
      const { data: favoriteRows, error: favoriteError } = await supabase.from('question_favorites').select('question_id').eq('user_id', ownerId)
      if (favoriteError) throw favoriteError
      remote.favorites = (favoriteRows || []).map(row => Number(row.question_id)).filter(hasQuestion)
      progress.value.favorites = [...remote.favorites]
      const localHistoryIds = new Set(progress.value.history.map(session => session.id))
      const hasNewRemoteSession = remote.history.some(session => !localHistoryIds.has(session.id))
      if (remote.sessions > progress.value.sessions || (remote.sessions === progress.value.sessions && hasNewRemoteSession)) {
        const activeQuiz = progress.value.activeQuiz || remote.activeQuiz
        progress.value = { ...remote, activeQuiz }
      }
      saveLocal()
      recordSyncSuccess()
    })().catch(error => {
      recordSyncFailure()
      console.error('Progress refresh failed:', error.message)
    }).finally(() => {
      pullPromise = null
    })
    return pullPromise
  }

  async function synchronizeNow() {
    isOnline.value = navigator.onLine
    if (!userId || !isOnline.value) return
    if (Date.now() < nextSyncAttemptAt) return
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
    let pool = availablePool()
    let count = modes.value.find(item => item.id === kind)?.count || 12
    if (kind === 'thematic') pool = pool.filter(question => question.section === selectedSection.value)
    if (kind === 'mistakes') {
      pool = questions.filter(question => progress.value.mistakes.includes(question.id))
      count = pool.length
    }
    if (kind === 'favorites') {
      pool = availablePool().filter(question => progress.value.favorites.includes(question.id))
      count = pool.length
    }
    if (kind === 'technical') pool = pool.filter(question => question.category === 'technical')
    if (kind === 'humanities') pool = pool.filter(question => question.category === 'humanities')
    if (kind === 'marathon') count = pool.length
    if (kind === 'exam') {
      const recentIds = new Set(progress.value.history.filter(session => session.mode === 'exam').slice(0, 3).flatMap(session => session.questionIds || []))
      const freshPool = pool.filter(question => !recentIds.has(question.id))
      if (freshPool.length >= count * 2) pool = freshPool
    }
    if (kind === 'exam') {
      quiz.value = shuffle(officialSections().flatMap(section => sectionPick(pool.filter(question => question.section === section), 5, section)))
    } else if (kind === 'diagnostic') {
      const weights = Object.fromEntries(officialSections().map(section => [section, .1]))
      quiz.value = weightedPool(pool, weights, count)
    } else if (kind === 'thematic') quiz.value = sectionPick(pool, count, selectedSection.value)
    else if (kind === 'marathon') quiz.value = shuffle(pool)
    else quiz.value = balancedPick(pool, count)
    index.value = 0
    answers.value = []
    selected.value = null
    screen.value = 'quiz'
    examRemaining.value = kind === 'exam' ? examDurationSeconds : 0
    progress.value.activeQuiz = { ids: quiz.value.map(question => question.id), mode: kind, track: track.value, selectedSection: selectedSection.value, index: 0, answers: [], remainingSeconds: kind === 'exam' ? examDurationSeconds : null }
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
    examRemaining.value = active.mode === 'exam' ? Math.max(0, Number(active.remainingSeconds) || examDurationSeconds) : 0
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

  function goToQuestion(questionIndex) {
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= quiz.value.length) return
    index.value = questionIndex
    selected.value = answers.value[index.value] ?? null
    progress.value.activeQuiz = { ...progress.value.activeQuiz, index: index.value }
    persist()
  }

  function finish() {
    const attemptId = Date.now()
    const completedMode = mode.value
    const completedGrade = examGrade.value
    const mistakeProgress = updateMistakeProgress(
      progress.value.mistakes,
      progress.value.mastery,
      quiz.value.map((question, i) => ({ id: question.id, correct: answers.value[i] === question.correct })),
      completedMode,
    )
    const sectionResults = Object.fromEntries(resultsBySection.value.map(row => [row.key, { correct: row.correct, total: row.total }]))
    progress.value = {
      ...progress.value,
      questionBankVersion,
      sessions: progress.value.sessions + 1,
      correct: progress.value.correct + sessionScore.value,
      total: progress.value.total + quiz.value.length,
      mistakes: mistakeProgress.mistakes,
      favorites: [...progress.value.favorites],
      mastery: mistakeProgress.mastery,
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
    if (value === 'it' && selectedSection.value === 'security') selectedSection.value = 'databases'
    if (value === 'security' && selectedSection.value === 'databases') selectedSection.value = 'security'
  }

  function toggleFavorite(questionId) {
    const favorites = new Set(progress.value.favorites)
    const enabled = !favorites.has(questionId)
    if (enabled) favorites.add(questionId)
    else favorites.delete(questionId)
    progress.value.favorites = [...favorites]
    progress.value.favoriteChanges = { ...progress.value.favoriteChanges, [questionId]: enabled }
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
    progress.value = sanitizeProgress(saved ? readJson(userKey, {}) : {})
    try {
      if (nextUserId && navigator.onLine) {
        const progressRequest = Promise.all([
          supabase.from('progress').select('data').eq('user_id', nextUserId).maybeSingle(),
          supabase.from('question_favorites').select('question_id').eq('user_id', nextUserId),
        ])
        const [progressResult, favoritesResult] = await Promise.race([
          progressRequest,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Progress sync timeout')), 10000)),
        ])
        if (progressResult.error) throw progressResult.error
        if (favoritesResult.error) throw favoritesResult.error
        if (progressResult.data?.data) {
          const remote = sanitizeProgress(progressResult.data.data)
          remote.favorites = (favoritesResult.data || []).map(row => Number(row.question_id)).filter(hasQuestion)
          const hasLocalQueue = hasPendingChanges()
          if (!hasLocalQueue && (remote.sessions || 0) >= progress.value.sessions) {
            const localActiveQuiz = progress.value.activeQuiz
            progress.value = { ...remote, activeQuiz: localActiveQuiz || remote.activeQuiz }
            writeJson(userKey, progress.value)
          } else persist()
        } else {
          progress.value.favorites = (favoritesResult.data || []).map(row => Number(row.question_id)).filter(hasQuestion)
          persist()
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
    const favoriteChanges = { ...progress.value.favoriteChanges }
    const pendingSimulations = [...progress.value.pendingSimulations]
    progress.value = { ...emptyProgress(), favorites, favoriteChanges, pendingSimulations }
    localStorage.removeItem(progressKey())
    persist()
    screen.value = 'home'
  }

  function modeLabel(id) {
    return modes.value.find(item => item.id === id)?.title || 'Работа над ошибками'
  }

  function handleOnline() {
    isOnline.value = true
    nextSyncAttemptAt = 0
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
  let timerTicks = 0
  const examTimer = window.setInterval(() => {
    if (screen.value !== 'quiz' || mode.value !== 'exam' || !progress.value.activeQuiz) return
    examRemaining.value = Math.max(0, examRemaining.value - 1)
    progress.value.activeQuiz = { ...progress.value.activeQuiz, remainingSeconds: examRemaining.value }
    saveLocal()
    if (++timerTicks % 15 === 0 && userId && navigator.onLine) void runSync()
    if (examRemaining.value === 0) finish()
  }, 1000)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('focus', synchronizeNow)
  document.addEventListener('visibilitychange', handleVisibility)
  onBeforeUnmount(() => {
    window.clearInterval(syncTimer)
    window.clearInterval(examTimer)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('focus', synchronizeNow)
    document.removeEventListener('visibilitychange', handleVisibility)
  })

  return { screen, track, selectedSection, mode, quiz, index, selected, answers, progress, progressReady, reviewSession, modes, availableSections, current, isExam, immediateFeedback, answered, isCorrect, totalAccuracy, examAccuracy, examRemaining, formattedExamTime, sessionScore, resultTotal, examGrade, wrongQuestions, resultsBySection, isOnline, syncing, pendingSyncCount, startQuiz, resumeQuiz, choose, confirm, next, goToQuestion, goHome, openHistory, setTrack, setUser, clearProgress, toggleFavorite, modeLabel }
}
