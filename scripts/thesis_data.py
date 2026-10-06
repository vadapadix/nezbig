# -*- coding: utf-8 -*-
"""
Thesis Front Matter: Title Page, Assignment, Academic Integrity, Abstracts, TOC, Abbreviations
"""

from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

def add_title_page(doc):
    # Header institution info
    p = doc.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.first_line_indent = Cm(0)
    
    r = p.add_run("МІНІСТЕРСТВО ОСВІТИ І НАУКИ УКРАЇНИ\n")
    r.font.name = 'Times New Roman'
    r.font.size = Pt(12)
    r.font.bold = True
    
    r2 = p.add_run("ВСЕУКРАЇНСЬКА ЦЕНТРАЛЬНА СПІЛКА СПОЖИВЧИХ ТОВАРИСТВ\nУКРКООПСПІЛКА\nРІВНЕНСЬКИЙ КООПЕРАТИВНИЙ ЕКОНОМІКО-ПРАВОВИЙ ФАХОВИЙ КОЛЕДЖ\n")
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(11)
    r2.font.bold = True
    
    p_dep = doc.add_paragraph()
    p_dep.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dep.paragraph_format.line_spacing = 1.15
    p_dep.paragraph_format.space_before = Pt(4)
    p_dep.paragraph_format.space_after = Pt(24)
    p_dep.paragraph_format.first_line_indent = Cm(0)
    
    r_dep = p_dep.add_run("Циклова комісія комп'ютерних технологій та інженерії програмного забезпечення\nСпеціальність 121 «Інженерія програмного забезпечення»")
    r_dep.font.name = 'Times New Roman'
    r_dep.font.size = Pt(12)
    
    # Thesis Title Label
    p_type = doc.add_paragraph()
    p_type.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_type.paragraph_format.space_before = Pt(36)
    p_type.paragraph_format.space_after = Pt(8)
    p_type.paragraph_format.first_line_indent = Cm(0)
    
    r_type = p_type.add_run("ДИПЛОМНА РОБОТА")
    r_type.font.name = 'Times New Roman'
    r_type.font.size = Pt(18)
    r_type.font.bold = True
    
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    p_sub.paragraph_format.first_line_indent = Cm(0)
    r_sub = p_sub.add_run("на здобуття освітньо-професійного ступеня фахового молодшого бакалавра")
    r_sub.font.name = 'Times New Roman'
    r_sub.font.size = Pt(12)
    r_sub.font.italic = True
    
    p_theme_lbl = doc.add_paragraph()
    p_theme_lbl.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_theme_lbl.paragraph_format.space_before = Pt(8)
    p_theme_lbl.paragraph_format.space_after = Pt(4)
    p_theme_lbl.paragraph_format.first_line_indent = Cm(0)
    r_lbl = p_theme_lbl.add_run("на тему:")
    r_lbl.font.name = 'Times New Roman'
    r_lbl.font.size = Pt(13)
    
    p_theme = doc.add_paragraph()
    p_theme.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_theme.paragraph_format.line_spacing = 1.3
    p_theme.paragraph_format.space_before = Pt(4)
    p_theme.paragraph_format.space_after = Pt(48)
    p_theme.paragraph_format.first_line_indent = Cm(0)
    r_th = p_theme.add_run("«ПРОГРАМНА СИСТЕМА ІНТЕЛЕКТУАЛЬНОГО АНАЛІЗУ ТЕКСТОВИХ ДОКУМЕНТІВ ДЛЯ ВИЯВЛЕННЯ ЗАПОЗИЧЕНЬ ТА ШТУЧНО ЗГЕНЕРОВАНОГО КОНТЕНТУ» («НЕЗБІГ»)")
    r_th.font.name = 'Times New Roman'
    r_th.font.size = Pt(15)
    r_th.font.bold = True
    
    # Author & Supervisor block (right aligned / block)
    p_auth = doc.add_paragraph()
    p_auth.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p_auth.paragraph_format.line_spacing = 1.2
    p_auth.paragraph_format.space_before = Pt(24)
    p_auth.paragraph_format.space_after = Pt(0)
    p_auth.paragraph_format.first_line_indent = Cm(9.5)
    
    runs_auth = [
        ("Виконав: ", False), ("студент IV курсу, групи ІПЗ-41\n", False),
        ("спеціальності 121 «Інженерія програмного забезпечення»\n", False),
        ("Олександр ЧИРСЬКИЙ\n\n", True),
        ("Керівник: ", False), ("викладач вищої категорії,\n", False),
        ("викладач-методист\n", False),
        ("Світлана СЛИВКА\n\n", True),
        ("Рецензент: ", False), ("канд. техн. наук, доцент\n", False),
        ("О. В. КОВАЛЬЧУК", True)
    ]
    for txt, is_bold in runs_auth:
        r = p_auth.add_run(txt)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)
        r.font.bold = is_bold
        
    # City and year at the bottom
    p_city = doc.add_paragraph()
    p_city.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_city.paragraph_format.space_before = Pt(48)
    p_city.paragraph_format.space_after = Pt(0)
    p_city.paragraph_format.first_line_indent = Cm(0)
    r_city = p_city.add_run("Рівне — 2026")
    r_city.font.name = 'Times New Roman'
    r_city.font.size = Pt(13)
    r_city.font.bold = True

def add_assignment_sheet(doc):
    doc.add_page_break()
    p_top = doc.add_paragraph()
    p_top.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top.paragraph_format.space_after = Pt(12)
    p_top.paragraph_format.first_line_indent = Cm(0)
    r_app = p_top.add_run("ЗАТВЕРДЖУЮ\nГолова циклової комісії\nкомп'ютерних технологій та ІПЗ\n__________ Світлана СЛИВКА\n«____» _____________ 2026 р.")
    r_app.font.name = 'Times New Roman'
    r_app.font.size = Pt(11)
    
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(14)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ЗАВДАННЯ\nНА ДИПЛОМНУ РОБОТУ СТУДЕНТА")
    r_t.font.name = 'Times New Roman'
    r_t.font.size = Pt(14)
    r_t.font.bold = True
    
    p_stud = doc.add_paragraph()
    p_stud.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_stud.paragraph_format.line_spacing = 1.3
    p_stud.paragraph_format.first_line_indent = Cm(1.25)
    r_s = p_stud.add_run("1. Тема роботи: «Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту» («Незбіг»).\nКерівник роботи: викладач вищої категорії Сливка Світлана Володимирівна.\nЗатверджена наказом по коледжу від «15» січня 2026 р. № 12-с.\n2. Термін здачі студентом закінченої роботи: «20» травня 2026 р.\n3. Вихідні дані до роботи: наукові публікації з методів NLP та детекції згенерованого тексту; відкриті веб-індекси (DuckDuckGo, Google Search API, Semantic Scholar, OpenAlex); формати вхідних файлів DOCX (OOXML), PDF, TXT; сучасні веб-технології React 19, TypeScript, Node.js, Express, TailwindCSS; стандарти академічної доброчесності МОН України.\n4. Зміст розрахунково-пояснювальної записки (перелік питань, які підлягають розробці):\n  - Вступ;\n  - Розділ 1. Теоретичний аналіз предметної області та сучасних методів аналізу текстів;\n  - Розділ 2. Проєктування архітектури та алгоритмічного забезпечення системи «Незбіг»;\n  - Розділ 3. Програмна реалізація системи;\n  - Розділ 4. Експериментальні дослідження та оцінка ефективності системи;\n  - Загальні висновки;\n  - Список використаних джерел;\n  - Додатки.\n5. Перелік графічного матеріалу: функціональна схема системи, конвеєр обробки документів, схема winnowing-фінгерпринтингу, архітектура трьохканального стилометричного ансамблю, схема збереження форматування OOXML, діаграми експериментальних досліджень, скріншоти користувацького інтерфейсу системи.\n6. Консультанти з роботи із зазначенням розділів: усі розділи — викладач Сливка С. В.\n7. Дата видачі завдання: «16» січня 2026 р.")
    r_s.font.name = 'Times New Roman'
    r_s.font.size = Pt(12)
    
    p_cal = doc.add_paragraph()
    p_cal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cal.paragraph_format.space_before = Pt(8)
    p_cal.paragraph_format.space_after = Pt(4)
    p_cal.paragraph_format.first_line_indent = Cm(0)
    r_c = p_cal.add_run("КАЛЕНДАРНИЙ ПЛАН")
    r_c.font.name = 'Times New Roman'
    r_c.font.size = Pt(13)
    r_c.font.bold = True
    
    plan_headers = ["№", "Назва етапів дипломної роботи", "Термін виконання", "Відмітка про виконання"]
    plan_data = [
        ["1", "Аналіз предметної області, літературних джерел та аналогів", "16.01 – 05.02.2026", "Виконано"],
        ["2", "Формулювання технічних вимог та постановка завдання", "06.02 – 15.02.2026", "Виконано"],
        ["3", "Розробка математичних моделей n-грамного скорингу та winnowing", "16.02 – 28.02.2026", "Виконано"],
        ["4", "Проєктування архітектури трьохканального стилометричного ансамблю", "01.03 – 12.03.2026", "Виконано"],
        ["5", "Проєктування серверного API та механізмів OOXML round-trip", "13.03 – 25.03.2026", "Виконано"],
        ["6", "Програмна реалізація модулів бекенду та інтеграції провайдерів", "26.03 – 10.04.2026", "Виконано"],
        ["7", "Розробка клієнтського інтерфейсу на React 19 та візуалізації", "11.04 – 22.04.2026", "Виконано"],
        ["8", "Експериментальні дослідження, тестування на калібрувальному корпусі", "23.04 – 05.05.2026", "Виконано"],
        ["9", "Оформлення пояснювальної записки та ілюстративних матеріалів", "06.05 – 15.05.2026", "Виконано"],
        ["10", "Передзахист дипломної роботи та подання на рецензування", "16.05 – 20.05.2026", "Виконано"]
    ]
    
    from build_full_diploma_docx import add_table_custom
    add_table_custom(doc, plan_headers, plan_data, col_widths=[1.0, 9.5, 3.5, 2.5])
    
    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_sig.paragraph_format.space_before = Pt(8)
    p_sig.paragraph_format.first_line_indent = Cm(0)
    r_sig = p_sig.add_run("Студент: ______________ О. І. Чирський          Керівник роботи: ______________ С. В. Сливка")
    r_sig.font.name = 'Times New Roman'
    r_sig.font.size = Pt(11)

def add_academic_integrity_statement(doc):
    doc.add_page_break()
    p_top = doc.add_paragraph()
    p_top.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top.paragraph_format.space_after = Pt(24)
    p_top.paragraph_format.first_line_indent = Cm(0)
    r_top = p_top.add_run("Голові екзаменаційної комісії\nзі спеціальності 121 «Інженерія програмного забезпечення»\nстудента групи ІПЗ-41\nЧирського Олександра Ігоровича")
    r_top.font.name = 'Times New Roman'
    r_top.font.size = Pt(12)
    
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(24)
    p_title.paragraph_format.space_after = Pt(24)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ЗАЯВА\nщодо самостійного виконання дипломної роботи")
    r_t.font.name = 'Times New Roman'
    r_t.font.size = Pt(14)
    r_t.font.bold = True
    
    p_body = doc.add_paragraph()
    p_body.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_body.paragraph_format.line_spacing = 1.5
    p_body.paragraph_format.first_line_indent = Cm(1.25)
    r_b = p_body.add_run("Я, Чирський Олександр Ігорович, студент денної форми навчання відділення комерційної діяльності та права, групи ІПЗ-41, спеціальності 121 «Інженерія програмного забезпечення», заявляю: моя дипломна робота на тему «Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту» («Незбіг») виконана мною особисто і в ній не містяться елементи неправомірних текстових запозичень чи академічного плагіату. Всі результати наукових праць інших авторів, статистичні дані, програмні коди та алгоритми мають належні бібліографічні посилання згідно з чинними нормами законодавства України та вимогами ДСТУ 8302:2015.\n\nЯ усвідомлюю принципи академічної доброчесності, визначені Законом України «Про вищу освіту», «Про фахову передвищу освіту» та внутрішнім Положенням коледжу про академічну доброчесність, і підтверджую, що виявлення фальсифікацій чи неправомірних запозичень тягне за собою відмову в допуску до захисту або анулювання рішення екзаменаційної комісії.")
    r_b.font.name = 'Times New Roman'
    r_b.font.size = Pt(14)
    
    p_sign = doc.add_paragraph()
    p_sign.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_sign.paragraph_format.space_before = Pt(48)
    p_sign.paragraph_format.first_line_indent = Cm(0)
    r_s = p_sign.add_run("«____» _______________ 2026 р.                            ______________ О. І. ЧИРСЬКИЙ")
    r_s.font.name = 'Times New Roman'
    r_s.font.size = Pt(13)

def add_abstracts(doc):
    doc.add_page_break()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(12)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("АНОТАЦІЯ")
    r_t.font.name = 'Times New Roman'
    r_t.font.size = Pt(16)
    r_t.font.bold = True
    
    p_ua = doc.add_paragraph()
    p_ua.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ua.paragraph_format.line_spacing = 1.5
    p_ua.paragraph_format.first_line_indent = Cm(1.25)
    r_ua = p_ua.add_run("Чирський О. І. Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту («Незбіг»). — Дипломна робота на здобуття освітньо-професійного ступеня фахового молодшого бакалавра за спеціальністю 121 «Інженерія програмного забезпечення». — Рівненський кооперативний економіко-правовий фаховий коледж, Рівне, 2026.\n\nДипломна робота присвячена проєктуванню, розробці та дослідженню високопродуктивної клієнт-серверної системи автоматизованого аналізу текстових документів з метою виявлення неправомірних текстових запозичень (плагіату) та контенту, згенерованого великими мовними моделями (LLM). Актуальність дослідження зумовлена стрімким розвитком генеративного штучного інтелекту, що призвело до девальвації традиційних методів перевірки академічних робіт та зростання хибнопозитивних спрацьовувань комерційних систем.\n\nУ роботі розроблено багаторівневий конвеєр аналізу тексту, що включає препроцесор фільтрації вихідного коду, цитат і бібліографії, алгоритм перекривного фрагментування (sliding overlap chunking) та багатопровайдерний збір джерел через відкриті вебіндекси (DuckDuckGo, Google Search API, Semantic Scholar, OpenAlex). Запропоновано 5-факторну зважену метрику збігу, яка інтегрує токенне перекриття, фразове зіставлення, довжину найдовшої спільної послідовності (longest common run via sparse DP), winnowing-фінгерпринтинг та повнотекстовий індекс. Для виявлення синтетичного тексту спроєктовано трьохканальний локальний стилометричний ансамбль (статистичний канал MATTR та burstiness CV, патерновий канал мовних кліше та структурний канал симетрії), що функціонує детерміновано без обов'язкового виклику сторонніх хмарних LLM та забезпечує повну пояснюваність вердиктів. Реалізовано збереження вихідного форматування документів Microsoft Word при стилістичній оптимізації завдяки низькорівневій маніпуляції OOXML-пакетом.\n\nПрактична реалізація системи базується на React 19, TypeScript, Node.js та Express 5. Експериментальні дослідження на калібрувальному корпусі підтвердили високу точність детекції запозичень (ROC-AUC 0.94) та стійкість до парафраз-атак.")
    r_ua.font.name = 'Times New Roman'
    r_ua.font.size = Pt(13)
    
    p_kw = doc.add_paragraph()
    p_kw.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_kw.paragraph_format.space_before = Pt(8)
    p_kw.paragraph_format.space_after = Pt(24)
    p_kw.paragraph_format.first_line_indent = Cm(1.25)
    r_kw_lbl = p_kw.add_run("Ключові слова: ")
    r_kw_lbl.font.bold = True
    r_kw = p_kw.add_run("виявлення плагіату, генеративний штучний інтелект, великі мовні моделі, winnowing-фінгерпринтинг, стилометрія, MATTR, burstiness, OOXML round-trip, React 19, TypeScript, REST API, пояснюваність (explainable AI).")
    
    # English Abstract
    doc.add_page_break()
    p_en_title = doc.add_paragraph()
    p_en_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_en_title.paragraph_format.space_before = Pt(12)
    p_en_title.paragraph_format.space_after = Pt(12)
    p_en_title.paragraph_format.first_line_indent = Cm(0)
    r_et = p_en_title.add_run("ABSTRACT")
    r_et.font.name = 'Times New Roman'
    r_et.font.size = Pt(16)
    r_et.font.bold = True
    
    p_en = doc.add_paragraph()
    p_en.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en.paragraph_format.line_spacing = 1.5
    p_en.paragraph_format.first_line_indent = Cm(1.25)
    r_en = p_en.add_run("Chyrskyi O. I. Software System for Intelligent Text Document Analysis for Detecting Borrowings and Machine-Generated Content (\"Nezbig\"). — Diploma thesis for obtaining the professional junior bachelor degree in specialty 121 \"Software Engineering\". — Rivne Cooperative Economics and Law College, Rivne, 2026.\n\nThe thesis is dedicated to the design, engineering, and empirical evaluation of a high-performance client-server web system for automated document analysis aimed at identifying unauthorized text borrowings (plagiarism) and synthetic content generated by large language models (LLMs). The urgency of this research stems from the widespread adoption of generative AI, which undermines conventional academic integrity enforcement and leads to high false-positive rates in existing commercial solutions.\n\nA multi-stage document processing pipeline has been developed, incorporating specialized preprocessors for filtering source code, direct quotes, and bibliography sections, sliding overlap chunking with 18% inter-window redundancy, and multi-provider candidate harvesting via open web indices (DuckDuckGo, Google Search API, Semantic Scholar, OpenAlex). A novel 5-factor weighted scoring model integrates token overlap, phrase containment, longest contiguous run via sparse dynamic programming, winnowing document fingerprinting, and BM25-based full-text ranking. For synthetic text detection, a three-channel deterministic stylometric ensemble is introduced, combining statistical metrics (MATTR and sentence length burstiness CV), lexical pattern indicators (LLM cliches, hedging, prompt artifacts), and structural symmetry features. This ensemble operates locally without mandatory external LLM calls, ensuring verifiable explainability. Furthermore, an OOXML-preserving document transformation engine enables Word round-trip editing while maintaining native font styles, layouts, and tables.\n\nThe system is implemented using React 19, TypeScript, Node.js, and Express 5. Empirical evaluations across human, machine-generated, mixed, and paraphrased document corpora demonstrate high detection reliability (ROC-AUC of 0.94) and robust resilience against adversarial evasion.")
    r_en.font.name = 'Times New Roman'
    r_en.font.size = Pt(13)
    
    p_en_kw = doc.add_paragraph()
    p_en_kw.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en_kw.paragraph_format.space_before = Pt(8)
    p_en_kw.paragraph_format.space_after = Pt(24)
    p_en_kw.paragraph_format.first_line_indent = Cm(1.25)
    r_en_kw_lbl = p_en_kw.add_run("Keywords: ")
    r_en_kw_lbl.font.bold = True
    r_en_kw = p_en_kw.add_run("plagiarism detection, generative artificial intelligence, large language models, winnowing fingerprinting, stylometry, MATTR, sentence burstiness, OOXML round-trip, React 19, TypeScript, REST API, explainable AI.")

def add_abbreviations(doc):
    doc.add_page_break()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(18)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ПЕРЕЛІК УМОВНИХ ПОЗНАЧЕНЬ ТА СКОРОЧЕНЬ")
    r_t.font.name = 'Times New Roman'
    r_t.font.size = Pt(16)
    r_t.font.bold = True
    
    abbrs = [
        ("AI (Artificial Intelligence)", "штучний інтелект (ШІ)"),
        ("API (Application Programming Interface)", "програмний інтерфейс взаємодії застосунків"),
        ("AST (Abstract Syntax Tree)", "абстрактне синтаксичне дерево"),
        ("BPE (Byte Pair Encoding)", "алгоритм побайтового кодування пар токенів"),
        ("CV (Coefficient of Variation)", "коефіцієнт варіації"),
        ("DOM (Document Object Model)", "об'єктна модель документа в браузері"),
        ("DOI (Digital Object Identifier)", "цифровий ідентифікатор наукового об'єкта"),
        ("FPR (False Positive Rate)", "частка хибнопозитивних спрацьовувань"),
        ("HTML (HyperText Markup Language)", "мова гіпертекстової розмітки"),
        ("HTTP / HTTPS", "протокол передачі гіпертексту / захищений протокол"),
        ("JSON (JavaScript Object Notation)", "текстовий формат обміну структурованими даними"),
        ("LCS (Longest Common Subsequence / Substring)", "найдовша спільна підпослідовність / підрядок"),
        ("LLM (Large Language Model)", "велика мовна модель"),
        ("MATTR (Moving-Average Type-Token Ratio)", "ковзне середнє співвідношення типів до токенів"),
        ("NLP (Natural Language Processing)", "обробка природної мови"),
        ("OOXML (Office Open XML)", "відкритий стандарт пакування офісних документів (.docx)"),
        ("REST (Representational State Transfer)", "архітектурний стиль передачі стану представлення"),
        ("ROC-AUC", "площа під кривою помилок класифікації"),
        ("SPA (Single Page Application)", "односторінковий вебзастосунок"),
        ("TPR (True Positive Rate)", "частка істиннопозитивних спрацьовувань (чутливість)"),
        ("TTL (Time To Live)", "час актуальності кешованого запису"),
        ("UI (User Interface)", "користувацький графічний інтерфейс"),
        ("URL (Uniform Resource Locator)", "уніфікований покажчик ресурсу в мережі Інтернет"),
        ("ВАК", "Вища атестаційна комісія"),
        ("ДСТУ", "Державний стандарт України"),
        ("МОН", "Міністерство освіти і науки України"),
        ("ООП", "об'єктно-орієнтоване програмування"),
        ("ПЗ", "програмне забезпечення"),
        ("СУБД", "система управління базами даних")
    ]
    
    for term, desc in abbrs:
        p = doc.add_paragraph()
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.3
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.first_line_indent = Cm(1.25)
        
        r1 = p.add_run(f"{term} — ")
        r1.font.bold = True
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(13)
        
        r2 = p.add_run(desc)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(13)

def add_table_of_contents(doc):
    doc.add_page_break()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(18)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ЗМІСТ")
    r_t.font.name = 'Times New Roman'
    r_t.font.size = Pt(16)
    r_t.font.bold = True
    
    toc_items = [
        ("ВСТУП", "6", True),
        ("РОЗДІЛ 1. ТЕОРЕТИЧНИЙ АНАЛІЗ ПРЕДМЕТНОЇ ОБЛАСТІ ТА СУЧАСНИХ МЕТОДІВ АНАЛІЗУ ТЕКСТІВ", "10", True),
        ("  1.1. Проблема академічної доброчесності в епоху генеративного штучного інтелекту", "10", False),
        ("  1.2. Огляд та критичний аналіз існуючих аналогів виявлення плагіату та AI-тексту", "13", False),
        ("  1.3. Математичні та алгоритмічні моделі текстового порівняння", "17", False),
        ("    1.3.1. Метод n-грамного containment та коефіцієнт Жаккара", "17", False),
        ("    1.3.2. Алгоритм Winnowing локального документно-орієнтованого фінгерпринтингу", "19", False),
        ("    1.3.3. Визначення найдовшої спільної послідовності та розріджене динамічне програмування", "22", False),
        ("  1.4. Стилометричні методи оцінки машинно згенерованого тексту", "24", False),
        ("    1.4.1. Ковзний показник лексичного багатства MATTR", "24", False),
        ("    1.4.2. Аналіз варіативності довжини речень (Burstiness) та показник CV", "26", False),
        ("    1.4.3. Виявлення синтаксичної симетрії та шаблонів генеративних моделей", "28", False),
        ("  1.5. Наукові обмеження детекції та аналіз упередженості сучасних детекторів", "30", False),
        ("  1.6. Висновки до розділу 1", "33", False),
        ("РОЗДІЛ 2. ПРОЄКТУВАННЯ АРХІТЕКТУРИ ТА АЛГОРИТМІЧНОГО ЗАБЕЗПЕЧЕННЯ СИСТЕМИ «НЕЗБІГ»", "35", True),
        ("  2.1. Концептуальна архітектура та функціональні вимоги до системи", "35", False),
        ("  2.2. Модуль попередньої обробки та очищення документів", "39", False),
        ("  2.3. Алгоритм перекривного фрагментування та формування пошукових запитів", "42", False),
        ("  2.4. Багатопровайдерна інтеграція пошуку, черга запитів та Circuit Breaker", "45", False),
        ("  2.5. Математична модель 5-факторного зваженого скорингу текстових збігів", "49", False),
        ("  2.6. Трьохканальний локальний ансамбль AI-аналізу та метрика надійності", "52", False),
        ("  2.7. Архітектура збереження форматування Microsoft Word OOXML", "56", False),
        ("  2.8. Асинхронна інтеграція зовнішніх мовних моделей (LLM Opinion Fallback)", "59", False),
        ("  2.9. Висновки до розділу 2", "62", False),
        ("РОЗДІЛ 3. ПРОГРАМНА РЕАЛІЗАЦІЯ СИСТЕМИ", "64", True),
        ("  3.1. Обґрунтування технологічного стеку та середовища розробки", "64", False),
        ("  3.2. Архітектура сервера та проєктування REST API специфікації", "67", False),
        ("  3.3. Програмна реалізація модулів аналізу та алгоритмів", "71", False),
        ("    3.3.1. Реалізація алгоритмів скорингу та Winnowing", "71", False),
        ("    3.3.2. Реалізація стилометричного AI-аналізатора", "74", False),
        ("    3.3.3. Реалізація фільтрації коду та структури документів", "77", False),
        ("    3.3.4. Реалізація маніпулятора документами Microsoft Word OOXML", "79", False),
        ("  3.4. Реалізація детермінованого стилістичного редактора (Text Humanizer)", "82", False),
        ("  3.5. Клієнтський користувацький інтерфейс на React 19", "85", False),
        ("  3.6. Висновки до розділу 3", "90", False),
        ("РОЗДІЛ 4. ЕКСПЕРИМЕНТАЛЬНІ ДОСЛІДЖЕННЯ ТА ОЦІНКА ЕФЕКТИВНОСТІ", "92", True),
        ("  4.1. Методологія тестування та калібрування системи", "92", False),
        ("  4.2. Дослідження точності виявлення запозичень та стійкості Winnowing", "95", False),
        ("  4.3. Оцінка стилометричного AI-ансамблю на верифікаційному корпусі", "98", False),
        ("  4.4. Дослідження швидкодії та ефективності багаторівневого кешування", "102", False),
        ("  4.5. Інструкція користувача та демонстрація практичної роботи системи", "105", False),
        ("  4.6. Висновки до розділу 4", "110", False),
        ("ЗАГАЛЬНІ ВИСНОВКИ", "112", True),
        ("СПИСОК ВИКОРИСТАНИХ ДЖЕРЕЛ", "115", True),
        ("ДОДАТКИ", "121", True),
        ("  Додаток А. Ілюстративні матеріали користувацького інтерфейсу", "122", False),
        ("  Додаток Б. Лістинги вихідного коду ключових алгоритмічних модулів", "126", False),
        ("  Додаток В. Специфікація REST API маршрутів та схем даних", "132", False)
    ]
    
    for title, page, is_major in toc_items:
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_before = Pt(4 if is_major else 1)
        p.paragraph_format.space_after = Pt(2 if is_major else 1)
        p.paragraph_format.first_line_indent = Cm(0)
        
        # Dots leader logic using tab stop or custom text
        dots_count = max(4, 90 - len(title) - len(page))
        dots = "." * dots_count
        
        r1 = p.add_run(title)
        r1.font.name = 'Times New Roman'
        r1.font.size = Pt(13 if is_major else 12)
        r1.font.bold = is_major
        
        r_dots = p.add_run(f" {dots} ")
        r_dots.font.name = 'Times New Roman'
        r_dots.font.size = Pt(11)
        r_dots.font.color.rgb = RGBColor(120, 120, 120)
        
        r2 = p.add_run(page)
        r2.font.name = 'Times New Roman'
        r2.font.size = Pt(13 if is_major else 12)
        r2.font.bold = is_major

print("Front matter generator ready.")
