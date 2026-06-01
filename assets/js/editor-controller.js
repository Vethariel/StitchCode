/**
 * Editor de texto Woven con números de línea.
 * @param {{ codeArea: HTMLTextAreaElement, lineNumbers: HTMLElement }} els
 */
export function createEditorController({ codeArea, lineNumbers }) {
  function updateLines() {
    const n = codeArea.value.split("\n").length;
    lineNumbers.innerHTML = Array.from(
      { length: n },
      (_, i) => `<span id="ln${i + 1}">${i + 1}</span>`
    ).join("");
    updateActiveLine();
  }

  function syncScroll() {
    lineNumbers.scrollTop = codeArea.scrollTop;
  }

  function updateActiveLine() {
    const cur = codeArea.value.substring(0, codeArea.selectionStart).split("\n").length;
    lineNumbers.querySelectorAll("span").forEach((el, i) => {
      el.classList.toggle("active", i + 1 === cur);
    });
  }

  function handleTab(event) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    codeArea.value = `${codeArea.value.slice(0, start)}  ${codeArea.value.slice(end)}`;
    codeArea.selectionStart = codeArea.selectionEnd = start + 2;
    updateLines();
  }

  codeArea.addEventListener("input", updateLines);
  codeArea.addEventListener("scroll", syncScroll);
  codeArea.addEventListener("click", updateActiveLine);
  codeArea.addEventListener("keyup", updateActiveLine);
  codeArea.addEventListener("keydown", handleTab);

  updateLines();

  return {
    getCode() {
      return codeArea.value;
    },
  };
}
