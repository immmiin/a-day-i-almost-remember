import "./style.css";
import { renderEntry } from "./ui/entry";
import { renderGeneration } from "./ui/generation-view";
import { renderArchive } from "./ui/archive-view";

const app = document.querySelector<HTMLDivElement>("#app")!;

let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  cleanup = null;
  app.innerHTML = "";

  const hash = window.location.hash.replace(/^#\/?/, "");
  const path = hash.split("?")[0];

  if (path === "archive") {
    cleanup = renderArchive(app);
  } else if (path === "generate") {
    cleanup = renderGeneration(app);
  } else {
    renderEntry(app);
  }
}

window.addEventListener("hashchange", route);
route();
