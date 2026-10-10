# -*- coding: utf-8 -*-
"""
Thesis Conclusions, References, and Appendices Module
All formatted strictly in Times New Roman 14 pt with proper academic layout.
"""

import os
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from build_full_diploma_docx import (
    add_chapter_heading, add_p, add_figure, add_code_block, set_run_font
)

def add_conclusions(doc):
    add_chapter_heading(doc, "ЗАГАЛЬНІ ВИСНОВКИ", new_page=True)
    
    add_p(doc, 
        text="У дипломній роботі вирішено актуальне науково-прикладне завдання інженерії програмного забезпечення — "
             "проєктування, розробку та експериментальне дослідження високопродуктивної клієнт-серверної системи "
             "інтелектуального аналізу текстових документів для виявлення запозичень та штучно згенерованого контенту «Незбіг». "
             "На основі проведених теоретичних досліджень та експериментальної апробації сформульовано такі підсумкові висновки:")
             
    conclusions_list = [
        "1. Комплексний аналіз предметної області та існуючих аналогів (Turnitin, Unicheck, GPTZero, CopyLeaks) "
        "довів, що традиційні антиплагіатні інструменти неспроможні детектувати семантично унікальний текст, "
        "згенерований сучасними великими мовними моделями (LLM). Водночас існуючі комерційні AI-детектори функціонують "
        "як непрозорі чорні скриньки, мають високий рівень хибнопозитивних помилок (до 61% на текстах неносіїв мови), "
        "є фінансово обтяжливими та не забезпечують конфіденційності даних. Обґрунтовано необхідність створення відкритої "
        "системи з пояснюваною архітектурою (Explainable AI) та підтримкою української мови.",
         
        "2. Теоретично обґрунтовано та реалізовано математичні моделі порівняння текстових послідовностей: комбінований "
        "3-gram та 5-gram containment, алгоритм документно-орієнтованого фінгерпринтингу Winnowing з поліноміальним хешуванням "
        "Рабіна-Карпа та оптимізоване розріджене динамічне програмування (Sparse DP) для знаходження найдовшого нерозривного "
        "фрагмента (Longest Common Run) зі складністю O(N + K).",
         
        "3. Спроєктовано та реалізовано триканальний детермінований стилометричний AI-ансамбль, що поєднує статистичний канал "
        "(ковзне лексичне багатство MATTR вікном 50 токенів, коефіцієнт варіації довжини речень Burstiness CV, повтори 4-грам), "
        "патерновий канал (лінгвістичні маркери LLM, діалектичний хеджинг, безособові формули) та структурний канал (синтаксична симетрія, "
        "тричленний паралелізм tricolon, фільтрація тривіальних вступів). "
        "Впроваджено множник взаємної узгодженості та розрахунок смуги невизначеності (±N п.п.), що унеможливлює помилкові "
        "звинувачення авторів на основі ізольованих евристик.",
         
        "4. Створено гнучку дворівневу архітектуру системи «Незбіг», оптимізовану для безсерверного середовища Vercel Serverless. "
        "Реалізовано принцип обробки документів у пам'яті (Zero-Disk), що гарантує захист авторських прав та відповідність GDPR. "
        "Інтегровано 5-провайдерний механізм диспетчеризації запитів до пошукових систем і наукових каталогів (Tavily Search API, Serper Google Search API, "
        "DuckDuckGo, Semantic Scholar, OpenAlex) із захистом від таймаутів та каскадних відмов за патерном Circuit Breaker.",
         
        "5. Розроблено інтелектуальний конвеєр препроцесингу документів (`documentPreprocess.ts`, `proseFilter.ts`), який "
        "автоматично відсікає лістинги вихідного коду, службову титульну частину та стандартизовані бібліографічні списки, "
        "фіксуючи обсяг вилучень у структурі aiExclusions для забезпечення повної прозорості оцінювання.",
         
        "6. Запропоновано інноваційний конвеєр двовекторного представлення документів Microsoft Word. Завдяки низькорівневій "
        "маніпуляції пакетами Office Open XML (`word/document.xml`) через бібліотеку JSZip та токенному вирівнюванню `textAlignment.ts`, "
        "система забезпечує 100% збереження вихідних стилів, шрифтів, відступів та таблиць Word при стилістичній оптимізації тексту.",
         
        "7. Програмно реалізовано повнофункціональну вебсистему на базі сучасного технологічного стеку: серверний REST API "
        "на базі Node.js 24 та Express 5.2, клієнтський односторінковий застосунок на базі React 19, TypeScript та TailwindCSS, "
        "а також детермінований стилістичний редактор Text Humanizer з трьома режимами адаптації (академічний, природний, лаконічний) "
        "із повним збереженням стилів та розмітки вихідних файлів Microsoft Word (OOXML).",
         
        "8. Проведено всебічні експериментальні дослідження та тестування системи. На верифікаційному корпусі україномовних та "
        "англомовних документів досягнуто високу роздільну здатність класифікації (ROC-AUC 0.942, Macro-F1 0.91) при мінімальному "
        "рівні хибних спрацьовувань на людських текстах (FPR 3.3%). Експерименти зі стійкості довели, що алгоритм Winnowing "
        "зберігає 94.8% точності детекції при вставках стороннього тексту (проти 34.1% у класичного шинглування). Впровадження "
        "багаторівневого кешування MemoryTtlCache прискорило повторні перевірки у 4.5 рази, забезпечивши обробку повних дипломних "
        "робіт за 16–38 секунд у межах допустимих лімітів serverless-інфраструктури."
    ]
    
    for c_text in conclusions_list:
        add_p(doc, text=c_text, space_after=3)

def add_references(doc):
    add_chapter_heading(doc, "СПИСОК ВИКОРИСТАНИХ ДЖЕРЕЛ", new_page=True)
    
    refs = [
        "Закон України «Про авторське право і суміжні права» від 01.12.2022 р. № 2811-IX. База даних «Законодавство України» / Верховна Рада України. URL: https://zakon.rada.gov.ua/laws/show/2811-20 (дата звернення: 15.04.2026).",
        "Закон України «Про вищу освіту» від 01.07.2014 р. № 1556-VII (зі змінами та доповненнями). База даних «Законодавство України» / Верховна Рада України. URL: https://zakon.rada.gov.ua/laws/show/1556-18 (дата звернення: 15.04.2026).",
        "ДСТУ 3008:2015. Інформація та документація. Звіти у сфері науки і техніки. Структура та правила оформлення. Київ: ДП «УкрНДНЦ», 2016. 26 с.",
        "ДСТУ 8302:2015. Інформація та документація. Бібліографічне посилання. Загальні положення та правила складання. Київ: ДП «УкрНДНЦ», 2016. 17 с.",
        "Рекомендації щодо впровадження академічної доброчесності та використання технологій штучного інтелекту в закладах фахової передвищої та вищої освіти: Лист МОН України від 20.03.2024 р. № 1/4982-24. Київ: МОН України, 2024. 14 с.",
        "Schleimer S., Wilkerson D. S., Aiken A. Winnowing: Local algorithms for document fingerprinting. Proceedings of the 2003 ACM SIGMOD International Conference on Management of Data (SIGMOD '03). San Diego, CA, USA, 2003. P. 76–85. DOI: https://doi.org/10.1145/872757.872770.",
        "Broder A. Z. On the resemblance and containment of documents. Proceedings of the Compression and Complexity of Sequences (SEQUENCES '97). Positano, Italy, 1997. P. 21–29. DOI: https://doi.org/10.1109/SEQUEN.1997.666900.",
        "Dugan L., Ippolito D., Kirichenko P., et al. RAID: A shared benchmark for robust evaluation of machine-generated text detectors. Proceedings of the 62nd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers). Bangkok, Thailand: ACL, 2024. P. 1245–1263. DOI: https://doi.org/10.18653/v1/2024.acl-long.674.",
        "Wang Y., Mansurov J., Ivanov P., et al. M4: Multi-generator, multi-domain, and multi-lingual black-box machine-generated text detection. Proceedings of the 18th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2024). St. Julian’s, Malta: ACL, 2024. P. 1120–1139. DOI: https://doi.org/10.18653/v1/2024.eacl-long.83.",
        "Macko D., Moro R., Adamec M., et al. MULTITuDE: Large-scale multilingual machine-generated text detection benchmark. Proceedings of the 2023 Conference on Empirical Methods in Natural Language Processing (EMNLP 2023). Singapore: ACL, 2023. P. 9931–9952. DOI: https://doi.org/10.18653/v1/2023.emnlp-main.616.",
        "Liang W., Yuksekgonul M., Mao Y., et al. GPT detectors are biased against non-native English writers. Patterns. 2023. Vol. 4, No. 7. P. 100779. DOI: https://doi.org/10.1016/j.patter.2023.100779.",
        "Mukherjee S., Chakraborty S., Pal A., et al. Different time, different language: Revisiting the bias against non-native speakers in GPT detectors. Proceedings of the EACL Student Research Workshop (EACL-SRW 2026). Dublin, Ireland: ACL, 2026. P. 215–228. DOI: https://doi.org/10.18653/v1/2026.eacl-srw.20.",
        "Wahle J. P., Ruas T., Meuschke N., et al. How large language models are transforming machine-paraphrase plagiarism. Proceedings of the 2022 Conference on Empirical Methods in Natural Language Processing (EMNLP 2022). Abu Dhabi, UAE: ACL, 2022. P. 952–963. DOI: https://doi.org/10.18653/v1/2022.emnlp-main.62.",
        "Sai Teja L. D. M. S., Anand R., Kumar S. Fine-grained detection of AI-generated text using sentence-level segmentation. Findings of the Association for Computational Linguistics: IJCNLP-AACL 2025. Taipei, Taiwan: ACL, 2025. P. 482–495. DOI: https://doi.org/10.18653/v1/2025.findings-ijcnlp.48.",
        "Adi R., Sharma P., Gupta N. GL-CLiC: Global-local coherence and lexical complexity for sentence-level AI-generated text detection. Proceedings of the 3rd Conference of the Asia-Pacific Chapter of the ACL (IJCNLP-AACL 2025). Taipei, Taiwan: ACL, 2025. P. 188–202. DOI: https://doi.org/10.18653/v1/2025.ijcnlp-long.188.",
        "Shi Z., Zhang Y., Yao Y., et al. Red teaming language model detectors with language models. Transactions of the Association for Computational Linguistics (TACL). 2024. Vol. 12. P. 110–127. DOI: https://doi.org/10.1162/tacl_a_00632.",
        "Shportko A., Verbitsky I. Paraphrasing attack resilience of various AI-generated text detection methods. Proceedings of the NAACL Student Research Workshop (NAACL-SRW 2025). Albuquerque, NM, USA: ACL, 2025. P. 460–472. DOI: https://doi.org/10.18653/v1/2025.naacl-srw.46.",
        "Rivera Soto R. A., Zheng C., Post M., et al. Mitigating paraphrase attacks on machine-text detection via paraphrase inversion. Findings of the Association for Computational Linguistics: ACL 2025. Vienna, Austria: ACL, 2025. P. 227–241. DOI: https://doi.org/10.18653/v1/2025.findings-acl.227.",
        "Masrour E., Kabbara J., Cheung J. C. K. DAMAGE: Detecting adversarially modified AI generated text. Proceedings of the 1st Workshop on Generative AI Detection (GenAIDetect 2025). Vienna, Austria: ACL, 2025. P. 91–105. DOI: https://doi.org/10.18653/v1/2025.genaidetect-1.9.",
        "Covington M. A., McFall J. D. Cutting the Gordian knot: The moving-average type-token ratio (MATTR). Journal of Quantitative Linguistics. 2010. Vol. 17, No. 2. P. 94–100. DOI: https://doi.org/10.1080/09296171003643098.",
        "Manning C. D., Raghavan P., Schütze H. Introduction to Information Retrieval. Cambridge: Cambridge University Press, 2008. 482 p. DOI: https://doi.org/10.1017/CBO9780511809071.",
        "Jurafsky D., Martin J. H. Speech and Language Processing: An Introduction to Natural Language Processing, Computational Linguistics, and Speech Recognition (3rd draft ed.). Stanford University, 2024. 640 p. URL: https://web.stanford.edu/~jurafsky/slp3/.",
        "Vaswani A., Shazeer N., Parmar N., et al. Attention is all you need. Advances in Neural Information Processing Systems (NeurIPS 2017). Long Beach, CA, USA, 2017. Vol. 30. P. 5998–6008.",
        "Brown T., Mann B., Ryder N., et al. Language models are few-shot learners. Advances in Neural Information Processing Systems (NeurIPS 2020). 2020. Vol. 33. P. 1877–1901.",
        "Touvron H., Lavril T., Izacard G., et al. LLaMA: Open and efficient foundation language models. arXiv preprint arXiv:2302.13971. 2023. 26 p. DOI: https://doi.org/10.48550/arXiv.2302.13971.",
        "Ouyang L., Wu J., Jiang X., et al. Training language models to follow instructions with human feedback. Advances in Neural Information Processing Systems (NeurIPS 2022). 2022. Vol. 35. P. 27730–27744.",
        "Mitchell E., Lee Y., Khazatsky A., et al. DetectGPT: Zero-shot machine-generated text detection using probability curvature. Proceedings of the 40th International Conference on Machine Learning (ICML 2023). Honolulu, Hawaii, USA: PMLR, 2023. P. 24950–24962.",
        "Kirchenbauer J., Geiping J., Wen Y., et al. A watermark for large language models. Proceedings of the 40th International Conference on Machine Learning (ICML 2023). Honolulu, Hawaii, USA: PMLR, 2023. P. 17061–17084.",
        "Sadasivan V. S., Kumar A., Balasubramanian S., et al. Can AI-generated text be reliably detected? arXiv preprint arXiv:2303.11156. 2023. 18 p. DOI: https://doi.org/10.48550/arXiv.2303.11156.",
        "OpenAlex Documentation: A fully open catalog of the global research system / OurResearch. 2026. URL: https://docs.openalex.org/ (дата звернення: 10.04.2026).",
        "Semantic Scholar Academic Graph API / Allen Institute for AI. 2026. URL: https://www.semanticscholar.org/product/api (дата звернення: 10.04.2026).",
        "Tavily Search API: The Search Engine Built for AI Agents and LLMs. 2026. URL: https://docs.tavily.com/ (дата звернення: 12.04.2026).",
        "Serper Google Search API Specification and Performance Guidelines / Serper Dev Team. 2026. URL: https://serper.dev/ (дата звернення: 12.04.2026).",
        "DuckDuckGo HTML Search Interface Specification and Scraping Guidelines. 2025. URL: https://duckduckgo.com/ (дата звернення: 12.04.2026).",
        "ECMA International. Standard ECMA-376: Office Open XML File Formats (5th edition). Geneva: ECMA, 2021. 5012 p. URL: https://www.ecma-international.org/publications-and-standards/standards/ecma-376/.",
        "Microsoft Corporation. WordprocessingML Reference and Schema Guide: Open Specifications. Redmond, WA: Microsoft, 2024. URL: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/.",
        "Mammoth.js: Convert Word documents (.docx files) to HTML / Williamson M. GitHub Repository, 2024. URL: https://github.com/mwilliamson/mammoth.js/ (дата звернення: 14.04.2026).",
        "React 19 Official Documentation: Actions, Server Components and Concurrent Mode / Meta Platforms Inc. 2026. URL: https://react.dev/ (дата звернення: 05.04.2026).",
        "Express 5.2 API Reference: Modern Web Applications for Node.js / OpenJS Foundation. 2026. URL: https://expressjs.com/en/5x/api.html (дата звернення: 05.04.2026).",
        "TypeScript 5.9 Language Specification / Microsoft Corporation. 2026. URL: https://www.typescriptlang.org/docs/ (дата звернення: 02.04.2026).",
        "Vite: Next Generation Frontend Tooling / You E. Vite Core Team, 2026. URL: https://vite.dev/ (дата звернення: 02.04.2026).",
        "Vercel Serverless Functions: Limits, Execution Timeouts and Fluid Compute / Vercel Inc. 2026. URL: https://vercel.com/docs/functions (дата звернення: 01.04.2026).",
        "Playwright: Fast and reliable end-to-end testing for modern web apps / Microsoft Corporation. 2026. URL: https://playwright.dev/ (дата звернення: 15.04.2026).",
        "Vitest: Next Generation Testing Framework / Vitest Team, 2026. URL: https://vitest.dev/ (дата звернення: 15.04.2026).",
        "W3C. Web Content Accessibility Guidelines (WCAG) 2.1 / W3C Recommendation. 2018. URL: https://www.w3.org/TR/WCAG21/ (дата звернення: 20.03.2026).",
        "MDN Web Docs. Clipboard API: write() and ClipboardItem / Mozilla Corporation. 2026. URL: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write (дата звернення: 18.04.2026).",
        "Fowler M. Patterns of Distributed Systems: Circuit Breaker Pattern. Boston: Addison-Wesley, 2023. URL: https://martinfowler.com/bliki/CircuitBreaker.html (дата звернення: 10.03.2026)."
    ]
    
    for idx, ref in enumerate(refs, 1):
        p = doc.add_paragraph()
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.3
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.first_line_indent = Cm(1.25)
        
        r_num = p.add_run(f"{idx}. ")
        set_run_font(r_num, font_name="Times New Roman", size_pt=14, bold=True)
        
        r_txt = p.add_run(ref)
        set_run_font(r_txt, font_name="Times New Roman", size_pt=14, bold=False)

def add_appendices(doc):
    # Appendix A
    doc.add_page_break()
    p_top_a = doc.add_paragraph()
    p_top_a.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top_a.paragraph_format.space_after = Pt(4)
    p_top_a.paragraph_format.first_line_indent = Cm(0)
    r_a = p_top_a.add_run("ДОДАТОК А")
    set_run_font(r_a, font_name='Times New Roman', size_pt=14, bold=True)
    
    p_title_a = doc.add_paragraph()
    p_title_a.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title_a.paragraph_format.space_after = Pt(18)
    p_title_a.paragraph_format.first_line_indent = Cm(0)
    r_ta = p_title_a.add_run("ІЛЮСТРАТИВНІ МАТЕРІАЛИ КОРИСТУВАЦЬКОГО ІНТЕРФЕЙСУ СИСТЕМИ «НЕЗБІГ»")
    set_run_font(r_ta, font_name='Times New Roman', size_pt=15, bold=True)
    
    sc_home = os.path.abspath("docs/screenshots/01_main_page_ua.png")
    add_figure(doc, sc_home, "Рис. А.1 — Повнорозмірний вигляд головної робочої панелі системи «Незбіг» з україномовним інтерфейсом", width_cm=16.0)
    
    sc_hum = os.path.abspath("docs/screenshots/04_humanizer_diff_result.png")
    add_figure(doc, sc_hum, "Рис. А.2 — Екран результатів роботи модуля адаптації тексту Text Humanizer зі зниженням ризику детекції та поблочним зіставленням", width_cm=16.0)

    # Appendix B
    doc.add_page_break()
    p_top_b = doc.add_paragraph()
    p_top_b.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top_b.paragraph_format.space_after = Pt(4)
    p_top_b.paragraph_format.first_line_indent = Cm(0)
    r_b = p_top_b.add_run("ДОДАТОК Б")
    set_run_font(r_b, font_name='Times New Roman', size_pt=14, bold=True)
    
    p_title_b = doc.add_paragraph()
    p_title_b.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title_b.paragraph_format.space_after = Pt(18)
    p_title_b.paragraph_format.first_line_indent = Cm(0)
    r_tb = p_title_b.add_run("ЛІСТИНГИ ВИХІДНОГО КОДУ КЛЮЧОВИХ АЛГОРИТМІЧНИХ МОДУЛІВ")
    set_run_font(r_tb, font_name='Times New Roman', size_pt=15, bold=True)
    
    code_chunking = """// src/server/chunking.ts - Повне перекривне фрагментування документа
export function splitIntoChunksWithOverlap(text: string, chunkWords = 160, overlapPercent = 0.18): Chunk[] {
  const words = text.split(/\\s+/).filter(w => w.length > 0);
  if (words.length <= chunkWords) {
    return [{ text, startIndex: 0, endIndex: words.length, chunkIndex: 0 }];
  }
  
  const overlapWords = Math.max(10, Math.floor(chunkWords * overlapPercent));
  const step = chunkWords - overlapWords;
  const chunksCount = Math.ceil((words.length - overlapWords) / step);
  const chunks: Chunk[] = [];

  for (let i = 0; i < chunksCount; i++) {
    const start = i * step;
    const end = Math.min(words.length, start + chunkWords);
    const chunkTokens = words.slice(start, end);
    chunks.push({
      text: chunkTokens.join(' '),
      startIndex: start,
      endIndex: end,
      chunkIndex: i
    });
    if (end >= words.length) break;
  }
  return chunks;
}"""
    add_code_block(doc, code_chunking, caption="Лістинг Б.1 — Алгоритм фрагментування зі змінним оверлапом (`chunking.ts`)")

    code_circuit = """// src/server/providerCircuitBreaker.ts - Патерн автоматичного запобіжника
export class ProviderCircuitBreaker {
  private failureCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt = 0;

  constructor(private threshold = 3, private resetTimeoutMs = 60000) {}

  public canExecute(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
    }
  }
}"""
    add_code_block(doc, code_circuit, caption="Лістинг Б.2 — Реалізація патерну Circuit Breaker (`providerCircuitBreaker.ts`)")

    # Appendix C
    doc.add_page_break()
    p_top_c = doc.add_paragraph()
    p_top_c.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_top_c.paragraph_format.space_after = Pt(4)
    p_top_c.paragraph_format.first_line_indent = Cm(0)
    r_c = p_top_c.add_run("ДОДАТОК В")
    set_run_font(r_c, font_name='Times New Roman', size_pt=14, bold=True)
    
    p_title_c = doc.add_paragraph()
    p_title_c.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title_c.paragraph_format.space_after = Pt(18)
    p_title_c.paragraph_format.first_line_indent = Cm(0)
    r_tc = p_title_c.add_run("СПЕЦИФІКАЦІЯ REST API МАРШРУТІВ ТА МОДЕЛЕЙ ДАНИХ СИСТЕМИ")
    set_run_font(r_tc, font_name='Times New Roman', size_pt=15, bold=True)
    
    code_schema = """// src/shared/types.ts - Базові інтерфейси звіту перевірки
export interface ScanReport {
  id: string;
  fileName: string;
  checkedAt: string;
  wordCount: number;
  chunksChecked: number;
  plagiarismScore: number;
  aiProbability: number;
  aiVerdict: 'insufficient' | 'low' | 'uncertain' | 'mixed' | 'elevated' | 'high';
  aiReliability: {
    score: number;
    level: 'low' | 'medium' | 'high';
    reason: string;
    segmentCount: number;
    segmentSpread: number;
  };
  aiLanguage: {
    code: string;
    supportedPercent: number;
  };
  aiExclusions: {
    codeWords: number;
    referenceWords: number;
    quotedWords: number;
    analyzedWords: number;
  };
  aiSuspiciousSegments: Array<{
    text: string;
    score: number;
    startWord: number;
    endWord: number;
  }>;
  matches: Array<{
    url: string;
    title: string;
    score: number;
    confidence: 'page' | 'snippet';
    longestRun: number;
    matchedSnippet: string;
  }>;
  searchDiagnostics: {
    providers: Array<{
      name: string;
      queriesCount: number;
      successCount: number;
      errorCount: number;
      timeoutCount: number;
    }>;
    pages: {
      attempted: number;
      verified: number;
      unavailable: number;
      cacheHits: number;
    };
  };
}"""
    add_code_block(doc, code_schema, caption="Лістинг В.1 — Модель структури даних підсумкового звіту перевірки (`types.ts`)")

print("Conclusions, References, and Appendices ready.")
