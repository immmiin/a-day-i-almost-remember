export function buildDreamNav(active: "files" | "machine" | "zine" | "archive"): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "dream-nav";
  nav.setAttribute("aria-label", "Site");
  const link = (href: string, label: string, key: typeof active) =>
    `<a href="${href}"${key === active ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`;
  nav.innerHTML = `
    <a href="#/" class="dream-nav__brand" aria-label="A Day I Almost Remember — home">
      <span class="dream-nav__brand-top">a day i</span>
      <span class="dream-nav__brand-main" data-echo="almost remember">almost remember</span>
    </a>
    <div class="dream-nav__links">
      ${link("#/machine", "dream machine", "machine")}
      ${link("#/zine", "zine studio", "zine")}
      ${link("#/archive", "dream archive", "archive")}
    </div>
  `;
  return nav;
}
