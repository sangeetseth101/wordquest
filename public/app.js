/* WordQuest client. All account data, lesson attempts and AI calls live on the server. */
let session = null,
  dashboard = null,
  active = null,
  messages = [],
  collection = [],
  guardianData = null;
let page = "home",
  busy = false,
  chatBusy = false,
  loading = true,
  voices = [],
  speechRun = 0,
  recognition = null;
let ui = {
  feedback: "",
  good: false,
  listened: false,
  hint: false,
  draft: "",
  transcript: "",
  selected: null,
  wordFilter: "All",
  search: "",
  topic: "All",
  chatLanguage: "hi-IN",
};
const INTERESTS = [
  "cricket",
  "football",
  "animals",
  "space",
  "nature",
  "games",
  "art",
  "food",
  "music",
  "school",
];
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const firstName = () => session?.user?.name.split(" ")[0] || "Explorer";
const profile = () => session.user.profile;
const stats = () =>
  dashboard?.stats || {
    xp: 0,
    completed: 0,
    stars: 0,
    words: 0,
    spelling: 0,
    meaning: 0,
    accuracy: null,
    due: 0,
    today: 0,
    streak: 0,
    days: {},
  };
const connected = () =>
  dashboard?.ai?.connected ?? session?.ai?.connected ?? false;
const levelInfo = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    4500,
  );
}
async function api(path, method = "GET", data) {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server did not respond clearly. Please retry.");
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/login") {
      session = null;
      render();
    }
    const err = new Error(payload.error || "Please try again.");
    err.code = payload.code;
    throw err;
  }
  return payload;
}
function setFeedback(text, good = false) {
  ui.feedback = text;
  ui.good = good;
  render();
}
function aiBadge() {
  return `<span class="status-badge ${connected() ? "online" : ""}"><i></i>${connected() ? "AI connected" : "Practice mode"}</span>`;
}
function brand() {
  return `<a class="brand" href="#home" data-action="nav" data-value="home"><span class="brand-mark">${icon("book", 23)}</span><span class="brand-text">WordQuest<span style="color:#e87847">.</span></span></a>`;
}
function pip(size = "") {
  return `<span class="pip-avatar ${size}" aria-hidden="true"><span class="pip-eyes"><i></i><i></i></span><span class="pip-smile"></span><span class="pip-leaf"></span></span>`;
}
function tutorBubble(text) {
  return `<div class="tutor-bubble">${pip("tiny")}<div><b>PIP · YOUR AI READING COACH</b>${esc(text)}</div></div>`;
}
function layout(content, title, subtitle) {
  const guardian = session.user.role === "guardian";
  return `<div class="shell"><aside class="sidebar">${brand()}<p class="brand-sub">Small steps. Big worlds.</p><nav class="nav" aria-label="Main navigation">${(guardian
    ? [["guardian", "settings", "Guardian controls"]]
    : [
        ["home", "home", "My adventure"],
        ["tutor", "headphones", "Talk to Pip"],
        ["journey", "map", "Learning path"],
        ["words", "layers", "My words"],
        ["progress", "chart", "My progress"],
        ["settings", "settings", "My settings"],
      ]
  )
    .map(
      ([p, i, n]) =>
        `<button class="nav-btn ${p === page ? "active" : ""} ${p === "settings" ? "desktop-only" : ""}" data-action="nav" data-value="${p}" ${p === page ? 'aria-current="page"' : ""}>${icon(i)}<span>${n}</span></button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-bottom"><div class="side-note">${pip("small")}<b>Meet Pip. Grow together.</b>A patient AI coach.<br>A new adventure, every little step.</div><div class="profile"><div class="avatar">${esc(firstName()[0])}</div><div><b>${esc(session.user.name)}</b><small>${guardian ? "Guardian account" : "Your own learning journey"}</small></div><button class="text-btn logout-side" data-action="logout" aria-label="Sign out">${icon("arrow", 16)}</button></div></div></aside><main class="main"><div class="mobile-brand">${brand()}<button class="icon-btn" data-action="${guardian ? "logout" : "nav"}" data-value="settings" aria-label="${guardian ? "Sign out" : "Open settings"}">${icon(guardian ? "arrow" : "settings", 18)}</button></div><header class="topbar"><div><span class="eyebrow">${guardian ? "A LITTLE GUIDANCE GOES A LONG WAY" : "YOUR WORLD. YOUR WORDS. YOUR PACE."}</span><h1>${title}</h1><p>${subtitle}</p></div><div class="top-actions">${guardian ? "" : `<span class="chip fire">${icon("fire", 15)} ${stats().streak} day streak</span><span class="chip">${icon("star", 15)} ${stats().xp} XP</span>`}<button class="icon-btn" data-action="logout" aria-label="Sign out">${icon("arrow", 17)}</button></div></header>${content}<div class="footer-note">${icon("heart", 12)} Every attempt matters. You can always take a break.</div></main></div>`;
}
function loginView() {
  return `<main class="login-shell"><section class="login-story">${brand()}<span class="eyebrow">A FRIENDLY PLACE TO FIND YOUR WORDS</span><h1>Your next chapter<br>starts with a <em>hello.</em></h1><p>A patient coach. Adventures made for you.<br>A little more confidence, one word at a time.</p><div class="login-art">${art()}${pip("large")}</div><div class="login-promises"><span>${icon("volume", 17)} Listen & speak</span><span>${icon("sprout", 17)} Grow at your pace</span><span>${icon("spark", 17)} Your own adventures</span></div></section><section class="login-form-panel"><div class="login-form-wrap"><span class="eyebrow">YOUR WORD WORLD IS WAITING</span><h2>Good to see you.</h2><p>Sign in and pick up your adventure.</p><form id="login-form"><label class="field"><span>Username</span><input name="username" id="login-username" autocomplete="username" placeholder="Your username" required maxlength="60"></label><label class="field"><span>Password</span><span class="password-wrap"><input name="password" id="login-password" autocomplete="current-password" placeholder="Your password" type="password" required maxlength="128"><button type="button" class="password-toggle" data-action="show-password">Show</button></span></label>${ui.feedback ? `<div class="feedback" role="alert">${esc(ui.feedback)}</div>` : ""}<button class="primary full-width" type="submit" ${busy ? "disabled" : ""}>${busy ? "Opening your world…" : "Let’s begin"} ${icon("arrow", 17)}</button></form><p class="login-help">Need help signing in? Ask your guardian.<br>Guardian accounts use the same sign-in form.</p><span class="login-foot">${icon("heart", 13)} A little practice. A world of possibilities.</span></div></section></main>`;
}
function onboarding() {
  const p = profile(),
    chosen = ui.interests || p.interests;
  return `<main class="onboarding"><header>${brand()}<button class="text-btn" data-action="logout">Sign out</button></header><section>${pip("large")}<span class="eyebrow">HI ${esc(firstName().toUpperCase())}. I’M PIP.</span><h1>Let’s make this your adventure.</h1><p>Tell me a little about what you enjoy. We’ll start gently.</p><h3>What do you love exploring?</h3><div class="interest-chips">${INTERESTS.map((t) => `<button class="interest ${chosen.includes(t) ? "selected" : ""}" data-action="interest" data-value="${t}" aria-pressed="${chosen.includes(t)}">${titleCase(t)} ${chosen.includes(t) ? icon("check", 13) : ""}</button>`).join("")}</div><h3>Where shall we start?</h3><div class="comfort-options">${[
    [
      "foundation",
      "From the very beginning",
      "Letters and little words need practice.",
    ],
    ["basic", "I know some small words", "Let’s grow my everyday vocabulary."],
    ["beginner", "I can read a little", "I want to try short sentences."],
  ]
    .map(
      ([l, t, d]) =>
        `<button class="comfort ${(ui.startLevel || p.level) === l ? "selected" : ""}" data-action="comfort" data-value="${l}"><b>${t}</b><span>${d}</span></button>`,
    )
    .join(
      "",
    )}</div><p class="notice">This is a starting point, not a test. Pip will use your actual practice to suggest the next step.</p><button class="primary" data-action="finish-onboarding" ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Meet my reading buddy"} ${icon("arrow", 16)}</button></section></main>`;
}
function home() {
  const s = stats(),
    p = profile(),
    rec = dashboard?.recommendation || {
      level: p.level,
      reason: "Small steps are a great place to start.",
    },
    goal = Math.min(1, s.today / p.goal),
    circle = 370.7;
  return layout(
    `<div class="content-grid"><div><section class="hero intelligent-hero"><div class="hero-copy"><span class="hero-tag">${icon("spark", 12)} AN ADVENTURE THAT GROWS WITH YOU</span><h2>Hello, ${esc(firstName())}.<br><span>What’s our next story?</span></h2><p>${esc(p.interests.slice(0, 2).map(titleCase).join(", ")) || "A world of possibilities"}. New words.<br>A little more confidence every day.</p><button class="primary" data-action="${active ? "resume" : "generate"}" ${busy ? "disabled" : ""}>${busy ? "Making your adventure…" : active ? "Continue my adventure" : connected() ? "Create my adventure" : "Start my next adventure"} ${icon("arrow", 16)}</button><span class="hero-mode">${aiBadge()}</span></div>${art()}</section><div class="mood-row"><span>How are you feeling today?</span>${[
      ["ready", "Ready"],
      ["curious", "Curious"],
      ["tired", "A little tired"],
      ["frustrated", "Finding it tricky"],
    ]
      .map(
        ([v, t]) =>
          `<button data-action="mood" data-value="${v}" class="mood ${p.mood === v ? "selected" : ""}">${t}</button>`,
      )
      .join(
        "",
      )}</div><div class="personal-note">${icon("compass", 20)}<div><b>Your next small step · ${levelInfo(rec.level).name}</b><p>${esc(rec.reason)}${s.due ? " " + s.due + " words are ready for another practice." : ""}</p></div></div><div class="section-head"><h2>Your adventure journal</h2><button class="text-btn" data-action="nav" data-value="journey">Explore lessons ${icon("chevron", 12)}</button></div><div class="lesson-list">${
      dashboard?.adventures?.length
        ? dashboard.adventures
            .slice(0, 4)
            .map((a, i) => adventureRow(a, i))
            .join("")
        : `<div class="empty journal-empty">${icon("sprout", 25)}<h3>A fresh little beginning.</h3><p>Your adventures will collect here. Let’s make the first one.</p><button class="secondary" data-action="generate" ${busy ? "disabled" : ""}>${icon("spark", 15)} ${connected() ? "Create an adventure" : "Choose my first practice"}</button></div>`
    }</div></div><aside class="right-col"><section class="panel pip-panel"><div class="pip-panel-head">${pip()}<div><h3>Your buddy, Pip</h3>${aiBadge()}</div></div><p>${connected() ? `“Hi ${esc(firstName())}! We can talk, explore new words, and take things one step at a time.”` : "“We can practise together now. Your guardian can connect AI for open conversation and freshly written adventures.”"}</p><button class="primary full-width" data-action="nav" data-value="tutor">${icon("mic", 16)} Let’s talk</button></section><section class="panel"><div class="goal-header"><h3>Your daily little goal</h3><button class="icon-btn" data-action="nav" data-value="settings" aria-label="Change daily goal">${icon("settings", 15)}</button></div><div class="goal-ring"><svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="59" fill="none" stroke="#eff1e9" stroke-width="8"/><circle cx="70" cy="70" r="59" fill="none" stroke="#93a878" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circle}" stroke-dashoffset="${circle * (1 - goal)}"/></svg><div class="ring-copy"><strong>${s.today}<span style="display:inline;font-size:17px;color:#abb59e"> / ${p.goal}</span></strong><span>lessons today</span></div></div><p class="goal-label">${goal >= 1 ? "Today’s little goal is complete. Lovely effort!" : "A few minutes. A few new words.<br>At a pace that feels right."}</p></section><section class="panel stats-panel"><h3>A growing word world</h3><p class="stat-line"><span>Words practised</span><b>${s.words}</b></p><p class="stat-line"><span>Adventures completed</span><b>${s.completed}</b></p><p class="stat-line"><span>Meaning recognised</span><b>${s.meaning}</b></p></section></aside></div>`,
    `A little adventure, just for you.`,
    `Your interests, your practice, your next small step.`,
  );
}
function adventureRow(a, n) {
  return `<button class="lesson-row" data-action="open-adventure" data-value="${a.data.id}" style="width:100%;text-align:left"><span class="lesson-num">${icon(a.completed ? "check" : "book", 20)}</span><span class="lesson-info"><h3>${esc(a.data.title)}</h3><p>${levelInfo(a.data.level).name} · ${a.data.items.length} words & sentences · ${a.data.source === "ai" ? "Created for you" : "Prepared practice"}</p></span><span class="pill">${a.completed ? "Complete" : "Continue"}</span><span class="row-play">${icon(a.completed ? "check" : "play", 13)}</span></button>`;
}
function journey() {
  return layout(
    `<p class="page-intro">A familiar lesson or a brand-new AI adventure. Choose what feels right today.</p><div class="journey-banner"><div>${icon("spark", 23)}<b>${connected() ? "A new adventure, built around you." : "Your next practice, chosen around you."}</b><p>We’ll revisit tricky words and take a small step forward.</p></div><button class="primary" data-action="generate" ${busy ? "disabled" : ""}>${busy ? "Creating…" : "Surprise me"} ${icon("arrow", 15)}</button></div><div class="filter-row">${["All", "School", "Home", "Animals", "Nature", "Actions", "Feelings", "Play"].map((t) => `<button class="filter ${ui.topic === t ? "active" : ""}" data-action="topic" data-value="${t}">${t}</button>`).join("")}</div>${LEVELS.map(
      (l) => {
        const lessons = LESSONS.filter(
          (x) =>
            x.level === l.id && (ui.topic === "All" || x.topic === ui.topic),
        );
        return lessons.length
          ? `<section class="journey-section"><div class="journey-title"><span class="level-icon ${l.color}">${icon(l.icon, 24)}</span><div><h2>${l.name}</h2><p>${l.tag}</p></div></div><div class="lesson-list">${lessons.map((x, i) => `<button class="lesson-row" data-action="template" data-value="${x.id}" style="width:100%;text-align:left"><span class="lesson-num">${i + 1}</span><span class="lesson-info"><h3>${esc(x.title)}</h3><p>${x.items.length} words & sentences · ${x.topic}</p></span><span class="row-play">${icon("play", 13)}</span></button>`).join("")}</div></section>`
          : "";
      },
    ).join("")}`,
    "Where shall we explore?",
    "Prepared lessons are always available, even when AI is disconnected.",
  );
}
function tutorView() {
  return layout(
    `<div class="chat-layout"><section class="chat-panel"><div class="chat-header">${pip()}<div><h2>Pip, your reading buddy</h2><p>An AI coach. A patient place to practise.</p></div>${aiBadge()}</div>${!connected() ? '<div class="chat-notice">Pip is in prepared practice mode. A guardian needs to connect OpenRouter for open-ended conversation.</div>' : ""}<div class="chat-messages" id="chat-messages" aria-live="polite">${!messages.length ? `<div class="chat-welcome">${pip("large")}<h3>Hi ${esc(firstName())}. I’m Pip.</h3><p>Tell me about your day, ask about a word,<br>or let’s try something tiny together.</p><div class="suggestions">${["Hi Pip!", "Can we learn about cricket?", "Reading feels difficult today."].map((t) => `<button class="secondary" data-action="suggestion" data-value="${esc(t)}">${t}</button>`).join("")}</div></div>` : messages.map((m, i) => `<article class="chat-message ${m.role === "user" ? "from-me" : "from-pip"}">${m.role === "assistant" ? pip("tiny") : ""}<div class="message-body"><small>${m.role === "user" ? esc(firstName()) : "Pip" + (m.source === "practice" ? " · Practice mode" : " · AI")}</small><p>${esc(m.text)}</p>${m.english ? `<div class="chat-english">${icon("book", 14)} ${esc(m.english)}</div>` : ""}${m.prompt ? `<p class="chat-question">${esc(m.prompt)}</p>` : ""}${m.role === "assistant" ? `<button class="text-btn" data-action="message-audio" data-value="${i}" aria-label="Listen to Pip’s message">${icon("volume", 14)} Listen</button>` : ""}</div></article>`).join("")}${chatBusy ? `<article class="chat-message from-pip">${pip("tiny")}<div class="message-body"><small>Pip is thinking</small><span class="thinking"><i></i><i></i><i></i></span></div></article>` : ""}</div><form id="chat-form" class="chat-composer"><label class="sr-only" for="chat-input">Your message to Pip</label><textarea id="chat-input" maxlength="600" placeholder="Say hello, ask about a word, or tell Pip how you feel…" ${chatBusy ? "disabled" : ""}>${esc(ui.draft)}</textarea><div class="composer-tools"><div><select id="chat-language" aria-label="Speaking language"><option value="hi-IN" ${ui.chatLanguage === "hi-IN" ? "selected" : ""}>Hindi / Hinglish</option><option value="en-IN" ${ui.chatLanguage === "en-IN" ? "selected" : ""}>English</option></select><button class="icon-btn ${ui.recording ? "recording" : ""}" type="button" data-action="chat-mic" aria-label="${ui.recording ? "Stop microphone" : "Speak your message"}" ${chatBusy ? "disabled" : ""}>${icon("mic", 18)}</button></div><button class="primary" type="submit" ${chatBusy ? "disabled" : ""}>${chatBusy ? "Thinking…" : "Send"} ${icon("arrow", 16)}</button></div><small>${ui.recording ? "Listening… tap the mic to stop." : "Tap the mic to speak. Review the text, then send. No audio is stored by this app."}</small></form></section><aside class="chat-sidebar"><section class="panel"><h3>A buddy who learns with you</h3><p>Pip uses your interests, recent conversation, and reading practice to choose a helpful next step.</p><div class="memory-tag">${icon("compass", 15)} ${levelInfo(dashboard?.recommendation?.level || profile().level).name}</div><div class="interest-chips compact">${profile()
      .interests.map((t) => `<span class="pill">${titleCase(t)}</span>`)
      .join(
        "",
      )}</div><button class="primary full-width" data-action="generate" ${busy ? "disabled" : ""}>${icon("spark", 15)} Make an adventure</button></section><section class="panel gentle-panel"><h3>It’s okay to go slowly.</h3><p>You can make mistakes, ask again, or take a break. Pip is an AI coach; your family and teachers are here for you too.</p></section></aside></div>`,
    "A conversation can be a little adventure.",
    "Talk in Hindi, Hinglish or English. We’ll find the words together.",
  );
}
function wordsView() {
  const due = (w) => w.due_at * 1000 <= Date.now(),
    items = collection.filter(
      (w) =>
        (ui.wordFilter === "All" || due(w)) &&
        `${w.word} ${w.hindi} ${w.roman}`
          .toLowerCase()
          .includes(ui.search.toLowerCase()),
    );
  return layout(
    `<input class="search-input" id="word-search" aria-label="Search your words" placeholder="Find a word or its meaning…" value="${esc(ui.search)}"><div class="filter-row">${["All", "Ready to revisit"].map((t) => `<button class="filter ${ui.wordFilter === t ? "active" : ""}" data-action="word-filter" data-value="${t}">${t}</button>`).join("")}</div>${items.length ? `<div class="vocab-grid">${items.map((w) => `<article class="word-card"><div class="word-top"><span class="pill">${due(w) ? "Ready to revisit" : "Growing with practice"}</span><button class="icon-btn" data-action="word-audio" data-value="${esc(w.word)}" aria-label="Listen to ${esc(w.word)}">${icon("volume", 17)}</button></div><h3>${esc(w.word)}</h3><p>${esc(w.hindi)}</p><small>${esc(w.roman)}</small><small class="word-context">${esc(w.english)}</small><p class="word-attempts">${w.attempts} practice attempts · ${w.successes} successful</p></article>`).join("")}</div>` : '<div class="empty"><h3>Your word world is waiting.</h3><p>Words you practise will collect here. Tricky ones return sooner.</p><button class="primary" data-action="generate">Start a little practice</button></div>'}`,
    "Your words, growing with you.",
    "A familiar word today can feel easier tomorrow.",
  );
}
function progressView() {
  const s = stats();
  return layout(
    `<div class="stat-cards">${[
      ["star", s.xp, "XP earned"],
      ["book", s.words, "Words practised"],
      ["flag", s.completed, "Adventures complete"],
      ["fire", s.streak, "Day streak"],
    ]
      .map(
        ([i, n, t]) =>
          `<div class="stat-card">${icon(i, 22)}<strong>${n}</strong><span>${t}</span></div>`,
      )
      .join(
        "",
      )}</div><div class="content-grid"><section class="panel"><h3>Your last seven days</h3><div class="week-chart">${Array.from(
      { length: 7 },
      (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
          n = s.days[key] || 0;
        return `<div class="week-day"><b>${n}</b><div class="week-bar" style="height:${Math.max(5, Math.min(110, n * 30))}px"></div><small>${d.toLocaleDateString("en", { weekday: "short" })}</small></div>`;
      },
    ).join(
      "",
    )}</div><div class="notice">A missed day is just a missed day. Your progress is still here.</div></section><section class="panel"><h3>Small skills, growing steadily</h3><p class="stat-line"><span>Spelling practised correctly</span><b>${s.spelling}</b></p><p class="stat-line"><span>Meaning recognised</span><b>${s.meaning}</b></p><p class="stat-line"><span>Recent unassisted accuracy</span><b>${s.accuracy === null ? "Not yet" : s.accuracy + "%"}</b></p><p class="stat-line"><span>Ready for review</span><b>${s.due}</b></p><p class="notice" style="margin-top:23px">Speaking transcripts and self-reports are practice evidence, not pronunciation scores. Level suggestions use unassisted spelling and meaning answers.</p></section></div>`,
    "Look at those little steps.",
    "Saved to your account, so your story can continue.",
  );
}
function voiceOptions(lang, selected) {
  return (
    `<option value="">Automatic · ${lang === "en" ? "Indian English preferred" : "Hindi preferred"}</option>` +
    voices
      .filter(
        (v) =>
          v.lang.startsWith(lang) &&
          !/(boing|bells|bubbles|bad news|good news|bahh|cellos|organ|trinoids|wobble|zarvox|whisper|superstar|jester)/i.test(
            v.name,
          ),
      )
      .map(
        (v) =>
          `<option value="${esc(v.voiceURI)}" ${v.voiceURI === selected ? "selected" : ""}>${esc(v.name)} (${v.lang})</option>`,
      )
      .join("")
  );
}
function settingsView() {
  const p = profile();
  return layout(
    `<form id="settings-form" class="settings-grid"><section class="panel"><h3>A pace that feels right</h3><label class="field"><span>Starting level</span><select id="level-setting">${LEVELS.map((l) => `<option value="${l.id}" ${p.level === l.id ? "selected" : ""}>${l.name} · ${l.tag}</option>`).join("")}</select></label><label class="field"><span>Your daily little goal</span><select id="goal-setting">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${p.goal === n ? "selected" : ""}>${n} adventure${n > 1 ? "s" : ""}</option>`).join("")}</select></label><label class="toggle-line"><span><b>Gentle level suggestions</b><small>Use practice evidence to suggest an easier or harder step.</small></span><input id="auto-level-setting" type="checkbox" ${p.autoLevel ? "checked" : ""}></label><label class="toggle-line"><span><b>Read-aloud practice</b><small>Use the mic or read together.</small></span><input id="mic-setting" type="checkbox" ${p.mic ? "checked" : ""}></label><label class="toggle-line"><span><b>Typing practice</b><small>Try spelling each new word.</small></span><input id="typing-setting" type="checkbox" ${p.typing ? "checked" : ""}></label><label class="field"><span>Your interests</span><span class="interest-chips compact">${INTERESTS.map((t) => `<label class="check-interest"><input type="checkbox" name="interest" value="${t}" ${p.interests.includes(t) ? "checked" : ""}>${titleCase(t)}</label>`).join("")}</span></label><button class="primary" type="submit" ${busy ? "disabled" : ""}>Save my settings ${icon("check", 15)}</button></section><section class="panel"><h3>A voice that feels familiar</h3><label class="field"><span>English voice</span><select id="voice-setting">${voiceOptions("en", p.voice)}</select></label><label class="field"><span>Hindi voice</span><select id="hi-voice-setting">${voiceOptions("hi", p.hiVoice)}</select></label><label class="field"><span>Reading speed</span><select id="rate-setting">${[
      [0.65, "Extra gentle"],
      [0.82, "Slow and clear"],
      [1, "Natural"],
    ]
      .map(
        ([n, t]) =>
          `<option value="${n}" ${p.rate === n ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="toggle-line"><span><b>Read Pip’s replies aloud</b><small>Turn off anytime for quiet practice.</small></span><input id="autovoice-setting" type="checkbox" ${p.autoVoice ? "checked" : ""}></label><button class="secondary" type="button" data-action="voice-test">${icon("volume", 16)} Try the voice</button><p class="notice" style="margin-top:22px">Voice playback uses your device. Microphone transcription may use your browser’s speech service. No recordings are stored by WordQuest. AI conversations go to OpenRouter only when your guardian enables it.</p><button class="text-btn" type="button" data-action="logout" style="margin-top:20px">Sign out ${icon("arrow", 14)}</button></section></form>`,
    "Your pace. Your voice. Your adventure.",
    "Changes apply to new adventures. Current adventures keep their activity sequence.",
  );
}
const INFO = {
  listen: [
    "headphones",
    "Listen",
    "Let’s hear it together.",
    "Suno, phir saath mein padho.",
  ],
  read: [
    "mic",
    "Speak",
    "Your turn. Take it slowly.",
    "Aaram se bolo. Koi jaldi nahi hai.",
  ],
  type: [
    "keyboard",
    "Type",
    "Can you spell the word?",
    "Pehle suno. Phir word type karo.",
  ],
  meaning: [
    "bulb",
    "Meaning",
    "What does it mean to you?",
    "Apne words mein batao, ya sahi option chuno.",
  ],
  recap: [
    "star",
    "Remember",
    "A little word. A little win.",
    "Ek baar phir padho aur meaning yaad karo.",
  ],
};
function target(text) {
  return `<div class="target">${text
    .split(" ")
    .map(
      (w, i) =>
        `<button data-action="token" data-value="${esc(w)}" data-token="${i}" aria-label="Listen to ${esc(w)}">${esc(w)}</button>`,
    )
    .join(" ")}</div>`;
}
function studio() {
  const a = active,
    d = a.data,
    p = a.progress,
    w = d.items[p.index],
    s = p.stage,
    si = d.stages.indexOf(s),
    done = p.index * d.stages.length + si;
  let body = "";
  if (s === "listen")
    body = `<div class="reading-card"><div class="sound-wave" id="wave">${"<i></i>".repeat(17)}</div>${target(w.text)}<div class="audio-actions"><button class="primary" data-action="listen">${icon("volume", 17)} ${ui.listened ? "Listen again" : "Listen carefully"}</button><button class="secondary" data-action="slow">${icon("clock", 16)} Slower</button></div><small class="sentence-note">Tap a word to hear it on its own.</small></div><button class="text-btn" data-action="read-together">Audio not working? Read together</button>`;
  if (s === "read")
    body = `<div class="reading-card">${target(w.text)}<button class="secondary" data-action="model-audio">${icon("volume", 16)} Hear it again</button><button class="mic-btn ${ui.recording ? "recording" : ""}" data-action="reading-mic" aria-label="${ui.recording ? "Stop listening" : "Read into the microphone"}">${icon("mic", 28)}</button><p class="record-note">${ui.recording ? "Listening… read the English text aloud." : "Tap the mic and read. Or read aloud together without the mic."}</p>${ui.transcript ? `<div class="transcript">I heard: “${esc(ui.transcript)}”</div><button class="primary" data-action="check-reading" ${busy ? "disabled" : ""}>Check my words ${icon("check", 15)}</button>` : ""}</div><button class="secondary" data-action="self-read" ${busy ? "disabled" : ""}>${icon("check", 15)} I read it aloud · Khud padh liya</button><p class="record-note" style="margin-top:15px">Mic matching checks recognised words, not pronunciation quality.</p>`;
  if (s === "type")
    body = `<div class="reading-card"><span class="eyebrow">LISTEN. THINK. TYPE.</span><div class="spelling-placeholder">${ui.hint ? esc(w.target) : Array.from(w.target, () => "<span></span>").join("")}</div><button class="primary" data-action="spelling-audio">${icon("volume", 17)} Hear the word</button><button class="text-btn" data-action="hint">${icon("bulb", 14)} ${ui.hint ? "Word shown · guided practice" : "Show me the word"}</button></div><form id="spelling-form" class="type-box"><input id="spelling-input" aria-label="Type the English word" placeholder="Type the word here…" value="${esc(ui.draft)}" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false" ${busy ? "disabled" : ""}><button class="primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Checking…" : "Check spelling"} ${icon("check", 15)}</button></form>`;
  if (s === "meaning")
    body = `<div class="reading-card meaning-target">${target(w.text)}<button class="text-btn" data-action="options-audio">${icon("volume", 15)} Listen to the Hindi options</button></div><div class="choices">${w.options.map((o, i) => `<button class="choice ${ui.selected === i ? "wrong" : ""}" data-action="meaning-choice" data-value="${i}" ${busy ? "disabled" : ""}><span class="choice-number">${i + 1}</span><span>${esc(o.text)}</span></button>`).join("")}</div><div class="meaning-own"><div class="section-head"><h3>Or tell Pip in your own words</h3><button class="text-btn" data-action="meaning-mic" aria-label="Speak the meaning">${icon("mic", 15)} Speak</button></div><form id="meaning-form"><textarea id="meaning-input" aria-label="Explain the meaning" maxlength="600" placeholder="Hindi, Hinglish or English — your words are welcome.">${esc(ui.draft)}</textarea><button class="secondary" type="submit" ${busy || !connected() ? "disabled" : ""}>${busy ? "Pip is checking…" : "Ask Pip to check"} ${icon("spark", 14)}</button></form>${!connected() ? "<small>AI needs to be connected to check your own wording. You can use the options above.</small>" : ""}</div><button class="text-btn" data-action="meaning-hint">${icon("bulb", 13)} Meaning hint</button>${ui.hint ? `<p class="notice">${esc(w.hi)} · ${esc(w.roman)}</p>` : ""}`;
  if (s === "recap")
    body = `<div class="reading-card"><div class="recap-icon">${icon("sprout", 36)}</div>${target(w.text)}<p class="meaning-reveal">${esc(w.hi)}</p><p class="meaning-roman">${esc(w.roman)}</p><div class="audio-actions" style="margin-top:22px"><button class="secondary" data-action="model-audio">${icon("volume", 15)} English</button><button class="secondary" data-action="hindi-audio">${icon("volume", 15)} Hindi meaning</button></div></div>`;
  return `<main class="studio"><header class="studio-header"><button class="icon-btn" data-action="exit-lesson" aria-label="Save and exit">${icon("close", 18)}</button><div class="studio-progress"><small>${esc(d.title)} · ${p.index + 1} of ${d.items.length}</small><div class="tiny-track"><i style="width:${(done / (d.items.length * d.stages.length)) * 100}%"></i></div></div><span class="studio-level">${icon(levelInfo(d.level).icon, 17)} ${levelInfo(d.level).name}</span></header><div class="studio-source">${d.source === "ai" ? `${icon("spark", 12)} Created for you by Pip` : "Prepared practice · chosen for your learning"}</div><nav class="stage-tabs" aria-label="Lesson steps">${d.stages.map((k, i) => `<span class="stage-tab ${k === s ? "active" : i < si ? "done" : ""}">${icon(i < si ? "check" : INFO[k][0], 15)} ${INFO[k][1]}</span>`).join("")}</nav><section class="exercise"><span class="eyebrow">SMALL STEP ${si + 1} OF ${d.stages.length}</span><h1>${INFO[s][2]}</h1><p>${INFO[s][3]}</p>${body}${ui.feedback ? `<div class="feedback ${ui.good ? "good" : ""}" role="status">${esc(ui.feedback)}</div>` : ""}${tutorBubble(p.index === 0 && s === "listen" ? d.intro : s === "type" ? "Hint lena okay hai. Hints wali practice se level jaldi nahi badhega; pehle confidence banayenge." : s === "recap" ? "Ek baar bina audio ke padho. Phir apne words mein matlab batao." : "Tum apni speed se seekh sakte ho. Ek chhota step ek baar.")}</section><footer class="exercise-bottom"><button class="text-btn" data-action="lesson-help">${icon("headphones", 14)} Ask Pip for help</button>${s === "listen" ? `<button class="primary" data-action="next-listen" ${busy || !ui.listened ? "disabled" : ""}>Continue ${icon("arrow", 15)}</button>` : s === "recap" ? `<button class="primary" data-action="next-recap" ${busy ? "disabled" : ""}>${p.index === d.items.length - 1 ? "Finish adventure" : "Next word"} ${icon("arrow", 15)}</button>` : "<small>Small steps. Mistakes welcome.</small>"}</footer></main>`;
}
function completeView() {
  const d = active.data;
  return `<main class="studio"><section class="complete"><div class="recap-icon celebration">${icon("trophy", 52)}</div><span class="eyebrow" style="margin-top:25px">A NEW PAGE IN YOUR STORY</span><h1>Look at you growing, ${esc(firstName())}.</h1><p>“${esc(d.title)}” complete.<br>One adventure. Four little steps forward.</p><div class="stat-cards"><div class="stat-card">${icon("book", 20)}<strong>${d.items.length}</strong><span>Items practised</span></div><div class="stat-card">${icon("star", 20)}<strong>${stats().xp}</strong><span>Total XP</span></div><div class="stat-card">${icon("trophy", 20)}<strong>${stats().completed}</strong><span>Adventures finished</span></div></div><div class="word-chips">${d.items.map((w) => `<span>${esc(w.target)}</span>`).join("")}</div>${tutorBubble("Shabash! Agli adventure mein familiar words wapas aa sakte hain. Ab break lo, ya ek nayi kahani banayein?")}<div class="audio-actions"><button class="secondary" data-action="nav" data-value="home">Take a little break</button><button class="primary" data-action="generate" ${busy ? "disabled" : ""}>${busy ? "Making your adventure…" : "Create my next adventure"} ${icon("spark", 15)}</button></div></section></main>`;
}
function guardianView() {
  if (!guardianData)
    return layout(
      '<div class="empty">Opening guardian controls…</div>',
      "A little guidance. A lot of growth.",
      "Your space to support the learning journey.",
    );
  const ai = guardianData.ai;
  return layout(
    `<div class="guardian-grid"><section class="panel ai-connect"><div class="section-head" style="margin-top:0"><h2>Connect Pip’s intelligence</h2><span class="status-badge ${ai.connected ? "online" : ""}"><i></i>${ai.connected ? "Connected" : "Not connected"}</span></div><p class="page-intro">OpenRouter powers conversations, freshly written adventures and checking explanations in the child’s own words. Device voices handle speaking and listening.</p><form id="ai-form"><label class="field"><span>OpenRouter API key ${ai.configured ? "· a key is saved" : ""}</span><input id="ai-key" type="password" autocomplete="off" placeholder="${ai.configured ? "Leave empty to keep the saved key" : "sk-or-…"}" maxlength="300"></label><label class="field"><span>AI model</span><select id="ai-model">${["openai/gpt-4.1-mini", "google/gemini-2.5-flash", "openai/gpt-5-mini"].map((m) => `<option value="${m}" ${ai.model === m ? "selected" : ""}>${m}</option>`).join("")}</select></label><label class="field"><span>Maximum AI calls in a rolling 24 hours</span><input id="ai-limit" type="number" min="10" max="500" value="${ai.dailyLimit}"><small>Includes conversations, generation, answer checking and connection tests. This is a request limit, not a monetary budget.</small></label><label class="toggle-line"><span><b>Enable AI for the learner</b><small>Share first name, selected interests, recent learning results and recent messages with OpenRouter and its model provider. Stored full names and account credentials are excluded from the AI context.</small></span><input id="ai-enabled" type="checkbox" ${ai.connected ? "checked" : ""}></label><div class="audio-actions" style="justify-content:flex-start"><button class="primary" type="submit" ${busy ? "disabled" : ""}>Save connection ${icon("check", 15)}</button><button class="secondary" type="button" data-action="test-ai" ${busy || !ai.connected ? "disabled" : ""}>${icon("spark", 15)} Test a real AI response</button></div></form>${ui.feedback ? `<div class="feedback ${ui.good ? "good" : ""}" role="status">${esc(ui.feedback)}</div>` : ""}<p class="connection-test">${ai.testedAt ? "Last successful provider test: " + new Date(ai.testedAt * 1000).toLocaleString() : "No successful provider test yet."}</p></section><aside><section class="panel"><h3>AI usage · last 24 hours</h3><p class="stat-line"><span>Requests reserved</span><b>${ai.usage.calls} / ${ai.dailyLimit}</b></p><p class="stat-line"><span>Tokens reported</span><b>${ai.usage.tokens}</b></p><p class="stat-line"><span>Cost reported by provider</span><b>$${Number(ai.usage.cost).toFixed(4)}</b></p><p class="notice" style="margin-top:20px">Your API key stays on this server and is never returned to the browser or included in GitHub source. Keep the server’s persistent data directory private.</p></section><section class="panel" style="margin-top:20px"><h3>Keep the connection human</h3><p class="page-intro" style="margin:12px 0 0">Pip supports reading practice. It doesn’t diagnose learning difficulties or replace parents, teachers or friends. Level suggestions use actual unassisted attempts.</p></section></aside></div><div class="section-head"><h2>The learner’s story</h2></div>${guardianData.learners
      .map(
        ({ user, stats: s, recommendation: r, words }) =>
          `<section class="panel learner-panel"><div class="learner-heading"><div class="avatar">${esc(user.name[0])}</div><div><h3>${esc(user.name)}</h3><small>@${esc(user.username)} · ${levelInfo(r.level).name}</small></div></div><div class="stat-cards guardian-stats">${[
            [s.completed, "Adventures"],
            [s.spelling, "Spelling successes"],
            [s.meaning, "Meanings recognised"],
            [s.accuracy === null ? "—" : s.accuracy + "%", "Recent accuracy"],
          ]
            .map(
              ([n, t]) =>
                `<div class="stat-card"><strong>${n}</strong><span>${t}</span></div>`,
            )
            .join(
              "",
            )}</div><p class="notice">${esc(r.reason)} ${s.scoredAttempts} recent unassisted scored attempts. ${s.due} words ready for review.</p><div class="review-table"><h4>Words to revisit</h4>${
            words.length
              ? words
                  .slice(0, 8)
                  .map(
                    (w) =>
                      `<div><b>${esc(w.word)}</b><span>${w.attempts - w.successes} retries</span><span>${new Date(w.due_at * 1000).toLocaleDateString()}</span></div>`,
                  )
                  .join("")
              : "<p>Words will appear after the first adventure.</p>"
          }</div><details class="password-details"><summary>Adjust the learner’s next steps</summary><form class="learner-controls" data-user="${user.id}"><label class="field"><span>Starting level</span><select name="level">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === user.profile.level ? "selected" : ""}>${l.name}</option>`).join("")}</select></label><label class="field"><span>Daily adventure goal</span><select name="goal">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === user.profile.goal ? "selected" : ""}>${n} adventure${n > 1 ? "s" : ""}</option>`).join("")}</select></label><label class="toggle-line"><span><b>Use evidence for level suggestions</b><small>Turn off to keep the chosen level steady.</small></span><input name="autoLevel" type="checkbox" ${user.profile.autoLevel ? "checked" : ""}></label><button class="secondary" type="submit">Save learning controls</button></form></details><details class="password-details"><summary>Change this account’s password</summary><form class="password-form" data-user="${user.id}"><label class="field"><span>Your guardian password</span><input name="current" type="password" autocomplete="current-password" required></label><label class="field"><span>New learner password · at least 12 characters</span><input name="new" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button class="secondary" type="submit">Update password</button></form></details></section>`,
      )
      .join("")}`,
    "A little guidance. A lot of growth.",
    "Connect the AI, check learning evidence, and support the next small step.",
  );
}
function render() {
  if (!session?.user) {
    $("#app").innerHTML = loginView();
    return;
  }
  if (session.user.role === "learner" && !profile().onboarded) {
    $("#app").innerHTML = onboarding();
    return;
  }
  if (page !== "lesson" && page !== "tutor") stopSpeech();
  $("#app").innerHTML =
    page === "lesson"
      ? studio()
      : page === "complete"
        ? completeView()
        : (
            {
              home,
              journey,
              tutor: tutorView,
              words: wordsView,
              progress: progressView,
              settings: settingsView,
              guardian: guardianView,
            }[page] || home
          )();
  if (page === "tutor")
    requestAnimationFrame(() => {
      const pane = $("#chat-messages");
      if (pane) pane.scrollTop = pane.scrollHeight;
    });
}
async function refreshDashboard() {
  dashboard = await api("/dashboard");
  active = dashboard.active;
  session.ai = dashboard.ai;
}
async function navigate(to) {
  stopSpeech();
  stopMic();
  ui.feedback = "";
  if (!session?.user) return;
  page = session.user.role === "guardian" ? "guardian" : to;
  try {
    if (page === "guardian") guardianData = await api("/guardian");
    else if (page === "home" || page === "progress" || page === "journey")
      await refreshDashboard();
    else if (page === "tutor") {
      messages = (await api("/tutor/messages")).messages;
      await refreshDashboard();
    } else if (page === "words") collection = (await api("/words")).words;
    render();
    window.scrollTo(0, 0);
  } catch (e) {
    toast(e.message);
  }
}
function freshUI() {
  ui = {
    ...ui,
    feedback: "",
    good: false,
    listened: false,
    hint: false,
    draft: "",
    transcript: "",
    selected: null,
  };
}
async function generate(template = null, forcePrepared = false) {
  if (busy) return;
  busy = true;
  render();
  try {
    const data = template
      ? { template }
      : { mode: connected() && !forcePrepared ? "ai" : "prepared" };
    active = await api("/adventures", "POST", data);
    freshUI();
    page = "lesson";
    render();
    window.scrollTo(0, 0);
  } catch (e) {
    toast(e.message);
    ui.feedback = e.message;
    if (e.code && page !== "guardian") {
      showDialog("Pip needs a moment", e.message, [
        ["Go back", "close-dialog"],
        ["Use prepared practice", "prepared"],
      ]);
    }
  } finally {
    busy = false;
    render();
  }
}
async function submitAnswer(value, opts = {}) {
  if (busy || !active) return;
  const attempt = {
    eventId: crypto.randomUUID(),
    stage: active.progress.stage,
    itemIndex: active.progress.index,
    value,
    ...opts,
  };
  busy = true;
  try {
    const result = await api(
      "/adventures/" + active.data.id + "/answer",
      "POST",
      attempt,
    );
    if (!result.correct) {
      ui.feedback = result.feedback;
      ui.good = false;
    } else {
      stopSpeech();
      stopMic();
      active = result.adventure;
      freshUI();
      if (dashboard) dashboard.stats = result.stats;
      if (active.completed) {
        page = "complete";
        dashboard.active = null;
      } else page = "lesson";
      toast(result.feedback);
      window.scrollTo(0, 0);
    }
  } catch (e) {
    ui.feedback = e.message;
    ui.good = false;
  } finally {
    busy = false;
    render();
  }
}
async function sendChat(message) {
  message = message.trim();
  if (!message || chatBusy) return;
  ui.draft = "";
  chatBusy = true;
  messages.push({ role: "user", text: message });
  render();
  try {
    const result = await api("/tutor/chat", "POST", { message });
    messages.push({
      role: "assistant",
      text: result.reply,
      source: result.source,
      speech: result.speak,
      english: result.english,
      prompt: result.prompt,
    });
    render();
    if (profile().autoVoice) speak(result.speak, "hi");
  } catch (e) {
    messages.pop();
    ui.draft = message;
    toast(e.message);
  } finally {
    chatBusy = false;
    render();
  }
}
async function updateProfile(data) {
  const result = await api("/profile", "PATCH", data);
  session.user.profile = result.profile;
  return result;
}
function showDialog(title, text, buttons) {
  $("#dialog")?.remove();
  const node = document.createElement("div");
  node.className = "modal-backdrop";
  node.id = "dialog";
  node.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-actions">${buttons.map(([t, a], i) => `<button class="${i ? "primary" : "secondary"}" data-action="${a}">${esc(t)}</button>`).join("")}</div></section>`;
  document.body.append(node);
  node.querySelector("button").focus();
  node.addEventListener("keydown", (e) => {
    if (e.key === "Escape") node.remove();
    if (e.key === "Tab") {
      const buttons = [...node.querySelectorAll("button")],
        i = buttons.indexOf(document.activeElement);
      if (e.shiftKey && i === 0) {
        e.preventDefault();
        buttons.at(-1).focus();
      } else if (!e.shiftKey && i === buttons.length - 1) {
        e.preventDefault();
        buttons[0].focus();
      }
    }
  });
}
function currentItem() {
  return active?.data.items[active.progress.index];
}
function stopSpeech() {
  speechRun++;
  window.speechSynthesis?.cancel();
  $("#wave")?.classList.remove("playing");
  document
    .querySelectorAll(".speaking")
    .forEach((el) => el.classList.remove("speaking"));
}
function speak(text, lang = "en", slow = false, done) {
  stopSpeech();
  if (!window.speechSynthesis) {
    toast("Voice playback is unavailable. You can read together.");
    return;
  }
  const run = speechRun,
    u = new SpeechSynthesisUtterance(text),
    p = session?.user?.profile || {},
    chosen = lang === "hi" ? p.hiVoice : p.voice;
  const voice =
    voices.find((v) => v.voiceURI === chosen) ||
    voices.find(
      (v) => v.lang.toLowerCase() === (lang === "hi" ? "hi-in" : "en-in"),
    ) ||
    voices.find((v) => v.lang.startsWith(lang));
  u.lang = lang === "hi" ? "hi-IN" : "en-IN";
  if (voice) u.voice = voice;
  u.rate = slow ? 0.58 : p.rate || 0.82;
  u.onstart = () => $("#wave")?.classList.add("playing");
  u.onboundary = (e) => {
    if (run !== speechRun) return;
    document
      .querySelectorAll(".speaking")
      .forEach((el) => el.classList.remove("speaking"));
    const i =
      text.slice(0, e.charIndex).trim().split(/\s+/).length -
      (e.charIndex ? 0 : 1);
    document.querySelector(`[data-token="${i}"]`)?.classList.add("speaking");
  };
  u.onend = () => {
    if (run !== speechRun) return;
    $("#wave")?.classList.remove("playing");
    document
      .querySelectorAll(".speaking")
      .forEach((el) => el.classList.remove("speaking"));
    if (done) done();
  };
  u.onerror = (e) => {
    if (!["canceled", "interrupted"].includes(e.error))
      toast("Audio could not play. Try another voice in settings.");
  };
  window.speechSynthesis.speak(u);
}
function stopMic() {
  if (recognition) {
    recognition.onend = null;
    recognition.onresult = null;
    recognition.onerror = null;
    try {
      recognition.abort();
    } catch {}
    recognition = null;
  }
  ui.recording = false;
}
function startMic(mode) {
  if (ui.recording) {
    stopMic();
    render();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    toast(
      "Speech recognition is not available here. Try Chrome, or type/read together.",
    );
    return;
  }
  stopSpeech();
  recognition = new SR();
  recognition.lang =
    mode === "read" ? "en-IN" : mode === "meaning" ? "hi-IN" : ui.chatLanguage;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  const expectedPage = page,
    adventureId = active?.data.id,
    index = active?.progress.index;
  recognition.onresult = (e) => {
    if (
      page !== expectedPage ||
      (mode !== "chat" &&
        (active?.data.id !== adventureId || active?.progress.index !== index))
    )
      return;
    const text = e.results[0][0].transcript;
    if (mode === "read") ui.transcript = text;
    else ui.draft = text;
    ui.recording = false;
    render();
    (mode === "chat"
      ? $("#chat-input")
      : mode === "meaning"
        ? $("#meaning-input")
        : null
    )?.focus();
  };
  recognition.onerror = (e) => {
    ui.recording = false;
    toast(
      e.error === "not-allowed"
        ? "Microphone permission was not granted. You can type instead."
        : e.error === "network"
          ? "The browser’s speech service is unavailable. You can type instead."
          : "I couldn’t hear clearly. Try again or type.",
    );
    render();
  };
  recognition.onend = () => {
    recognition = null;
    ui.recording = false;
    if (page === expectedPage) render();
  };
  try {
    recognition.start();
    ui.recording = true;
    render();
  } catch {
    stopMic();
    toast("The microphone could not start. You can type instead.");
  }
}
async function act(a, v, btn) {
  if (a === "nav") {
    if (!session?.user) return;
    navigate(v);
  } else if (a === "show-password") {
    const i = $("#login-password");
    i.type = i.type === "password" ? "text" : "password";
    btn.textContent = i.type === "password" ? "Show" : "Hide";
  } else if (a === "logout") {
    await api("/logout", "POST", {});
    session = null;
    dashboard = null;
    active = null;
    messages = [];
    guardianData = null;
    stopMic();
    stopSpeech();
    freshUI();
    render();
  } else if (a === "interest") {
    const arr = ui.interests || [...profile().interests];
    ui.interests = arr.includes(v)
      ? arr.filter((x) => x !== v)
      : arr.length < 5
        ? [...arr, v]
        : arr;
    render();
  } else if (a === "comfort") {
    ui.startLevel = v;
    render();
  } else if (a === "finish-onboarding") {
    busy = true;
    await updateProfile({
      interests: ui.interests || profile().interests,
      level: ui.startLevel || profile().level,
      onboarded: true,
    });
    await refreshDashboard();
    page = "home";
    busy = false;
    render();
  } else if (a === "generate") {
    generate();
  } else if (a === "prepared") {
    document.querySelector("#dialog")?.remove();
    generate(null, true);
  } else if (a === "close-dialog") {
    document.querySelector("#dialog")?.remove();
  } else if (a === "template") {
    generate(v, true);
  } else if (a === "resume") {
    active = await api("/adventures/" + active.data.id);
    freshUI();
    page = "lesson";
    render();
  } else if (a === "open-adventure") {
    active = await api("/adventures/" + v);
    freshUI();
    page = active.completed ? "complete" : "lesson";
    render();
    window.scrollTo(0, 0);
  } else if (a === "mood") {
    await updateProfile({ mood: v });
    render();
    if (v === "tired" || v === "frustrated")
      toast("We can take it slowly. A break is always okay.");
  } else if (a === "topic") {
    ui.topic = v;
    render();
  } else if (a === "word-filter") {
    ui.wordFilter = v;
    render();
  } else if (a === "word-audio") {
    speak(v);
  } else if (a === "suggestion") {
    sendChat(v);
  } else if (a === "message-audio") {
    const m = messages[Number(v)];
    speak(m.speech || m.text, "hi");
  } else if (a === "chat-mic") {
    ui.draft = $("#chat-input")?.value || "";
    ui.chatLanguage = $("#chat-language")?.value || ui.chatLanguage;
    startMic("chat");
  } else if (a === "exit-lesson") {
    stopMic();
    stopSpeech();
    await navigate("home");
    toast("Your place is saved to your account.");
  } else if (a === "listen" || a === "slow") {
    const id = active.data.id,
      index = active.progress.index;
    speak(currentItem().text, "en", a === "slow", () => {
      if (
        page === "lesson" &&
        active.data.id === id &&
        active.progress.index === index &&
        active.progress.stage === "listen"
      ) {
        ui.listened = true;
        render();
      }
    });
  } else if (a === "next-listen") {
    if (ui.listened) submitAnswer(true);
  } else if (a === "read-together") {
    submitAnswer(true, { assisted: true });
  } else if (a === "token") {
    speak(v);
  } else if (a === "model-audio") {
    speak(currentItem().text);
  } else if (a === "hindi-audio") {
    speak(currentItem().hi, "hi");
  } else if (a === "spelling-audio") {
    speak(currentItem().target);
  } else if (a === "hint") {
    ui.draft = $("#spelling-input")?.value || "";
    ui.hint = true;
    render();
  } else if (a === "reading-mic") {
    startMic("read");
  } else if (a === "meaning-mic") {
    ui.draft = $("#meaning-input")?.value || "";
    startMic("meaning");
  } else if (a === "check-reading") {
    submitAnswer(ui.transcript);
  } else if (a === "self-read") {
    submitAnswer(true, { assisted: true });
  } else if (a === "meaning-choice") {
    ui.draft = $("#meaning-input")?.value || "";
    ui.selected = Number(v);
    submitAnswer(currentItem().options[Number(v)].text, { assisted: ui.hint });
  } else if (a === "options-audio") {
    speak(
      currentItem()
        .options.map((o, i) => `विकल्प ${i + 1}। ${o.text}`)
        .join("। "),
      "hi",
    );
  } else if (a === "meaning-hint") {
    ui.draft = $("#meaning-input")?.value || "";
    ui.hint = true;
    render();
    speak(currentItem().hi, "hi");
  } else if (a === "next-recap") {
    submitAnswer(true);
  } else if (a === "lesson-help") {
    const message = "Help me read: " + currentItem().text;
    await navigate("tutor");
    ui.draft = message;
    render();
  } else if (a === "voice-test") {
    speak("This is my book.");
  } else if (a === "test-ai") {
    busy = true;
    render();
    try {
      const result = await api("/guardian/ai/test", "POST", {});
      guardianData = await api("/guardian");
      ui.feedback =
        "Connection verified with a real provider response: " + result.message;
      ui.good = true;
    } catch (e) {
      ui.feedback = e.message;
      ui.good = false;
    } finally {
      busy = false;
      render();
    }
  }
}
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn || btn.disabled) return;
  e.preventDefault();
  try {
    await act(btn.dataset.action, btn.dataset.value, btn);
  } catch (error) {
    busy = false;
    toast(error.message);
    render();
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    if (form.id === "login-form") {
      const username = $("#login-username").value,
        password = $("#login-password").value;
      busy = true;
      ui.feedback = "";
      render();
      try {
        await api("/login", "POST", { username, password });
        await bootstrap();
      } catch (err) {
        ui.feedback = err.message;
        busy = false;
        render();
        $("#login-username").value = username;
      }
    } else if (form.id === "chat-form") {
      const message = $("#chat-input").value;
      await sendChat(message);
    } else if (form.id === "spelling-form") {
      const value = $("#spelling-input").value.trim();
      ui.draft = value;
      if (value) await submitAnswer(value, { assisted: ui.hint });
      else toast("Type the word first.");
    } else if (form.id === "meaning-form") {
      const value = $("#meaning-input").value.trim();
      ui.draft = value;
      if (value)
        await submitAnswer(value, { freeText: true, assisted: ui.hint });
      else toast("Tell Pip what it means first.");
    } else if (form.id === "settings-form") {
      const data = {
        level: $("#level-setting").value,
        goal: Number($("#goal-setting").value),
        autoLevel: $("#auto-level-setting").checked,
        mic: $("#mic-setting").checked,
        typing: $("#typing-setting").checked,
        autoVoice: $("#autovoice-setting").checked,
        rate: Number($("#rate-setting").value),
        voice: $("#voice-setting").value,
        hiVoice: $("#hi-voice-setting").value,
        interests: [...form.querySelectorAll('[name="interest"]:checked')].map(
          (x) => x.value,
        ),
      };
      busy = true;
      await updateProfile(data);
      await refreshDashboard();
      busy = false;
      render();
      toast("Your settings are saved.");
    } else if (form.id === "ai-form") {
      const data = {
        key: $("#ai-key").value.trim(),
        model: $("#ai-model").value,
        dailyLimit: Number($("#ai-limit").value),
        enabled: $("#ai-enabled").checked,
      };
      busy = true;
      await api("/guardian/ai", "POST", data);
      guardianData = await api("/guardian");
      ui.feedback =
        "Connection settings saved. Use “Test a real AI response” to verify the provider.";
      ui.good = true;
      busy = false;
      render();
    } else if (form.classList.contains("learner-controls")) {
      await api("/guardian/learner", "POST", {
        userId: form.dataset.user,
        level: form.elements.level.value,
        goal: Number(form.elements.goal.value),
        autoLevel: form.elements.autoLevel.checked,
      });
      guardianData = await api("/guardian");
      render();
      toast("Learning controls saved for the next adventure.");
    } else if (form.classList.contains("password-form")) {
      const data = {
        userId: form.dataset.user,
        currentPassword: form.elements.current.value,
        password: form.elements.new.value,
      };
      await api("/guardian/password", "POST", data);
      form.reset();
      toast(
        "Password updated. Existing learner sessions have been signed out.",
      );
    }
  } catch (err) {
    busy = false;
    toast(err.message);
    if (session?.user) render();
  }
});
document.addEventListener("input", (e) => {
  if (
    e.target.id === "chat-input" ||
    e.target.id === "meaning-input" ||
    e.target.id === "spelling-input"
  )
    ui.draft = e.target.value;
  if (e.target.id === "word-search") {
    ui.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#word-search").focus();
    $("#word-search").setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "chat-language") ui.chatLanguage = e.target.value;
});
async function bootstrap() {
  loading = true;
  try {
    session = await api("/session");
    if (session.user?.role === "guardian") {
      page = "guardian";
      guardianData = await api("/guardian");
    } else if (session.user) {
      page = "home";
      await refreshDashboard();
    }
    busy = false;
    loading = false;
    render();
  } catch (e) {
    loading = false;
    busy = false;
    $("#app").innerHTML =
      `<main class="boot"><span class="boot-mark">W.</span><h2>Your word world needs a moment.</h2><p>${esc(e.message)}</p><button class="primary" data-action="retry">Try again</button></main>`;
  }
}
document.addEventListener("click", (e) => {
  if (e.target.closest('[data-action="retry"]')) bootstrap();
});
function loadVoices() {
  voices = window.speechSynthesis?.getVoices() || [];
  if (page === "settings" && $("#voice-setting")) {
    const en = $("#voice-setting").value,
      hi = $("#hi-voice-setting").value;
    $("#voice-setting").innerHTML = voiceOptions("en", en);
    $("#hi-voice-setting").innerHTML = voiceOptions("hi", hi);
  }
}
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}
window.addEventListener("pagehide", () => {
  stopMic();
  stopSpeech();
});
bootstrap();
