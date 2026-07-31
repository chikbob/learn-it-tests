<template>
  <main class="admin-page">
    <header class="admin-header">
      <div><p class="eyebrow"><ShieldCheck :size="17" /> Управление</p><h1>Админ-панель</h1><p>Пользователи, статистика и банк экзаменационных вопросов.</p></div>
      <div class="admin-actions"><button class="secondary" @click="$emit('app')"><BookOpen :size="17" /> В приложение</button><button class="icon-button" @click="$emit('logout')" title="Выйти"><LogOut :size="18" /></button></div>
    </header>

    <nav class="admin-tabs" aria-label="Разделы админ-панели">
      <button :class="{ active: tab === 'users' }" @click="tab = 'users'"><Users :size="17" /> Пользователи</button>
      <button :class="{ active: tab === 'questions' }" @click="tab = 'questions'"><ListChecks :size="17" /> Вопросы <b>{{ questions.length }}</b></button>
    </nav>

    <template v-if="tab === 'users'">
      <section v-if="usersLoading" class="admin-loading"><span></span><p>Собираем статистику…</p></section>
      <template v-else-if="!usersError">
        <section class="admin-stats">
          <div><Users :size="19" /><span><b>{{ users.length }}</b><small>пользователей</small></span></div>
          <div><ClipboardCheck :size="19" /><span><b>{{ totalSessions }}</b><small>тестов завершено</small></span></div>
          <div><Target :size="19" /><span><b>{{ averageAccuracy }}%</b><small>средняя точность</small></span></div>
          <div><Gauge :size="19" /><span><b>{{ simulations }}</b><small>симуляций</small></span></div>
        </section>

        <section class="admin-table-wrap">
          <div class="admin-table-heading"><div><h2>Пользователи</h2><p>Данные из Supabase.</p></div><button class="icon-button" @click="loadUsers" title="Обновить"><RefreshCw :size="17" /></button></div>
          <div class="admin-columns"><span>Аккаунт</span><span>Роль</span><span>Тесты</span><span>Точность</span><span>Симуляции</span><span>Регистрация</span></div>
          <div v-for="item in users" :key="item.user_id" class="admin-row">
            <span class="admin-user"><i>{{ item.display_name.slice(0, 1).toUpperCase() }}</i><span><b>{{ item.display_name }}</b><small>{{ item.email }}</small></span></span>
            <span><em :class="item.role">{{ item.role === 'admin' ? 'Админ' : 'Ученик' }}</em></span>
            <span><b>{{ item.sessions }}</b></span>
            <span><b>{{ item.accuracy }}%</b></span>
            <span><b>{{ item.simulation_count }}</b><small v-if="item.simulation_count"> · {{ item.average_grade }} б.</small></span>
            <span>{{ formatDate(item.joined_at) }}</span>
          </div>
        </section>
      </template>
      <section v-else class="admin-error"><CircleAlert :size="22" /><div><b>Не удалось загрузить пользователей</b><p>{{ usersError }}</p></div><button class="secondary" @click="loadUsers">Повторить</button></section>
    </template>

    <template v-else>
      <section class="question-toolbar">
        <label class="admin-search"><Search :size="17" /><input v-model="questionSearch" type="search" placeholder="Найти вопрос" /></label>
        <select v-model="sectionFilter" aria-label="Фильтр по разделу"><option value="all">Все разделы</option><option v-for="(section, key) in sections" :key="key" :value="key">{{ section.label }}</option></select>
        <button class="primary" @click="startCreate"><Plus :size="18" /> Добавить вопрос</button>
        <button class="icon-button" :disabled="questionsLoading" @click="loadQuestionBank" title="Обновить"><RefreshCw :size="17" /></button>
      </section>

      <section v-if="editorOpen" class="question-editor">
        <div class="editor-heading"><div><p class="eyebrow">{{ editingId ? `Вопрос #${editingId}` : 'Новый вопрос' }}</p><h2>{{ editingId ? 'Редактирование' : 'Создание вопроса' }}</h2></div><button class="icon-button" type="button" title="Закрыть" @click="closeEditor"><X :size="18" /></button></div>
        <form @submit.prevent="saveQuestion">
          <div class="editor-grid">
            <label><span>Раздел</span><select v-model="form.section" required><option v-for="(section, key) in sections" :key="key" :value="key">{{ section.label }}</option></select></label>
            <label><span>Сложность</span><select v-model="form.difficulty" required><option v-for="(label, key) in difficultyLabels" :key="key" :value="key">{{ label }}</option></select></label>
            <label><span>Позиция</span><input v-model.number="form.position" type="number" min="0" required /></label>
          </div>
          <label><span>Текст вопроса</span><textarea v-model="form.text" rows="3" maxlength="1000" required /></label>
          <fieldset>
            <legend>Варианты ответа — отметьте правильный</legend>
            <label v-for="(_, optionIndex) in form.options" :key="optionIndex" class="option-editor">
              <input v-model.number="form.correct" type="radio" name="correct-option" :value="optionIndex" />
              <b>{{ String.fromCharCode(65 + optionIndex) }}</b>
              <input v-model="form.options[optionIndex]" type="text" maxlength="1000" required :placeholder="`Вариант ${optionIndex + 1}`" />
            </label>
          </fieldset>
          <label><span>Объяснение</span><textarea v-model="form.explanation" rows="3" maxlength="3000" required /></label>
          <label><span>Код или данные к вопросу <small>необязательно</small></span><textarea v-model="form.code" rows="4" maxlength="10000" /></label>
          <p v-if="editorError" class="editor-error"><CircleAlert :size="16" /> {{ editorError }}</p>
          <div class="editor-actions"><button type="button" class="secondary" @click="closeEditor">Отмена</button><button class="primary" :disabled="saving">{{ saving ? 'Сохраняем…' : editingId ? 'Сохранить' : 'Создать' }} <Save v-if="!saving" :size="17" /></button></div>
        </form>
      </section>

      <section v-if="questionsError" class="admin-error"><CircleAlert :size="22" /><div><b>Не удалось загрузить вопросы из Supabase</b><p>{{ questionsError }}</p></div><button class="secondary" @click="loadQuestionBank">Повторить</button></section>
      <section class="question-table">
        <div class="question-table-heading"><div><h2>Банк вопросов</h2><p>{{ filteredQuestions.length }} из {{ questions.length }}</p></div><span v-if="questionsLoading">Обновляем…</span></div>
        <p v-if="!filteredQuestions.length" class="empty-state">Вопросов по заданному фильтру нет.</p>
        <article v-for="question in filteredQuestions" :key="question.id" class="question-admin-row">
          <span class="question-id">#{{ question.id }}</span>
          <div><small :style="{ color: sections[question.section]?.color }">{{ sections[question.section]?.label }} · {{ difficultyLabels[question.difficulty] }}</small><b>{{ question.text }}</b><span>{{ question.options[question.correct] }}</span></div>
          <div class="row-actions"><button class="icon-button" title="Редактировать" @click="startEdit(question)"><Pencil :size="16" /></button><button class="icon-button danger" title="Удалить" @click="remove(question)"><Trash2 :size="16" /></button></div>
        </article>
      </section>
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { BookOpen, CircleAlert, ClipboardCheck, Gauge, ListChecks, LogOut, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, Target, Trash2, Users, X } from 'lucide-vue-next'
import { difficultyLabels, questions, sections } from '../questions'
import { createQuestion, deleteQuestion, loadQuestions, updateQuestion } from '../lib/questionRepository'

const props = defineProps({ loadUsers: { type: Function, required: true } })
defineEmits(['app', 'logout'])

const tab = ref('users')
const users = ref([])
const usersLoading = ref(true)
const usersError = ref('')
const questionsLoading = ref(false)
const questionsError = ref('')
const questionSearch = ref('')
const sectionFilter = ref('all')
const editorOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const editorError = ref('')
const emptyForm = () => ({ section: 'algorithms', difficulty: 'understanding', position: questions.length + 1, text: '', options: ['', '', '', ''], correct: 0, explanation: '', code: '' })
const form = reactive(emptyForm())

const totalSessions = computed(() => users.value.reduce((sum, user) => sum + user.sessions, 0))
const simulations = computed(() => users.value.reduce((sum, user) => sum + user.simulation_count, 0))
const averageAccuracy = computed(() => users.value.length ? Math.round(users.value.reduce((sum, user) => sum + user.accuracy, 0) / users.value.length) : 0)
const filteredQuestions = computed(() => {
  const needle = questionSearch.value.trim().toLocaleLowerCase('ru')
  return questions.filter(question =>
    (sectionFilter.value === 'all' || question.section === sectionFilter.value)
    && (!needle || `${question.text} ${question.explanation} ${question.options.join(' ')}`.toLocaleLowerCase('ru').includes(needle))
  )
})

async function loadUsers() {
  usersLoading.value = true
  usersError.value = ''
  try { users.value = await props.loadUsers() } catch (reason) { usersError.value = reason.message } finally { usersLoading.value = false }
}

async function loadQuestionBank() {
  questionsLoading.value = true
  questionsError.value = ''
  try { await loadQuestions({ strict: true }) } catch (reason) { questionsError.value = reason.message } finally { questionsLoading.value = false }
}

function resetForm(question = emptyForm()) {
  Object.assign(form, { ...question, options: [...question.options] })
}

function startCreate() {
  editingId.value = null
  editorError.value = ''
  resetForm()
  editorOpen.value = true
}

function startEdit(question) {
  editingId.value = question.id
  editorError.value = ''
  resetForm(question)
  editorOpen.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function closeEditor() {
  editorOpen.value = false
  editingId.value = null
  editorError.value = ''
}

async function saveQuestion() {
  editorError.value = ''
  const normalizedOptions = form.options.map(option => option.trim())
  if (new Set(normalizedOptions.map(option => option.toLocaleLowerCase('ru'))).size !== 4) {
    editorError.value = 'Все четыре варианта должны отличаться.'
    return
  }
  saving.value = true
  try {
    const payload = { ...form, options: normalizedOptions }
    if (editingId.value) await updateQuestion(editingId.value, payload)
    else await createQuestion(payload)
    closeEditor()
  } catch (reason) {
    editorError.value = reason.message
  } finally {
    saving.value = false
  }
}

async function remove(question) {
  if (!window.confirm(`Удалить вопрос #${question.id}? Это действие нельзя отменить.`)) return
  questionsError.value = ''
  try { await deleteQuestion(question.id) } catch (reason) { questionsError.value = reason.message }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

onMounted(() => {
  void loadUsers()
  void loadQuestionBank()
})
</script>

<style scoped>
.admin-page { max-width: 1180px; margin: auto; padding: 55px 28px 80px; }
.admin-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 30px; margin-bottom: 28px; }.admin-header h1 { font-size: 50px; margin: 8px 0; }.admin-header > div:first-child > p:last-child { margin: 0; color: #66716e; font-size: 13px; }.admin-actions { display: flex; gap: 8px; }
.admin-tabs { display: flex; gap: 5px; margin-bottom: 28px; border-bottom: 1px solid #dce2dd; }.admin-tabs button { min-height: 46px; padding: 0 18px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: #66716e; display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; font-weight: 800; }.admin-tabs button.active { color: #173f3a; border-bottom-color: #2d7f77; }.admin-tabs b { min-width: 24px; padding: 3px 6px; border-radius: 12px; background: #edf1ed; font-size: 10px; }
.admin-stats { display: grid; grid-template-columns: repeat(4,1fr); border: 1px solid #dce2dd; background: white; margin-bottom: 28px; }.admin-stats > div { min-height: 106px; padding: 22px; border-left: 1px solid #e5e9e5; display: flex; align-items: center; gap: 13px; color: #2d7f77; }.admin-stats > div:first-child { border-left: 0; }.admin-stats span { display: flex; flex-direction: column; }.admin-stats b { color: #182321; font: 700 28px 'Source Serif 4 Variable', serif; }.admin-stats small { color: #66716e; font-size: 11px; text-transform: uppercase; font-weight: 800; }
.admin-table-wrap,.question-table { border: 1px solid #dce2dd; background: white; overflow: hidden; }.admin-table-heading,.question-table-heading { min-height: 88px; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; }.admin-table-heading h2,.question-table-heading h2 { margin: 0 0 5px; font: 700 25px 'Source Serif 4 Variable', serif; }.admin-table-heading p,.question-table-heading p { margin: 0; color: #66716e; font-size: 11px; }.admin-columns,.admin-row { display: grid; grid-template-columns: minmax(220px,1.4fr) 80px 65px 80px 110px 105px; gap: 16px; align-items: center; }.admin-columns { min-height: 40px; padding: 0 22px; background: #edf1ed; color: #66716e; font-size: 11px; text-transform: uppercase; font-weight: 800; }.admin-row { min-height: 72px; padding: 10px 22px; border-top: 1px solid #e7ebe7; font-size: 12px; }.admin-user { display: flex; align-items: center; gap: 11px; min-width: 0; }.admin-user > i { width: 36px; height: 36px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: #173f3a; color: white; font-style: normal; font-weight: 800; }.admin-user > span { min-width: 0; display: flex; flex-direction: column; }.admin-user small { overflow: hidden; text-overflow: ellipsis; color: #66716e; }.admin-row em { padding: 4px 7px; border-radius: 3px; background: #edf1ed; color: #66716e; font-size: 11px; font-style: normal; font-weight: 800; }.admin-row em.admin { color: #8a6812; background: #fff4cf; }.admin-row > span:last-child { color: #66716e; }
.question-toolbar { display: grid; grid-template-columns: minmax(260px,1fr) 220px auto 42px; gap: 10px; margin-bottom: 18px; }.admin-search { height: 46px; padding: 0 13px; border: 1px solid #d3dad5; background: white; display: flex; align-items: center; gap: 8px; color: #66716e; }.admin-search input { width: 100%; border: 0; outline: 0; }.question-toolbar select,.editor-grid select,.editor-grid input { height: 46px; border: 1px solid #d3dad5; background: white; padding: 0 11px; color: #293431; }
.question-editor { margin-bottom: 22px; padding: 24px; border: 1px solid #b9d2ca; border-top: 4px solid #2d7f77; background: white; }.editor-heading { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }.editor-heading h2 { margin: 5px 0 0; font: 700 27px 'Source Serif 4 Variable', serif; }.question-editor form { display: grid; gap: 17px; }.question-editor label { display: grid; gap: 7px; }.question-editor label > span,.question-editor legend { color: #59645f; font-size: 11px; text-transform: uppercase; font-weight: 800; }.question-editor textarea,.option-editor > input[type=text] { width: 100%; border: 1px solid #d3dad5; border-radius: 4px; padding: 11px; color: #182321; resize: vertical; }.editor-grid { display: grid; grid-template-columns: 1fr 1fr 130px; gap: 12px; }.question-editor fieldset { margin: 0; padding: 15px; border: 1px solid #dce2dd; display: grid; gap: 9px; }.question-editor legend { padding: 0 7px; }.option-editor { grid-template-columns: 20px 30px 1fr; align-items: center; }.option-editor > input[type=radio] { width: 17px; height: 17px; accent-color: #2d7f77; }.option-editor b { width: 28px; height: 28px; display: grid; place-items: center; background: #edf1ed; border-radius: 3px; font-size: 11px; }.editor-actions { display: flex; justify-content: flex-end; gap: 9px; }.editor-error { margin: 0; color: #a3423d; display: flex; align-items: center; gap: 7px; font-size: 12px; }
.question-table-heading > span { color: #66716e; font-size: 11px; }.question-admin-row { min-height: 92px; padding: 14px 18px; border-top: 1px solid #e7ebe7; display: grid; grid-template-columns: 62px 1fr auto; gap: 14px; align-items: center; }.question-id { color: #66716e; font-size: 11px; font-weight: 800; }.question-admin-row > div:nth-child(2) { display: flex; flex-direction: column; gap: 5px; }.question-admin-row small { font-size: 10px; text-transform: uppercase; font-weight: 800; }.question-admin-row b { font-size: 13px; line-height: 1.45; }.question-admin-row div > span { color: #28704d; font-size: 11px; }.row-actions { display: flex; gap: 6px; }.icon-button.danger { color: #a3423d; }.icon-button.danger:hover { border-color: #d6857f; background: #fff1ef; }
.admin-loading { min-height: 320px; display: grid; place-content: center; justify-items: center; color: #66716e; font-size: 12px; }.admin-loading span { width: 30px; height: 30px; border: 3px solid #dce5e1; border-top-color: #2d7f77; border-radius: 50%; animation: spin .8s linear infinite; }.admin-error { margin-bottom: 18px; padding: 24px; border: 1px solid #e3bbb7; background: #fff3f1; display: flex; gap: 13px; align-items: center; color: #a3423d; }.admin-error div { flex: 1; }.admin-error p { margin: 4px 0 0; font-size: 12px; }
@media (max-width: 760px) { .admin-page { padding: 28px 14px 60px; }.admin-header { align-items: center; }.admin-header h1 { font-size: 37px; }.admin-actions .secondary { width: 42px; padding: 0; font-size: 0; }.admin-stats { grid-template-columns: repeat(2,1fr); }.admin-stats > div:nth-child(3) { border-left: 0; border-top: 1px solid #e5e9e5; }.admin-stats > div:nth-child(4) { border-top: 1px solid #e5e9e5; }.admin-table-wrap { overflow-x: auto; }.admin-table-heading,.admin-columns,.admin-row { min-width: 850px; }.question-toolbar { grid-template-columns: 1fr 48px; }.question-toolbar select { grid-column: 1 / -1; grid-row: 2; }.question-toolbar .primary { grid-column: 1; }.editor-grid { grid-template-columns: 1fr; }.question-editor { padding: 18px 14px; }.question-admin-row { grid-template-columns: 1fr auto; }.question-id { grid-column: 1 / -1; }.row-actions { grid-column: 2; grid-row: 2; }.question-admin-row > div:nth-child(2) { grid-column: 1; grid-row: 2; } }
</style>
