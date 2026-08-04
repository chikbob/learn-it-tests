import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] || path.join(root, 'polnyy_bank_voprosov_magistratura_2026.md')
const canonicalPath = path.join(root, 'docs/question-sources/bank_magistratura_2026.md')
const migrationPath = path.join(root, 'supabase/migrations/20260804200000_exam_2026_and_favorites.sql')

const sectionMap = {
  '1': { key: 'communications', name: 'Деловые коммуникации', category: 'humanities', audience: 'common' },
  '2': { key: 'history', name: 'История России', category: 'humanities', audience: 'common' },
  '3': { key: 'psychology', name: 'Психология и самообразование', category: 'humanities', audience: 'common' },
  '4': { key: 'softskills', name: 'Гибкие навыки в развитии карьеры', category: 'humanities', audience: 'common' },
  '5': { key: 'algorithms', name: 'Алгоритмизация и программирование', category: 'technical', audience: 'common' },
  '6': { key: 'graphics', name: 'Компьютерная графика', category: 'technical', audience: 'common' },
  '7': { key: 'modeling', name: 'Системный анализ и моделирование систем', category: 'technical', audience: 'common' },
  '8A': { key: 'databases', name: 'Базы данных', category: 'technical', audience: 'it' },
  '8B': { key: 'security', name: 'Основы информационной безопасности', category: 'technical', audience: 'security' },
  '9': { key: 'information', name: 'Организация и обработка электронной информации', category: 'technical', audience: 'common' },
  '10': { key: 'networks', name: 'Компьютерные сети', category: 'technical', audience: 'common' },
}

const difficultyMap = { 'термин': 'surface', 'понимание': 'understanding', 'применение': 'application', 'с подвохом': 'trick', 'расчёт': 'application' }
const letters = 'ABCD'
const clean = value => value.replaceAll('**', '').replace(/\s+/g, ' ').trim()
const normalized = value => clean(value).toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

function parseSource(sourcePath) {
  const text = fs.readFileSync(sourcePath, 'utf8')
  const headings = [...text.matchAll(/^#\s+(\d+[AB]?)\.\s+(.+)$/gm)]
  const parsed = []

  headings.forEach((heading, sectionIndex) => {
    const section = sectionMap[heading[1]]
    if (!section) return
    const block = text.slice(heading.index, headings[sectionIndex + 1]?.index ?? text.length)
    const questionPattern = /^###\s+(\d+)\.\s+(.+?)\n\nA\.\s+(.+?)\nB\.\s+(.+?)\nC\.\s+(.+?)\nD\.\s+(.+?)\n\n\*\*Ответ:\s+([A-D])\.\s+(.+?)\*\*\n\n\*\*Уровень:\*\*\s+(.+?)$/gm

    for (const match of block.matchAll(questionPattern)) {
      const options = match.slice(3, 7).map(clean)
      const correct = letters.indexOf(match[7])
      const answer = clean(match[8])
      const level = clean(match[9]).toLocaleLowerCase('ru')
      if (correct < 0 || options[correct] !== answer || new Set(options.map(option => clean(option).toLocaleLowerCase('ru'))).size !== 4) {
        throw new Error(`Некорректный вопрос ${match[1]} в разделе ${heading[1]}`)
      }
      parsed.push({ ...section, originalId: Number(match[1]), text: clean(match[2]), options, correct, answer, difficulty: difficultyMap[level] || 'understanding' })
    }
  })
  return parsed
}

function removeSemanticDuplicates(questions) {
  const result = []
  const seenTexts = new Set()
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index]
    const previous = result.at(-1)
    const isMirroredDefinition = previous
      && previous.key === question.key
      && /^Какой термин соответствует определению/.test(previous.text)
      && question.text.includes(`«${previous.answer}»`)
    const textKey = `${question.key}:${normalized(question.text)}`
    if (isMirroredDefinition || seenTexts.has(textKey)) continue
    seenTexts.add(textKey)
    result.push(question)
  }
  return result
}

function explanationFor(question) {
  if (/^Какой термин соответствует определению/.test(question.text)) return `${question.answer} — термин, соответствующий приведённому определению.`
  if (/сколько|чему рав|результат|адрес|маск|размер|сложност/i.test(question.text)) return `По указанным данным получается ответ: ${question.answer}.`
  return `${question.answer} — наиболее точный ответ среди предложенных вариантов.`
}

const parsed = removeSemanticDuplicates(parseSource(source))
const questions = parsed.map((question, offset) => {
  const id = offset + 1
  const targetCorrect = offset % 4
  const rotatedOptions = question.options.map((_, index) => question.options[(index + question.correct - targetCorrect + 4) % 4])
  return {
    id,
    section: question.key,
    category: question.category,
    audience: question.audience,
    difficulty: question.difficulty,
    text: question.text,
    options: rotatedOptions,
    correct: targetCorrect,
    explanation: explanationFor(question),
    source: 'Программа вступительных испытаний 2026',
    code: '',
    position: id,
  }
})

if (questions.length < 500) throw new Error(`После дедупликации осталось слишком мало вопросов: ${questions.length}`)
if (new Set(questions.map(question => normalized(question.text))).size !== questions.length) throw new Error('В итоговом банке остались точные дубли')
if (questions.some(question => question.options.length !== 4 || new Set(question.options.map(option => clean(option).toLocaleLowerCase('ru'))).size !== 4)) throw new Error('В итоговом банке есть неуникальные варианты')
const answerCounts = [0, 1, 2, 3].map(index => questions.filter(question => question.correct === index).length)
if (Math.max(...answerCounts) - Math.min(...answerCounts) > 1) throw new Error(`Неравномерные ответы: ${answerCounts.join(', ')}`)

let markdown = '# Банк вопросов для вступительных испытаний в магистратуру 2026\n\n'
for (const section of Object.values(sectionMap)) {
  const sectionQuestions = questions.filter(question => question.section === section.key)
  markdown += `# ${section.name}\n\n`
  sectionQuestions.forEach(question => {
    markdown += `### ${question.id}. ${question.text}\n\n`
    question.options.forEach((option, index) => { markdown += `${letters[index]}. ${option}\n` })
    markdown += `\n**Ответ: ${letters[question.correct]}. ${question.options[question.correct]}**\n\n`
    markdown += `**Тип:** ${question.difficulty === 'surface' ? 'термин' : question.difficulty === 'application' ? 'применение' : question.difficulty === 'trick' ? 'с подвохом' : 'понимание'}\n`
    markdown += `**Категория:** ${question.category === 'humanities' ? 'гуманитарный' : 'технический'}\n`
    markdown += `**Аудитория:** ${question.audience === 'common' ? 'оба направления' : question.audience === 'it' ? '09.04.01' : '10.04.01'}\n`
    markdown += `**Источник:** ${question.source}\n`
    markdown += `**Объяснение:** ${question.explanation}\n\n`
  })
}
markdown += '# Отчёт о редактуре\n\n'
markdown += `- Исходный объединённый банк: 986 вопросов.\n- Исключено зеркальных вопросов «термин ↔ определение» и точных дублей: ${986 - questions.length}.\n- Итоговый банк: ${questions.length} вопросов.\n- Технических: ${questions.filter(question => question.category === 'technical').length}; гуманитарных: ${questions.filter(question => question.category === 'humanities').length}.\n- Позиции ответов: A — ${answerCounts[0]}, B — ${answerCounts[1]}, C — ${answerCounts[2]}, D — ${answerCounts[3]}.\n`
fs.writeFileSync(canonicalPath, markdown)

const moduleBody = `// Сгенерировано из банка вступительных испытаний 2026. Не редактировать вручную.\nexport const builtInQuestions = ${JSON.stringify(questions, null, 2)}\n`
fs.writeFileSync(path.join(root, 'src/generatedQuestions.js'), moduleBody)

const seedJson = JSON.stringify(questions.map(({ id: _id, ...question }) => question))
const sections = Object.values(sectionMap).map(section => `'${section.key}'`).join(', ')
const migrationSql = `begin;

alter table public.questions drop constraint if exists questions_section_check;
alter table public.questions add column if not exists category text not null default 'technical';
alter table public.questions add column if not exists audience text not null default 'common';
alter table public.questions add column if not exists source text not null default 'Программа вступительных испытаний 2026';
alter table public.questions drop constraint if exists questions_category_check;
alter table public.questions add constraint questions_category_check check (category in ('technical', 'humanities'));
alter table public.questions drop constraint if exists questions_audience_check;
alter table public.questions add constraint questions_audience_check check (audience in ('common', 'it', 'security'));

create table if not exists public.question_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id bigint not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.question_favorites enable row level security;
drop policy if exists "users read own favorites" on public.question_favorites;
drop policy if exists "users add own favorites" on public.question_favorites;
drop policy if exists "users delete own favorites" on public.question_favorites;
create policy "users read own favorites" on public.question_favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "users add own favorites" on public.question_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users delete own favorites" on public.question_favorites for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.question_favorites from public, anon;
grant select, insert, delete on table public.question_favorites to authenticated;

truncate table public.questions restart identity cascade;
alter table public.questions add constraint questions_section_check check (section in (${sections}));
insert into public.questions (section, category, audience, difficulty, text, options, correct, explanation, source, code, position)
select seed.section, seed.category, seed.audience, seed.difficulty, seed.text, seed.options, seed.correct, seed.explanation, seed.source, seed.code, seed.position
from jsonb_to_recordset($question_seed$${seedJson}$question_seed$::jsonb) as seed (
  section text, category text, audience text, difficulty text, text text, options jsonb, correct smallint,
  explanation text, source text, code text, position integer
);

commit;
`
fs.writeFileSync(migrationPath, migrationSql)
console.log(`Сгенерировано ${questions.length} вопросов; удалено ${986 - questions.length} смысловых дублей`)
