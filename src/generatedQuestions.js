const makeQuestion = (id, section, difficulty, text, correctAnswer, distractors, explanation, code = '') => {
  const options = [...new Set([correctAnswer, ...distractors])]
  const fillers = ['Ни один из перечисленных вариантов', 'Недостаточно данных', 'Запрос завершится ошибкой']
  while (options.length < 4) options.push(fillers.find(option => !options.includes(option)))
  const shift = id % options.length
  const rotated = [...options.slice(shift), ...options.slice(0, shift)]
  return { id, section, difficulty, text, options: rotated, correct: rotated.indexOf(correctAnswer), explanation, code }
}

function algorithmQuestions(start) {
  const sorts = [
    ['сортировки слиянием', 'O(n log n)', 'O(n)', 'стабильной'],
    ['пирамидальной сортировки', 'O(n log n)', 'O(1)', 'нестабильной'],
    ['сортировки вставками', 'O(n²)', 'O(1)', 'стабильной'],
    ['пузырьковой сортировки', 'O(n²)', 'O(1)', 'стабильной'],
    ['быстрой сортировки без специальных мер', 'O(n²)', 'O(log n)', 'нестабильной'],
  ]
  const principles = [
    ['SRP', 'одна причина для изменения класса'], ['OCP', 'расширение без изменения проверенного кода'],
    ['LSP', 'заменяемость базового типа его подтипом'], ['ISP', 'небольшие специализированные интерфейсы'],
    ['DIP', 'зависимость от абстракций'], ['инкапсуляция', 'сокрытие состояния за публичным интерфейсом'],
    ['наследование', 'получение и уточнение поведения базового класса'], ['полиморфизм', 'разное поведение через общий контракт'],
    ['абстракция', 'выделение существенных свойств объекта'], ['композиция', 'построение объекта из других объектов'],
  ]
  return Array.from({ length: 100 }, (_, i) => {
    const id = start + i
    const type = i % 4
    if (type === 0) {
      const n = 3 + Math.floor(i / 4)
      const value = n * 2 + 1
      return makeQuestion(id, 'algorithms', 'application', `Что выведет фрагмент Python при n = ${n}?`, String(value), [String(value - 1), String(value + 1), String(n * n)], 'Сначала n умножается на 2, затем к результату прибавляется 1.', `n = ${n}\nprint(n * 2 + 1)`)
    }
    if (type === 1) {
      const [name, complexity, memory, stability] = sorts[Math.floor(i / 4) % sorts.length]
      return makeQuestion(id, 'algorithms', 'understanding', `Какова временная сложность в худшем случае для ${name}?`, complexity, ['O(1)', 'O(log n)', complexity === 'O(n²)' ? 'O(n log n)' : 'O(n²)'], `Для ${name} характерна оценка ${complexity}; дополнительная память обычно ${memory}, алгоритм считается ${stability}.`)
    }
    if (type === 2) {
      const [term, meaning] = principles[Math.floor(i / 4) % principles.length]
      return makeQuestion(id, 'algorithms', 'surface', `Какое описание точнее всего соответствует понятию «${term}»?`, meaning, ['глобальное хранение всех переменных', 'обязательное копирование исходного кода', 'выполнение программы без алгоритма'], `Ключевой смысл понятия «${term}» — ${meaning}.`)
    }
    const n = 2 + Math.floor(i / 4)
    const result = n % 2 === 0 ? 'even' : 'odd'
    return makeQuestion(id, 'algorithms', 'application', `Что выведет этот код JavaScript при x = ${n}?`, result, [result === 'even' ? 'odd' : 'even', String(n), 'undefined'], 'Оператор % возвращает остаток от деления; четное число имеет остаток 0 при делении на 2.', `const x = ${n};\nconsole.log(x % 2 === 0 ? 'even' : 'odd');`)
  })
}

function databaseQuestions(start) {
  return Array.from({ length: 100 }, (_, i) => {
    const id = start + i
    const type = i % 5
    const a = 2 + Math.floor(i / 5)
    const b = a + 3
    const c = b + 4
    if (type === 0) return makeQuestion(id, 'databases', 'application', 'Какое значение вернет SQL-запрос?', String(2), ['0', '1', '3'], `Условию price >= ${b} соответствуют две строки: ${b} и ${c}.`, `items\nid  price\n1   ${a}\n2   ${b}\n3   ${c}\n\nSELECT COUNT(*)\nFROM items\nWHERE price >= ${b};`)
    if (type === 1) return makeQuestion(id, 'databases', 'application', 'Какой результат вернет агрегатный SQL-запрос?', String(a + b + c), [String(a + b), String(b + c), String(c)], 'SUM складывает все ненулевые значения выбранного столбца.', `values_table\namount\n${a}\n${b}\n${c}\n\nSELECT SUM(amount) FROM values_table;`)
    if (type === 2) return makeQuestion(id, 'databases', 'application', 'Какая строка окажется первой в результате?', `C — ${c}`, [`A — ${a}`, `B — ${b}`, `A — ${c}`], 'ORDER BY score DESC сортирует по убыванию, поэтому первой будет строка с максимальным значением.', `ratings\nname  score\nA     ${a}\nB     ${b}\nC     ${c}\n\nSELECT name, score\nFROM ratings\nORDER BY score DESC;`)
    if (type === 3) return makeQuestion(id, 'databases', 'application', 'Сколько строк вернет запрос с BETWEEN?', '2', ['0', '1', '3'], 'BETWEEN включает обе границы, поэтому подходят значения на нижней и верхней границе.', `numbers\nvalue\n${a}\n${b}\n${c}\n\nSELECT * FROM numbers\nWHERE value BETWEEN ${a} AND ${b};`)
    return makeQuestion(id, 'databases', 'trick', 'Как обработается NULL в этом запросе?', 'COUNT(value) не учтет строку с NULL', ['COUNT(value) вернет ошибку', 'NULL будет посчитан как ноль', 'COUNT(value) всегда равен COUNT(*)'], 'COUNT(column) считает только строки с ненулевым значением столбца, тогда как COUNT(*) считает строки.', `samples\nvalue\n${a}\nNULL\n${c}\n\nSELECT COUNT(value) FROM samples;`)
  })
}

function graphicsQuestions(start) {
  const facts = [
    ['SVG', 'масштабируемой векторной графики'], ['PNG', 'растровой графики с прозрачностью без потерь'],
    ['JPEG', 'фотографий со сжатием с потерями'], ['TIFF', 'качественных растровых материалов для печати'],
    ['GIF', 'простой покадровой веб-анимации'], ['PSD', 'редактируемого проекта Adobe Photoshop'],
    ['CDR', 'редактируемого проекта CorelDRAW'], ['CMYK', 'полиграфической цветовой модели'],
    ['RGB', 'экранной аддитивной цветовой модели'], ['маска слоя', 'неразрушающего скрытия частей слоя'],
    ['кривые Безье', 'описания плавных векторных контуров'], ['альфа-канал', 'хранения степени прозрачности'],
    ['DPI', 'плотности точек при выводе на печать'], ['PPI', 'плотности пикселей изображения или экрана'],
    ['растрирование', 'преобразования векторных объектов в пиксели'], ['трассировка', 'преобразования растра в векторные контуры'],
    ['слои', 'раздельного редактирования элементов композиции'], ['гистограмма', 'оценки распределения тонов изображения'],
    ['перо', 'построения точных векторных контуров'], ['цветовой профиль ICC', 'согласованного воспроизведения цвета устройствами'],
  ]
  const prompts = ['Какое понятие подходит для', 'Что обычно применяют для', 'Выберите средство для', 'С каким понятием связано назначение']
  return Array.from({ length: 100 }, (_, i) => {
    const id = start + i
    const [answer, purpose] = facts[i % facts.length]
    const others = facts.filter(([name]) => name !== answer).slice((i * 3) % 16, (i * 3) % 16 + 3).map(([name]) => name)
    return makeQuestion(id, 'graphics', i % 5 === 4 ? 'application' : 'understanding', `${prompts[Math.floor(i / facts.length)]} ${purpose}?`, answer, others, `${answer} используют для ${purpose}.`)
  })
}

function modelingQuestions(start) {
  const modelFacts = [
    ['математическая модель', 'описывает объект формулами и уравнениями'], ['имитационная модель', 'воспроизводит поведение системы во времени'],
    ['статическая модель', 'описывает состояние без учета изменения во времени'], ['динамическая модель', 'учитывает изменение состояния во времени'],
    ['детерминированная модель', 'не содержит случайных факторов'], ['стохастическая модель', 'учитывает случайные величины'],
    ['адекватность', 'соответствие существенным свойствам объекта и цели исследования'], ['устойчивость', 'ограниченную реакцию на малые возмущения'],
    ['сходимость', 'приближение численного результата к точному'], ['верификация', 'проверку правильности реализации модели'],
  ]
  return Array.from({ length: 100 }, (_, i) => {
    const id = start + i
    const type = i % 4
    const n = 1 + Math.floor(i / 4)
    if (type === 0) {
      const x0 = n + 1
      const rootSquare = x0 * x0 + 4
      const result = x0 + 2 / x0
      return makeQuestion(id, 'modeling', 'application', `Выполните один шаг метода Ньютона для f(x)=x²−${rootSquare}, x₀=${x0}.`, String(Number(result.toFixed(3))), [String(x0), String(Number((result + 1).toFixed(3))), String(rootSquare)], `x₁ = x₀ − f(x₀)/f′(x₀) = ${x0} − (${x0 * x0}−${rootSquare})/${2 * x0} = ${Number(result.toFixed(3))}.`)
    }
    if (type === 1) {
      const h = 0.1
      const result = Number((n + h * n).toFixed(1))
      return makeQuestion(id, 'modeling', 'application', `Один шаг явного метода Эйлера для y′=y, y(0)=${n}, h=0,1 даст значение...`, String(result), [String(n), String(n + 1), String(Number((n + .01).toFixed(2)))], `По формуле y₁=y₀+h·f(y₀): ${n}+0,1·${n}=${result}.`)
    }
    if (type === 2) {
      const power = 1 + (n % 4)
      const factorial = [1, 1, 2, 6, 24][power]
      return makeQuestion(id, 'modeling', 'understanding', `Как выглядит преобразование Лапласа функции t^${power}?`, `${factorial}/s^${power + 1}`, [`1/s^${power}`, `s^${power}`, `${power}/s`], `Используется формула L{t^n}=n!/s^(n+1), поэтому результат равен ${factorial}/s^${power + 1}.`)
    }
    const [answer, meaning] = modelFacts[n % modelFacts.length]
    return makeQuestion(id, 'modeling', 'surface', `Какой термин обозначает свойство или тип, который ${meaning}?`, answer, modelFacts.filter(([term]) => term !== answer).slice(0, 3).map(([term]) => term), `Это определение понятия «${answer}».`)
  })
}

function informationQuestions(start) {
  const facts = [
    ['8 бит', 'размер одного байта'], ['UTF-8', 'кодирование символов Unicode'], ['TXT', 'простой текст без оформления'],
    ['DOCX', 'редактируемый текстовый документ Office'], ['PDF', 'переносимый документ с сохранением компоновки'],
    ['CSV', 'табличные данные с разделителями'], ['JSON', 'структурированный обмен данными API'], ['XML', 'иерархические размеченные данные'],
    ['ZIP', 'архивирование набора файлов'], ['WAV', 'несжатое или без потерь цифровое аудио'], ['MP3', 'сжатое аудио с потерями'],
    ['MP4', 'мультимедийный контейнер'], ['application/json', 'MIME-тип JSON'], ['API', 'программный интерфейс взаимодействия систем'],
    ['бит', 'минимальная двоичная единица данных'], ['метаданные', 'данные, описывающие другие данные'],
    ['резервная копия', 'восстановление информации после потери'], ['архив', 'объединение и часто сжатие файлов'],
    ['логический тип', 'хранение значений истина или ложь'], ['целочисленный тип', 'хранение чисел без дробной части'],
  ]
  return Array.from({ length: 100 }, (_, i) => {
    const id = start + i
    if (i % 5 === 0) {
      const bits = 8 * (1 + Math.floor(i / 5))
      const values = 2 ** Math.min(bits, 20)
      return makeQuestion(id, 'information', 'application', `Сколько байт содержат ${bits} бит?`, String(bits / 8), [String(bits), String(bits / 4), String(values)], `Один байт равен 8 битам: ${bits}/8=${bits / 8}.`)
    }
    const [answer, purpose] = facts[i % facts.length]
    const distractors = facts.filter(([term]) => term !== answer).slice((i * 2) % 16, (i * 2) % 16 + 3).map(([term]) => term)
    return makeQuestion(id, 'information', i % 3 === 0 ? 'understanding' : 'surface', `Что соответствует назначению «${purpose}»?`, answer, distractors, `${answer} — это ${purpose}.`)
  })
}

function networkQuestions(start) {
  const protocols = [
    ['IP', 'логическая адресация и маршрутизация', 'сетевом'], ['TCP', 'надежная доставка упорядоченного потока', 'транспортном'],
    ['UDP', 'доставка датаграмм без установления соединения', 'транспортном'], ['HTTP', 'передача веб-ресурсов', 'прикладном'],
    ['HTTPS', 'защищенная передача веб-ресурсов', 'прикладном'], ['DNS', 'преобразование доменных имен в адреса', 'прикладном'],
    ['DHCP', 'автоматическая выдача сетевой конфигурации', 'прикладном'], ['ARP', 'поиск MAC-адреса по IPv4-адресу в локальной сети', 'канальном/сетевом стыке'],
    ['ICMP', 'диагностические и служебные сообщения IP', 'сетевом'], ['Ethernet', 'передача кадров в проводной локальной сети', 'канальном'],
  ]
  return Array.from({ length: 100 }, (_, i) => {
    const id = start + i
    const type = i % 5
    if (type <= 1) {
      const prefix = 24 + ((Math.floor(i / 5) + type) % 7)
      const total = 2 ** (32 - prefix)
      const hosts = total - 2
      return makeQuestion(id, 'networks', 'application', `Сколько адресов узлов доступно в обычной IPv4-подсети /${prefix}?`, String(hosts), [String(total), String(Math.max(0, hosts - 2)), String(total * 2 - 2)], `После префикса /${prefix} остается ${32 - prefix} бит: всего ${total} адресов, два служебных, доступно ${hosts}.`)
    }
    if (type === 2) {
      const block = [128, 64, 32, 16][Math.floor(i / 5) % 4]
      const prefix = { 128: 25, 64: 26, 32: 27, 16: 28 }[block]
      const octet = (Math.floor(i / 5) * 19) % 256
      const network = Math.floor(octet / block) * block
      return makeQuestion(id, 'networks', 'application', `Какой последний октет адреса сети для узла 192.168.1.${octet}/${prefix}?`, String(network), [String(octet), String(Math.min(255, network + block - 1)), String((network + block) % 256)], `Размер блока для /${prefix} равен ${block}; значение ${octet} входит в диапазон, начинающийся с ${network}.`)
    }
    const [answer, purpose, level] = protocols[Math.floor(i / 5) % protocols.length]
    if (type === 3) return makeQuestion(id, 'networks', 'surface', `Какой протокол отвечает за ${purpose}?`, answer, protocols.filter(([name]) => name !== answer).slice(0, 3).map(([name]) => name), `${answer} обеспечивает ${purpose} и работает на ${level} уровне модели OSI.`)
    return makeQuestion(id, 'networks', 'understanding', `На каком уровне модели OSI преимущественно работает ${answer}?`, level, ['физическом', 'сеансовом', 'представления'], `${answer} относят к ${level} уровню в контексте модели OSI.`)
  })
}

export const generatedQuestions = [
  ...algorithmQuestions(175),
  ...graphicsQuestions(275),
  ...modelingQuestions(375),
  ...databaseQuestions(475),
  ...informationQuestions(575),
  ...networkQuestions(675),
]
