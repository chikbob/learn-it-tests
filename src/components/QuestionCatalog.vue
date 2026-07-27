<template>
  <main class="catalog-page">
    <div class="catalog-header">
      <button class="icon-button" @click="$emit('home')" title="На главную"><ArrowLeft :size="21" /></button>
      <div><p class="eyebrow"><LibraryBig :size="16" /> Справочник</p><h1>Все вопросы</h1><p>{{ filteredQuestions.length }} из {{ questions.length }}</p></div>
    </div>
    <div class="catalog-tools">
      <label class="search-box"><Search :size="18" /><input v-model="search" type="search" placeholder="Найти вопрос или термин" /></label>
      <select v-model="sectionFilter" aria-label="Фильтр по теме">
        <option value="all">Все темы</option>
        <option v-for="(section, key) in sections" :key="key" :value="key">{{ section.label }}</option>
      </select>
      <select v-model="difficultyFilter" aria-label="Фильтр по сложности">
        <option value="all">Любая сложность</option>
        <option v-for="(label, key) in difficultyLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>
    <div class="catalog-list">
      <details v-for="question in filteredQuestions" :key="question.id" class="catalog-question">
        <summary>
          <span class="catalog-number">{{ question.id }}</span>
          <span><small :style="{ color: sections[question.section].color }">{{ sections[question.section].label }} · {{ difficultyLabels[question.difficulty] }}</small><strong>{{ question.text }}</strong></span>
          <ChevronRight :size="18" />
        </summary>
        <div class="catalog-answer">
          <pre v-if="question.code"><code>{{ question.code }}</code></pre>
          <ol type="A"><li v-for="(option, optionIndex) in question.options" :key="option" :class="{ correct: optionIndex === question.correct }">{{ option }}</li></ol>
          <p><b>Объяснение:</b> {{ question.explanation }}</p>
        </div>
      </details>
      <p v-if="!filteredQuestions.length" class="empty-state">По этому запросу вопросов не найдено.</p>
    </div>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, ChevronRight, LibraryBig, Search } from 'lucide-vue-next'
import { difficultyLabels, questions, sections } from '../questions'

defineEmits(['home'])

const search = ref('')
const sectionFilter = ref('all')
const difficultyFilter = ref('all')
const filteredQuestions = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('ru')
  return questions.filter(question => {
    const matchesSearch = !needle || [question.text, question.explanation, ...question.options].join(' ').toLocaleLowerCase('ru').includes(needle)
    return matchesSearch && (sectionFilter.value === 'all' || question.section === sectionFilter.value) && (difficultyFilter.value === 'all' || question.difficulty === difficultyFilter.value)
  })
})
</script>
