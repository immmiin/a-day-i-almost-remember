export function buildNav(active: "generate" | "archive"): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Site");
  nav.innerHTML = `
    <a href="#/" class="site-nav__brand">a day i almost remember</a>
    <div class="site-nav__links">
      <a href="#/generate"${active === "generate" ? ' class="is-active" aria-current="page"' : ""}>generate</a>
      <a href="#/archive"${active === "archive" ? ' class="is-active" aria-current="page"' : ""}>dream archive</a>
    </div>
  `;
  return nav;
}
