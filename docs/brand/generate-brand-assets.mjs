import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const outDir = __dirname;
mkdirSync(outDir, { recursive: true });

const names = [
  {
    name: "Незбіг",
    latin: "NEZBIG",
    line: "Немає збігів. Є власний текст.",
    idea: "Найпряміша назва: сервіс шукає збіги, бренд обіцяє їхню відсутність.",
    accent: "#2ec4b6",
    dark: "#10201f",
    light: "#eefbf8",
    mark: "split"
  },
  {
    name: "Твірно",
    latin: "TVIRNO",
    line: "Твір + вірно: перевірка авторства.",
    idea: "М'якіша академічна назва для студентів, викладачів і документів.",
    accent: "#ffbe0b",
    dark: "#2b2412",
    light: "#fff8df",
    mark: "orbit"
  },
  {
    name: "Слідок",
    latin: "SLIDOK",
    line: "Знайти слід, не звинуватити автора.",
    idea: "Форензичний характер: сервіс акуратно показує джерела і текстові сліди.",
    accent: "#ff5d73",
    dark: "#28151a",
    light: "#fff1f3",
    mark: "finger"
  }
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function markSvg(item, x, y) {
  if (item.mark === "split") {
    return `
      <g transform="translate(${x} ${y})">
        <rect x="0" y="0" width="132" height="132" rx="28" fill="${item.dark}"/>
        <path d="M31 38h50c21 0 34 12 34 28s-13 28-34 28H31" fill="none" stroke="${item.light}" stroke-width="12" stroke-linecap="round"/>
        <path d="M42 66h72" stroke="${item.accent}" stroke-width="12" stroke-linecap="round"/>
        <path d="M65 28v76" stroke="${item.accent}" stroke-width="9" stroke-linecap="round"/>
        <circle cx="66" cy="66" r="14" fill="${item.dark}" stroke="${item.light}" stroke-width="8"/>
      </g>`;
  }
  if (item.mark === "orbit") {
    return `
      <g transform="translate(${x} ${y})">
        <rect x="0" y="0" width="132" height="132" rx="28" fill="${item.dark}"/>
        <path d="M34 73c17-45 47-57 72-35 19 17 12 48-13 60-31 15-61-5-57-32" fill="none" stroke="${item.light}" stroke-width="10" stroke-linecap="round"/>
        <path d="M43 70h47" stroke="${item.accent}" stroke-width="11" stroke-linecap="round"/>
        <circle cx="95" cy="38" r="12" fill="${item.accent}"/>
        <circle cx="42" cy="92" r="7" fill="${item.light}"/>
      </g>`;
  }
  return `
    <g transform="translate(${x} ${y})">
      <rect x="0" y="0" width="132" height="132" rx="28" fill="${item.dark}"/>
      <path d="M38 92c0-32 7-54 28-54 21 0 28 22 28 54" fill="none" stroke="${item.light}" stroke-width="10" stroke-linecap="round"/>
      <path d="M66 38v56" stroke="${item.accent}" stroke-width="10" stroke-linecap="round"/>
      <path d="M45 74c15 7 27 7 42 0" fill="none" stroke="${item.accent}" stroke-width="9" stroke-linecap="round"/>
      <circle cx="66" cy="38" r="13" fill="${item.dark}" stroke="${item.light}" stroke-width="8"/>
    </g>`;
}

function card(item, i) {
  const x = 92 + i * 420;
  const y = 238;
  return `
    <g>
      <rect x="${x}" y="${y}" width="360" height="510" rx="22" fill="#fbf7ed" stroke="#1f2726" stroke-opacity=".16"/>
      ${markSvg(item, x + 42, y + 42)}
      <text x="${x + 42}" y="${y + 234}" class="brand" fill="#111817">${esc(item.name)}</text>
      <text x="${x + 45}" y="${y + 274}" class="latin" fill="#53615f">${esc(item.latin)}</text>
      <line x1="${x + 42}" y1="${y + 310}" x2="${x + 318}" y2="${y + 310}" stroke="${item.accent}" stroke-width="5" stroke-linecap="round"/>
      <text x="${x + 42}" y="${y + 354}" class="line" fill="#111817">${esc(item.line)}</text>
      <foreignObject x="${x + 42}" y="${y + 382}" width="276" height="96">
        <div xmlns="http://www.w3.org/1999/xhtml" class="body">${esc(item.idea)}</div>
      </foreignObject>
      <g transform="translate(${x + 42} ${y + 462})">
        <circle cx="16" cy="16" r="16" fill="${item.dark}"/>
        <circle cx="58" cy="16" r="16" fill="${item.accent}"/>
        <circle cx="100" cy="16" r="16" fill="${item.light}" stroke="#1f2726" stroke-opacity=".16"/>
      </g>
    </g>`;
}

const boardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">
  <defs>
    <style>
      .kicker { font: 700 16px Georgia, serif; letter-spacing: .22em; }
      .title { font: 900 78px Georgia, serif; letter-spacing: 0; }
      .sub { font: 500 20px "Segoe UI", Arial, sans-serif; }
      .brand { font: 900 64px Georgia, serif; letter-spacing: 0; }
      .latin { font: 800 15px "Segoe UI", Arial, sans-serif; letter-spacing: .28em; }
      .line { font: 760 20px "Segoe UI", Arial, sans-serif; }
      .body { color: #53615f; font: 500 17px/1.45 "Segoe UI", Arial, sans-serif; }
      .note { font: 600 17px "Segoe UI", Arial, sans-serif; }
    </style>
  </defs>
  <rect width="1440" height="900" fill="#ebe4d4"/>
  <path d="M0 0h1440v164H0z" fill="#111817"/>
  <path d="M0 164c211 62 361 25 548 12 252-18 476 66 892 6v718H0z" fill="#ebe4d4"/>
  <text x="92" y="70" class="kicker" fill="#2ec4b6">FREE ANTIPLAGIARISM IDENTITY EXPLORATION</text>
  <text x="92" y="136" class="title" fill="#fbf7ed">Назва та логотип</text>
  <text x="792" y="95" class="sub" fill="#cbd7d4">3 короткі напрями для сервісу перевірки оригінальності тексту</text>
  ${names.map(card).join("\n")}
  <text x="92" y="820" class="note" fill="#111817">Рекомендація: “Незбіг” — найкоротше пояснює користь сервісу і добре працює як український бренд.</text>
  <text x="92" y="852" class="note" fill="#53615f">SVG побудований з векторних форм: його можна перетягнути у Figma та редагувати кольори, текст і композицію.</text>
</svg>`;

const standaloneSvgs = names.map((item) => {
  return {
    file: `${item.latin.toLowerCase()}-logo.svg`,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260" viewBox="0 0 640 260">
  <defs>
    <style>
      .brand { font: 900 76px Georgia, serif; letter-spacing: 0; }
      .latin { font: 800 15px "Segoe UI", Arial, sans-serif; letter-spacing: .28em; }
      .tag { font: 600 21px "Segoe UI", Arial, sans-serif; }
    </style>
  </defs>
  <rect width="640" height="260" fill="#fbf7ed"/>
  ${markSvg(item, 52, 64)}
  <text x="218" y="125" class="brand" fill="#111817">${esc(item.name)}</text>
  <text x="222" y="158" class="latin" fill="#53615f">${esc(item.latin)}</text>
  <path d="M222 184h282" stroke="${item.accent}" stroke-width="5" stroke-linecap="round"/>
  <text x="222" y="220" class="tag" fill="#53615f">${esc(item.line)}</text>
</svg>`
  };
});

const html = `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AntiPlagiarism Brand Concepts</title>
    <style>
      body { margin: 0; background: #1b201f; color: #fbf7ed; font-family: "Segoe UI", Arial, sans-serif; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
      img { width: min(100%, 1440px); height: auto; box-shadow: 0 36px 120px rgba(0,0,0,.35); border-radius: 14px; }
    </style>
  </head>
  <body>
    <main>
      <img src="./brand-board.svg" alt="Brand concepts for antiplagiarism project" />
    </main>
  </body>
</html>`;

const philosophy = `# Візуальна філософія: Forensic Warmth

Ця айдентика поєднує точність текстової експертизи з людяним відчуттям підтримки. Вона не має виглядати як каральний інструмент або холодний корпоративний сканер. Її форма говорить: ми уважно дивимось на текст, відділяємо власне від запозиченого і робимо результат зрозумілим. Простір має бути зібраним, майже лабораторним, але з теплим паперовим фоном, щоб сервіс відчувався доступним для студентів, авторів і викладачів.

Основна мова форми — розрив, слід, орбіта, лінія порівняння. Графіка будується з простих геометричних елементів, але кожен елемент має виглядати вивіреним: ніби знак довго шліфували, прибираючи зайве. Логотип не копіює очевидні символи галочки, щита або лупи; натомість показує саму дію перевірки: два фрагменти тексту зіставляються, одна лінія проходить крізь іншу, слід стає видимим.

Колір має працювати як система сигналів. Темний графіт дає довіру й серйозність, теплий папір прив'язує бренд до текстів і документів, а один яскравий акцент позначає момент знаходження збігу. У фінальному виконанні це має бути майстерно, чисто, з прискіпливою увагою до контрасту, відступів і масштабу. Жоден акцент не повинен випадати з композиції.

Типографіка коротка і впевнена. Назва — головний голос, підпис — тільки тихе пояснення. Українські літери мають бути перевагою бренду, не компромісом: знаки повинні виглядати так, ніби їх ретельно підібрали для локального освітнього продукту. Крафт важливий всюди: у кривих, у ритмі, у товщині штрихів, у тому, як знак тримається поруч із назвою.

Фінальний об'єкт має виглядати не як швидка генерація, а як бренд-дошка, над якою працював сильний дизайнер: стримана, пам'ятна, придатна для Figma, сайту, favicon, кнопки запуску перевірки та звіту PDF. Мінімум слів, максимум впізнаваної форми.`;

writeFileSync(join(outDir, "brand-board.svg"), boardSvg, "utf8");
writeFileSync(join(outDir, "brand-board.html"), html, "utf8");
writeFileSync(join(outDir, "visual-philosophy.md"), philosophy, "utf8");

for (const item of standaloneSvgs) {
  writeFileSync(join(outDir, item.file), item.svg, "utf8");
}

writeFileSync(
  join(outDir, "brand-summary.json"),
  JSON.stringify(
    {
      recommended: "Незбіг",
      concepts: names.map(({ name, latin, line, idea }) => ({ name, latin, line, idea })),
      figmaImport: "Drag brand-board.svg or any standalone logo SVG into Figma."
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Generated ${3 + standaloneSvgs.length} brand files in ${outDir}`);
