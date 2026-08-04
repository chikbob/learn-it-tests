import { supabase } from './supabase'
import { questions, removeQuestion, replaceQuestions, upsertQuestion } from '../questions'

const columns = 'id, section, category, audience, difficulty, text, options, correct, explanation, source, code, position'

function normalizeQuestion(row) {
  return {
    ...row,
    id: Number(row.id),
    correct: Number(row.correct),
    position: Number(row.position),
    options: [...row.options],
    code: row.code || '',
  }
}

function payloadFrom(question) {
  const humanities = ['communications', 'history', 'psychology', 'softskills']
  return {
    section: question.section,
    category: question.category || (humanities.includes(question.section) ? 'humanities' : 'technical'),
    audience: question.audience || (question.section === 'databases' ? 'it' : question.section === 'security' ? 'security' : 'common'),
    difficulty: question.difficulty,
    text: question.text.trim(),
    options: question.options.map(option => option.trim()),
    correct: Number(question.correct),
    explanation: question.explanation.trim(),
    source: question.source?.trim() || 'Ручное добавление',
    code: question.code?.trim() || '',
    position: Number(question.position),
    updated_at: new Date().toISOString(),
  }
}

export async function loadQuestions({ strict = false } = {}) {
  const { data, error } = await supabase.from('questions').select(columns).order('position').order('id')
  if (error) {
    if (strict) throw error
    return questions
  }
  if (data?.length) replaceQuestions(data.map(normalizeQuestion))
  return questions
}

export async function createQuestion(question) {
  const position = question.position || Math.max(0, ...questions.map(item => item.position)) + 1
  const { data, error } = await supabase
    .from('questions')
    .insert(payloadFrom({ ...question, position }))
    .select(columns)
    .single()
  if (error) throw error
  const created = normalizeQuestion(data)
  upsertQuestion(created)
  return created
}

export async function updateQuestion(questionId, question) {
  const { data, error } = await supabase
    .from('questions')
    .update(payloadFrom(question))
    .eq('id', questionId)
    .select(columns)
    .single()
  if (error) throw error
  const updated = normalizeQuestion(data)
  upsertQuestion(updated)
  return updated
}

export async function deleteQuestion(questionId) {
  const { error } = await supabase.from('questions').delete().eq('id', questionId)
  if (error) throw error
  removeQuestion(questionId)
}
