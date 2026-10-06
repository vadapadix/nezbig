import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function capture() {
  const outDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  console.log('Navigating to live site...');
  await page.goto('https://nezbig.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. Home page
  console.log('Capturing home page...');
  await page.screenshot({ path: path.join(outDir, '01_home_main.png'), fullPage: false });

  // 2. Scan settings / deep settings
  console.log('Checking for settings button or accordion...');
  const settingsBtn = page.locator('button:has-text("Параметри"), button:has-text("Налаштування"), button[aria-label*="параметр"], button[aria-label*="навал"]');
  if (await settingsBtn.count() > 0) {
    try {
      await settingsBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, '02_scan_settings.png') });
    } catch (e) {
      console.log('Could not click settings:', e.message);
    }
  }

  // 3. Humanize page
  console.log('Navigating to humanize page...');
  try {
    await page.goto('https://nezbig.vercel.app/humanize', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '03_humanize_page.png') });
  } catch (e) {
    console.log('Could not open /humanize:', e.message);
  }

  // 4. History page
  console.log('Navigating to history page...');
  try {
    await page.goto('https://nezbig.vercel.app/history', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, '04_history_page.png') });
  } catch (e) {
    console.log('Could not open /history:', e.message);
  }

  // 5. Perform a mock or sample scan to capture full report view
  console.log('Navigating back to home for sample scan...');
  await page.goto('https://nezbig.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const sampleText = `Штучний інтелект (ШІ) — це розділ комп'ютерних наук, який займається створенням інтелектуальних машин, здатних виконувати завдання, які зазвичай вимагають людського інтелекту. Сучасні методи машинного навчання та обробки природної мови дозволяють аналізувати великі обсяги текстових даних та виявляти складні патерни у семантичній структурі документів. Важливим аспектом академічної доброчесності є запобігання плагіату та несанкціонованому використанню згенерованого контенту у студентських роботах і наукових публікаціях. Застосування алгоритмів n-грамного порівняння та winnowing-хешування забезпечує швидкий та стійкий пошук тексту.`;

  const editor = page.locator('[contenteditable], textarea').first();
  if (await editor.count() > 0) {
    await editor.fill(sampleText);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, '05_text_entered.png') });

    // Look for submit button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Перевірити")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isEnabled()) {
      console.log('Submitting scan...');
      await submitBtn.click();
      // wait for report or progress
      try {
        await page.waitForSelector('.report, .metrics, .loading-panel', { timeout: 15000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(outDir, '06_scan_progress_or_report.png') });
        
        // Wait longer for report completion if still loading
        await page.waitForSelector('.report, .metrics, article', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(outDir, '07_scan_result.png') });
      } catch (e) {
        console.log('Scan wait timeout/error:', e.message);
        await page.screenshot({ path: path.join(outDir, '06_scan_state.png') });
      }
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully in', outDir);
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
