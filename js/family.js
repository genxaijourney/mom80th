/* Sharon 80 — Mode 2: Family trivia
 *
 * Async, individual play. Multiple choice, no time pressure,
 * live global leaderboard, resumes where the player left off.
 */

import {
  db, ref, get, set, update, onValue, ensureSignedIn, serverTimestamp
} from "./firebase.js";
import { loadQuestions } from "./questions.js";
import { $, el, clear } from "./ui.js";

const NAME_KEY  = "sharon80.playerName";
const INDEX_KEY = "sharon80.familyIndex";

const state = {
  user: null,
  playerId: null,
  playerName: "",
  questions: [],
  playable: [],
  index: 0,
  scores: {},
  answered: {}
};

async function boot() {
  state.user = await ensureSignedIn();
  state.playerId = state.user.uid;

  const cfgSnap = await get(ref(db, "config"));
  const cfg = cfgSnap.exists() ? cfgSnap.val() : { live: true };
  if (cfg.live === false) {
    $("#screen").innerHTML = "<div class='card center'><h2>The trivia isn't open yet.</h2><p>Check back later today!</p></div>";
    return;
  }

  const all = await loadQuestions();
  state.questions = all;
  state.playable = all.filter(q =>
    Array.isArray(q.choices) &&
    q.choices.length === 4 &&
    typeof q.correctIndex === "number"
  );

  const savedName = localStorage.getItem(NAME_KEY);
  if (!savedName) return renderNamePrompt();
  state.playerName = savedName;

  await ensurePlayerRecord();
  await loadMyScores();
  subscribeLeaderboard();

  const savedIndex = parseInt(localStorage.getItem(INDEX_KEY) || "0", 10);
  state.index = Number.isFinite(savedIndex) ? Math.max(0, Math.min(savedIndex, state.playable.length)) : 0;

  render();
}

function renderNamePrompt() {
  const screen = $("#screen");
  clear(screen);
  const input = el("input", { class: "field", placeholder: "Your name (e.g. Uncle Bob)", autofocus: true });
  const go = el("button", { class: "btn btn-primary" }, "Let's play!");
  go.addEventListener("click", async () => {
    const name = (input.value || "").trim();
    if (!name) { input.focus(); return; }
    localStorage.setItem(NAME_KEY, name);
    state.playerName = name;
    await ensurePlayerRecord();
    await loadMyScores();
    subscribeLeaderboard();
    state.index = 0;
    render();
  });
  screen.append(el("div", { class: "card" },
    el("h1", {}, "🎉 Sharon's 80th Trivia"),
    el("p", {}, "How well do you know Sharon? Take your time — the leaderboard runs all day."),
    el("div", { class: "field" },
      el("label", {}, "What's your name?"),
      input
    ),
    el("div", { class: "big-spacer" }),
    go
  ));
}

async function ensurePlayerRecord() {
  const playerRef = ref(db, "players/" + state.playerId);
  const snap = await get(playerRef);
  if (!snap.exists()) {
    await set(playerRef, {
      name:       state.playerName,
      totalScore: 0,
      createdAt:  serverTimestamp(),
      lastSeen:   serverTimestamp()
    });
  } else {
    await update(playerRef, { name: state.playerName, lastSeen: serverTimestamp() });
  }
}

async function loadMyScores() {
  const snap = await get(ref(db, "scores/" + state.playerId));
  state.answered = snap.exists() ? snap.val() : {};
}

function render() {
  if (state.playable.length === 0) {
    $("#screen").innerHTML =
      "<div class='card center'><h2>Trivia is loading…</h2><p>Dan is still setting up the questions. Try again in a bit.</p></div>";
    return renderLeaderboard();
  }
  if (state.index >= state.playable.length) return renderComplete();

  const q = state.playable[state.index];
  const already = state.answered[q.id];

  const screen = $("#screen");
  clear(screen);

  const total = state.playable.length;
  const pct = Math.round((state.index / total) * 100);
  const progressLabel = el("p", { class: "progress-label" }, `Question ${state.index + 1} of ${total}`);
  const progressBar = el("div", { class: "progress" }, el("div", { style: { width: pct + "%" } }));

  const card = el("div", { class: "card" });

  const photo = el("div", { class: "photo-frame" },
    q.photoUrl
      ? el("img", { src: q.photoUrl, alt: "Sharon" })
      : el("div", { class: "placeholder" }, "📷 Photo of Sharon")
  );

  const secTag = el("div", { class: "tag" }, q.section);
  const qText = el("h2", { class: "question-text" }, q.text);

  const choicesWrap = el("div", { class: "choices" });
  q.choices.forEach((choice, i) => {
    const btn = el("button", { class: "choice", type: "button" }, choice);
    btn.addEventListener("click", () => pick(q, i, choicesWrap));
    if (already) {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add("correct");
      if (i === already.chosenIndex && i !== q.correctIndex) btn.classList.add("wrong");
    }
    choicesWrap.append(btn);
  });

  const nextBtn = el("button", { class: "btn btn-primary" }, "Next →");
  nextBtn.addEventListener("click", () => { state.index++; persistIndex(); render(); });

  const backBtn = el("button", { class: "btn btn-ghost" }, "← Back");
  backBtn.addEventListener("click", () => {
    if (state.index > 0) { state.index--; persistIndex(); render(); }
  });

  card.append(secTag, qText, photo, choicesWrap);
  if (already) card.append(el("div", { class: "actions" }, backBtn, nextBtn));
  else card.append(el("div", { class: "actions" }, backBtn));

  screen.append(progressLabel, progressBar, card);
  renderLeaderboard();
}

async function pick(q, chosenIndex, choicesWrap) {
  const correct = chosenIndex === q.correctIndex;
  const btns = choicesWrap.querySelectorAll(".choice");
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) btn.classList.add("correct");
    if (i === chosenIndex && !correct) btn.classList.add("wrong");
  });

  await set(ref(db, `scores/${state.playerId}/${q.id}`), {
    chosenIndex,
    correct,
    answeredAt: serverTimestamp()
  });
  state.answered[q.id] = { chosenIndex, correct };

  await recomputeTotal();

  const existing = choicesWrap.parentElement.querySelector(".actions");
  if (!existing) {
    const nextBtn = el("button", { class: "btn btn-primary" }, "Next →");
    nextBtn.addEventListener("click", () => { state.index++; persistIndex(); render(); });
    choicesWrap.parentElement.append(el("div", { class: "actions" }, nextBtn));
  }
}

async function recomputeTotal() {
  const total = Object.values(state.answered).filter(a => a.correct).length;
  await update(ref(db, "players/" + state.playerId), {
    totalScore: total,
    lastSeen: serverTimestamp()
  });
}

function persistIndex() { localStorage.setItem(INDEX_KEY, String(state.index)); }

function renderComplete() {
  const total = Object.values(state.answered).filter(a => a.correct).length;
  const screen = $("#screen");
  clear(screen);
  screen.append(el("div", { class: "card center" },
    el("h1", {}, "🎂 You did it!"),
    el("p", {}, `You got ${total} of ${state.playable.length} right.`),
    el("p", {}, "Happy 80th, Sharon 💛"),
    el("button", { class: "btn btn-secondary", onclick: () => { state.index = 0; persistIndex(); render(); } }, "Play again")
  ));
  renderLeaderboard();
}

function subscribeLeaderboard() {
  onValue(ref(db, "players"), (snap) => {
    state.scores = snap.exists() ? snap.val() : {};
    renderLeaderboard();
  });
}

function renderLeaderboard() {
  const wrap = $("#leaderboard");
  if (!wrap) return;
  clear(wrap);
  const players = Object.entries(state.scores)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .slice(0, 20);

  wrap.append(el("h3", {}, "🏆 Leaderboard"));
  if (players.length === 0) {
    wrap.append(el("p", {}, "No scores yet — be the first!"));
    return;
  }
  const ol = el("ol");
  players.forEach((p) => {
    const line = el("li", {},
      el("strong", {}, `${p.name || "Anonymous"}`),
      ` — ${p.totalScore || 0}`
    );
    if (p.id === state.playerId) line.append(" (you)");
    ol.append(line);
  });
  wrap.append(ol);
}

boot().catch((e) => {
  console.error(e);
  $("#screen").innerHTML =
    "<div class='card'><h2>Trouble loading trivia.</h2><p>Try refreshing this page.</p></div>";
});
