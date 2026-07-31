import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceArguments = process.argv.slice(2)
const sources = sourceArguments.length ? sourceArguments : [
  path.join(root, 'docs/question-sources/nadiktovannye_voprosy_magistratura_it.md'),
  path.join(root, 'docs/question-sources/dopolnitelnye_voprosy_dlya_izucheniya_magistratura_it.md'),
]

if (sources.length !== 2) {
  throw new Error('Передайте пути к двум Markdown-файлам с вопросами')
}

const sectionKeys = {
  'Алгоритмизация и программирование': 'algorithms',
  'Графика / Photoshop / CorelDRAW': 'graphics',
  'Моделирование систем': 'modeling',
  'Базы данных': 'databases',
  'Системный анализ': 'systems',
  'Сети': 'networks',
  'Информационная безопасность': 'security',
  'Организация и обработка электронной информации': 'information',
}

const normalize = value => value
  .toLocaleLowerCase('ru')
  .replaceAll('ё', 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const clean = value => value
  .replaceAll('**', '')
  .replace(/\s+/g, ' ')
  .trim()

const corrections = new Map([
  [normalize('Возможна ли конструкция с if/else как именами переменных?'), {
    answer: 'Да, в PL/I ключевые слова могут использоваться как идентификаторы в допустимом контексте',
    variants: ['Нет, ключевые слова нигде не могут быть идентификаторами', 'Да, в TypeScript без ограничений', 'Да, в Pascal без ограничений'],
  }],
  [normalize('Если K=0, L=4, чему равно (K++) + (--L) + (++K)?'), {
    answer: 'У выражения нет надёжно определённого результата из-за нескольких изменений K',
    variants: ['3', '4', '5'],
  }],
  [normalize('С чем работает физический уровень сети?'), {
    text: 'Что передаёт физический уровень модели OSI?',
    answer: 'Биты в виде физических сигналов по среде передачи',
    variants: ['IP-пакеты между сетями', 'Кадры с MAC-адресами', 'HTTP-запросы приложений'],
  }],
  [normalize('Как переводится Wi-Fi?'), {
    text: 'Является ли Wi‑Fi официальной аббревиатурой от Wireless Fidelity?',
    answer: 'Нет, Wi‑Fi — торговое название, а не официальная расшифровываемая аббревиатура',
    variants: ['Да, это официальная расшифровка', 'Это сокращение от Wired Fiber', 'Это название протокола IPv6'],
  }],
  [normalize('Адрес для рассылки всем в сети 10.0.1.x и 10.0.2.x.'), {
    text: 'Какой broadcast-адрес у сети 10.0.0.0/16?',
    answer: '10.0.255.255',
    variants: ['10.0.0.0', '10.0.1.255', '10.255.255.255'],
  }],
  [normalize('Стандартная длина пакета Ethernet.'), {
    text: 'Каков стандартный максимальный размер полезной нагрузки Ethernet-кадра без jumbo frames?',
    answer: '1500 байт',
    variants: ['64 байта', '10 КБ', '65 535 байт'],
  }],
  [normalize('Язык для реляционных БД.'), {
    answer: 'SQL',
    variants: ['Pascal', 'PHP', 'COBOL'],
  }],
  [normalize('Наибольшую угрозу ИС составляет…'), {
    text: 'Какой фактор часто считают одной из главных угроз информационной системе?',
    answer: 'Человеческий фактор',
    variants: ['Только цвет интерфейса', 'Размер монитора', 'Формат офисного документа'],
  }],
  [normalize('Нарушением динамической целостности не является…'), {
    answer: 'Нет однозначного варианта: все перечисленные действия могут нарушать динамическую целостность',
    variants: ['Только ввод неверных данных', 'Только нарушение атомарности', 'Только изменение данных'],
  }],
  [normalize('Python — компилируемый или интерпретируемый?'), {
    answer: 'Обычно исходный код Python компилируется в байт-код и выполняется интерпретатором',
    variants: ['Только компилируемый напрямую в машинный код', 'Только построчно интерпретируемый без промежуточного кода', 'Язык не имеет реализации'],
  }],
])

function parseSource(source, sourceIndex) {
  const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/)
  const parsed = []
  let section = ''

  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^##\s+(?:\d+\.\s*)?(.+)/)
    if (heading) section = heading[1].trim()

    const question = lines[index].match(/^\d+\.\s+(.+)/)
    if (!question) continue

    const variants = lines[index + 1]?.match(/^\s*-\s*Варианты:\s*(.+)/)?.[1]
    const answer = lines[index + 2]?.match(/^\s*-\s*Ответ:\s*\*\*(.+)\*\*\s*$/)?.[1]
    if (!variants || !answer || !sectionKeys[section]) {
      throw new Error(`Не удалось разобрать вопрос в ${source}:${index + 1}`)
    }

    parsed.push({
      sourceIndex,
      section: sectionKeys[section],
      text: clean(question[1]),
      variants: variants.split(';').map(clean).filter(Boolean),
      answer: clean(answer),
    })
  }

  return parsed
}

const parsed = sources.flatMap(parseSource)
const unique = new Map()

for (const question of parsed) {
  const key = normalize(question.text)
  if (!unique.has(key)) unique.set(key, question)
}

const rawQuestions = [...unique.values()].map(question => {
  const correction = corrections.get(normalize(question.text))
  return correction ? { ...question, ...correction } : question
})

const sectionCandidates = new Map()
for (const question of rawQuestions) {
  if (!sectionCandidates.has(question.section)) sectionCandidates.set(question.section, [])
  sectionCandidates.get(question.section).push(...question.variants, question.answer)
}

const genericDistractors = {
  algorithms: ['Операция выполняется только средствами базы данных', 'Результат всегда не зависит от входных данных', 'Это относится только к компьютерной графике'],
  graphics: ['Формат реляционной таблицы', 'Транспортный сетевой протокол', 'Алгоритм сортировки данных'],
  modeling: ['Метод шифрования файлов', 'Формат растрового изображения', 'Команда языка SQL'],
  databases: ['Графический фильтр изображения', 'Сетевой протокол транспортного уровня', 'Алгоритм обхода графа'],
  systems: ['Формат архивного файла', 'Оператор языка разметки', 'Цветовая модель изображения'],
  networks: ['Алгоритм сортировки массива', 'Формат рабочего файла Photoshop', 'Метод решения линейных уравнений'],
  security: ['Способ сортировки записей', 'Графическая цветовая модель', 'Тип компьютерной топологии'],
  information: ['Транспортный протокол', 'Метод численного интегрирования', 'Принцип объектного программирования'],
}

function semanticDuplicate(left, right) {
  const a = normalize(left)
  const b = normalize(right)
  if (!a || !b) return true
  return a === b || (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a)))
}

function difficultyFor(text) {
  const normalized = normalize(text)
  if (/сколько|чему рав|результат|что получ|запрос|маск|вычисл|определить/.test(normalized)) return 'application'
  if (/не |ошибоч|неправиль|исключ|возможна ли|можно ли|является ли/.test(normalized)) return 'trick'
  if (/что такое|как расшифров|что означает|как называется/.test(normalized)) return 'surface'
  return 'understanding'
}

const questions = rawQuestions.map((question, offset) => {
  const id = 10000 + offset
  const options = [question.answer]
  const candidates = [
    ...question.variants,
    ...(sectionCandidates.get(question.section) || []),
    ...genericDistractors[question.section],
  ]

  for (const candidate of candidates) {
    if (options.length === 4) break
    if (options.some(option => semanticDuplicate(option, candidate))) continue
    options.push(candidate)
  }

  if (options.length !== 4) throw new Error(`Недостаточно вариантов: ${question.text}`)

  const shift = id % 4
  const rotated = options.map((_, index) => options[(index + shift) % 4])
  return {
    id,
    section: question.section,
    difficulty: difficultyFor(question.text),
    text: question.text,
    options: rotated,
    correct: rotated.indexOf(question.answer),
    explanation: `Правильный ответ: ${question.answer}.`,
    code: '',
    position: offset + 1,
  }
})

const moduleBody = `// Сгенерировано из актуальных файлов консультации. Не редактировать вручную.\nexport const builtInQuestions = ${JSON.stringify(questions, null, 2)}\n`
fs.writeFileSync(path.join(root, 'src/generatedQuestions.js'), moduleBody)

const sqlString = value => `'${String(value).replaceAll("'", "''")}'`
const rows = questions.map(question => `(${question.id}, ${sqlString(question.section)}, ${sqlString(question.difficulty)}, ${sqlString(question.text)}, ${sqlString(JSON.stringify(question.options))}::jsonb, ${question.correct}, ${sqlString(question.explanation)}, ${sqlString(question.code)}, ${question.position})`)
const migrationSql = `create table if not exists public.questions (
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

delete from public.questions;

insert into public.questions (id, section, difficulty, text, options, correct, explanation, code, position)
values
  ${rows.join(',\n  ')}
on conflict (id) do update set
  section = excluded.section,
  difficulty = excluded.difficulty,
  text = excluded.text,
  options = excluded.options,
  correct = excluded.correct,
  explanation = excluded.explanation,
  code = excluded.code,
  position = excluded.position,
  updated_at = now();

select setval(pg_get_serial_sequence('public.questions', 'id'), (select max(id) from public.questions));
`
fs.writeFileSync(path.join(root, 'supabase/migrations/20260731000000_question_crud.sql'), migrationSql)

console.log(`Сгенерировано ${questions.length} уникальных вопросов`)
