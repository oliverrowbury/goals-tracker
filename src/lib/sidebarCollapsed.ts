// Every visual effect of collapsing the sidebar is pure CSS, keyed off the
// "sidebar-collapsed" class on <html> (see globals.css and SIDEBAR_INIT_SCRIPT
// in the root layout) — so there's no React state to track here, just
// flipping that class and remembering the choice. Same localStorage key
// SIDEBAR_INIT_SCRIPT reads on the next page load.
export function toggleSidebarCollapsed(): void {
  const next = !document.documentElement.classList.contains("sidebar-collapsed");
  document.documentElement.classList.toggle("sidebar-collapsed", next);
  try {
    localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
  } catch {
    // not persisted this session — not worth surfacing to the user
  }
}
