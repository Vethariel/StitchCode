/**
 * Resize vertical entre editor y consola.
 * @param {{ handle: HTMLElement, editorPanel: HTMLElement, consolePanel: HTMLElement }} els
 */
export function initResizeController({ handle, editorPanel, consolePanel }) {
  let dragging = false;
  let startY = 0;
  let startEd = 0;
  let startCon = 0;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startY = e.clientY;
    startEd = editorPanel.offsetHeight;
    startCon = consolePanel.offsetHeight;
    handle.classList.add("dragging");
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const total = editorPanel.parentElement.clientHeight;
    const edPct = (Math.max(80, startEd + dy) / total) * 100;
    const conPct = (Math.max(60, startCon - dy) / total) * 100;
    editorPanel.style.flex = `0 0 ${edPct}%`;
    consolePanel.style.flex = `0 0 ${conPct}%`;
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.style.userSelect = "";
  });
}
