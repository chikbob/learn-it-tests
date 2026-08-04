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
      <label class="favorites-filter" :class="{ active: favoritesOnly }">
        <input v-model="favoritesOnly" type="checkbox" />
        <Star :size="17" :fill="favoritesOnly ? 'currentColor' : 'none'" />
        Только избранные <b>{{ favorites.length }}</b>
      </label>
    </div>
    <div class="catalog-list">
      <details v-for="question in filteredQuestions" :key="question.id" class="catalog-question">
        <summary>
          <span class="catalog-number">{{ question.id }}</span>
          <span><small :style="{ color: sections[question.section].color }">{{ sections[question.section].label }} · {{ difficultyLabels[question.difficulty] }}</small><strong>{{ question.text }}</strong></span>
          <button class="catalog-favorite" :class="{ active: favorites.includes(question.id) }" @click.stop.prevent="$emit('toggle-favorite', question.id)" :title="favorites.includes(question.id) ? 'Убрать из избранного' : 'Добавить в избранное'">
            <Star :size="18" :fill="favorites.includes(question.id) ? 'currentColor' : 'none'" />
          </button>
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
    <Transition name="scroll-top">
      <button
        v-if="showScrollTop"
        class="scroll-top-button"
        type="button"
        title="Вернуться наверх"
        aria-label="Вернуться наверх"
        @click="scrollToTop"
      >
        <ArrowUp :size="21" />
      </button>
    </Transition>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowUp, ChevronRight, LibraryBig, Search, Star } from 'lucide-vue-next'
import { difficultyLabels, questions, sections } from '../questions'

const props = defineProps({ favorites: { type: Array, default: () => [] }, track: { type: String, default: 'it' } })
defineEmits(['home', 'toggle-favorite'])

const search = ref('')
const sectionFilter = ref('all')
const difficultyFilter = ref('all')
const favoritesOnly = ref(false)
const showScrollTop = ref(false)

const updateScrollTopVisibility = () => {
  showScrollTop.value = window.scrollY > 500
}

const scrollToTop = () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
}

onMounted(() => {
  updateScrollTopVisibility()
  window.addEventListener('scroll', updateScrollTopVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScrollTopVisibility)
})

const filteredQuestions = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('ru')
  return questions.filter(question => {
    const matchesTrack = question.audience === 'common' || question.audience === props.track
    const matchesSearch = !needle || [question.text, question.explanation, ...question.options].join(' ').toLocaleLowerCase('ru').includes(needle)
    const matchesFavorite = !favoritesOnly.value || props.favorites.includes(question.id)
    return matchesTrack && matchesSearch && matchesFavorite && (sectionFilter.value === 'all' || question.section === sectionFilter.value) && (difficultyFilter.value === 'all' || question.difficulty === difficultyFilter.value)
  })
})
</script>

<style scoped>
.favorites-filter { height: 46px; padding: 0 12px; border: 1px solid #d3dad5; border-radius: 5px; background: white; color: #59645f; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 700; white-space: nowrap; }
.favorites-filter input { position: absolute; opacity: 0; pointer-events: none; }
.favorites-filter b { min-width: 23px; height: 23px; margin-left: auto; border-radius: 50%; background: #edf0ed; display: grid; place-items: center; font-size: 11px; }
.favorites-filter.active { color: #8a6812; border-color: #d9b650; background: #fff9e7; }
.catalog-question summary { grid-template-columns: 38px 1fr 38px 20px; }
.catalog-favorite { width: 34px; height: 34px; border: 0; border-radius: 4px; background: transparent; color: #85908c; display: grid; place-items: center; cursor: pointer; }
.catalog-favorite:hover, .catalog-favorite.active { color: #a47b18; background: #fff6d9; }
.scroll-top-button { position: fixed; right: max(24px, calc((100vw - 1050px) / 2 - 64px)); bottom: 28px; z-index: 10; width: 48px; height: 48px; border: 1px solid #246d66; border-radius: 50%; background: #2d7f77; color: white; box-shadow: 0 8px 24px rgba(23, 63, 58, .22); display: grid; place-items: center; cursor: pointer; }
.scroll-top-button:hover { background: #246d66; box-shadow: 0 10px 28px rgba(23, 63, 58, .3); transform: translateY(-2px); }
.scroll-top-enter-active, .scroll-top-leave-active { transition: opacity .2s ease, transform .2s ease; }
.scroll-top-enter-from, .scroll-top-leave-to { opacity: 0; transform: translateY(10px); }
@media (max-width: 760px) {
  .catalog-question summary { grid-template-columns: 34px 1fr 34px 18px; }
  .scroll-top-button { right: 16px; bottom: 18px; width: 46px; height: 46px; }
}
</style>
