import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const diagrams = [
  {
    id: 'diagram_system_architecture',
    title: 'Загальна архітектура програмної системи',
    mermaid: `
flowchart TD
    User["Користувач (Web-клієнт)"] --> UI["Клієнтський застосунок (React 19, TypeScript, TailwindCSS)"]
    UI --> Editor["Редактор тексту та завантажувач (DOCX / PDF / TXT)"]
    UI --> Settings["Панель конфігурації (Standard, Deep, Expert)"]
    UI --> Router["Серверний API Шлюз (Node.js, Express 5)"]

    Router --> Preproc["Препроцесор документа (proseFilter, титул, бібліографія)"]
    Preproc --> PlagEngine["Двигун перевірки на плагіат (scoring.ts)"]
    Preproc --> AiEngine["Стилометричний AI-ансамбль (aiStylometry.ts)"]
    Preproc --> Humanizer["Детермінований редактор стилю (humanizer.ts)"]

    PlagEngine --> SearchQueue["Черга пошуку та Circuit Breaker (providerTaskScheduler)"]
    SearchQueue --> SearchEngines["Провайдери пошуку (DuckDuckGo, Google, Semantic Scholar, OpenAlex)"]
    SearchEngines --> Hydrator["Гідратація сторінок та екстракція контенту (Cheerio)"]
    Hydrator --> Scoring["5-факторний зважений скоринг (Winnowing + n-gram + LCS)"]

    AiEngine --> Stylometry["Аналіз метрик MATTR, Burstiness, повторів та патернів"]
    AiEngine --> LLMFallback["Асинхронний запит до LLM (OpenRouter / NVIDIA NIM)"]

    Scoring --> Cache["Кешування відповідей (MemoryTtlCache)"]
    Scoring --> ReportView["Підсумковий звіт (ReportView)"]
    Stylometry --> ReportView
    LLMFallback --> ReportView
    ReportView --> UI
`
  },
  {
    id: 'diagram_pipeline_detection',
    title: 'Конвеєр виявлення текстових запозичень',
    mermaid: `
flowchart TD
    Doc["Вхідний документ (DOCX, PDF, TXT)"] --> Prep["Попередня обробка: відсікання коду, титулу, бібліографії"]
    Prep --> Chunk["Перекривне розбиття на фрагменти (Overlap: 18%)"]
    Chunk --> QueryGen["Генерація інформативних пошукових запитів"]
    QueryGen --> SearchDist["Диспетчеризація запитів та Circuit Breaker"]
    SearchDist --> Hydrate["Hydration: завантаження й очищення HTML джерел"]
    Hydrate --> Scoring["5-факторний скоринг: n-gram + winnowing + LCS run"]
    Scoring --> Aggreg["Агрегація результатів і формування звіту"]
`
  },
  {
    id: 'diagram_stylometry_ensemble',
    title: 'Трьохканальний стилометричний AI-ансамбль',
    mermaid: `
flowchart TD
    Text["Очищений авторський текст"] --> Split["Сегментація на вікна по 220 слів (Overlap: 55 слів)"]
    Split --> Ch1["Канал 1: Статистичний (Вага 0.38)"]
    Split --> Ch2["Канал 2: Патерновий (Вага 0.42)"]
    Split --> Ch3["Канал 3: Структурний (Вага 0.20)"]

    Ch1 --> Ch1_f["MATTR, варіація довжини речень (Burstiness CV), повтори 4-грам"]
    Ch2 --> Ch2_f["Шаблонні кліше, hedging, prompt-leak, академічний пасив"]
    Ch3 --> Ch3_f["Синтаксична симетрія, списки, пунктуаційний профіль"]

    Ch1_f --> Comb["Зважена агрегація з множником узгодженості"]
    Ch2_f --> Comb
    Ch3_f --> Comb

    Comb --> Metric["Підсумковий бал, вердикт (low/mixed/elevated/high) та надійність"]
    Metric --> LLMOpinion["Асинхронна думка зовнішньої LLM (OpenRouter / NVIDIA)"]
`
  },
  {
    id: 'diagram_winnowing_process',
    title: 'Схема алгоритму Winnowing-фінгерпринтингу',
    mermaid: `
flowchart TD
    A["Вхідний потік токенів тексту"] --> B["Побудова k-грам послідовності (k = 5)"]
    B --> C["Хешування k-грам (хеш-послідовність H)"]
    C --> D["Ковзне вікно шириною w токенів"]
    D --> E["Вибір правого мінімального хешу у кожному вікні"]
    E --> F["Множина стабільних відбитків (Fingerprints)"]
    F --> G["Порівняння відбитків документа та веб-джерел"]
`
  },
  {
    id: 'diagram_ooxml_processing',
    title: 'Конвеєр збереження форматування Microsoft Word (OOXML)',
    mermaid: `
flowchart TD
    OrigDoc["Вихідний файл .docx (ZIP/OOXML)"] --> Parse["Mammoth / JSZip розпакування"]
    Parse --> TwoStreams["Два синхронізованих представлення"]
    TwoStreams --> PlainText["Plain Text: пошук запозичень та стилометрія"]
    TwoStreams --> OOXMLDoc["word/document.xml: збереження початкової розмітки"]
    PlainText --> HumanizerMod["Стилістичний редактор: генерація правок"]
    HumanizerMod --> Alignment["textAlignment: зіставлення токенів і вузлів"]
    Alignment --> Inject["Ін'єкція замінених токенів у вузли w:t оригіналу"]
    OOXMLDoc --> Inject
    Inject --> Pack["JSZip запакування з вихідними стилями, шрифтами й таблицями"]
    Pack --> ResultDoc["Готовий .docx файл з повним збереженням оформлення"]
`
  }
];

async function main() {
  const outDir = path.resolve('docs/diagrams');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2.0
  });

  for (const diag of diagrams) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #ffffff;
      padding: 30px;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .mermaid {
      background: #ffffff;
      padding: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="mermaid">
    ${diag.mermaid}
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      flowchart: { curve: 'basis', htmlLabels: true }
    });
  </script>
</body>
</html>
`;
    await page.setContent(html);
    try {
      await page.waitForSelector('.mermaid svg', { timeout: 10000 });
      await page.waitForTimeout(1000);
      const svgEl = page.locator('.mermaid');
      const outPath = path.join(outDir, `${diag.id}.png`);
      await svgEl.screenshot({ path: outPath });
      console.log(`Rendered: ${diag.id}.png`);
    } catch (e) {
      console.error(`Failed to render ${diag.id}:`, e.message);
    }
  }

  await browser.close();
  console.log('All diagrams rendered!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
