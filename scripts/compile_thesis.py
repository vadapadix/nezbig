# -*- coding: utf-8 -*-
"""
Master Compilation Script for Diploma Thesis:
«Програмна система інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту» («Незбіг»)
Specialty 121 "Інженерія програмного забезпечення"
"""

import os
import sys
import time

# Ensure scripts directory is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from build_full_diploma_docx import create_document
from thesis_data import (
    add_title_page,
    add_assignment_sheet,
    add_academic_integrity_statement,
    add_abstracts,
    add_table_of_contents,
    add_abbreviations,
)
from thesis_intro import add_introduction
from thesis_ch1 import add_chapter_1
from thesis_ch2 import add_chapter_2
from thesis_ch3 import add_chapter_3
from thesis_ch4 import add_chapter_4
from thesis_concl_refs import (
    add_conclusions,
    add_references,
    add_appendices,
)

def compile_full_thesis():
    start_time = time.time()
    print("=" * 70)
    print("ПОЧАТОК ГЕНЕРАЦІЇ ДИПЛОМНОЇ РОБОТИ")
    print("Тема: «Програмна система інтелектуального аналізу текстових документів")
    print("       для виявлення запозичень та штучно згенерованого контенту»")
    print("=" * 70)

    doc = create_document()

    steps = [
        ("Титульний аркуш", add_title_page),
        ("Завдання на дипломну роботу", add_assignment_sheet),
        ("Декларація академічної доброчесності", add_academic_integrity_statement),
        ("Анотація (укр. та англ.)", add_abstracts),
        ("Зміст", add_table_of_contents),
        ("Перелік умовних позначень і скорочень", add_abbreviations),
        ("Вступ", add_introduction),
        ("Розділ 1. Теоретичний аналіз предметної області", add_chapter_1),
        ("Розділ 2. Проєктування архітектури та алгоритмів", add_chapter_2),
        ("Розділ 3. Програмна реалізація системи", add_chapter_3),
        ("Розділ 4. Експериментальні дослідження та тестування", add_chapter_4),
        ("Загальні висновки", add_conclusions),
        ("Список використаних джерел (45 джерел)", add_references),
        ("Додатки А, Б, В", add_appendices),
    ]

    total_steps = len(steps)
    for idx, (title, func) in enumerate(steps, 1):
        step_start = time.time()
        print(f"[{idx:02d}/{total_steps:02d}] Формування розділу: {title}...")
        func(doc)
        print(f"       -> Завершено за {time.time() - step_start:.2f} сек.")

    # Paths
    project_root = os.path.dirname(SCRIPT_DIR)
    docs_dir = os.path.join(project_root, "docs")
    os.makedirs(docs_dir, exist_ok=True)

    target_docs = os.path.join(docs_dir, "ДИПЛОМНА_РОБОТА_НЕЗБІГ.docx")
    target_root = os.path.join(project_root, "ДИПЛОМНА_РОБОТА_НЕЗБІГ.docx")

    print("\nЗбереження документа...")
    doc.save(target_docs)
    doc.save(target_root)

    file_size_docs = os.path.getsize(target_docs) / (1024 * 1024)
    file_size_root = os.path.getsize(target_root) / (1024 * 1024)

    para_count = len(doc.paragraphs)
    table_count = len(doc.tables)
    section_count = len(doc.sections)

    elapsed = time.time() - start_time
    print("=" * 70)
    print("ГЕНЕРАЦІЮ УСПІШНО ЗАВЕРШЕНО!")
    print(f"Загальний час виконання: {elapsed:.2f} сек.")
    print(f"Кількість абзаців:       {para_count}")
    print(f"Кількість таблиць:       {table_count}")
    print(f"Кількість секцій:        {section_count}")
    print(f"Файл 1:                  {target_docs} ({file_size_docs:.2f} МБ)")
    print(f"Файл 2 (копія в корені): {target_root} ({file_size_root:.2f} МБ)")
    print("=" * 70)

if __name__ == "__main__":
    compile_full_thesis()
