import { computed, ref } from 'vue'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const currentUser = ref(null)
  const leaderboard = ref([])
  const loading = ref(true)
  const isAuthenticated = computed(() => Boolean(currentUser.value))

  async function loadProfile(user) {
    if (!user) {
      currentUser.value = null
      return null
    }
    const { data, error } = await supabase.from('profiles').select('id, display_name').eq('id', user.id).single()
    if (error) throw new Error('Не удалось загрузить профиль. Проверьте настройку базы данных.')
    currentUser.value = { id: data.id, name: data.display_name }
    return currentUser.value
  }

  async function initialize() {
    loading.value = true
    const { data } = await supabase.auth.getSession()
    try {
      await loadProfile(data.session?.user)
    } finally {
      loading.value = false
    }
  }

  async function register(name, email, password) {
    const cleanName = name.trim()
    if (cleanName.length < 2) throw new Error('Имя должно содержать минимум 2 символа')
    if (password.length < 6) throw new Error('Пароль должен содержать минимум 6 символов')
    const normalized = cleanName.toLocaleLowerCase('ru').normalize('NFKC')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLocaleLowerCase(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: cleanName, username_normalized: normalized },
      },
    })
    if (error) {
      if (error.message.includes('Database error')) throw new Error('Аккаунт с таким именем уже существует')
      throw new Error(error.message)
    }
    if (!data.session) return { pendingConfirmation: true, email: data.user?.email || email }
    return loadProfile(data.user)
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLocaleLowerCase(), password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) throw new Error('Сначала подтвердите email по ссылке из письма')
      throw new Error('Неверный email или пароль')
    }
    return loadProfile(data.user)
  }

  async function logout() {
    await supabase.auth.signOut()
    currentUser.value = null
  }

  async function refreshLeaderboard() {
    const { data, error } = await supabase.from('leaderboard').select('user_id, display_name, best_grade, accuracy, sessions').order('best_grade', { ascending: false }).order('accuracy', { ascending: false }).order('sessions', { ascending: false }).limit(100)
    if (error) throw new Error('Не удалось загрузить таблицу лидеров')
    leaderboard.value = data.map(row => ({ id: row.user_id, name: row.display_name, bestGrade: row.best_grade, accuracy: row.accuracy, sessions: row.sessions }))
  }

  return { currentUser, isAuthenticated, leaderboard, loading, initialize, register, login, logout, refreshLeaderboard }
}
