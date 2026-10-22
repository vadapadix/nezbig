import type { TextEditorProps } from "../types/TextEditor.types";
export type { TextEditorProps } from "../types/TextEditor.types";


export function TextEditor({
  editorRef,
  selectedFile,
  fileName,
  sourceHtml,
  formattedPreviewBusy,
  onInput,
  onPaste,
  onFileChange,
  onClearFile,
  onCopyFormatted,
  onDownloadFormatted,
  draftSaved,
  wordCount
}: TextEditorProps) {
  return (
    <section className="input-panel" aria-labelledby="input-title">
      <div className="panel-heading">
        <div>
          <h2 id="input-title">Документ</h2>
          <p>
            {selectedFile ? `${fileName} - ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : fileName}
            {draftSaved && <span className="draft-saved"> · Збережено</span>}
          </p>
        </div>
        <label className="file-button">
          <input
            name="document"
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.rtf,.docx,.pdf,text/*,application/pdf"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          Завантажити файл
        </label>
        <p className="file-hint">або перетягніть файл сюди</p>
      </div>

      <label className="text-label" htmlFor="source-text">
        Текст для перевірки
      </label>
      <div
        ref={editorRef}
        id="source-text"
        className={selectedFile ? "rich-editor rich-editor-readonly" : "rich-editor"}
        role="textbox"
        aria-multiline="true"
        aria-label="Текст для перевірки"
        contentEditable={selectedFile === null}
        suppressContentEditableWarning
        data-empty={sourceHtml.trim().length === 0 ? "true" : "false"}
        data-placeholder={
          selectedFile
            ? formattedPreviewBusy
              ? "Читаємо форматування файлу…"
              : "Файл прикріплено. Форматований preview з'явиться тут, якщо формат підтримується."
            : "Вставте текст із Word або завантажте документ…"
        }
        onInput={onInput}
        onPaste={onPaste}
      />
      
      {sourceHtml.trim().length === 0 && !selectedFile && (
        <div className="editor-empty-state">
          <p>Вставте текст із Word або перетягніть файл сюди</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const sample = "Штучний інтелект (ШІ) — це галузь комп'ютерних наук, яка займається створенням систем, здатних виконувати завдання, що зазвичай потребують людського інтелекту. До таких завдань належать розпізнавання мови, прийняття рішень, візуальне сприйняття та переклад текстів. Сучасні моделі ШІ, зокрема великі мовні моделі, здатні генерувати тексти, які важко відрізнити від написаних людиною...";
              onFileChange(null);
              if (editorRef.current) {
                editorRef.current.innerText = sample;
                onInput();
              }
            }}
          >
            Вставити приклад
          </button>
        </div>
      )}

      <div className="editor-footer">
        <span className="word-count">
          {wordCount} {wordCount === 1 ? "слово" : wordCount < 5 ? "слова" : "слів"}
        </span>
        {wordCount > 0 && wordCount < 120 && (
          <span className="word-count-hint">
            Ще {120 - wordCount} {120 - wordCount === 1 ? "слово" : 120 - wordCount < 5 ? "слова" : "слів"} до мінімуму
          </span>
        )}
      </div>

      {sourceHtml.trim() ? (
        <div className="format-actions" aria-label="Дії з форматованим текстом">
          <button type="button" className="secondary-button" onClick={onCopyFormatted}>
            Копіювати у Word
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onDownloadFormatted}
          >
            {selectedFile ? "Завантажити оригінал" : "Завантажити для Word"}
          </button>
          <span>
            {selectedFile
              ? "Оригінальний файл не перетворюється; preview і текст для аналізу зберігаються окремо."
              : "Шрифти, розміри, вирівнювання, відступи, списки й таблиці зберігаються окремо від тексту для аналізу."}
          </span>
        </div>
      ) : null}
      {selectedFile ? (
        <div className="file-mode">
          <strong>Файловий режим</strong>
          <span>Preview і редактор зберігають абзаци, заголовки, списки, таблиці та базові стилі Word; перевірка йде оригінальним файлом.</span>
          <button
            type="button"
            className="secondary-button"
            onClick={onClearFile}
          >
            Прибрати файл
          </button>
        </div>
      ) : null}
    </section>
  );
}
