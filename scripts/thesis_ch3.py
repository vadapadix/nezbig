# -*- coding: utf-8 -*-
"""
Thesis Chapter 3 Module: Software Implementation of the "Незбіг" System
"""

import os
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from build_full_diploma_docx import (
    add_chapter_heading, add_section_heading, add_subsection_heading, 
    add_p, add_formula, add_table_custom, add_figure, add_code_block
)

def add_chapter_3(doc):
    add_chapter_heading(doc, "РОЗДІЛ 3. ПРОГРАМНА РЕАЛІЗАЦІЯ СИСТЕМИ", new_page=True)
    
    # 3.1
    add_section_heading(doc, "3.1. Обґрунтування технологічного стеку та середовища розробки")
    
    add_p(doc, 
        text="Програмна реалізація вебсистеми «Незбіг» базується на сучасному стеку технологій, що відповідає "
             "вимогам високої швидкодії, типувальної безпеки, реактивності користувацького інтерфейсу та простоти масштабування. "
             "Вся кодова база проєкту реалізована мовою TypeScript (версія 5.9.3), що дозволяє використовувати єдину систему "
             "типізації як на клієнті, так і на сервері (`shared/types.ts`).")
             
    add_p(doc, 
        text="Клієнтська частина системи побудована на базі бібліотеки React 19.2.3. Вибір найновішої мажорної версії React "
             "зумовлений впровадженням прогресивних механізмів паралельного рендерингу (Concurrent Mode), оптимізованого хука "
             "`useTransition` для плавної обробки великих текстових масивів без зависання інтерфейсу, а також покращеної роботи "
             "з формами та діями. Збірка клієнтського застосунку здійснюється за допомогою інструменту Vite 7.3, що забезпечує "
             "миттєве гаряче оновлення модулів (Hot Module Replacement, HMR) під час розробки та генерацію компактних оптимізованих "
             "бандлів для продакшн-середовища. Для стилізації застосовано утилітарний CSS-фреймворк TailwindCSS 3.4 з гнучкою "
             "підтримкою темної теми (Dark Mode) та сучасних компонентних анімацій.")
             
    add_p(doc, 
        text="Серверна частина реалізована на платформі Node.js версії 24 з використанням вебфреймворку Express 5.2. "
             "П'ята мажорна версія Express забезпечує нативну підтримку Promise-орієнтованих асинхронних обробників маршрутів, "
             "що значно спрощує обробку помилок і виключає падіння процесу через необроблені відхилення промісів. "
             "Для обробки офісних документів використано бібліотеку Mammoth 1.11 (екстракція вмісту DOCX у санітизований HTML), "
             "pdf-parse 2.4 (вилучення тексту з файлів PDF) та JSZip 3.10 (низькорівнева маніпуляція ZIP-архівами OOXML). "
             "Синтаксичний аналіз та очищення HTML-коду завантажених вебсторінок здійснюється надшвидким парсером Cheerio 1.1. "
             "Безпека забезпечується пакетами Helmet 8.3, DOMPurify 3.4, CORS та rate-limiting.")

    headers_3_1 = ["Рівень системи", "Технологія / Бібліотека", "Версія", "Функціональне призначення"]
    data_3_1 = [
        ["Клієнт (Frontend)", "React", "19.2.3", "Побудова реактивного користувацького інтерфейсу (SPA)"],
        ["Клієнт (Frontend)", "TypeScript", "5.9.3", "Статична типізація, інтерфейси та безпека коду"],
        ["Клієнт (Frontend)", "Vite", "7.3.0", "Високошвидкісний бандлер та інструмент збірки"],
        ["Клієнт (Frontend)", "TailwindCSS", "3.4.19", "Адаптивна верстка та дизайн компонентів"],
        ["Сервер (Backend)", "Node.js / Express", "5.2.1", "Асинхронний REST API сервер та маршрутизація"],
        ["Сервер (Backend)", "Mammoth.js", "1.11.0", "Екстракція та preview форматування DOCX документів"],
        ["Сервер (Backend)", "pdf-parse / JSZip", "2.4 / 3.10", "Парсинг PDF та низькорівнева маніпуляція OOXML пакетами"],
        ["Сервер (Backend)", "Cheerio", "1.1.2", "Очищення та екстракція смислового тексту вебсторінок"],
        ["Сервер (Backend)", "DuckDuckGo / OpenAlex", "API", "Відкритий збір кандидатів пошуку та наукових DOI"],
        ["Кешування", "MemoryTtlCache / Vercel KV", "custom", "Дворівневе кешування пошуку (30 хв) та сторінок (60 хв)"],
        ["Тестування", "Vitest / Playwright", "4.0 / 1.62", "Модульне, інтеграційне та E2E тестування"]
    ]
    add_table_custom(doc, headers_3_1, data_3_1, 
                     caption="Таблиця 3.1 — Технологічний стек програмної системи «Незбіг»", 
                     col_widths=[3.0, 3.8, 1.8, 7.9])

    # 3.2
    add_section_heading(doc, "3.2. Архітектура сервера та проєктування REST API специфікації")
    
    add_p(doc, 
        text="Серверна архітектура системи «Незбіг» спроєктована за принципами REST (Representational State Transfer). "
             "Кожен маршрут виконує строго окреслену атомарну операцію, обмінюючись даними у форматі JSON (для метаданих) "
             "або multipart/form-data (для завантаження бінарних файлів). Обробка запитів супроводжується структурним логуванням "
             "через високоефективний логер Pino 10.3.")

    headers_3_2 = ["HTTP Метод і Маршрут", "Вхідні параметри (Request)", "Формат відповіді (Response)", "Опис призначення"]
    data_3_2 = [
        ["GET /api/health", "Відсутні", "JSON {status: 'ok', uptime}", "Перевірка життєздатності сервера"],
        ["POST /api/scan", "JSON: text, settings", "JSON: ScanReport (повний)", "Локальне сканування вставленого тексту"],
        ["POST /api/scan-file", "Multipart: file, settings", "JSON: ScanReport (повний)", "Сканування завантаженого файлу (DOCX/PDF)"],
        ["POST /api/extract", "Multipart: file", "JSON: text, htmlPreview, info", "Екстракція тексту та HTML прев'ю файлу"],
        ["POST /api/humanize", "JSON: text, mode, html?", "JSON: revisedText, html, diff", "Стилістичне детерміноване редагування"],
        ["POST /api/humanize-file", "Multipart: file, mode", "JSON: revisedText, html, diff", "Стилістичне редагування файлу Word"],
        ["POST /api/export-docx", "Multipart: file, revisedText", "Binary Blob (.docx)", "Генерація відредагованого файлу OOXML Word"],
        ["POST /api/ai-opinion", "JSON: text, localSignals", "JSON: aiProbability, opinion", "Асинхронний фоновий запит до зовнішньої LLM"],
        ["GET /api/scan-status/:id", "URL param: jobId", "JSON: status, progress, result", "Опитування прогресу тривалого сканування"]
    ]
    add_table_custom(doc, headers_3_2, data_3_2, 
                     caption="Таблиця 3.2 — Специфікація REST API маршрутів системи «Незбіг»", 
                     col_widths=[3.5, 3.8, 3.8, 5.4])

    add_p(doc, 
        text="Важливою перевагою спроєктованого API є розділення швидкої фази сканування та важких фонових обчислень. "
             "Клієнтський застосунок отримує базовий локальний звіт за лічені секунди, після чого асинхронно ініціює маршрут "
             "`/api/ai-opinion` для отримання зовнішньої експертної оцінки мовної моделі. Збереження результатів забезпечує "
             "ендпоінт мерджу, що записує отриману думку у збережений звіт в локальному сховищі.")

    # 3.3
    add_section_heading(doc, "3.3. Програмна реалізація модулів аналізу та алгоритмів")
    
    add_subsection_heading(doc, "3.3.1. Реалізація алгоритмів скорингу та Winnowing")
    add_p(doc, 
        text="Алгоритмічне ядро детекції запозичень реалізоване у модулях `src/server/scoring.ts` та `plagiarismScoring.ts`. "
             "Нижче наведено лістинг програмної реалізації функції генерації цифрових відбитків Winnowing:")

    code_winnowing = """// src/server/scoring.ts - Генерація Winnowing-фінгерпринтингів
export function generateWinnowingFingerprints(tokens: string[], k = 5, w = 4): Set<number> {
  if (tokens.length < k) return new Set();
  const hashes: number[] = [];
  
  // 1. Поліноміальне хешування k-грам (Rabin-Karp)
  for (let i = 0; i <= tokens.length - k; i++) {
    let h = 0;
    for (let j = 0; j < k; j++) {
      const charCode = tokens[i + j].charCodeAt(0) || 0;
      h = (h * 31 + charCode) & 0xffffffff;
    }
    hashes.push(h);
  }

  // 2. Ковзне вікно шириною w та вибір правого мінімального хешу
  const fingerprints = new Set<number>();
  for (let i = 0; i <= hashes.length - w; i++) {
    let minVal = hashes[i];
    let minIdx = i;
    for (let j = 1; j < w; j++) {
      if (hashes[i + j] <= minVal) { // <= забезпечує вибір правого мінімуму
        minVal = hashes[i + j];
        minIdx = i + j;
      }
    }
    fingerprints.add(minVal);
  }
  return fingerprints;
}"""
    add_code_block(doc, code_winnowing, caption="Лістинг 3.1 — Реалізація алгоритму Winnowing-фінгерпринтингу (TypeScript)")

    add_p(doc, 
        text="Функція `calculateScore` поєднує обчислені відбитки, токенний оверлап та розріджене динамічне програмування для виявлення "
             "найдовшого спільного прогону слів. Якщо сервер підтвердив сторінку, розраховується зважений бал відповідно до формули (2.3).")

    add_subsection_heading(doc, "3.3.2. Реалізація стилометричного AI-аналізатора")
    add_p(doc, 
        text="Модуль `src/server/aiStylometry.ts` здійснює локальний багатофакторний аналіз авторського тексту. "
             "Нижче наведено фрагмент розрахунку ковзного показника лексичного багатства MATTR та коефіцієнта варіації довжини речень:")

    code_stylometry = """// src/server/aiStylometry.ts - Розрахунок метрик MATTR та Burstiness CV
export function computeSegmentMetrics(tokens: string[], sentences: string[][]): SegmentMetrics {
  // 1. Розрахунок MATTR ковзним вікном розміром 50 слів
  const windowSize = 50;
  let mattrScore = 1.0;
  if (tokens.length >= windowSize) {
    let totalTTR = 0;
    const steps = tokens.length - windowSize + 1;
    for (let i = 0; i < steps; i++) {
      const slice = tokens.slice(i, i + windowSize);
      const uniqueTypes = new Set(slice.map(t => t.toLowerCase())).size;
      totalTTR += uniqueTypes / windowSize;
    }
    mattrScore = totalTTR / steps;
  }

  // 2. Розрахунок коефіцієнта варіації довжини речень (Burstiness CV)
  const lengths = sentences.map(s => s.length).filter(l => l > 0);
  const mean = lengths.reduce((acc, v) => acc + v, 0) / (lengths.length || 1);
  const variance = lengths.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (lengths.length || 1);
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0.5;

  return { mattr: mattrScore, burstinessCV: cv, sentenceCount: lengths.length };
}"""
    add_code_block(doc, code_stylometry, caption="Лістинг 3.2 — Реалізація розрахунку MATTR та Burstiness CV (TypeScript)")

    add_subsection_heading(doc, "3.3.3. Реалізація фільтрації коду та структури документів")
    add_p(doc, 
        text="Модуль `src/server/proseFilter.ts` містить спеціалізовані регулярні вирази та евристики для ідентифікації кодових конструкцій. "
             "Кожен рядок оцінюється за наявністю ключових слів програмування (`function`, `class`, `import`, `return`, `SELECT`, `FROM`), "
             "символів синтаксису (фігурні дужки, крапка з комою, оператори присвоєння) та характерних відступів коду. "
             "Рядки з високим індексом коду ізолюються від стилометрії та обліковуються в `aiExclusions.codeWords`.")

    add_subsection_heading(doc, "3.3.4. Реалізація маніпулятора документами Microsoft Word OOXML")
    add_p(doc, 
        text="Модуль `src/server/formattedDocx.ts` здійснює розбір ZIP-пакета вихідного файлу за допомогою бібліотеки JSZip. "
             "Він зчитує файл `word/document.xml`, перетворює його в об'єктне дерево DOM та викликає `textAlignment.ts`. "
             "Токенний вирівнювач формує карту відповідностей між старими словами та новими словами після стилістичної обробки. "
             "Зміни записуються безпосередньо у текстові теги `<w:t>`, не зачіпаючи параметрів `<w:rPr>` (де зберігаються шрифти, розміри, "
             "курсив або колір). Після цього JSZip генерує новий бінарний буфер DOCX і повертає його клієнту.")

    # 3.4
    add_section_heading(doc, "3.4. Реалізація детермінованого стилістичного редактора (Text Humanizer)")
    
    add_p(doc, 
        text="Стилістичний редактор (`src/server/humanizer.ts`) спроєктовано не як інструмент сліпого обходу детекторів, "
             "а як інтелектуальний помічник автора для підвищення читабельності та усунення мовних канцеляризмів. "
             "Редактор підтримує три функціональні режими:\n"
             "1. `Academic` — оптимізація наукового стилю: видалення порожніх чат-кліше («слід обов'язково зазначити»), "
             "збереження строгості формулювань, посилань та модальності («може», «доцільно»);\n"
             "2. `Natural` — модуляція природного ритму речень, розбиття надмірно довгих синтаксичних періодів, чергування лаконічних фраз;\n"
             "3. `Concise` — видалення плеоназмів, скорочення надлишкових слів-паразитів та стиснення викладу без втрати фактів.")
             
    add_p(doc, 
        text="Алгоритм працює строго детерміновано: він не додає вигаданих фактів і не змінює числових значень. "
             "Якщо в тексті виявлено неконкретне твердження на кшталт «дослідження довели», редактор додає маркер "
             "необхідності вказання конкретного наукового першоджерела. Усі зміни групуються та передаються клієнту у вигляді структурованого диф-звіту.")

    # 3.5
    add_section_heading(doc, "3.5. Клієнтський користувацький інтерфейс на React 19")
    
    add_p(doc, 
        text="Користувацький інтерфейс системи «Незбіг» спроєктовано за принципами людино-орієнтованого дизайну (Human-Centered Design) "
             "та вимогами вебдоступності (WCAG 2.1). Інтерфейс підтримує миттєве перемикання мов (українська / англійська), "
             "має темну кольорову гаму з високим коефіцієнтом контрастності та адаптивну розмітку для мобільних і десктопних екранів.")

    add_p(doc, 
        text="Ключові компоненти клієнтського застосунку:\n"
             "1. `TextEditor.tsx` — багатофункціональний редактор з підтримкою прямого вводу тексту, очищення та відстеження кількості слів. "
             "Підтримує механізм Drag-and-Drop для перетягування файлів DOCX та PDF безпосередньо у робочу область;\n"
             "2. `ScanSettingsPanel.tsx` — бічна панель налаштування глибини сканування (Standard Fast, Deep Analysis, Expert Scan) "
             "із динамічною індикацією розміру фрагмента та оверлапу;\n"
             "3. `ReportView.tsx` — головний аналітичний екран звіту, що візуалізує картки метрик плагіату та AI-ризику, "
             "знайдені вебсторінки, смуги невизначеності та кнопки експорту результатів у PDF, PNG, JSON та Word;\n"
             "4. `DiffPanel.tsx` — компонент стилістичного редактора, що наочно підсвічує видалені та додані слова "
             "у режимі Side-by-Side (до і після обробки);\n"
             "5. `HistoryPage.tsx` — панель журналу сканувань, збережена у локальному сховищі браузера з можливістю швидкого перегляду.")

    sc1_path = os.path.abspath("docs/screenshots/01_main_page_ua.png")
    if not os.path.exists(sc1_path): sc1_path = os.path.abspath("docs/screenshots/01_home_main.png")
    add_figure(doc, sc1_path, "Рис. 3.1 — Головна робоча область системи «Незбіг»: завантаження документів та редактор", width_cm=15.5)

    sc2_path = os.path.abspath("docs/screenshots/02_settings_ua.png")
    add_figure(doc, sc2_path, "Рис. 3.2 — Панель налаштування глибини сканування та вибору пошукових провайдерів", width_cm=15.5)

    sc3_path = os.path.abspath("docs/screenshots/03_humanizer_page.png")
    add_figure(doc, sc3_path, "Рис. 3.3 — Інтерфейс модуля стилістичного редагування та академічної адаптації (Humanizer)", width_cm=15.5)

    sc4_path = os.path.abspath("docs/screenshots/04_humanizer_diff_result.png")
    add_figure(doc, sc4_path, "Рис. 3.4 — Процес групування та застосування стилістичних правок у редакторі", width_cm=15.5)

    sc5_path = os.path.abspath("docs/screenshots/05_history_page.png")
    add_figure(doc, sc5_path, "Рис. 3.5 — Панель архіву та журналу попередніх перевірок документів", width_cm=15.5)

    # 3.6
    add_section_heading(doc, "3.6. Висновки до розділу 3")
    
    add_p(doc, 
        text="1. Успішно здійснено програмну реалізацію клієнт-серверної системи «Незбіг» на базі прогресивного стеку технологій "
             "React 19, TypeScript 5.9, Vite 7.3, Node.js 24 та Express 5.2 з повною типувальною безпекою всього життєвого циклу даних.\n"
             "2. Розроблено та задокументовано REST API специфікацію, що забезпечує асинхронне виконання перевірок, екстракцію вмісту "
             "файлів DOCX/PDF та фонову інтеграцію зовнішніх мовних моделей.\n"
             "3. Програмно реалізовано високоточні алгоритмічні модулі 5-факторного скорингу, генерації відбитків Winnowing та розрахунку "
             "стилометричних показників MATTR і коефіцієнта варіації довжини речень (Burstiness CV).\n"
             "4. Створено модуль `formattedDocx.ts` на базі JSZip та лінійного токенного вирівнювання `textAlignment.ts`, що гарантує "
             "100% збереження вихідних OOXML-стилів Word при стилістичній оптимізації тексту.\n"
             "5. Реалізовано детермінований стилістичний редактор Text Humanizer з трьома режимами адаптації (Academic, Natural, Concise) "
             "та інтерактивну візуалізацію диференційних змін DiffPanel у сучасному вебінтерфейсі.")

print("Chapter 3 module ready.")
