import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] || path.join(root, 'polnyy_bank_voprosov_magistratura_2026.md')
const canonicalPath = path.join(root, 'docs/question-sources/bank_magistratura_2026.md')
const migrationPath = path.join(root, 'supabase/migrations/20260804200000_exam_2026_and_favorites.sql')
const refinementMigrationPath = path.join(root, 'supabase/migrations/20260805120000_refine_question_wording.sql')

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

function naturalizeQuestion(text) {
  const termMatch = text.match(/^Какой термин соответствует определению:\s*«(.+)»\?$/)
  if (termMatch) {
    const definition = termMatch[1].replace(/[.]$/, '')
    return `${definition.charAt(0).toLocaleUpperCase('ru')}${definition.slice(1)} — это:`
  }
  const definitionMatch = text.match(/^Какое определение (?:точнее всего раскрывает|раскрывает) (?:понятие )?«?(.+?)»?\?$/)
  if (definitionMatch) return `${definitionMatch[1]} — это:`
  return text
}

const wordingOverrides = {
  7: 'Обратная связь в коммуникационном процессе — это:',
  142: 'Транзакция в транзактном анализе — это:',
  152: 'Обратная связь как инструмент развития навыков — это:',
  300: 'Обратная связь в системе управления — это:',
  371: 'Транзакция в базе данных — это:',
  433: 'Резервное копирование как мера информационной безопасности — это:',
  464: 'Бит как единица цифровых данных — это:',
  476: 'API во взаимодействии программных компонентов — это:',
  510: 'Какой формат передают с типом содержимого `application/json`?',
}

const distractorOverrides = {
  7: ['способ выбора канала передачи сообщения', 'процесс преобразования сообщения в систему знаков', 'помеха, возникающая при передаче сообщения'],
  35: ['В отчёте много данных, поэтому менять ничего не нужно', 'Источники данных не указаны, значит весь отчёт бесполезен', 'Отчёт следует переписать, потому что выводы недостаточно подробны'],
  142: ['устойчивая последовательность скрытых взаимодействий с предсказуемым итогом', 'ожидаемая модель поведения участника в соответствии с его позицией', 'обмен репликами, происходящий только между одинаковыми эго-состояниями'],
  152: ['самооценка результата без использования внешних критериев', 'перечень целей, установленный до начала выполнения задачи', 'итоговая оценка, которая не предполагает обсуждения и корректировки'],
  161: ['Гибкое распределение ролей без общей цели и критериев результата', 'Общая цель при индивидуальной ответственности без обмена информацией', 'Регулярные совещания без закреплённых ролей и обратной связи'],
  225: ['На классическом наследовании без прототипов', 'На копировании всех свойств при создании объекта', 'На обязательной реализации интерфейсов объектами'],
  236: ['Функция, доступная только внутри другого метода', 'Функция, которая обязательно возвращает логическое значение', 'Функция, автоматически вызываемая при запуске программы'],
  237: ['Java', 'C#', 'Python'],
  239: ['Да, если не вызывать чисто виртуальные функции', 'Да, если класс содержит конструктор без параметров', 'Только если объект создаётся через указатель базового типа'],
  242: ['Для прямого управления видеоустройством в обход операционной системы', 'Для хранения графических ресурсов в едином формате файла', 'Для автоматического преобразования любой программы в трёхмерную сцену'],
  282: ['Для определения геометрии полигональной сетки', 'Для расчёта положения источников освещения', 'Для задания траектории движения трёхмерного объекта'],
  284: ['Положение наблюдателя относительно картинной плоскости', 'Масштаб объектов, расположенных на переднем плане', 'Угол обзора виртуальной камеры'],
  300: ['однонаправленная передача управляющего воздействия от входа к выходу', 'случайное изменение состояния системы под влиянием внешней среды', 'изменение входного сигнала без учёта фактического состояния выхода'],
  340: ['От выбора единицы измерения аргумента', 'От количества неизвестных в исходной записи функции', 'От способа округления уже найденного точного корня'],
  348: ['Дифференциальное уравнение первого порядка', 'Алгебраическое уравнение второй степени', 'Интегральное уравнение без производных'],
  349: ['Метод конечных разностей', 'Метод наименьших квадратов', 'Метод половинного деления'],
  350: ['Разделить переменные на зависимые и независимые', 'Построить уравнение зависимости целевой переменной', 'Сократить число признаков с помощью скрытых факторов'],
  351: ['Разбить объекты на однородные группы', 'Оценить параметры регрессионной зависимости', 'Найти выбросы по расстоянию между наблюдениями'],
  352: ['Единая модель без выделения внутренних частей', 'Набор независимых результатов без связей между ними', 'Случайная выборка состояний исходной системы'],
  354: ['Последовательной оптимизацией каждой цели без сравнения результатов', 'Оптимизацией только самого дешёвого варианта', 'Сведением всех целей к одному произвольно выбранному показателю'],
  355: ['Она описывает только установившееся состояние системы', 'Она всегда приводит к точному аналитическому решению', 'Она исключает случайные события и изменение параметров'],
  371: ['отдельная команда чтения одной записи из таблицы', 'резервная копия таблицы, созданная перед изменением данных', 'набор независимых запросов, выполняемых без общего результата'],
  404: ['Экранировать специальные символы вручную во всех строках', 'Проверять запрос только после выполнения в базе данных', 'Ограничиться проверкой длины пользовательского ввода'],
  405: ['Для ускорения любых операций изменения данных', 'Для автоматического устранения дублирующихся строк', 'Для хранения резервной копии индексируемых столбцов'],
  406: ['Удалятся только значения, а определение столбца сохранится', 'Удалятся строки, в которых поле имело значение NULL', 'Столбец будет скрыт, но останется доступен во всех запросах'],
  433: ['перенос рабочих данных на более быстрый накопитель без создания копии', 'архивирование данных без проверки возможности их восстановления', 'шифрование единственной копии данных ключом, хранящимся вместе с ней'],
  464: ['минимальная адресуемая ячейка оперативной памяти', 'последовательность из восьми двоичных разрядов', 'единица измерения скорости выполнения машинных команд'],
  476: ['интерфейс прямого управления оборудованием в обход операционной системы', 'формат хранения состояния взаимодействующих программных компонентов', 'служба автоматической установки обновлений программных компонентов'],
  510: ['CSV', 'XML', 'YAML'],
  511: ['RTF', 'DOCX', 'ODT'],
  512: ['Thunderbolt', 'HDMI', 'PCI Express'],
  513: ['JavaScript', 'PHP', 'C'],
  514: ['Сжатие', 'Сериализация', 'Растеризация'],
  517: ['Верификация данных', 'Нормализация данных', 'Агрегация данных'],
  522: ['Тестирование', 'Сопровождение', 'Развёртывание'],
  523: ['Подтвердить полное отсутствие дефектов в программе', 'Оценить только производительность оборудования', 'Заменить проверку требований пользовательской документацией'],
  524: ['Полные копии всех файлов накопителя', 'Только машинные команды операционной системы', 'Исключительно данные, уже записанные в файл подкачки'],
  525: ['Для предоставления прикладным программам графического интерфейса', 'Для управления правами пользователей в файловой системе', 'Для преобразования исходного кода программы в машинный'],
  526: ['Контроллер ввода-вывода', 'Оперативная память', 'Системная шина'],
  528: ['JSON', 'CSV', 'YAML'],
  529: ['XML', 'CSV', 'INI'],
  530: ['Цвет каждого отдельного пикселя изображения', 'Сжатая копия графического содержимого файла', 'Исполняемый код программы для просмотра изображения'],
  531: ['SDK', 'Текстовый редактор', 'Интерпретатор командной строки'],
  532: ['Выполняет исходный код построчно без преобразования', 'Проверяет только форматирование и стиль исходного кода', 'Связывает уже готовые объектные модули в исполняемый файл'],
  533: ['Универсальный табличный процессор', 'Операционная система общего назначения', 'Драйвер стандартного устройства ввода'],
  593: ['Два адреса зарезервированы протоколом DHCP', 'Два адреса используются как шлюзы по умолчанию', 'Два адреса обязательны для работы DNS-серверов'],
  595: ['ifconfig', 'ip addr', 'Get-NetAdapter'],
  596: ['ipconfig', 'ip route', 'netstat -r'],
  597: ['ip link', 'route -n', 'ss -a'],
  601: ['Определить IPv4-адрес по доменному имени', 'Автоматически назначить узлу IPv4-параметры', 'Проверить достижимость удалённого IPv4-узла'],
  613: ['Отдельный физический канал между каждой парой узлов', 'Автоматическое назначение адресов всем участникам сети', 'Преобразование доменных имён в адреса внутри туннеля'],
  614: ['Увеличивать физическую пропускную способность канала', 'Шифровать весь трафик независимо от протокола', 'Автоматически выбирать IP-адреса для новых узлов'],
  615: ['Маршрут до узла с перечислением всех промежуточных маршрутизаторов', 'Скорость передачи файла на прикладном уровне', 'Состояние всех открытых TCP-портов удалённого узла'],
  617: ['Маршрутизатор', 'Сетевой мост', 'Повторитель'],
  619: ['Джиттер', 'Пропускная способность', 'Коэффициент потери пакетов'],
  620: ['Задержку передачи', 'Частоту потери пакетов', 'Величину джиттера'],
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
    text: wordingOverrides[id] || naturalizeQuestion(question.text),
    options: rotatedOptions,
    correct: targetCorrect,
    explanation: explanationFor(question),
    source: 'Программа вступительных испытаний 2026',
    code: '',
    position: id,
  }
}).map(question => {
  const distractors = distractorOverrides[question.id]
  if (!distractors) return question
  const options = [...question.options]
  let distractorIndex = 0
  options.forEach((_, index) => {
    if (index !== question.correct) options[index] = distractors[distractorIndex++]
  })
  return { ...question, options }
})

if (questions.length < 500) throw new Error(`После дедупликации осталось слишком мало вопросов: ${questions.length}`)
if (questions.some((question, index) => question.options[question.correct] !== parsed[index].answer)) throw new Error('Генератор изменил правильный ответ')
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
const refinementJson = JSON.stringify(questions.map(question => ({ id: question.id, text: question.text, options: question.options, explanation: question.explanation })))
const refinementSql = `begin;

update public.questions as question
set text = seed.text,
    options = seed.options,
    explanation = seed.explanation,
    updated_at = now()
from jsonb_to_recordset($question_refinement$${refinementJson}$question_refinement$::jsonb) as seed (
  id bigint, text text, options jsonb, explanation text
)
where question.id = seed.id;

commit;
`
fs.writeFileSync(refinementMigrationPath, refinementSql)
console.log(`Сгенерировано ${questions.length} вопросов; удалено ${986 - questions.length} смысловых дублей`)
