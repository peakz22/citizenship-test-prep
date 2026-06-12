/* True North — Canadian citizenship test prep.
   Question bank lives in data/questions.js (const QUESTIONS).
   All progress is stored locally in localStorage; no server. */
"use strict";

const CHAPTERS = {
  1: { name: "Rights & Responsibilities", short: "Rights" },
  2: { name: "Who We Are", short: "Who We Are" },
  3: { name: "Canada's History", short: "History" },
  4: { name: "Modern Canada", short: "Modern" },
  5: { name: "How Canadians Govern Themselves", short: "Government" },
  6: { name: "Federal Elections", short: "Elections" },
  7: { name: "The Justice System", short: "Justice" },
  8: { name: "Canadian Symbols", short: "Symbols" },
  9: { name: "Canada's Economy", short: "Economy" },
  10: { name: "Canada's Regions", short: "Regions" },
};
const PASS_MARK = 15, TEST_SIZE = 20, TEST_MINUTES = 30;
// Leitner intervals in days per box 0..4
const BOX_DAYS = [0, 1, 2, 4, 7];

/* ---------- storage ---------- */
const KEY = "truenorth_v1";
let S = load();
function load() {
  try { return Object.assign({ srs: {}, tests: [], streak: { last: "", count: 0 }, examDate: "", theme: "" }, JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { return { srs: {}, tests: [], streak: { last: "", count: 0 }, examDate: "", theme: "" }; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
function today() { return Math.floor(Date.now() / 864e5); }

/* ---------- spaced repetition ---------- */
function rec(id) { return S.srs[id] || (S.srs[id] = { box: 0, due: today(), seen: 0, ok: 0, bad: 0 }); }
function gradeAnswer(id, correct) {
  const r = rec(id);
  r.seen++;
  if (correct) { r.ok++; r.box = Math.min(4, r.box + 1); }
  else { r.bad++; r.box = 0; }
  r.due = today() + BOX_DAYS[r.box];
  bumpStreak(); save();
}
function dueIds() {
  const t = today();
  return QUESTIONS.filter(q => { const r = S.srs[q.id]; return r && r.seen > 0 && r.box < 4 && r.due <= t; }).map(q => q.id);
}
function masteredCount(ch) { return QUESTIONS.filter(q => (!ch || q.chapter === ch) && S.srs[q.id] && S.srs[q.id].box >= 2).length; }
function chapterQs(ch) { return QUESTIONS.filter(q => q.chapter === ch); }

/* priority order for practice: due first, then unseen, then rest; shuffled within groups */
function practiceOrder(pool) {
  const t = today();
  const due = [], unseen = [], rest = [];
  for (const q of pool) {
    const r = S.srs[q.id];
    if (!r || !r.seen) unseen.push(q);
    else if (r.box < 4 && r.due <= t) due.push(q);
    else rest.push(q);
  }
  return [...shuffle(due), ...shuffle(unseen), ...shuffle(rest)];
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

/* mock test sampling: at least one per chapter, remainder weighted by bank size */
function sampleTest() {
  const picked = [];
  const byCh = {};
  for (const ch of Object.keys(CHAPTERS)) byCh[ch] = shuffle(chapterQs(+ch));
  for (const ch of Object.keys(byCh)) if (byCh[ch].length) picked.push(byCh[ch].pop());
  const rest = shuffle(Object.values(byCh).flat());
  while (picked.length < TEST_SIZE && rest.length) picked.push(rest.pop());
  return shuffle(picked).slice(0, TEST_SIZE);
}

/* ---------- streak ---------- */
function bumpStreak() {
  const d = new Date().toISOString().slice(0, 10);
  if (S.streak.last === d) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  S.streak.count = (S.streak.last === y) ? S.streak.count + 1 : 1;
  S.streak.last = d;
  renderStreak();
}
function renderStreak() {
  const d = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const live = (S.streak.last === d || S.streak.last === y) ? S.streak.count : 0;
  document.getElementById("streakBadge").textContent = "🔥 " + live;
}

/* ---------- theme ---------- */
function applyTheme() {
  const pref = S.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = pref;
}
document.getElementById("themeBtn").onclick = () => {
  S.theme = (document.documentElement.dataset.theme === "dark") ? "light" : "dark";
  save(); applyTheme();
};

/* ---------- router ---------- */
const view = document.getElementById("view");
const routes = { home, practice, test, review, cards };
function go(r, arg) {
  location.hash = r;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.route === r));
  stopTimer();
  routes[r](arg);
  window.scrollTo(0, 0);
  renderDue();
}
document.querySelectorAll(".tab").forEach(t => t.onclick = () => go(t.dataset.route));
window.addEventListener("hashchange", () => { const r = location.hash.slice(1); if (routes[r]) go(r); });

function renderDue() {
  const n = dueIds().length;
  const b = document.getElementById("dueBadge");
  b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
}

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ---------- HOME ---------- */
function readiness() {
  const total = QUESTIONS.length;
  const mastery = total ? masteredCount() / total : 0;
  const recent = S.tests.slice(-3);
  const testAvg = recent.length ? recent.reduce((s, t) => s + t.score / t.total, 0) / recent.length : null;
  // blend: mastery of the bank + recent mock performance (if any)
  const r = testAvg === null ? mastery * 0.85 : mastery * 0.45 + testAvg * 0.55;
  return Math.round(r * 100);
}
function home() {
  const total = QUESTIONS.length;
  const seen = QUESTIONS.filter(q => S.srs[q.id] && S.srs[q.id].seen).length;
  const due = dueIds().length;
  const pct = readiness();
  const last = S.tests[S.tests.length - 1];
  const ring = ringSVG(pct);
  const days = S.examDate ? Math.ceil((new Date(S.examDate + "T12:00") - Date.now()) / 864e5) : null;

  let chapRows = "";
  for (const [ch, c] of Object.entries(CHAPTERS)) {
    const qs = chapterQs(+ch);
    if (!qs.length) continue;
    const m = masteredCount(+ch), p = Math.round(100 * m / qs.length);
    const cls = p === 0 ? "zero" : p < 50 ? "low" : "";
    chapRows += `<div class="chap-row" data-ch="${ch}">
      <div class="chap-name">${c.name}<small>${m}/${qs.length} mastered</small></div>
      <div class="meter ${cls}"><i style="width:${p}%"></i></div><div class="chap-pct">${p}%</div></div>`;
  }

  view.innerHTML = `
  <div class="card hero">
    <div class="ready-row">
      ${ring}
      <div>
        <h2>Test readiness</h2>
        <p class="small" style="margin:.2em 0">${pct >= 80 ? "You're in great shape — keep the streak going." : pct >= 50 ? "Solid progress. Focus on your weakest chapters below." : "Build mastery with Practice, then try a Mock Test."}</p>
        ${days !== null ? `<p class="small" style="margin:.2em 0"><b>${days > 0 ? days + " day" + (days === 1 ? "" : "s") + " until your test" : days === 0 ? "Test day — good luck! 🍁" : "Test date passed"}</b></p>` : ""}
      </div>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat"><b>${seen}</b><span>of ${total} seen</span></div>
    <div class="stat"><b>${due}</b><span>due for review</span></div>
    <div class="stat"><b>${last ? last.score + "/" + last.total : "—"}</b><span>last mock test</span></div>
  </div>

  <div class="btn-row mt">
    <button class="btn" id="goTest">Take a Mock Test</button>
    <button class="btn secondary" id="goReview">${due ? "Review " + due + " due" : "Smart Review"}</button>
  </div>

  <div class="card mt">
    <h2>Mastery by chapter</h2>
    <p class="small dim" style="margin-top:-4px">Tap a chapter to practice it. "Mastered" = answered correctly on recent attempts.</p>
    ${chapRows}
  </div>

  <div class="card">
    <h2>Mock test history</h2>
    ${S.tests.length ? S.tests.slice(-8).reverse().map(t =>
      `<div class="history-row"><span>${new Date(t.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${Math.floor(t.sec / 60)}m${String(t.sec % 60).padStart(2, "0")}s</span>
       <span>${t.score}/${t.total} <span class="tag ${t.score >= PASS_MARK ? "pass" : "fail"}">${t.score >= PASS_MARK ? "PASS" : "FAIL"}</span></span></div>`).join("")
      : `<p class="small dim">No mock tests yet. The real test: 20 questions, 30 minutes, 15 correct to pass.</p>`}
  </div>

  <div class="card">
    <h2>My test date</h2>
    <div class="countdown-input">
      <input type="date" id="examDate" value="${S.examDate}">
      <button class="btn row secondary" id="saveDate">Save</button>
    </div>
  </div>

  <footer class="src">Questions written from <a href="https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html" target="_blank" rel="noopener">Discover Canada</a>, the official study guide (IRCC).<br>Unofficial study aid — not affiliated with the Government of Canada.</footer>`;

  document.getElementById("goTest").onclick = () => go("test");
  document.getElementById("goReview").onclick = () => go("review");
  document.getElementById("saveDate").onclick = () => { S.examDate = document.getElementById("examDate").value; save(); home(); };
  view.querySelectorAll(".chap-row").forEach(r => r.onclick = () => go("practice", +r.dataset.ch));
}
function ringSVG(pct) {
  const r = 40, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg class="ring" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="9"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/>
    <text x="50" y="48" text-anchor="middle" dominant-baseline="middle">${pct}%</text>
    <text x="50" y="66" text-anchor="middle" class="sub">ready</text></svg>`;
}

/* ---------- shared quiz engine ----------
   mode: "practice" (instant feedback, endless) | "test" (no feedback until end, timed) | "review" */
let T = null; // active timer
function stopTimer() { if (T) { clearInterval(T); T = null; } }

function runQuiz({ qs, mode, title, onDone }) {
  let i = 0, score = 0;
  const answers = []; // {q, picked}
  let deadline = mode === "test" ? Date.now() + TEST_MINUTES * 60e3 : null;

  function renderQ() {
    if (i >= qs.length) return finish();
    const q = qs[i];
    const opts = q.opts.map((o, k) =>
      `<button class="opt" data-k="${k}"><span class="key">${q.type === "tf" ? (k ? "F" : "T") : "ABCD"[k]}</span><span>${esc(o)}</span></button>`).join("");
    view.innerHTML = `
      <div class="quiz-head">
        <span class="q-meta">${title} · ${i + 1}/${qs.length}</span>
        ${mode === "test" ? `<span class="timer" id="timer">--:--</span>` : title !== CHAPTERS[q.chapter].short ? `<span class="q-meta">${CHAPTERS[q.chapter].short}</span>` : ""}
      </div>
      <div class="progress"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <p class="q-text">${esc(q.q)}</p>
      <div id="opts">${opts}</div>
      <div id="fb"></div>
      <button class="btn ghost mt" id="quit">End session</button>`;
    view.querySelectorAll(".opt").forEach(b => b.onclick = () => pick(+b.dataset.k));
    document.getElementById("quit").onclick = () => { if (mode === "test" && i > 0) { if (!confirm("End the test now? It will be scored as-is.")) return; finish(); } else go("home"); };
    if (mode === "test") tick();
  }

  function tick() {
    const el = document.getElementById("timer");
    if (!el) return;
    const upd = () => {
      const left = Math.max(0, deadline - Date.now());
      const m = Math.floor(left / 60e3), s = Math.floor(left / 1e3) % 60;
      el.textContent = `${m}:${String(s).padStart(2, "0")}`;
      el.classList.toggle("low", left < 5 * 60e3);
      if (left <= 0) { stopTimer(); finish(); }
    };
    stopTimer(); T = setInterval(upd, 250); upd();
  }

  function pick(k) {
    const q = qs[i];
    const correct = k === q.a;
    answers.push({ q, picked: k });
    if (correct) score++;
    gradeAnswer(q.id, correct);
    if (mode === "test") { i++; renderQ(); return; }
    // practice/review: instant feedback
    view.querySelectorAll(".opt").forEach(b => {
      const bk = +b.dataset.k;
      b.disabled = true;
      if (bk === q.a) b.classList.add("correct");
      else if (bk === k) b.classList.add("wrong");
      else b.classList.add("faded");
    });
    document.getElementById("fb").innerHTML = `
      <div class="feedback ${correct ? "good" : "bad"}">
        <b>${correct ? "Correct ✓" : "Not quite ✗"}</b>${esc(q.expl)}
      </div>
      <button class="btn" id="next">${i + 1 < qs.length ? "Next question" : "Finish"}</button>`;
    const nb = document.getElementById("next");
    nb.onclick = () => { i++; renderQ(); };
    nb.focus();
  }

  function finish() {
    stopTimer();
    onDone({ answers, score, sec: mode === "test" ? Math.min(TEST_MINUTES * 60, Math.round((TEST_MINUTES * 60e3 - (deadline - Date.now())) / 1e3)) : 0 });
  }
  renderQ();
}

/* ---------- PRACTICE ---------- */
function practice(ch) {
  if (ch) return startPractice(ch);
  let rows = `<button class="list-btn" data-ch="0"><span>All chapters (mixed)</span><span class="arrow">›</span></button>`;
  for (const [c, meta] of Object.entries(CHAPTERS)) {
    const qs = chapterQs(+c); if (!qs.length) continue;
    const due = qs.filter(q => { const r = S.srs[q.id]; return r && r.seen && r.box < 4 && r.due <= today(); }).length;
    rows += `<button class="list-btn" data-ch="${c}"><span>${meta.name}<span class="pill">${qs.length} q</span>${due ? `<span class="pill due">${due} due</span>` : ""}</span><span class="arrow">›</span></button>`;
  }
  view.innerHTML = `<h1>Practice by chapter</h1>
    <p class="small dim">Instant feedback with explanations after every answer. Questions you miss come back sooner.</p>${rows}`;
  view.querySelectorAll(".list-btn").forEach(b => b.onclick = () => startPractice(+b.dataset.ch));
}
function startPractice(ch) {
  const pool = ch ? chapterQs(ch) : QUESTIONS.slice();
  const qs = practiceOrder(pool).slice(0, 10);
  runQuiz({
    qs, mode: "practice", title: ch ? CHAPTERS[ch].short : "Mixed",
    onDone: ({ answers, score }) => sessionSummary(answers, score, () => startPractice(ch), "Practice 10 more")
  });
}
function sessionSummary(answers, score, again, againLabel) {
  if (!answers.length) return go("home");
  const misses = answers.filter(a => a.picked !== a.q.a);
  view.innerHTML = `
    <div class="card result-hero">
      <p class="q-meta">Session complete</p>
      <p class="big">${score}/${answers.length}</p>
      <p class="dim small">${misses.length ? "Missed questions will reappear in Smart Review." : "Perfect round! 🍁"}</p>
    </div>
    ${misses.length ? `<div class="card result-list"><h2>Worth another look</h2>${misses.map(m =>
      `<div class="miss"><b>${esc(m.q.q)}</b><span class="ans">✓ ${esc(m.q.opts[m.q.a])}</span><br><span class="dim">${esc(m.q.expl)}</span></div>`).join("")}</div>` : ""}
    <div class="btn-row"><button class="btn" id="again">${againLabel}</button><button class="btn secondary" id="homeBtn">Home</button></div>`;
  document.getElementById("again").onclick = again;
  document.getElementById("homeBtn").onclick = () => go("home");
}

/* ---------- MOCK TEST ---------- */
function test() {
  view.innerHTML = `
    <h1>Mock test</h1>
    <div class="card">
      <h2>Just like the real thing</h2>
      <p class="small">• <b>${TEST_SIZE} questions</b>, multiple choice &amp; true/false<br>
      • <b>${TEST_MINUTES} minutes</b> — the timer starts when you begin<br>
      • <b>${PASS_MARK}/${TEST_SIZE} (75%)</b> needed to pass<br>
      • No feedback until the end, just like the real test</p>
      <button class="btn mt" id="start">Start test</button>
    </div>
    <p class="small dim center">Questions are drawn from all chapters of Discover Canada, like the official test.</p>`;
  document.getElementById("start").onclick = () => {
    runQuiz({
      qs: sampleTest(), mode: "test", title: "Mock test",
      onDone: ({ answers, score, sec }) => {
        S.tests.push({ at: Date.now(), score, total: answers.length, sec }); save();
        testResults(answers, score, sec);
      }
    });
  };
}
function testResults(answers, score, sec) {
  const passed = score >= Math.ceil(answers.length * 0.75);
  const misses = answers.filter(a => a.picked !== a.q.a);
  view.innerHTML = `
    <div class="card result-hero">
      <p class="q-meta">Mock test result</p>
      <p class="big ${passed ? "pass" : "fail"}">${score}/${answers.length}</p>
      <p><b class="tag ${passed ? "pass" : "fail"}">${passed ? "PASS 🎉" : "NOT YET"}</b></p>
      <p class="dim small">${Math.floor(sec / 60)}m ${sec % 60}s · pass mark ${Math.ceil(answers.length * 0.75)}/${answers.length}${passed ? " — you'd have passed the real test." : " — review your misses below and try again."}</p>
    </div>
    ${misses.length ? `<div class="card result-list"><h2>Review your ${misses.length} miss${misses.length === 1 ? "" : "es"}</h2>${misses.map(m =>
      `<div class="miss"><b>${esc(m.q.q)}</b>
        <span class="dim">You picked: ${m.picked != null ? esc(m.q.opts[m.picked]) : "—"}</span><br>
        <span class="ans">✓ ${esc(m.q.opts[m.q.a])}</span><br>
        <span class="dim">${esc(m.q.expl)}</span></div>`).join("")}</div>` : `<div class="card center">Flawless. 🍁</div>`}
    <div class="btn-row"><button class="btn" id="again">Take another</button><button class="btn secondary" id="homeBtn">Home</button></div>`;
  document.getElementById("again").onclick = () => go("test");
  document.getElementById("homeBtn").onclick = () => go("home");
}

/* ---------- SMART REVIEW ---------- */
function review() {
  const due = dueIds();
  let pool;
  if (due.length) pool = QUESTIONS.filter(q => due.includes(q.id));
  else {
    // nothing due: serve weakest (lowest box, most wrong) seen items, else unseen
    const seen = QUESTIONS.filter(q => S.srs[q.id] && S.srs[q.id].seen);
    pool = seen.length ? seen.sort((a, b) => (S.srs[a.id].box - S.srs[b.id].box) || (S.srs[b.id].bad - S.srs[a.id].bad)).slice(0, 20) : [];
  }
  if (!pool.length) {
    view.innerHTML = `<h1>Smart review</h1><div class="card center"><p>Nothing to review yet — answer some questions in <b>Practice</b> first and this queue fills itself.</p><button class="btn mt" id="p">Go to Practice</button></div>`;
    document.getElementById("p").onclick = () => go("practice");
    return;
  }
  const qs = shuffle(pool).slice(0, 12);
  view.innerHTML = `<h1>Smart review</h1>
    <div class="card">
      <h2>${due.length ? `${due.length} question${due.length === 1 ? "" : "s"} due today` : "Targeting your weakest spots"}</h2>
      <p class="small dim">Spaced repetition: each question comes back right before you'd forget it (1 → 2 → 4 → 7 days). Miss it and it resets.</p>
      <button class="btn mt" id="start">Review ${qs.length} now</button>
    </div>`;
  document.getElementById("start").onclick = () =>
    runQuiz({ qs, mode: "review", title: "Review", onDone: ({ answers, score }) => sessionSummary(answers, score, () => go("review"), "Keep reviewing") });
}

/* ---------- FLASHCARDS ---------- */
function cards(ch) {
  if (ch === undefined) {
    let rows = `<button class="list-btn" data-ch="0"><span>All chapters (mixed)</span><span class="arrow">›</span></button>`;
    for (const [c, meta] of Object.entries(CHAPTERS)) {
      if (!chapterQs(+c).length) continue;
      rows += `<button class="list-btn" data-ch="${c}"><span>${meta.name}</span><span class="arrow">›</span></button>`;
    }
    view.innerHTML = `<h1>Flashcards</h1><p class="small dim">Tap to flip. Grade yourself honestly — it feeds the same review schedule.</p>${rows}`;
    view.querySelectorAll(".list-btn").forEach(b => b.onclick = () => cards(+b.dataset.ch));
    return;
  }
  const pool = practiceOrder(ch ? chapterQs(ch) : QUESTIONS.slice());
  let i = 0;
  function renderCard() {
    if (i >= pool.length) i = 0;
    const q = pool[i];
    view.innerHTML = `
      <div class="quiz-head"><span class="q-meta">Flashcards · ${ch ? CHAPTERS[ch].short : "Mixed"}</span><span class="q-meta">${i + 1}/${pool.length}</span></div>
      <div class="fc-stage"><div class="fc" id="fc">
        <div class="fc-face"><span class="q-meta">${CHAPTERS[q.chapter].short}</span><p>${esc(q.q)}</p><span class="hint">tap to flip</span></div>
        <div class="fc-face back"><span class="q-meta">Answer</span><p class="fc-answer">${esc(q.opts[q.a])}</p><p class="expl">${esc(q.expl)}</p></div>
      </div></div>
      <div class="btn-row" id="grade" style="visibility:hidden">
        <button class="btn secondary" id="no">✗ Didn't know</button>
        <button class="btn" id="yes">✓ Knew it</button>
      </div>
      <button class="btn ghost mt" id="quit">Done</button>`;
    const fc = document.getElementById("fc");
    fc.onclick = () => { fc.classList.toggle("flipped"); document.getElementById("grade").style.visibility = "visible"; };
    document.getElementById("yes").onclick = () => { gradeAnswer(q.id, true); i++; renderCard(); };
    document.getElementById("no").onclick = () => { gradeAnswer(q.id, false); i++; renderCard(); };
    document.getElementById("quit").onclick = () => go("cards");
  }
  renderCard();
}

/* ---------- boot ---------- */
applyTheme();
renderStreak();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
go(routes[location.hash.slice(1)] ? location.hash.slice(1) : "home");
