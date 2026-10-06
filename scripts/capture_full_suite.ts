import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  // 1. Visit live site and switch to Ukrainian if available
  await page.goto('https://nezbig.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Switch to UA if button exists
  const langBtn = page.locator('button:has-text("EN"), button:has-text("UA"), [aria-label*="мов"], [aria-label*="lang"]');
  if (await langBtn.count() > 0) {
    const text = await langBtn.first().innerText();
    if (text.includes('EN')) {
      await langBtn.first().click();
      await page.waitForTimeout(500);
      // If there is a dropdown or toggle
      const uaOption = page.locator('button:has-text("UA"), button:has-text("Українська")');
      if (await uaOption.count() > 0) {
        await uaOption.first().click();
        await page.waitForTimeout(500);
      }
    }
  }

  // Screenshot 1: Main page (UA)
  await page.screenshot({ path: path.join(outDir, '01_main_page_ua.png') });

  // Screenshot 2: Sensitivity settings
  const deepRadio = page.locator('text=Deep Analysis, text=Глибокий аналіз').first();
  if (await deepRadio.count() > 0) {
    await deepRadio.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(outDir, '02_settings_ua.png') });

  // 2. Humanizer page
  await page.goto('https://nezbig.vercel.app/humanize', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '03_humanizer_page.png') });

  // Test humanizing a sample text
  const humanizeSample = `Слід зазначити, що штучний інтелект є надзвичайно важливим інструментом сучасності. Дослідження показують, що в сучасному світі автоматизація відіграє ключову роль у підвищенні ефективності обробки текстових даних. Можна стверджувати, що подальший розвиток технологій відкриває безпрецедентні можливості.`;
  const humanizeInput = page.locator('[contenteditable], textarea').first();
  if (await humanizeInput.count() > 0) {
    await humanizeInput.fill(humanizeSample);
    await page.waitForTimeout(500);
    const humanizeSubmit = page.locator('button:has-text("Humanize"), button:has-text("Редагувати"), button:has-text("Очистити стиль")').first();
    if (await humanizeSubmit.count() > 0 && await humanizeSubmit.isEnabled()) {
      await humanizeSubmit.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(outDir, '04_humanizer_diff_result.png') });
    }
  }

  // 3. History page
  await page.goto('https://nezbig.vercel.app/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '05_history_page.png') });

  // 4. Report View - route mock for rich complete report visualization
  console.log('Generating rich report screenshot via mock route...');
  await page.route('/api/scan/jobs', async route => {
    await route.fulfill({ json: { jobId: 'demo-job-1' } });
  });

  await page.route('/api/scan-status/demo-job-1', async route => {
    await route.fulfill({
      json: {
        status: 'completed',
        result: {
          id: 'rep-demo-diploma-2026',
          fileName: 'Дипломна_робота_Магістр_ШІ.docx',
          checkedAt: new Date().toISOString(),
          wordCount: 8420,
          chunksChecked: 68,
          plagiarismScore: 18,
          aiProbability: 14,
          aiVerdict: 'low',
          aiReliability: { score: 94, level: 'high', reason: 'Висока репрезентативність вибірки та узгодженість стилометричних метрик', segmentCount: 42, segmentSpread: 6 },
          aiLanguage: { code: 'uk', supportedPercent: 100 },
          aiExclusions: { codeWords: 340, referenceWords: 810, quotedWords: 190, analyzedWords: 7080 },
          aiSuspiciousSegments: [
            { text: 'Сучасні нейромережеві моделі забезпечують високу швидкість обробки природної мови завдяки механізмам уваги...', score: 48, startWord: 120, endWord: 165 },
            { text: 'Для побудови відбитків документів застосовується алгоритм winnowing з плаваючим вікном фінгерпринтів...', score: 32, startWord: 840, endWord: 890 }
          ],
          aiProvider: 'local',
          scanNotes: ['Успішно перевірено за індексами DuckDuckGo, Google Scholar, Semantic Scholar та OpenAlex.'],
          searchDiagnostics: {
            providers: [
              { name: 'DuckDuckGo', queriesCount: 68, successCount: 68, errorCount: 0, timeoutCount: 0, latencyMs: 240 },
              { name: 'Semantic Scholar', queriesCount: 34, successCount: 34, errorCount: 0, timeoutCount: 0, latencyMs: 310 },
              { name: 'OpenAlex', queriesCount: 22, successCount: 22, errorCount: 0, timeoutCount: 0, latencyMs: 195 }
            ],
            pages: { attempted: 54, verified: 48, unavailable: 6, cacheHits: 18, negativeCacheHits: 2 }
          },
          matches: [
            {
              url: 'https://uk.wikipedia.org/wiki/Обробка_природної_мови',
              title: 'Обробка природної мови — Вікіпедія',
              score: 84,
              confidence: 'page',
              longestRun: 18,
              matchedSnippet: 'Обробка природної мови — загальний напрям штучного інтелекту та прикладної лінгвістики, який досліджує проблеми комп’ютерного аналізу та синтезу природної мови.'
            },
            {
              url: 'https://ieeexplore.ieee.org/document/winnowing-fingerprinting',
              title: 'Winnowing: Local Algorithms for Document Fingerprinting',
              score: 62,
              confidence: 'page',
              longestRun: 12,
              matchedSnippet: 'Winnowing selects the minimum hash value in every window of hashes to produce robust document fingerprints.'
            },
            {
              url: 'https://aclanthology.org/2024.acl-long.674/',
              title: 'RAID: A Shared Benchmark for Robust Evaluation of Machine-Generated Text Detectors',
              score: 55,
              confidence: 'page',
              longestRun: 9,
              matchedSnippet: 'RAID evaluates text detectors across multiple domains, generators, and adversarial attacks.'
            }
          ],
          aiSignals: [
            { name: 'Лексична різноманітність (MATTR)', value: '0.78 (Норма)', category: 'statistical', weight: 0.38 },
            { name: 'Варіація довжини речень (Burstiness CV)', value: '0.64 (Природний ритм)', category: 'statistical', weight: 0.35 },
            { name: 'Шаблонні LLM-формули', value: 'Низька частота (0.04)', category: 'pattern', weight: 0.20 },
            { name: 'Синтаксична симетрія', value: 'Асиметрична структура', category: 'structure', weight: 0.15 }
          ],
          summary: 'Документ має високий рівень оригінальності. Виявлено локальні коректні цитування наукових джерел. Стилометричні показники відповідають самостійно написаному академічному тексту.'
        }
      }
    });
  });

  await page.route('/api/ai-opinion', async route => {
    await route.fulfill({
      json: {
        aiProbability: 12,
        aiModel: 'Meta Llama 3.3 70B Instruct (OpenRouter)',
        aiNote: 'Текст демонструє характерні ознаки авторського наукового стилю, індивідуальну логіку аргументації та складні граматичні конструкції, нетипові для шаблонної генерації.',
        aiSignals: ['Природне використання спеціальної термінології', 'Відсутність штучних переходів']
      }
    });
  });

  await page.goto('https://nezbig.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const inputArea = page.locator('[contenteditable], textarea').first();
  await inputArea.fill('Це розширений демонстраційний текст академічної роботи з інженерії програмного забезпечення для повної візуалізації звіту перевірки системи Незбіг. '.repeat(10));
  await page.waitForTimeout(500);

  const scanBtn = page.locator('button[type="submit"], button:has-text("Run Plagiarism Scan"), button:has-text("Перевірити")').first();
  if (await scanBtn.count() > 0) {
    await scanBtn.click();
    console.log('Waiting for report to render...');
    await page.waitForSelector('.report, .metrics, article', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Screenshot of top report view (Metrics & Verdict)
    await page.screenshot({ path: path.join(outDir, '06_report_metrics_verdict.png') });

    // Scroll down to see matches & diagnostics
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '07_report_matches_sources.png') });

    // Scroll further down for diagnostics & ai signals
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '08_report_ai_signals_diagnostics.png') });
  }

  await browser.close();
  console.log('All detailed screenshots captured!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
