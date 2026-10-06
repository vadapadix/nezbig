import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // Block third-party ad network scripts from injecting overlays during tests
  await context.route(/(heeddialscary|effectivecpmnetwork|workdeadlinededicate)/, route => route.abort());
});

test('has title and brand lockup', async ({ page }) => {
  await page.goto('/');

  // Check the title
  await expect(page).toHaveTitle(/Nezbig|Незбіг/i);

  // Check the brand logo and name
  const brand = page.locator('nav').getByText(/НЕЗБІГ|NEZBIG/i).first();
  await expect(brand).toBeVisible();

  // Check navigation links
  await expect(page.locator('nav a[href="/"]').first()).toBeVisible();
  await expect(page.locator('nav a[href="/humanize"]').first()).toBeVisible();
});

test('can type text and see the live word counter and controls', async ({ page }) => {
  await page.goto('/');

  // Type enough text to exceed the word minimum
  const editor = page.locator('[contenteditable]');
  await editor.fill('Це тестовий документ для перевірки на плагіат, який не містить жодного сенсу і був згенерований випадково. Додаткові слова щоб зробити текст трохи довшим і дозволити системі увімкнути кнопку перевірки на плагіат.');

  // Check that word counter updates
  const counter = page.locator('.word-counter');
  await expect(counter).toContainText(/слів|words/i);

  // Check that the scan CTA button becomes enabled
  const submitButton = page.locator('.cta-main');
  await expect(submitButton).toBeEnabled();

  // Check sensitivity modes
  const balancedMode = page.locator('input[type="radio"][name="check_mode"]').nth(1);
  await expect(balancedMode).toBeChecked();
});

test('full scan flow with mock API and return to editor', async ({ page }) => {
  // Mock the scan endpoints
  await page.route('/api/scan/jobs', async route => {
    const json = { jobId: 'mocked-job-id' };
    await route.fulfill({ json });
  });

  await page.route('/api/scan-status/mocked-job-id', async route => {
    const json = {
      status: 'completed',
      result: {
        id: 'mocked-report-id',
        fileName: 'Вставлений текст',
        checkedAt: new Date().toISOString(),
        wordCount: 120,
        chunksChecked: 1,
        plagiarismScore: 45,
        aiProbability: 10,
        aiVerdict: 'low',
        aiReliability: { score: 90, level: 'high', reason: '', segmentCount: 1, segmentSpread: 0 },
        aiLanguage: { code: 'uk', supportedPercent: 100 },
        aiExclusions: { codeWords: 0, referenceWords: 0, quotedWords: 0, analyzedWords: 120 },
        aiSuspiciousSegments: [],
        aiProvider: 'local',
        scanNotes: [],
        searchDiagnostics: { providers: [], pages: { attempted: 0, verified: 0, unavailable: 0, cacheHits: 0, negativeCacheHits: 0 } },
        matches: [],
        aiSignals: [],
        summary: 'Оригінальний текст.'
      }
    };
    await route.fulfill({ json });
  });

  await page.route('/api/ai-opinion', async route => {
    await route.fulfill({
      json: {
        aiProbability: 12,
        aiModel: 'Mocked LLM',
        aiNote: '',
        aiSignals: []
      }
    });
  });

  await page.goto('/');

  // Type text
  const longText = 'Цей текст достатньо довгий, щоб запустити перевірку. '.repeat(15);
  await page.locator('[contenteditable]').fill(longText);

  // Click submit
  await page.locator('.cta-main').click();

  // Check report summary visibility
  const reportSection = page.locator('.report');
  await expect(reportSection).toBeVisible({ timeout: 10000 });
  
  const plagiarismScore = page.locator('.metrics article:first-child strong');
  await expect(plagiarismScore).toHaveText('45%');

  // Back to editor button
  const backBtn = page.getByRole('button', { name: /повернутись до редактора|back to editor/i }).first();
  await expect(backBtn).toBeVisible();
  await backBtn.click();

  // Editor is visible again
  await expect(page.locator('[contenteditable]')).toBeVisible();
});

test('humanize page loads, selects modes, and accepts text', async ({ page }) => {
  await page.goto('/humanize');

  // Verify heading
  await expect(page.locator('h1')).toContainText(/олюднення|humanize/i);

  // Mode selectors work
  const naturalModeBtn = page.getByRole('button', { name: /природний|natural/i });
  await expect(naturalModeBtn).toBeVisible();
  await naturalModeBtn.click();

  // Typing in humanizer editor
  const humanizeEditor = page.locator('[contenteditable]');
  await expect(humanizeEditor).toBeVisible();
  await humanizeEditor.fill('Текст для тестування олюднювача наукового та природного стилю. '.repeat(6));

  // Humanize button is present
  const humanizeBtn = page.getByRole('button', { name: /покращити|humanize/i });
  await expect(humanizeBtn).toBeVisible();
});

test('history page loads and shows status', async ({ page }) => {
  await page.goto('/history');

  // Verify heading
  await expect(page.locator('h1')).toContainText(/історія|history/i);
});

test('language switcher toggles between Ukrainian and English', async ({ page }) => {
  await page.goto('/');

  const langBtn = page.locator('nav').locator('button:has-text("UA"), button:has-text("EN")');
  await expect(langBtn).toBeVisible();

  // Capture initial CTA text
  const initialText = await page.locator('.cta-main').innerText();

  // Click to switch language
  await langBtn.click();
  const switchedText = await page.locator('.cta-main').innerText();
  expect(switchedText).not.toBe(initialText);

  // Switch back
  await langBtn.click();
  const restoredText = await page.locator('.cta-main').innerText();
  expect(restoredText).toBe(initialText);
});

test('auth modal opens, switches tabs, toggles password visibility, and closes on Escape', async ({ page }) => {
  await page.goto('/');

  const signInBtn = page.locator('nav button.signin-btn, nav button:has-text("Увійти"), nav button:has-text("Sign In")').first();
  await expect(signInBtn).toBeVisible();
  await signInBtn.click();

  // Modal is visible
  const modal = page.locator('div.fixed');
  await expect(modal).toBeVisible();

  // Check tab switcher inside modal
  const registerTab = modal.locator('button:has-text("Реєстрація"), button:has-text("Register")');
  await expect(registerTab).toBeVisible();
  await registerTab.click();

  // Name input should appear in register mode
  await expect(modal.locator('input[placeholder*="ім\'я"], input[placeholder*="Name"]')).toBeVisible();

  // Switch back to Login inside modal
  const loginTab = modal.locator('button:has-text("Вхід"), button:has-text("Sign In")');
  await loginTab.click();

  // Toggle password visibility
  const passwordInput = modal.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible();
  await passwordInput.fill('secretpassword');

  const toggleBtn = modal.locator('button[aria-label*="password"], button[title*="пароль"]').first();
  await toggleBtn.click();
  await expect(modal.locator('input[value="secretpassword"]')).toHaveAttribute('type', 'text');

  // Press Escape to close
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
});

test('feedback modal opens from footer and closes on Escape', async ({ page }) => {
  await page.goto('/');

  // Scroll to footer and click report bug
  const reportBugBtn = page.getByRole('button', { name: /повідомити про помилку|report/i });
  await reportBugBtn.scrollIntoViewIfNeeded();
  await expect(reportBugBtn).toBeVisible();
  await reportBugBtn.click();

  // Modal appears
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();

  // Press Escape to close
  await page.keyboard.press('Escape');
  await expect(textarea).not.toBeVisible();
});

test('humanizer transfers revised text directly into plagiarism checker', async ({ page }) => {
  // Mock humanize endpoint
  await page.route('/api/humanize', async route => {
    await route.fulfill({
      json: {
        revisedText: 'Це повністю перевірений та олюднений варіант тексту без штучних мовних шаблонів.',
        revisedHtml: '<p>Це повністю перевірений та олюднений варіант тексту без штучних мовних шаблонів.</p>',
        mode: 'academic',
        originalWordCount: 25,
        revisedWordCount: 15,
        aiScoreBefore: 88,
        aiScoreAfter: 8,
        changes: [{ label: 'Пасивний стан', count: 2, detail: 'Перетворено на активні форми' }],
        notes: ['Стиль узгоджено']
      }
    });
  });

  await page.goto('/humanize');

  // Fill text with at least 20 words
  const editor = page.locator('[contenteditable]');
  await editor.fill('Текст для олюднення який містить пасивні конструкції та шаблонні мовні звороти для ретельної перевірки алгоритму стильового редагування та адаптації тону мовлення.');

  // Click humanize
  const humanizeBtn = page.getByRole('button', { name: /покращити|humanize/i });
  await expect(humanizeBtn).toBeEnabled();
  await humanizeBtn.click();

  // Result panel should appear
  await expect(page.locator('#humanizer-title')).toBeVisible({ timeout: 5000 });

  // Click transfer to checker
  const transferBtn = page.getByRole('button', { name: /перенести в перевірку|run plagiarism scan/i });
  await expect(transferBtn).toBeVisible();
  await transferBtn.click();

  // Home page URL and editor content updated
  await expect(page).toHaveURL(/\/$/);
  const homeEditor = page.locator('[contenteditable]');
  await expect(homeEditor).toBeVisible();
  await expect(homeEditor).toContainText('олюднений варіант тексту');
});

