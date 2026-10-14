export function buildDreamNav(active: "files" | "machine" | "zine" | "archive"): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "dream-nav";
  nav.setAttribute("aria-label", "Site");
  const link = (href: string, label: string, key: typeof active) => `
    <a href="${href}"${key === active ? ' class="is-active" aria-current="page"' : ""}>
      <span class="dream-nav__link-label">${label}</span>
      <span class="dream-nav__link-dot" aria-hidden="true"></span>
    </a>`;
  const homeActive = active === "files";
  // One centered group — wordmark and links together, not brand-left/
  // links-right spread across the full bar — so the header reads as one
  // small typographic composition, not a full-width toolbar. "Almost" is
  // the compact nav mark; the full project name stays on the landing
  // title and the publication covers, not repeated small here.
  nav.innerHTML = `
    <div class="dream-nav__group">
      <a href="#/" class="dream-nav__brand${homeActive ? " is-active" : ""}" aria-label="A Day I Almost Remember — Home"${homeActive ? ' aria-current="page"' : ""}>
        <span class="dream-nav__brand-label">Almost</span>
        <span class="dream-nav__link-dot" aria-hidden="true"></span>
      </a>
      <div class="dream-nav__links">
        ${link("#/machine", "Dream Machine", "machine")}
        ${link("#/zine", "Zine Studio", "zine")}
        ${link("#/archive", "Dream Archive", "archive")}
      </div>
    </div>
  `;
  return nav;
}
