const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const paths = {
  book: "M4 4h6c2 0 2 2 2 2s0-2 2-2h6v15h-6c-2 0-2 1-2 1s0-1-2-1H4V4Zm8 2v14",
  home: "m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  layers: "m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5",
  chart: "M4 20V10m8 10V4m8 16v-7",
  settings:
    "m9 3-1 3-3 1-2 3 2 2v3l2 2 3-1 2 2 3-1 1-3 3-1 1-3-2-2V6l-3-1-2-2H9Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  play: "m9 5 11 7-11 7V5Z",
  star: "m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1 3-6Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  sprout: "M12 21V11m0 4C3 16 3 8 3 8s9-1 9 7Zm0-4C12 3 21 3 21 3s1 9-9 8Z",
  compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5 5-3Z",
  flag: "M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0",
  check: "m5 12 4 4 10-10",
  close: "m6 6 12 12M6 18 18 6",
  headphones: "M4 14v-3a8 8 0 0 1 16 0v3M4 12h3v8H3v-7Zm16 0h-3v8h4v-7Z",
  volume: "m4 9 4 0 5-5v16l-5-5H4V9Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 7a6 6 0 0 0 12 0m-6 6v4m-4 0h8",
  keyboard: "M3 5h18v14H3V5Zm4 4h1m3 0h1m3 0h1m-9 4h1m3 0h1m3 0h1m-9 3h10",
  heart: "M12 21 3 12C-2 4 8-1 12 6c4-7 14-2 9 6l-9 9Z",
  fire: "M13 2c2 7-4 7-2 12 3-1 4-4 4-4 8 9-2 15-8 10C1 15 6 9 8 7c-1 6 2 6 2 6-2-5 4-6 3-11Z",
  trophy:
    "M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v6m-4 0h8",
  repeat:
    "m18 3 4 4-4 4M2 11V9a2 2 0 0 1 2-2h18M6 21l-4-4 4-4m16 0v2a2 2 0 0 1-2 2H2",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 2",
  spark: "m12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3 2-7Z",
  bulb: "M9 18c0-5-4-4-4-9a7 7 0 1 1 14 0c0 5-4 4-4 9H9Zm1 3h4",
};
function icon(n, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] || paths.star}"/></svg>`;
}
function art() {
  return `<svg class="hero-art" viewBox="0 0 300 290" aria-hidden="true"><circle cx="174" cy="143" r="101" fill="#d8e1c9"/><circle cx="263" cy="81" r="23" fill="#e8cda7"/><path d="m49 188 24-19 12 24-24 20Z" fill="#b4c398"/><path d="m249 176 24-11 9 32-21 10Z" fill="#b2c396"/><path d="M93 241c39-10 87-10 126 1" fill="none" stroke="#bdcba9" stroke-width="11" stroke-linecap="round"/><g transform="rotate(-12 152 153)"><rect x="74" y="87" width="153" height="132" rx="12" fill="#bc623b"/><path d="M82 92h62q13 0 13 13v108q-7-9-21-9H82Z" fill="#fff9e9"/><path d="M157 105q5-13 17-13h44v113h-44q-12 0-17 8Z" fill="#f4eacf"/><path d="M91 105h36m-36 9h42m-42 9h32m-32 45h43m-43 10h38m-38 10h30" stroke="#d4cfb4" stroke-width="3" stroke-linecap="round"/><path d="m175 117 18 0 9 21-9 9-19-9Z" fill="#d7dfb8"/><path d="m183 118 4-9 5 11" fill="#9db181"/><path d="M174 164h29m-29 10h24m-24 10h28" stroke="#d0c6aa" stroke-width="3" stroke-linecap="round"/><path d="M156 109v96" stroke="#ded2b3" stroke-width="2"/><path d="M104 133q7-12 14 0v12q-7 11-14 0Z" fill="#e99366"/><circle cx="108" cy="138" r="1.5" fill="#78533d"/><circle cx="115" cy="138" r="1.5" fill="#78533d"/><path d="m109 143 3 2 3-2" fill="none" stroke="#78533d" stroke-width="1.3"/></g><g transform="rotate(13 239 57)"><rect x="215" y="29" width="42" height="49" rx="9" fill="#f7eee0"/><text x="236" y="63" text-anchor="middle" font-family="Georgia" font-size="30" fill="#b98555">A</text></g><path d="m73 57 4 10 11 2-9 7 1 11-9-6-10 4 3-10-7-8 11-1Z" fill="#e79a65"/><path d="m249 139 2 6 7 1-6 4 1 7-6-4-6 3 2-7-5-5 7 1Z" fill="#93a574"/><path d="m130 38 2 5 5 1-4 3v5l-4-3-5 2 2-5-3-4 5 1Z" fill="#a9b98d"/><path d="M232 234q15-20 18-35m-8 21q14-1 16-13m-15 14q-10-6-6-16" fill="none" stroke="#839966" stroke-width="3" stroke-linecap="round"/></svg>`;
}
