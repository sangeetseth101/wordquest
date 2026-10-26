// Give resource failures an actionable screen instead of an endless loading shell.
window.addEventListener(
  "error",
  function (event) {
    const resource = event.target;
    if (!resource || !["SCRIPT", "LINK"].includes(resource.tagName)) return;
    const root = document.getElementById("app");
    if (!root || !root.querySelector(".boot")) return;
    const heading = document.createElement("h2");
    heading.textContent = "Your word world could not load.";
    const detail = document.createElement("p");
    detail.textContent =
      "A page file is missing from this deployment. Refresh once; if it still happens, the owner needs to redeploy the latest WordQuest version.";
    root.replaceChildren(heading, detail);
    root.style.padding = "40px";
  },
  true,
);
