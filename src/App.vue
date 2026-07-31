<template>
  <div class="app-shell">
    <main v-if="authLoading || (currentUser && !progressReady)" class="loading-page"><span></span><p>{{ authLoading ? 'Загружаем аккаунт…' : 'Синхронизируем прогресс…' }}</p></main>
    <AuthScreen v-else-if="!currentUser" :login="login" :register="register" />
    <AdminScreen v-else-if="screen === 'admin' && currentUser.isAdmin" :load-users="loadAdminUsers" @app="screen = 'home'" @logout="handleLogout" />
    <HomeScreen
      v-else-if="screen === 'home'"
      :user="currentUser"
      :progress="progress"
      :total-accuracy="totalAccuracy"
      :modes="modes"
      :track="track"
      :mode="mode"
      :selected-section="selectedSection"
      :available-sections="availableSections"
      :mode-label="modeLabel"
      :is-online="isOnline"
      :syncing="syncing"
      :pending-sync-count="pendingSyncCount"
      @update:track="setTrack"
      @update:mode="mode = $event"
      @update:selected-section="selectedSection = $event"
      @start="startQuiz()"
      @resume="resumeQuiz"
      @mistakes="startQuiz('mistakes')"
      @catalog="screen = 'catalog'"
      @clear="clearProgress"
      @review="openHistory"
      @leaderboard="showLeaderboard"
      @profile="screen = 'profile'"
      @admin="screen = 'admin'"
      @logout="handleLogout"
    />
    <LeaderboardScreen v-else-if="screen === 'leaderboard'" :players="leaderboard" :current-user="currentUser" @home="goHome" />
    <ProfileScreen v-else-if="screen === 'profile'" :user="currentUser" :progress="progress" :total-accuracy="totalAccuracy" :password-recovery="passwordRecovery" :request-password-reset="requestPasswordReset" :update-password="updatePassword" :update-display-name="updateDisplayName" @home="goHome" />
    <QuizScreen
      v-else-if="screen === 'quiz' && current"
      :current="current"
      :index="index"
      :quiz-length="quiz.length"
      :mode="mode"
      :selected="selected"
      :answered="answered"
      :is-correct="isCorrect"
      :is-exam="isExam"
      :is-favorite="progress.favorites.includes(current.id)"
      :mode-label="modeLabel"
      @home="goHome"
      @choose="choose"
      @confirm="confirm"
      @next="next"
      @toggle-favorite="toggleFavorite"
    />
    <QuestionCatalog v-else-if="screen === 'catalog'" :favorites="progress.favorites" @toggle-favorite="toggleFavorite" @home="goHome" />
    <ResultsScreen
      v-else
      :session-score="sessionScore"
      :result-total="resultTotal"
      :quiz="quiz"
      :answers="answers"
      :exam-grade="examGrade"
      :is-exam="isExam"
      :is-history-review="Boolean(reviewSession)"
      :mode="mode"
      :results-by-section="resultsBySection"
      :wrong-questions="wrongQuestions"
      :favorites="progress.favorites"
      @mistakes="startQuiz('mistakes')"
      @toggle-favorite="toggleFavorite"
      @home="goHome"
    />
  </div>
</template>

<script setup>
import AuthScreen from './components/AuthScreen.vue'
import AdminScreen from './components/AdminScreen.vue'
import HomeScreen from './components/HomeScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'
import ProfileScreen from './components/ProfileScreen.vue'
import QuestionCatalog from './components/QuestionCatalog.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import { watch } from 'vue'
import { useExam } from './composables/useExam'
import { useAuth } from './composables/useAuth'
import { loadQuestions } from './lib/questionRepository'

const { currentUser, leaderboard, loading: authLoading, passwordRecovery, initialize, register, login, logout, refreshLeaderboard, loadAdminUsers, requestPasswordReset, updatePassword, updateDisplayName } = useAuth()
const { screen, track, selectedSection, mode, quiz, index, selected, answers, progress, progressReady, reviewSession, modes, availableSections, current, isExam, answered, isCorrect, totalAccuracy, sessionScore, resultTotal, examGrade, wrongQuestions, resultsBySection, isOnline, syncing, pendingSyncCount, startQuiz, resumeQuiz, choose, confirm, next, goHome, openHistory, setTrack, setUser, clearProgress, toggleFavorite, modeLabel } = useExam(currentUser.value?.id)

watch(() => currentUser.value?.id || null, async userId => {
  if (userId) await loadQuestions()
  await setUser(userId)
  if (userId && passwordRecovery.value) screen.value = 'profile'
  else if (userId && currentUser.value?.isAdmin) screen.value = 'admin'
}, { flush: 'sync' })

void initialize()

async function handleLogout() {
  await logout()
}

async function showLeaderboard() {
  await refreshLeaderboard()
  screen.value = 'leaderboard'
}
</script>
