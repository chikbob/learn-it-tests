<template>
  <main class="quiz-page">
    <div class="quiz-top">
      <button class="icon-button" @click="$emit('home')" title="Выйти"><ArrowLeft :size="21" /></button>
      <div class="quiz-progress"><div><span>{{ modeLabel(mode) }}</span><b>{{ index + 1 }} / {{ quizLength }}</b></div><div class="meter"><span :style="{ width: ((index + 1) / quizLength * 100) + '%' }"></span></div></div>
    </div>
    <article class="question-card">
      <div class="question-meta"><span :style="{ color: sections[current.section].color }">{{ sections[current.section].label }}</span><i>{{ difficultyLabels[current.difficulty] }}</i></div>
      <h2>{{ current.text }}</h2>
      <pre v-if="current.code"><code>{{ current.code }}</code></pre>
      <div class="options">
        <button v-for="(option, optionIndex) in current.options" :key="option" @click="$emit('choose', optionIndex)" :disabled="answered" :class="{ selected: selected === optionIndex, correct: answered && optionIndex === current.correct, wrong: answered && selected === optionIndex && optionIndex !== current.correct }">
          <span>{{ ['А','Б','В','Г'][optionIndex] }}</span><b>{{ option }}</b><Check v-if="answered && optionIndex === current.correct" :size="19" /><X v-else-if="answered && selected === optionIndex" :size="19" />
        </button>
      </div>
      <div v-if="answered && !isExam" class="explanation" :class="{ success: isCorrect }">
        <div><Check v-if="isCorrect" :size="20" /><CircleAlert v-else :size="20" /><strong>{{ isCorrect ? 'Верно' : 'Нужно повторить' }}</strong></div>
        <p>{{ current.explanation }}</p>
      </div>
      <div class="question-actions">
        <span v-if="!answered">Выбери один вариант</span><span v-else>{{ isCorrect ? '+1 к результату' : 'Вопрос добавлен в повторение' }}</span>
        <button v-if="!answered" class="primary" :disabled="selected === null" @click="$emit('confirm')">Ответить</button>
        <button v-else class="primary" @click="$emit('next')">{{ index === quizLength - 1 ? 'Завершить' : 'Следующий' }} <ChevronRight :size="18" /></button>
      </div>
    </article>
  </main>
</template>

<script setup>
import { ArrowLeft, Check, ChevronRight, CircleAlert, X } from 'lucide-vue-next'
import { difficultyLabels, sections } from '../questions'

defineProps({ current: Object, index: Number, quizLength: Number, mode: String, selected: Number, answered: Boolean, isCorrect: Boolean, isExam: Boolean, modeLabel: Function })
defineEmits(['home', 'choose', 'confirm', 'next'])
</script>
