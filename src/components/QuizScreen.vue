<template>
  <main class="quiz-page">
    <div class="quiz-top">
      <button class="icon-button" @click="$emit('home')" title="Выйти"><ArrowLeft :size="21" /></button>
      <div class="quiz-progress"><div><span>{{ modeLabel(mode) }}</span><b>{{ index + 1 }} / {{ quizLength }}</b></div><div class="meter"><span :style="{ width: ((index + 1) / quizLength * 100) + '%' }"></span></div></div>
      <div v-if="isExam" class="exam-timer"><Clock3 :size="18" /><span>Осталось</span><b>{{ formattedExamTime }}</b></div>
    </div>
    <article class="question-card">
      <nav class="question-pagination" aria-label="Навигация по заданиям">
        <button v-for="(_, questionIndex) in quiz" :key="questionIndex" :class="questionStatus(questionIndex)" :aria-label="`Перейти к вопросу ${questionIndex + 1}`" @click="$emit('go-to', questionIndex)">{{ questionIndex + 1 }}</button>
      </nav>
      <div class="question-meta">
        <span :style="{ color: sections[current.section].color }">{{ sections[current.section].label }}</span><i>{{ difficultyLabels[current.difficulty] }}</i>
        <button v-if="mode !== 'favorites'" class="favorite-button" :class="{ active: isFavorite }" @click="$emit('toggle-favorite', current.id)" :title="isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'">
          <Star :size="20" :fill="isFavorite ? 'currentColor' : 'none'" />
        </button>
      </div>
      <h2>{{ current.text }}</h2>
      <pre v-if="current.code"><code>{{ current.code }}</code></pre>
      <div class="options">
        <button v-for="(option, optionIndex) in current.options" :key="option" @click="$emit('choose', optionIndex)" :disabled="answered" :class="{ selected: selected === optionIndex && !answered, 'locked-answer': isExam && answered && selected === optionIndex, correct: immediateFeedback && answered && optionIndex === current.correct, wrong: immediateFeedback && answered && selected === optionIndex && optionIndex !== current.correct }">
          <span>{{ ['А','Б','В','Г'][optionIndex] }}</span><b>{{ formatQuestionOption(option) }}</b><Check v-if="immediateFeedback && answered && optionIndex === current.correct" :size="19" /><X v-else-if="immediateFeedback && answered && selected === optionIndex" :size="19" />
        </button>
      </div>
      <div v-if="answered && immediateFeedback" class="explanation" :class="{ success: isCorrect }">
        <div><Check v-if="isCorrect" :size="20" /><CircleAlert v-else :size="20" /><strong>{{ isCorrect ? 'Верно' : 'Нужно повторить' }}</strong></div>
        <p>{{ current.explanation }}</p>
      </div>
      <div class="question-actions">
        <span v-if="!answered">Выбери один вариант</span><span v-else-if="isExam">Ответ сохранён</span><span v-else>{{ isCorrect ? '+1 к результату' : 'Вопрос добавлен в повторение' }}</span>
        <button v-if="!answered" class="primary" :disabled="selected === null" @click="$emit('confirm')">Ответить</button>
        <button v-else class="primary" @click="$emit('next')">{{ index === quizLength - 1 ? 'Завершить' : 'Следующий' }} <ChevronRight :size="18" /></button>
      </div>
    </article>
  </main>
</template>

<script setup>
import { ArrowLeft, Check, ChevronRight, CircleAlert, Clock3, Star, X } from 'lucide-vue-next'
import { difficultyLabels, sections } from '../questions'
import { formatQuestionOption } from '../lib/questionFormatting'

const props = defineProps({ current: Object, quiz: Array, answers: Array, index: Number, quizLength: Number, mode: String, selected: Number, answered: Boolean, isCorrect: Boolean, isExam: Boolean, immediateFeedback: Boolean, formattedExamTime: String, isFavorite: Boolean, modeLabel: Function })
defineEmits(['home', 'choose', 'confirm', 'next', 'go-to', 'toggle-favorite'])

function questionStatus(questionIndex) {
  if (questionIndex === props.index) return 'current'
  if (props.answers[questionIndex] === undefined) return ''
  if (props.isExam) return 'answered'
  return props.answers[questionIndex] === props.quiz[questionIndex].correct ? 'correct' : 'wrong'
}
</script>

<style scoped>
.favorite-button { width: 36px; height: 36px; margin-left: auto; border: 1px solid #d8ded9; border-radius: 5px; background: #fff; color: #7a8581; display: grid; place-items: center; cursor: pointer; }
.favorite-button:hover, .favorite-button.active { color: #a47b18; border-color: #d9b650; background: #fff9e7; }
.exam-timer { min-width: 138px; padding: 9px 12px; border: 1px solid #d7ded9; background: #fff; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 1px 8px; color: #173f3a; }.exam-timer svg { grid-row: 1 / 3; }.exam-timer span { font-size: 9px; text-transform: uppercase; color: #78817e; font-weight: 800; }.exam-timer b { font-size: 17px; font-variant-numeric: tabular-nums; }
.question-pagination { margin: -8px 0 24px; padding-bottom: 18px; border-bottom: 1px solid #e2e7e3; display: flex; flex-wrap: wrap; gap: 6px; }.question-pagination button { width: 34px; height: 32px; border: 1px solid #d5dcd7; border-radius: 4px; background: #f7f9f8; color: #65706c; font-size: 11px; font-weight: 800; cursor: pointer; }.question-pagination button:hover,.question-pagination button.current { border-color: #2d7f77; color: #173f3a; box-shadow: inset 0 -2px #2d7f77; }.question-pagination button.correct { border-color: #77af8c; background: #e8f6ed; color: #24663d; }.question-pagination button.wrong { border-color: #d69a93; background: #faeae8; color: #9b3f38; }.question-pagination button.answered { border-color: #adb6b2; background: #dfe4e2; color: #52605b; }
.options button.locked-answer { border-color: #aeb7b3; background: #e4e8e6; color: #4f5b57; }.options button.locked-answer > span { background: #8b9691; color: #fff; }
@media (max-width: 650px) { .quiz-top { flex-wrap: wrap; }.exam-timer { margin-left: 52px; }.question-pagination { max-height: 150px; overflow-y: auto; }.question-pagination button { width: 32px; } }
</style>
