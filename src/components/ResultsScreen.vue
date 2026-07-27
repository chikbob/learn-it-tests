<template>
  <main class="results-page">
    <section class="result-hero">
      <p class="eyebrow"><Trophy :size="16" /> Тест завершен</p>
      <h1 v-if="isExam">{{ examGrade }} <small>баллов</small></h1>
      <h1 v-else>{{ sessionScore }} из {{ quizLength }}</h1>
      <p v-if="isExam">Верных ответов: {{ sessionScore }} из {{ quizLength }}. Все задания имеют одинаковый вес.</p>
      <p v-else>{{ summary }}</p>
    </section>
    <section class="result-content">
      <div class="breakdown">
        <h2>Результат по разделам</h2>
        <div v-for="row in resultsBySection" :key="row.key" class="result-row">
          <span class="dot" :style="{ background: sections[row.key].color }"></span><strong>{{ sections[row.key].label }}</strong><div class="meter"><span :style="{ width: row.percent + '%', background: sections[row.key].color }"></span></div><b>{{ row.correct }}/{{ row.total }}</b>
        </div>
      </div>
      <aside class="next-card">
        <Target :size="24" /><h3>{{ wrongQuestions.length ? 'Следующий шаг' : 'Без ошибок' }}</h3>
        <p>{{ wrongQuestions.length ? `${wrongQuestions.length} вопросов отправлено в персональное повторение.` : 'Все ответы верны. Можно переходить к новой симуляции.' }}</p>
        <button v-if="wrongQuestions.length" class="primary" @click="$emit('mistakes')"><RotateCcw :size="18" /> Разобрать ошибки</button>
        <button class="secondary" @click="$emit('home')">На главную</button>
      </aside>
    </section>
    <section v-if="wrongQuestions.length" class="mistake-review">
      <h2>Короткий разбор</h2>
      <details v-for="question in wrongQuestions" :key="question.id">
        <summary>{{ question.text }} <ChevronRight :size="18" /></summary>
        <p><b>Правильный ответ:</b> {{ question.options[question.correct] }}</p><p>{{ question.explanation }}</p>
      </details>
    </section>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight, RotateCcw, Target, Trophy } from 'lucide-vue-next'
import { sections } from '../questions'

const props = defineProps({ sessionScore: Number, quizLength: Number, examGrade: Number, isExam: Boolean, resultsBySection: Array, wrongQuestions: Array })
defineEmits(['mistakes', 'home'])

const summary = computed(() => props.sessionScore / props.quizLength >= .8
  ? 'Отличный результат. Основные темы уже держатся уверенно.'
  : props.sessionScore / props.quizLength >= .6
    ? 'Хорошая база. Разбор ошибок поможет быстро поднять результат.'
    : 'Диагностика сработала: теперь понятно, что повторять в первую очередь.')
</script>
