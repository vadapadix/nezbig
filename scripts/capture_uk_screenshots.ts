import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function main() {
  const outDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1.5,
  });

  // Force Ukrainian language in localStorage for all pages
  await context.addInitScript(() => {
    localStorage.setItem('nezbig_lang', 'uk');
  });

  const page = await context.newPage();

  // 1. Visit main page and ensure Ukrainian
  console.log('1. Capturing main page (UA)...');
  await page.goto('https://nezbig.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // If language is still EN, explicitly click language switcher
  const langBtn = page.locator('button:has-text("EN"), button:has-text("UA")');
  if (await langBtn.count() > 0) {
    const text = await langBtn.first().innerText();
    if (text.includes('EN')) {
      await langBtn.first().click();
      await page.waitForTimeout(500);
      const uaBtn = page.locator('button:has-text("UA"), button:has-text("Українська")').first();
      if (await uaBtn.count() > 0) {
        await uaBtn.click();
        await page.waitForTimeout(800);
      }
    }
  }

  await page.screenshot({ path: path.join(outDir, '01_main_page_ua.png') });
  console.log('Saved 01_main_page_ua.png');

  // 2. Settings Panel (UA)
  console.log('2. Capturing settings panel (UA)...');
  const deepRadio = page.locator('text=Глибоко, text=Deep Analysis').first();
  if (await deepRadio.count() > 0) {
    await deepRadio.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(outDir, '02_settings_ua.png') });
  console.log('Saved 02_settings_ua.png');

  // 3. Humanizer Page (UA)
  console.log('3. Capturing humanizer page (UA)...');
  await page.goto('https://nezbig.vercel.app/humanize', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '03_humanizer_page.png') });
  console.log('Saved 03_humanizer_page.png');

  // 4. Humanizer with Result & Diff (Mock API)
  console.log('4. Capturing humanizer result diff (UA)...');
  await page.route('**/api/humanize', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: {
        originalWordCount: 42,
        revisedWordCount: 38,
        revisedText: 'Використання штучного інтелекту суттєво оптимізує сучасні дослідницькі процеси. Автоматизація безпосередньо прискорює аналіз великих масивів текстових даних. Розвиток нейромережевих інструментів створює практичні передумови для якісного масштабування наукових розробок.',
        revisedHtml: '<p>Використання штучного інтелекту суттєво оптимізує сучасні дослідницькі процеси. Автоматизація безпосередньо прискорює аналіз великих масивів текстових даних. Розвиток нейромережевих інструментів створює практичні передумови для якісного масштабування наукових розробок.</p>',
        aiScoreBefore: 88,
        aiScoreAfter: 14,
        mode: 'academic',
        changes: [
          { label: 'Усунення мовних кліше', count: 3, detail: 'Вилучено «Слід зазначити», «Дослідження показують», «Можна стверджувати»', category: 'cliche' },
          { label: 'Регулювання темпоритму', count: 4, detail: 'Коефіцієнт варіації довжини речень оптимізовано (CV = 0.68)', category: 'pacing' },
          { label: 'Активний стан дієслів', count: 2, detail: 'Пасивні конструкції перетворено на суб’єктний активний стан', category: 'syntax' }
        ],
        notes: [
          'Усунуто вступні мовні кліше («Слід зазначити», «Дослідження показують», «Можна стверджувати»).',
          'Нормалізовано темпоритм (коефіцієнт варіації довжини речень зріс до природного академічного рівня).',
          'Синтаксичні пасивні конструкції замінено на прямий академічний активний стан.'
        ]
      }
    });
  });

  const humanizeInput = page.locator('[contenteditable], textarea').first();
  if (await humanizeInput.count() > 0) {
    await humanizeInput.fill('Слід зазначити, що штучний інтелект є надзвичайно важливим інструментом сучасності. Дослідження показують, що автоматизація відіграє ключову роль у підвищенні ефективності обробки текстових даних. Можна стверджувати, що подальший розвиток технологій відкриває безпрецедентні можливості для наукових досліджень.');
    await page.waitForTimeout(400);
    const humanizeBtn = page.locator('button:has-text("Олюднити"), button:has-text("Humanize")').first();
    if (await humanizeBtn.count() > 0 && await humanizeBtn.isEnabled()) {
      await humanizeBtn.click();
      await page.waitForTimeout(3000);
      // Scroll down to display HumanizePanel
      await page.evaluate(() => window.scrollBy(0, 450));
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, '04_humanizer_diff_result.png') });
      console.log('Saved 04_humanizer_diff_result.png');
    }
  }

  // 5. History Page (UA)
  console.log('5. Capturing history page (UA)...');
  await page.goto('https://nezbig.vercel.app/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '05_history_page.png') });
  console.log('Saved 05_history_page.png');

  // 6. Report View with Rich Mock Data (UA)
  console.log('6. Setting up rich report mock (UA)...');
  await page.goto('https://nezbig.vercel.app/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const inputArea = page.locator('[contenteditable], textarea').first();
  await inputArea.fill('Дослідження архітектури та алгоритмів інтелектуальної системи аналізу тексту Незбіг з багатопровайдерним пошуком Tavily та Serper. '.repeat(10));
  await page.waitForTimeout(500);

  const scanBtn = page.locator('button[type="submit"], button:has-text("Запустити перевірку"), button:has-text("Run Plagiarism Scan")').first();
  if (await scanBtn.count() > 0) {
    await scanBtn.click();
    console.log('Waiting for report to render...');
    await page.waitForSelector('.report', { timeout: 25000 });
    await page.waitForTimeout(2000);

    // 6. Report Top Hero Dashboard (Metrics, Verdict, Uncertainty band)
    console.log('Capturing 06_report_metrics_verdict.png...');
    await page.screenshot({ path: path.join(outDir, '06_report_metrics_verdict.png') });
    console.log('Saved 06_report_metrics_verdict.png');

    // 7. Report Sources & Matches Tab
    console.log('Capturing 07_report_matches_sources.png...');
    const sourcesTab = page.locator('button:has-text("Джерела та збіги"), button:has-text("Sources & Matches")').first();
    if (await sourcesTab.count() > 0) {
      await sourcesTab.click();
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollBy(0, 520));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '07_report_matches_sources.png') });
    console.log('Saved 07_report_matches_sources.png');

    // 8. Report AI Signals & Analysis Tab
    console.log('Capturing 08_report_ai_signals_diagnostics.png...');
    const aiTab = page.locator('button:has-text("Аналіз ШІ та AI-думка"), button:has-text("AI Analysis")').first();
    if (await aiTab.count() > 0) {
      await aiTab.click();
      await page.waitForTimeout(800);
    }
    await page.evaluate(() => window.scrollBy(0, 250));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '08_report_ai_signals_diagnostics.png') });
    console.log('Saved 08_report_ai_signals_diagnostics.png');

    // 9. Report Technical Diagnostics Tab (Providers: Tavily, Serper, etc.)
    console.log('Capturing 09_report_diagnostics_ua.png...');
    const techTab = page.locator('button:has-text("Додаткові відомості"), button:has-text("Technical Details")').first();
    if (await techTab.count() > 0) {
      await techTab.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, '09_report_diagnostics_ua.png') });
      console.log('Saved 09_report_diagnostics_ua.png');
    }
  }

  await browser.close();
  console.log('ALL UKRAINIAN SCREENSHOTS SUCCESSFULLY CAPTURED!');
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
