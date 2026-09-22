import "./style.css";
import { renderDreamFiles } from "./ui/dream-files";
import { renderDreamMachine } from "./ui/dream-machine";
import { renderZineStudio } from "./ui/zine-studio";
import { renderDreamArchive } from "./ui/dream-archive";

const app = document.querySelector<HTMLDivElement>("#app")!;

let cleanup: (() => void) | null = null;

function route(): void {
  cleanup?.();
  cleanup = null;
  app.innerHTML = "";

  const hash = window.location.hash.replace(/^#\/?/, "");
  const path = hash.split("?")[0];

  if (path === "machine") {
    cleanup = renderDreamMachine(app);
  } else if (path === "zine") {
    cleanup = renderZineStudio(app);
  } else if (path === "archive") {
    cleanup = renderDreamArchive(app);
  } else {
    cleanup = renderDreamFiles(app);
  }
}

window.addEventListener("hashchange", route);
route();
