<template>
  <div class="app-shell">
    <main v-if="authLoading" class="loading-page"><span></span><p>Загружаем аккаунт…</p></main>
    <AuthScreen v-else-if="!currentUser" :login="login" :register="register" @authenticated="handleAuthenticated" />
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
      @logout="handleLogout"
    />
    <LeaderboardScreen v-else-if="screen === 'leaderboard'" :players="leaderboard" :current-user="currentUser" @home="goHome" />
    <ProfileScreen v-else-if="screen === 'profile'" :user="currentUser" :update-password="updatePassword" @home="goHome" />
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
      :mode-label="modeLabel"
      @home="goHome"
      @choose="choose"
      @confirm="confirm"
      @next="next"
    />
    <QuestionCatalog v-else-if="screen === 'catalog'" @home="goHome" />
    <ResultsScreen
      v-else
      :session-score="sessionScore"
      :result-total="resultTotal"
      :quiz="quiz"
      :answers="answers"
      :exam-grade="examGrade"
      :is-exam="isExam"
      :is-history-review="Boolean(reviewSession)"
      :results-by-section="resultsBySection"
      :wrong-questions="wrongQuestions"
      @mistakes="startQuiz('mistakes')"
      @home="goHome"
    />
  </div>
</template>

<script setup>
import AuthScreen from './components/AuthScreen.vue'
import HomeScreen from './components/HomeScreen.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'
import ProfileScreen from './components/ProfileScreen.vue'
import QuestionCatalog from './components/QuestionCatalog.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import { useExam } from './composables/useExam'
import { useAuth } from './composables/useAuth'

const { currentUser, leaderboard, loading: authLoading, initialize, register, login, logout, refreshLeaderboard, updatePassword } = useAuth()
const { screen, track, selectedSection, mode, quiz, index, selected, answers, progress, reviewSession, modes, availableSections, current, isExam, answered, isCorrect, totalAccuracy, sessionScore, resultTotal, examGrade, wrongQuestions, resultsBySection, startQuiz, resumeQuiz, choose, confirm, next, goHome, openHistory, setTrack, setUser, clearProgress, modeLabel } = useExam(currentUser.value?.id)

initialize().then(() => {
  if (currentUser.value) setUser(currentUser.value.id)
})

function handleAuthenticated(account) {
  setUser(account.id)
}

async function handleLogout() {
  await logout()
  setUser(null)
}

async function showLeaderboard() {
  await refreshLeaderboard()
  screen.value = 'leaderboard'
}
</script>
