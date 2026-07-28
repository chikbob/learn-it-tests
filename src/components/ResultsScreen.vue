<template>
  <main class="results-page">
    <section class="result-hero">
      <p class="eyebrow"><Trophy :size="16" /> Тест завершен</p>
      <h1 v-if="isExam">{{ examGrade }} <small>баллов</small></h1>
      <h1 v-else>{{ sessionScore }} из {{ resultTotal }}</h1>
      <p v-if="isExam">Верных ответов: {{ sessionScore }} из {{ resultTotal }}. Все задания имеют одинаковый вес.</p>
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
        <History v-if="isHistoryReview" :size="24" /><Target v-else :size="24" />
        <h3>{{ isHistoryReview ? 'Архив попытки' : wrongQuestions.length ? 'Следующий шаг' : 'Без ошибок' }}</h3>
        <p v-if="isHistoryReview">Сохраненный результат можно просмотреть повторно в любое время.</p>
        <p v-else>{{ wrongQuestions.length ? `${wrongQuestions.length} вопросов отправлено в персональное повторение.` : 'Все ответы верны. Можно переходить к новой симуляции.' }}</p>
        <button v-if="wrongQuestions.length && !isHistoryReview" class="primary" @click="$emit('mistakes')"><RotateCcw :size="18" /> Разобрать ошибки</button>
        <button class="secondary" @click="$emit('home')">На главную</button>
      </aside>
    </section>
    <section class="answer-review">
      <div class="review-heading"><div><h2>Разбор ответов</h2><p v-if="quiz.length">Раскрой вопрос, чтобы увидеть все варианты и объяснение.</p></div><span v-if="quiz.length">{{ sessionScore }} верно · {{ resultTotal - sessionScore }} ошибок</span></div>
      <div v-if="quiz.length" class="review-list">
        <details v-for="(question, questionIndex) in quiz" :key="question.id" class="review-question">
          <summary :class="{ 'no-favorite': mode === 'favorites' }">
            <span class="review-status" :class="{ correct: answers[questionIndex] === question.correct, wrong: answers[questionIndex] !== question.correct }"><Check v-if="answers[questionIndex] === question.correct" :size="16" /><X v-else :size="16" /></span>
            <span><small>{{ sections[question.section].label }}</small><strong>{{ question.text }}</strong></span>
            <button v-if="mode !== 'favorites'" class="review-favorite" :class="{ active: favorites.includes(question.id) }" @click.stop.prevent="$emit('toggle-favorite', question.id)" :title="favorites.includes(question.id) ? 'Убрать из избранного' : 'Добавить в избранное'">
              <Star :size="17" :fill="favorites.includes(question.id) ? 'currentColor' : 'none'" />
            </button>
            <ChevronRight :size="18" />
          </summary>
          <div class="review-details">
            <pre v-if="question.code"><code>{{ question.code }}</code></pre>
            <div class="review-options">
              <div v-for="(option, optionIndex) in question.options" :key="option" :class="{ chosen: answers[questionIndex] === optionIndex, correct: question.correct === optionIndex, incorrect: answers[questionIndex] === optionIndex && question.correct !== optionIndex }">
                <span>{{ ['А','Б','В','Г'][optionIndex] }}</span><b>{{ option }}</b>
                <em v-if="question.correct === optionIndex"><Check :size="15" /> Правильный ответ</em>
                <em v-else-if="answers[questionIndex] === optionIndex"><MousePointer2 :size="15" /> Ваш ответ</em>
              </div>
            </div>
            <p class="review-explanation"><b>Объяснение:</b> {{ question.explanation }}</p>
          </div>
        </details>
      </div>
      <div v-else class="legacy-notice"><History :size="20" /><p><b>Детальный разбор недоступен.</b><br>Эта попытка была сохранена до появления протокола ответов. Итог и результаты по разделам восстановлены.</p></div>
    </section>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { Check, ChevronRight, History, MousePointer2, RotateCcw, Star, Target, Trophy, X } from 'lucide-vue-next'
import { sections } from '../questions'

const props = defineProps({ sessionScore: Number, resultTotal: Number, quiz: Array, answers: Array, examGrade: Number, isExam: Boolean, isHistoryReview: Boolean, mode: String, resultsBySection: Array, wrongQuestions: Array, favorites: { type: Array, default: () => [] } })
defineEmits(['mistakes', 'home', 'toggle-favorite'])

const summary = computed(() => props.sessionScore / props.resultTotal >= .8
  ? 'Отличный результат. Основные темы уже держатся уверенно.'
  : props.sessionScore / props.resultTotal >= .6
    ? 'Хорошая база. Разбор ошибок поможет быстро поднять результат.'
    : 'Диагностика сработала: теперь понятно, что повторять в первую очередь.')
</script>

<style scoped>
.review-question summary { grid-template-columns: 32px 1fr 34px 20px; }
.review-question summary.no-favorite { grid-template-columns: 32px 1fr 20px; }
.review-favorite { width: 32px; height: 32px; border: 0; border-radius: 4px; background: transparent; color: #85908c; display: grid; place-items: center; cursor: pointer; }
.review-favorite:hover, .review-favorite.active { color: #a47b18; background: #fff6d9; }
@media (max-width: 760px) { .review-question summary { grid-template-columns: 28px 1fr 32px 18px; }.review-question summary.no-favorite { grid-template-columns: 28px 1fr 18px; } }
</style>
