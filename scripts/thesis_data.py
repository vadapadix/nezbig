# -*- coding: utf-8 -*-
"""
Thesis Front Matter: Title Page, Assignment, Academic Integrity, Abstracts, TOC, Abbreviations
All formatted strictly in Times New Roman 14 pt with proper paragraph separation.
"""

from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from build_full_diploma_docx import set_run_font, add_table_custom

def add_title_page(doc):
    # Header institution info
    p = doc.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.first_line_indent = Cm(0)
    
    r = p.add_run("МІНІСТЕРСТВО ОСВІТИ І НАУКИ УКРАЇНИ")
    set_run_font(r, font_name='Times New Roman', size_pt=14, bold=True)
    
    p2 = doc.add_paragraph()
    p2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.line_spacing = 1.15
    p2.paragraph_format.space_before = Pt(2)
    p2.paragraph_format.space_after = Pt(4)
    p2.paragraph_format.first_line_indent = Cm(0)
    r2 = p2.add_run("ВСЕУКРАЇНСЬКА ЦЕНТРАЛЬНА СПІЛКА СПОЖИВЧИХ ТОВАРИСТВ (УКРКООПСПІЛКА)\nРІВНЕНСЬКИЙ КООПЕРАТИВНИЙ ЕКОНОМІКО-ПРАВОВИЙ ФАХОВИЙ КОЛЕДЖ")
    set_run_font(r2, font_name='Times New Roman', size_pt=13, bold=True)
    
    p_dep = doc.add_paragraph()
    p_dep.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dep.paragraph_format.line_spacing = 1.15
    p_dep.paragraph_format.space_before = Pt(4)
    p_dep.paragraph_format.space_after = Pt(28)
    p_dep.paragraph_format.first_line_indent = Cm(0)
    
    r_dep = p_dep.add_run("Циклова комісія комп'ютерних технологій та інженерії програмного забезпечення\nСпеціальність 121 «Інженерія програмного забезпечення»")
    set_run_font(r_dep, font_name='Times New Roman', size_pt=13, bold=False)
    
    # Thesis Title Label
    p_type = doc.add_paragraph()
    p_type.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_type.paragraph_format.space_before = Pt(28)
    p_type.paragraph_format.space_after = Pt(6)
    p_type.paragraph_format.first_line_indent = Cm(0)
    
    r_type = p_type.add_run("ДИПЛОМНА РОБОТА")
    set_run_font(r_type, font_name='Times New Roman', size_pt=18, bold=True)
    
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    p_sub.paragraph_format.first_line_indent = Cm(0)
    r_sub = p_sub.add_run("на здобуття освітньо-професійного ступеня фахового молодшого бакалавра")
    set_run_font(r_sub, font_name='Times New Roman', size_pt=13, italic=True)
    
    p_theme_lbl = doc.add_paragraph()
    p_theme_lbl.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_theme_lbl.paragraph_format.space_before = Pt(6)
    p_theme_lbl.paragraph_format.space_after = Pt(4)
    p_theme_lbl.paragraph_format.first_line_indent = Cm(0)
    r_lbl = p_theme_lbl.add_run("на тему:")
    set_run_font(r_lbl, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_theme = doc.add_paragraph()
    p_theme.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_theme.paragraph_format.line_spacing = 1.3
    p_theme.paragraph_format.space_before = Pt(4)
    p_theme.paragraph_format.space_after = Pt(36)
    p_theme.paragraph_format.first_line_indent = Cm(0)
    r_th = p_theme.add_run("«ПРОГРАМНА СИСТЕМА ІНТЕЛЕКТУАЛЬНОГО АНАЛІЗУ ТЕКСТОВИХ ДОКУМЕНТІВ ДЛЯ ВИЯВЛЕННЯ ЗАПОЗИЧЕНЬ ТА ШТУЧНО ЗГЕНЕРОВАНОГО КОНТЕНТУ» («НЕЗБІГ»)")
    set_run_font(r_th, font_name='Times New Roman', size_pt=14, bold=True)
    
    # Author & Supervisor block
    p_auth = doc.add_paragraph()
    p_auth.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p_auth.paragraph_format.line_spacing = 1.25
    p_auth.paragraph_format.space_before = Pt(18)
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
        set_run_font(r, font_name='Times New Roman', size_pt=13, bold=is_bold)
        
    p_city = doc.add_paragraph()
    p_city.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_city.paragraph_format.space_before = Pt(36)
    p_city.paragraph_format.space_after = Pt(0)
    p_city.paragraph_format.first_line_indent = Cm(0)
    r_city = p_city.add_run("Рівне — 2026")
    set_run_font(r_city, font_name='Times New Roman', size_pt=14, bold=True)

def add_assignment_sheet(doc):
    doc.add_page_break()
    p_top = doc.add_paragraph()
    p_top.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top.paragraph_format.line_spacing = 1.15
    p_top.paragraph_format.space_after = Pt(12)
    p_top.paragraph_format.first_line_indent = Cm(0)
    r_app = p_top.add_run("ЗАТВЕРДЖУЮ\nГолова циклової комісії\nкомп'ютерних технологій та ІПЗ\n__________ Світлана СЛИВКА\n«____» _____________ 2026 р.")
    set_run_font(r_app, font_name='Times New Roman', size_pt=12, bold=False)
    
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(10)
    p_title.paragraph_format.space_after = Pt(12)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ЗАВДАННЯ\nНА ДИПЛОМНУ РОБОТУ СТУДЕНТА")
    set_run_font(r_t, font_name='Times New Roman', size_pt=14, bold=True)
    
    items = [
        "1. Тема роботи: «Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту» («Незбіг»). Керівник роботи: викладач вищої категорії Сливка Світлана Володимирівна. Затверджена наказом по коледжу від «15» січня 2026 р. № 12-с.",
        "2. Термін здачі студентом закінченої роботи: «20» травня 2026 р.",
        "3. Вихідні дані до роботи: наукові публікації з методів NLP та детекції згенерованого тексту; пошукові API та відкриті каталоги (Tavily Search API, Serper Google Search API, DuckDuckGo, Semantic Scholar, OpenAlex); формати вхідних файлів DOCX (OOXML), PDF, TXT; сучасні веб-технології React 19, TypeScript, Node.js 24, Express 5.2, TailwindCSS; стандарти академічної доброчесності МОН України.",
        "4. Зміст розрахунково-пояснювальної записки (перелік питань, які підлягають розробці): Вступ; Розділ 1. Теоретичний аналіз предметної області та сучасних методів аналізу текстів; Розділ 2. Проєктування архітектури та алгоритмічного забезпечення системи «Незбіг»; Розділ 3. Програмна реалізація системи; Розділ 4. Експериментальні дослідження та оцінка ефективності системи; Загальні висновки; Список використаних джерел; Додатки.",
        "5. Перелік графічного матеріалу: функціональна схема системи, конвеєр обробки документів, схема winnowing-фінгерпринтингу, архітектура триканального стилометричного ансамблю, схема збереження форматування OOXML, діаграми експериментальних досліджень, скріншоти користувацького інтерфейсу системи.",
        "6. Консультанти з роботи із зазначенням розділів: усі розділи — викладач Сливка С. В.",
        "7. Дата видачі завдання: «16» січня 2026 р."
    ]
    for it in items:
        p_it = doc.add_paragraph()
        p_it.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p_it.paragraph_format.line_spacing = 1.3
        p_it.paragraph_format.space_before = Pt(2)
        p_it.paragraph_format.space_after = Pt(2)
        p_it.paragraph_format.first_line_indent = Cm(1.25)
        r_it = p_it.add_run(it)
        set_run_font(r_it, font_name='Times New Roman', size_pt=13, bold=False)
        
    p_cal = doc.add_paragraph()
    p_cal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cal.paragraph_format.space_before = Pt(8)
    p_cal.paragraph_format.space_after = Pt(4)
    p_cal.paragraph_format.first_line_indent = Cm(0)
    r_c = p_cal.add_run("КАЛЕНДАРНИЙ ПЛАН")
    set_run_font(r_c, font_name='Times New Roman', size_pt=14, bold=True)
    
    plan_headers = ["№", "Назва етапів дипломної роботи", "Термін виконання", "Відмітка про виконання"]
    plan_data = [
        ["1", "Аналіз предметної області, літературних джерел та аналогів", "16.01 – 05.02.2026", "Виконано"],
        ["2", "Формулювання технічних вимог та постановка завдання", "06.02 – 15.02.2026", "Виконано"],
        ["3", "Розробка математичних моделей n-грамного скорингу та winnowing", "16.02 – 28.02.2026", "Виконано"],
        ["4", "Проєктування архітектури триканального стилометричного ансамблю", "01.03 – 12.03.2026", "Виконано"],
        ["5", "Проєктування серверного API та механізмів OOXML round-trip", "13.03 – 25.03.2026", "Виконано"],
        ["6", "Програмна реалізація модулів бекенду та інтеграції провайдерів", "26.03 – 10.04.2026", "Виконано"],
        ["7", "Розробка клієнтського інтерфейсу на React 19 та візуалізації", "11.04 – 22.04.2026", "Виконано"],
        ["8", "Експериментальні дослідження, тестування на калібрувальному корпусі", "23.04 – 05.05.2026", "Виконано"],
        ["9", "Оформлення пояснювальної записки та ілюстративних матеріалів", "06.05 – 15.05.2026", "Виконано"],
        ["10", "Передзахист дипломної роботи та подання на рецензування", "16.05 – 20.05.2026", "Виконано"]
    ]
    add_table_custom(doc, plan_headers, plan_data, col_widths=[1.0, 9.5, 3.5, 2.5])
    
    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_sig.paragraph_format.space_before = Pt(8)
    p_sig.paragraph_format.first_line_indent = Cm(0)
    r_sig = p_sig.add_run("Студент: ______________ О. І. Чирський          Керівник роботи: ______________ С. В. Сливка")
    set_run_font(r_sig, font_name='Times New Roman', size_pt=13, bold=False)

def add_academic_integrity_statement(doc):
    doc.add_page_break()
    p_top = doc.add_paragraph()
    p_top.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top.paragraph_format.line_spacing = 1.2
    p_top.paragraph_format.space_after = Pt(20)
    p_top.paragraph_format.first_line_indent = Cm(0)
    r_top = p_top.add_run("Голові екзаменаційної комісії\nзі спеціальності 121 «Інженерія програмного забезпечення»\nстудента групи ІПЗ-41\nЧирського Олександра Ігоровича")
    set_run_font(r_top, font_name='Times New Roman', size_pt=13, bold=False)
    
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(16)
    p_title.paragraph_format.space_after = Pt(20)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ЗАЯВА\nщодо самостійного виконання дипломної роботи")
    set_run_font(r_t, font_name='Times New Roman', size_pt=14, bold=True)
    
    p_body1 = doc.add_paragraph()
    p_body1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_body1.paragraph_format.line_spacing = 1.5
    p_body1.paragraph_format.space_before = Pt(0)
    p_body1.paragraph_format.space_after = Pt(4)
    p_body1.paragraph_format.first_line_indent = Cm(1.25)
    r_b1 = p_body1.add_run("Я, Чирський Олександр Ігорович, студент денної форми навчання відділення комерційної діяльності та права, групи ІПЗ-41, спеціальності 121 «Інженерія програмного забезпечення», заявляю: моя дипломна робота на тему «Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту» («Незбіг») виконана мною особисто і в ній не містяться елементи неправомірних текстових запозичень чи академічного плагіату. Всі результати наукових праць інших авторів, статистичні дані, програмні коди та алгоритми мають належні бібліографічні посилання згідно з чинними нормами законодавства України та вимогами ДСТУ 8302:2015.")
    set_run_font(r_b1, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_body2 = doc.add_paragraph()
    p_body2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_body2.paragraph_format.line_spacing = 1.5
    p_body2.paragraph_format.space_before = Pt(4)
    p_body2.paragraph_format.space_after = Pt(0)
    p_body2.paragraph_format.first_line_indent = Cm(1.25)
    r_b2 = p_body2.add_run("Я усвідомлюю принципи академічної доброчесності, визначені Законом України «Про вищу освіту», «Про фахову передвищу освіту» та внутрішнім Положенням коледжу про академічну доброчесність, і підтверджую, що виявлення фальсифікацій чи неправомірних запозичень тягне за собою відмову в допуску до захисту або анулювання рішення екзаменаційної комісії.")
    set_run_font(r_b2, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_sign = doc.add_paragraph()
    p_sign.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_sign.paragraph_format.space_before = Pt(40)
    p_sign.paragraph_format.first_line_indent = Cm(0)
    r_s = p_sign.add_run("«____» _______________ 2026 р.                            ______________ О. І. ЧИРСЬКИЙ")
    set_run_font(r_s, font_name='Times New Roman', size_pt=13, bold=False)

def add_abstracts(doc):
    doc.add_page_break()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(14)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("АНОТАЦІЯ")
    set_run_font(r_t, font_name='Times New Roman', size_pt=16, bold=True)
    
    p_bib = doc.add_paragraph()
    p_bib.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_bib.paragraph_format.line_spacing = 1.5
    p_bib.paragraph_format.space_after = Pt(4)
    p_bib.paragraph_format.first_line_indent = Cm(1.25)
    r_bib = p_bib.add_run("Чирський О. І. Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту («Незбіг»). — Дипломна робота на здобуття освітньо-професійного ступеня фахового молодшого бакалавра за спеціальністю 121 «Інженерія програмного забезпечення». — Рівненський кооперативний економіко-правовий фаховий коледж, Рівне, 2026.")
    set_run_font(r_bib, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_ua1 = doc.add_paragraph()
    p_ua1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ua1.paragraph_format.line_spacing = 1.5
    p_ua1.paragraph_format.space_after = Pt(4)
    p_ua1.paragraph_format.first_line_indent = Cm(1.25)
    r_ua1 = p_ua1.add_run("Дипломна робота присвячена проєктуванню, розробці та експериментальному дослідженню клієнт-серверної системи інтелектуального аналізу текстових документів для виявлення запозичень та машинно згенерованого контенту «Незбіг». Масове використання великих мовних моделей (LLM) унеможливило детекцію запозичень виключно традиційними методами через семантичну варіативність синтезованого тексту. Водночас комерційні AI-детектори функціонують як непрозорі сервіси, демонструють надмірний рівень хибнопозитивних оцінок (FPR) на роботах неносіїв мови та мають суттєві обмеження щодо підтримки українськомовного наукового дискурсу.")
    set_run_font(r_ua1, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_ua2 = doc.add_paragraph()
    p_ua2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ua2.paragraph_format.line_spacing = 1.5
    p_ua2.paragraph_format.space_after = Pt(4)
    p_ua2.paragraph_format.first_line_indent = Cm(1.25)
    r_ua2 = p_ua2.add_run("У роботі розроблено повнофункціональний конвеєр обробки текстів: препроцесор евристичної фільтрації вихідного коду, цитат і бібліографії, алгоритм перекривного фрагментування (sliding overlap chunking) з оверлапом 18% та 5-провайдерний збір джерел через вебіндекси (Tavily Search API, Serper Google Search API, DuckDuckGo, Semantic Scholar, OpenAlex) із захистом за патерном Circuit Breaker. Запропоновано 5-факторну зважену метрику текстового збігу, яка поєднує токенний containment, фразові збіги, найдовший нерозривний фрагмент (longest common run через розріджене динамічне програмування зі складністю O(N+K)), winnowing-фінгерпринтинг та пошуковий ранжир. Для ідентифікації згенерованого контенту спроєктовано триканальний детермінований стилометричний ансамбль (статистичний канал MATTR-500 та Burstiness CV, патерновий канал мовних маркерів і діалектичного хеджингу, структурний канал симетрії та тричленних переліків tricolon) із розрахунком смуди невизначеності й штрафом узгодженості. Реалізовано детермінований редактор Text Humanizer із трьома режимами адаптації (академічний, природний, лаконічний) та 100% збереженням вихідних стилів і таблиць Microsoft Word завдяки низькорівневій модифікації пакетів Office Open XML (OOXML).")
    set_run_font(r_ua2, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_ua3 = doc.add_paragraph()
    p_ua3.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_ua3.paragraph_format.line_spacing = 1.5
    p_ua3.paragraph_format.space_after = Pt(4)
    p_ua3.paragraph_format.first_line_indent = Cm(1.25)
    r_ua3 = p_ua3.add_run("Програмну реалізацію виконано на стеку Node.js 24, Express 5.2, React 19, TypeScript та TailwindCSS. Експериментальні випробування на 110 калібрувальних документах підтвердили якість класифікації (ROC-AUC 0.942, Macro-F1 0.91, FPR 3.3%) та стійкість winnowing-фінгерпринтингу до деформаційних атак (точність 94.8% проти 34.1% у шинглування).")
    set_run_font(r_ua3, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_kw = doc.add_paragraph()
    p_kw.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_kw.paragraph_format.line_spacing = 1.5
    p_kw.paragraph_format.space_before = Pt(6)
    p_kw.paragraph_format.space_after = Pt(20)
    p_kw.paragraph_format.first_line_indent = Cm(1.25)
    r_kw_lbl = p_kw.add_run("Ключові слова: ")
    set_run_font(r_kw_lbl, font_name='Times New Roman', size_pt=14, bold=True)
    r_kw = p_kw.add_run("виявлення плагіату, генеративний штучний інтелект, великі мовні моделі, winnowing-фінгерпринтинг, стилометрія, MATTR, burstiness, тричленний паралелізм, діалектичний хеджинг, Tavily API, Serper API, Circuit Breaker, OOXML Word preservation, Text Humanizer, React 19, TypeScript, REST API, пояснюваність (explainable AI).")
    set_run_font(r_kw, font_name='Times New Roman', size_pt=14, bold=False)
    
    # English Abstract
    doc.add_page_break()
    p_en_title = doc.add_paragraph()
    p_en_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_en_title.paragraph_format.space_before = Pt(12)
    p_en_title.paragraph_format.space_after = Pt(14)
    p_en_title.paragraph_format.first_line_indent = Cm(0)
    r_et = p_en_title.add_run("ABSTRACT")
    set_run_font(r_et, font_name='Times New Roman', size_pt=16, bold=True)
    
    p_en_bib = doc.add_paragraph()
    p_en_bib.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en_bib.paragraph_format.line_spacing = 1.5
    p_en_bib.paragraph_format.space_after = Pt(4)
    p_en_bib.paragraph_format.first_line_indent = Cm(1.25)
    r_en_bib = p_en_bib.add_run("Chyrskyi O. I. Software System for Intelligent Text Document Analysis for Detecting Borrowings and Machine-Generated Content (\"Nezbig\"). — Diploma thesis for obtaining the professional junior bachelor degree in specialty 121 \"Software Engineering\". — Rivne Cooperative Economics and Law College, Rivne, 2026.")
    set_run_font(r_en_bib, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_en1 = doc.add_paragraph()
    p_en1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en1.paragraph_format.line_spacing = 1.5
    p_en1.paragraph_format.space_after = Pt(4)
    p_en1.paragraph_format.first_line_indent = Cm(1.25)
    r_en1 = p_en1.add_run("The thesis focuses on the engineering design, implementation, and empirical evaluation of a high-performance client-server web system for intelligent document analysis aimed at detecting unauthorized borrowings and machine-generated content (\"Nezbig\"). The proliferation of large language models (LLMs) has rendered traditional string matching insufficient due to semantic paraphrasing. Meanwhile, existing commercial AI detectors operate as proprietary black-boxes, exhibit high false-positive rates on non-native writing, and lack robust support for Ukrainian academic prose.")
    set_run_font(r_en1, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_en2 = doc.add_paragraph()
    p_en2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en2.paragraph_format.line_spacing = 1.5
    p_en2.paragraph_format.space_after = Pt(4)
    p_en2.paragraph_format.first_line_indent = Cm(1.25)
    r_en2 = p_en2.add_run("The study develops a comprehensive document processing pipeline comprising heuristic pre-filtering of source code, citations, and bibliographies, sliding window chunking with 18% overlap, and 5-provider source harvesting via web indices (Tavily Search API, Serper Google Search API, DuckDuckGo, Semantic Scholar, OpenAlex) governed by a Circuit Breaker finite-state machine. A 5-factor weighted similarity metric integrates token containment, phrase overlap, longest common run via sparse dynamic programming in O(N+K) time, winnowing document fingerprinting, and search ranking. For synthetic text detection, a tri-channel deterministic stylometric ensemble combines statistical metrics (MATTR-500, sentence length burstiness CV), lexical pattern markers (LLM clichés, dialectical hedging), and structural symmetry features (tricolon parallelism) alongside concordance damping and uncertainty bounds. A deterministic Text Humanizer with three adaptation modes (Academic, Natural, Concise) achieves 100% style and table preservation for Microsoft Word documents via low-level Office Open XML (OOXML) manipulation.")
    set_run_font(r_en2, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_en3 = doc.add_paragraph()
    p_en3.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en3.paragraph_format.line_spacing = 1.5
    p_en3.paragraph_format.space_after = Pt(4)
    p_en3.paragraph_format.first_line_indent = Cm(1.25)
    r_en3 = p_en3.add_run("The software architecture is implemented using Node.js 24, Express 5.2, React 19, TypeScript, and TailwindCSS. Empirical evaluations on a 110-document benchmark corpus confirm superior detection performance (ROC-AUC 0.942, Macro-F1 0.91, FPR 3.3%) and robust resilience of winnowing fingerprinting against adversarial perturbations (94.8% retention vs. 34.1% for shingling).")
    set_run_font(r_en3, font_name='Times New Roman', size_pt=14, bold=False)
    
    p_en_kw = doc.add_paragraph()
    p_en_kw.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_en_kw.paragraph_format.line_spacing = 1.5
    p_en_kw.paragraph_format.space_before = Pt(6)
    p_en_kw.paragraph_format.space_after = Pt(20)
    p_en_kw.paragraph_format.first_line_indent = Cm(1.25)
    r_en_kw_lbl = p_en_kw.add_run("Keywords: ")
    set_run_font(r_en_kw_lbl, font_name='Times New Roman', size_pt=14, bold=True)
    r_en_kw = p_en_kw.add_run("plagiarism detection, generative artificial intelligence, large language models, winnowing fingerprinting, stylometry, MATTR, sentence burstiness, tricolon parallelism, dialectical hedging, Tavily API, Serper API, Circuit Breaker, OOXML Word preservation, Text Humanizer, React 19, TypeScript, REST API, explainable AI.")
    set_run_font(r_en_kw, font_name='Times New Roman', size_pt=14, bold=False)

def add_abbreviations(doc):
    doc.add_page_break()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(18)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ПЕРЕЛІК УМОВНИХ ПОЗНАЧЕНЬ ТА СКОРОЧЕНЬ")
    set_run_font(r_t, font_name='Times New Roman', size_pt=16, bold=True)
    
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
        set_run_font(r1, font_name='Times New Roman', size_pt=14, bold=True)
        
        r2 = p.add_run(desc)
        set_run_font(r2, font_name='Times New Roman', size_pt=14, bold=False)

def add_table_of_contents(doc):
    doc.add_page_break()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(18)
    p_title.paragraph_format.first_line_indent = Cm(0)
    r_t = p_title.add_run("ЗМІСТ")
    set_run_font(r_t, font_name='Times New Roman', size_pt=16, bold=True)
    
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
        ("  2.6. Триканальний детермінований ансамбль AI-аналізу та метрика надійності", "52", False),
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
        p.paragraph_format.space_before = Pt(3 if is_major else 1)
        p.paragraph_format.space_after = Pt(2 if is_major else 1)
        p.paragraph_format.first_line_indent = Cm(0)
        
        dots_count = max(4, 88 - len(title) - len(page))
        dots = "." * dots_count
        
        r1 = p.add_run(title)
        set_run_font(r1, font_name='Times New Roman', size_pt=14, bold=is_major)
        
        r_dots = p.add_run(f" {dots} ")
        set_run_font(r_dots, font_name='Times New Roman', size_pt=14, bold=False, color_rgb=(130, 130, 130))
        
        r2 = p.add_run(page)
        set_run_font(r2, font_name='Times New Roman', size_pt=14, bold=is_major)

print("Front matter generator ready.")
