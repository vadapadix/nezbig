export function insertRichHtmlAtSelection(editor: HTMLElement, html: string): void {
  const selection = window.getSelection();
  const activeRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const selectionInsideEditor = activeRange ? editor.contains(activeRange.commonAncestorContainer) : false;

  if (!activeRange || !selectionInsideEditor) {
    editor.insertAdjacentHTML("beforeend", html);
    return;
  }

  activeRange.deleteContents();
  const fragment = activeRange.createContextualFragment(html);
  const lastNode = fragment.lastChild;
  activeRange.insertNode(fragment);

  if (lastNode && selection) {
    const caret = document.createRange();
    caret.setStartAfter(lastNode);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);
  }
}
