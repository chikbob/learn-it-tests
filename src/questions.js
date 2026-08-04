import { reactive } from 'vue'
import { builtInQuestions } from './generatedQuestions'

export const sections = {
  communications: { label: 'Деловые коммуникации', short: 'Коммуникации', color: '#a36245', category: 'humanities' },
  history: { label: 'История России', short: 'История', color: '#8e574e', category: 'humanities' },
  psychology: { label: 'Психология и самообразование', short: 'Психология', color: '#86628f', category: 'humanities' },
  softskills: { label: 'Гибкие навыки в развитии карьеры', short: 'Гибкие навыки', color: '#a47a31', category: 'humanities' },
  algorithms: { label: 'Алгоритмизация и программирование', short: 'Алгоритмы', color: '#e46f50' },
  graphics: { label: 'Компьютерная графика', short: 'Графика', color: '#a34f79' },
  modeling: { label: 'Системный анализ и моделирование систем', short: 'Системы и модели', color: '#95743d' },
  databases: { label: 'Базы данных', short: 'БД', color: '#2d7f77' },
  networks: { label: 'Компьютерные сети', short: 'Сети', color: '#466fb3' },
  security: { label: 'Основы информационной безопасности', short: 'ИБ', color: '#6657a0' },
  information: { label: 'Организация и обработка электронной информации', short: 'Электронная информация', color: '#65734a' },
}

export const difficultyLabels = {
  surface: 'Термин',
  understanding: 'Понимание',
  application: 'Практика',
  trick: 'С подвохом',
}

export const questions = reactive(builtInQuestions.map(question => ({ ...question })))

export function replaceQuestions(nextQuestions) {
  questions.splice(0, questions.length, ...nextQuestions)
}

export function upsertQuestion(question) {
  const index = questions.findIndex(item => item.id === question.id)
  if (index === -1) questions.push(question)
  else questions[index] = question
  questions.sort((left, right) => left.position - right.position || left.id - right.id)
}

export function removeQuestion(questionId) {
  const index = questions.findIndex(question => question.id === questionId)
  if (index !== -1) questions.splice(index, 1)
}
