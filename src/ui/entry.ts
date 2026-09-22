export function renderEntry(root: HTMLElement): void {
  const section = document.createElement("section");
  section.className = "view entry";
  section.setAttribute("aria-labelledby", "entry-title");

  section.innerHTML = `
    <div class="entry__grain" aria-hidden="true"></div>
    <div class="entry__frame">
      <h1 class="entry__title" id="entry-title">
        <span class="entry__title-line entry__title-line--1">A Day</span>
        <span class="entry__title-line entry__title-line--2">I Almost</span>
        <span class="entry__title-line entry__title-line--3">Remember</span>
      </h1>
      <div class="entry__body">
        <p class="entry__statement">
          A generator, not a story. Each scene remembers only <strong>two or three fragments</strong>
          of the one before it, forgets the rest, and lets exactly one surviving fragment come back
          changed. The protagonist never seems to notice. Morning drifts to night this way, one
          withheld detail at a time, until the ordinary day is barely itself.
        </p>
        <button type="button" class="entry__cta" id="begin-day">
          Begin a day <span class="entry__cta-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </div>
    <p class="entry__colophon">a procedural memory · remember → forget → distort → pass forward</p>
  `;

  root.appendChild(section);

  const beginBtn = section.querySelector<HTMLButtonElement>("#begin-day")!;
  beginBtn.addEventListener("click", () => {
    window.location.hash = "#/generate?new=1";
  });
}
