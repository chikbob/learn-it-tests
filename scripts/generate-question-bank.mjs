import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] || path.join(root, 'docs/question-sources/edinyy_bank_voprosov_exam_md_ispravlennyy.md')

const sectionKeys = {
  'Алгоритмизация и программирование': 'algorithms',
  'Графика, Photoshop и CorelDRAW': 'graphics',
  'Моделирование систем': 'modeling',
  'Базы данных': 'databases',
  'Системный анализ': 'systems',
  'Компьютерные сети': 'networks',
  'Информационная безопасность': 'security',
  'Организация и обработка электронной информации': 'information',
}

const clean = value => value
  .replaceAll('**', '')
  .replace(/\s+/g, ' ')
  .trim()

function parseSource(sourcePath) {
  const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/)
  const parsed = []
  let section = ''

  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^#\s+(?:\d+\.\s*)?(.+)/)
    if (heading && sectionKeys[heading[1].trim()]) section = heading[1].trim()

    const question = lines[index].match(/^###\s+(\d+)\.\s+(.+)/)
    if (!question) continue

    const nextQuestionOffset = lines.slice(index + 1).findIndex(line => /^###\s+\d+\./.test(line))
    const blockEnd = nextQuestionOffset === -1 ? lines.length : index + 1 + nextQuestionOffset
    const block = lines.slice(index + 1, blockEnd)
    const options = block
      .map(line => line.match(/^([A-D])\.\s+(.+)/))
      .filter(Boolean)
      .map(match => clean(match[2]))
    const answerMatch = block.map(line => line.match(/^\*\*Ответ:\s+([A-D])\.\s+(.+)\*\*$/)).find(Boolean)
    const typeMatch = block.map(line => line.match(/^\*\*Тип:\*\*\s+(.+?)\s*$/)).find(Boolean)
    const sourceMatch = block.map(line => line.match(/^\*\*Источник:\*\*\s+(.+?)\s*$/)).find(Boolean)
    const explanationMatch = block.map(line => line.match(/^\*\*Объяснение:\*\*\s+(.+?)\s*$/)).find(Boolean)
    const sectionKey = sectionKeys[section]

    if (Number(question[1]) !== parsed.length + 1 || options.length !== 4 || !answerMatch || !typeMatch || !sourceMatch || !explanationMatch || !sectionKey) {
      throw new Error(`Не удалось разобрать вопрос в ${sourcePath}:${index + 1}`)
    }

    const correct = answerMatch[1].charCodeAt(0) - 65
    const answer = clean(answerMatch[2])
    if (options[correct] !== answer) throw new Error(`Ответ не совпадает с вариантом в вопросе ${question[1]}`)
    if (new Set(options.map(option => option.toLocaleLowerCase('ru'))).size !== 4) {
      throw new Error(`В вопросе ${question[1]} есть повторяющиеся варианты`)
    }
    if (/консультац|преподавател/i.test(question[2])) {
      throw new Error(`Вопрос ${question[1]} ссылается на консультацию или преподавателя`)
    }
    if (!['термин', 'понимание', 'применение', 'расчёт'].includes(clean(typeMatch[1]))) {
      throw new Error(`Неизвестный тип вопроса ${question[1]}`)
    }
    if (!['консультация', 'дополнительный'].includes(clean(sourceMatch[1]))) {
      throw new Error(`Неизвестный источник вопроса ${question[1]}`)
    }
    if (options.some(option => /\s\/\s/.test(option))) {
      throw new Error(`Вариант вопроса ${question[1]} объединяет ответы символом /`)
    }

    parsed.push({
      section: sectionKey,
      text: clean(question[2]),
      options,
      correct,
      answer,
      type: clean(typeMatch[1]),
      source: clean(sourceMatch[1]),
      explanation: clean(explanationMatch[1]),
    })
  }

  return parsed
}

function validateBank(questions) {
  const answerCounts = [0, 1, 2, 3].map(index => questions.filter(question => question.correct === index).length)
  if (Math.max(...answerCounts) - Math.min(...answerCounts) > 1) {
    throw new Error(`Ответы распределены неравномерно: ${answerCounts.join(', ')}`)
  }

  const typeCounts = Object.fromEntries(['термин', 'понимание', 'применение', 'расчёт'].map(type => [type, 0]))
  questions.forEach(question => { typeCounts[question.type] += 1 })
  const practicalShare = (typeCounts['применение'] + typeCounts['расчёт']) / questions.length
  if (practicalShare < 0.18 || practicalShare > 0.22) {
    throw new Error(`Доля практических и расчётных вопросов вышла за диапазон 18–22%`)
  }
}

const difficultyByType = {
  'термин': 'surface',
  'понимание': 'understanding',
  'применение': 'application',
  'расчёт': 'application',
}

const parsedQuestions = parseSource(source)
validateBank(parsedQuestions)

const questions = parsedQuestions.map((question, offset) => {
  const id = offset + 1
  return {
    id,
    section: question.section,
    difficulty: difficultyByType[question.type],
    text: question.text,
    options: question.options,
    correct: question.correct,
    explanation: question.explanation,
    code: '',
    position: offset + 1,
  }
})

const moduleBody = `// Сгенерировано из единого банка вопросов. Не редактировать вручную.\nexport const builtInQuestions = ${JSON.stringify(questions, null, 2)}\n`
fs.writeFileSync(path.join(root, 'src/generatedQuestions.js'), moduleBody)

const seedJson = JSON.stringify(questions.map(({ id: _id, ...question }) => question))
const migrationSql = `begin;

create table if not exists public.questions (
  id bigint generated by default as identity primary key,
  section text not null check (section in ('algorithms', 'graphics', 'modeling', 'databases', 'systems', 'networks', 'security', 'information')),
  difficulty text not null check (difficulty in ('surface', 'understanding', 'application', 'trick')),
  text text not null check (char_length(trim(text)) between 3 and 1000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct smallint not null check (correct between 0 and 3),
  explanation text not null check (char_length(trim(explanation)) between 3 and 3000),
  code text not null default '' check (char_length(code) <= 10000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_section_position_idx on public.questions (section, position, id);
alter table public.questions enable row level security;

drop policy if exists "authenticated users read questions" on public.questions;
drop policy if exists "admins create questions" on public.questions;
drop policy if exists "admins update questions" on public.questions;
drop policy if exists "admins delete questions" on public.questions;

create policy "authenticated users read questions"
  on public.questions for select to authenticated using (true);
create policy "admins create questions"
  on public.questions for insert to authenticated
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create policy "admins update questions"
  on public.questions for update to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create policy "admins delete questions"
  on public.questions for delete to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));

revoke all on table public.questions from public, anon;
grant select on table public.questions to authenticated;
grant insert, update, delete on table public.questions to authenticated;
grant usage, select on sequence public.questions_id_seq to authenticated;

truncate table public.questions restart identity;

insert into public.questions (section, difficulty, text, options, correct, explanation, code, position)
select
  seed.section,
  seed.difficulty,
  seed.text,
  seed.options,
  seed.correct,
  seed.explanation,
  seed.code,
  seed.position
from jsonb_to_recordset(
  $question_seed$${seedJson}$question_seed$::jsonb
) as seed (
  section text,
  difficulty text,
  text text,
  options jsonb,
  correct smallint,
  explanation text,
  code text,
  position integer
);

commit;
`
fs.writeFileSync(path.join(root, 'supabase/migrations/20260731000000_question_crud.sql'), migrationSql)

console.log(`Сгенерировано ${questions.length} уникальных вопросов`)
