import { computed, ref } from 'vue'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const currentUser = ref(null)
  const leaderboard = ref([])
  const loading = ref(true)
  const passwordRecovery = ref(new URLSearchParams(window.location.search).has('reset_password'))
  const isAuthenticated = computed(() => Boolean(currentUser.value))

  async function loadProfile(user) {
    if (!user) {
      currentUser.value = null
      return null
    }
    const { data, error } = await supabase.from('profiles').select('id, display_name').eq('id', user.id).single()
    if (error) throw new Error('Не удалось загрузить профиль. Проверьте настройку базы данных.')
    currentUser.value = { id: data.id, name: data.display_name, email: user.email }
    return currentUser.value
  }

  async function initialize() {
    loading.value = true
    try {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: params.get('type') || 'email' })
        if (error) throw error
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      const { data } = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 8000)),
      ])
      await loadProfile(data.session?.user)
    } catch (error) {
      console.error('Auth initialization failed:', error.message)
      currentUser.value = null
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

  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset_password=1`,
    })
    if (error) throw new Error(error.message)
  }

  async function refreshLeaderboard() {
    const { data, error } = await supabase.from('leaderboard').select('user_id, display_name, average_grade, simulation_count').gt('simulation_count', 0).order('average_grade', { ascending: false }).order('simulation_count', { ascending: false }).limit(100)
    if (error) throw new Error('Не удалось загрузить таблицу лидеров')
    leaderboard.value = data.map(row => ({ id: row.user_id, name: row.display_name, averageGrade: row.average_grade, simulationCount: row.simulation_count }))
  }

  async function updatePassword(password) {
    if (password.length < 6) throw new Error('Пароль должен содержать минимум 6 символов')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    passwordRecovery.value = false
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  return { currentUser, isAuthenticated, leaderboard, loading, passwordRecovery, initialize, register, login, logout, refreshLeaderboard, requestPasswordReset, updatePassword }
}
