import { reactive } from 'vue'
import { builtInQuestions } from './generatedQuestions'

export const sections = {
  algorithms: { label: 'Алгоритмизация и программирование', short: 'Алгоритмы', color: '#e46f50' },
  graphics: { label: 'Графика и редакторы', short: 'Графика', color: '#a34f79' },
  modeling: { label: 'Моделирование систем', short: 'Модели', color: '#95743d' },
  databases: { label: 'Базы данных', short: 'БД', color: '#2d7f77' },
  systems: { label: 'Системный анализ', short: 'Системы', color: '#8b633f' },
  networks: { label: 'Компьютерные сети', short: 'Сети', color: '#466fb3' },
  security: { label: 'Информационная безопасность', short: 'ИБ', color: '#6657a0' },
  information: { label: 'Электронная информация', short: 'Информация', color: '#65734a' },
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
