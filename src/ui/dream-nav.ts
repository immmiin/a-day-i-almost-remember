export function buildDreamNav(active: "files" | "machine" | "zine" | "archive"): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "dream-nav";
  nav.setAttribute("aria-label", "Site");
  const link = (href: string, label: string, key: typeof active) =>
    `<a href="${href}"${key === active ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`;
  nav.innerHTML = `
    <a href="#/" class="dream-nav__brand" aria-label="Home" title="Home">
      <svg class="dream-nav__brand-icon" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false">
        <path d="M4 11.5 12 4l8 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 10.3V20h5v-6h2v6h5v-9.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </a>
    <div class="dream-nav__links">
      ${link("#/machine", "dream machine", "machine")}
      ${link("#/zine", "zine studio", "zine")}
      ${link("#/archive", "dream archive", "archive")}
    </div>
  `;
  return nav;
}
