<template>
  <div class="app-shell">
    <HomeScreen
      v-if="screen === 'home'"
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
    />
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
      :quiz-length="quiz.length"
      :exam-grade="examGrade"
      :is-exam="isExam"
      :results-by-section="resultsBySection"
      :wrong-questions="wrongQuestions"
      @mistakes="startQuiz('mistakes')"
      @home="goHome"
    />
  </div>
</template>

<script setup>
import HomeScreen from './components/HomeScreen.vue'
import QuestionCatalog from './components/QuestionCatalog.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import { useExam } from './composables/useExam'

const { screen, track, selectedSection, mode, quiz, index, selected, progress, modes, availableSections, current, isExam, answered, isCorrect, totalAccuracy, sessionScore, examGrade, wrongQuestions, resultsBySection, startQuiz, resumeQuiz, choose, confirm, next, goHome, setTrack, clearProgress, modeLabel } = useExam()
</script>
