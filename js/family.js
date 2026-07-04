/* Sharon 80 — Mode 2: Family trivia (1950s diner edition)
 * -------------------------------------------------------------
 * Async individual play. Multiple choice. No time pressure.
 * Live global leaderboard (Firebase onValue). Per-correct-answer
 * fireworks that escalate as scores climb — from firecrackers
 * all the way to a grand finale at 200.
 * -------------------------------------------------------------
 */

import {
  db, ref, get, set, update, onValue, ensureSignedIn, serverTimestamp
} from "./firebase.js";
import { loadQuestions } from "./questions.js";
import { $, el, clear } from "./ui.js";
import * as fireworks from "./fireworks.js";
import * as sfx from "./sfx.js";

const NAME_KEY  = "sharon80.playerName";
const INDEX_KEY = "sharon80.familyIndex";
const MUTE_KEY  = "sharon80.muted";

const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];

const state = {
  user: null,
  playerId: null,
  playerName: "",
  questions: [],
  playable: [],
  index: 0,
  scores: {},         // leaderboard snapshot (all players)
  answered: {},       // this player's answers
  photoPool: []       // fallback rotation if a question has no photo
};

/* ---------- Boot ---------- */
async function boot() {
  // Set up the fireworks canvas as soon as we can
  const canvasEl = document.getElementById("fireworks-canvas");
  if (canvasEl) fireworks.init(canvasEl);

  // Unlock Web Audio on the first user gesture (required on iOS / Safari)
  const unlockAudio = () => {
    sfx.unlock();
    document.removeEventListener("click", unlockAudio);
    document.removeEventListener("touchstart", unlockAudio);
  };
  document.addEventListener("click", unlockAudio, { once: false });
  document.addEventListener("touchstart", unlockAudio, { once: false });

  // Restore saved mute preference + mount the toggle button
  const savedMuted = localStorage.getItem(MUTE_KEY) === "yes";
  sfx.setEnabled(!savedMuted);
  mountMuteButton();

  state.user = await ensureSignedIn();
  state.playerId = state.user.uid;

  const cfgSnap = await get(ref(db, "config"));
  const cfg = cfgSnap.exists() ? cfgSnap.val() : { live: true };
  if (cfg.live === false) {
    return renderNotLive();
  }

  const all = await loadQuestions();
  state.questions = all;
  state.playable = all.filter(q =>
    Array.isArray(q.choices) &&
    q.choices.length === 4 &&
    typeof q.correctIndex === "number"
  );

  // Build a shared photo pool from any question that DOES have a photo,
  // so questions without one still get a real picture instead of a placeholder.
  state.photoPool = all.map(q => q.photoUrl).filter(Boolean);

  const savedName = localStorage.getItem(NAME_KEY);
  if (!savedName) return renderNamePrompt();
  state.playerName = savedName;

  await ensurePlayerRecord();
  await loadMyScores();
  subscribeLeaderboard();

  const savedIndex = parseInt(localStorage.getItem(INDEX_KEY) || "0", 10);
  state.index = Number.isFinite(savedIndex)
    ? Math.max(0, Math.min(savedIndex, state.playable.length))
    : 0;

  render();
}

/* ---------- Screens ---------- */

/* ---------- Sound toggle button (floating, top-right) ---------- */

function mountMuteButton() {
  if (document.getElementById("sfx-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "sfx-toggle";
  btn.className = "sfx-toggle";
  btn.type = "button";
  updateMuteButton(btn);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const nowMuted = sfx.getEnabled();
    sfx.setEnabled(!nowMuted);
    localStorage.setItem(MUTE_KEY, nowMuted ? "yes" : "no");
    updateMuteButton(btn);
    // Little confirm blip on unmute so the user hears something worked
    if (!nowMuted) { /* was muted, now enabled — no sound needed */ }
    else { /* was enabled, now muted — silence */ }
  });
  document.body.appendChild(btn);
}

function updateMuteButton(btn) {
  const on = sfx.getEnabled();
  btn.setAttribute("aria-label", on ? "Sound is ON — tap to mute" : "Sound is OFF — tap to unmute");
  btn.setAttribute("aria-pressed", on ? "false" : "true");
  btn.classList.toggle("sfx-off", !on);
  btn.innerHTML = on
    ? '<span class="sfx-icon">🔊</span><span class="sfx-label">SOUND ON</span>'
    : '<span class="sfx-icon">🔇</span><span class="sfx-label">SOUND OFF</span>';
}

function renderNotLive() {
  const screen = $("#screen");
  clear(screen);
  screen.append(
    el("div", { class: "jukebox-card center" },
      el("h2", { class: "finale-title" }, "The Grand Opening is Coming!"),
      el("p", {}, "Dan hasn't flipped the OPEN sign yet."),
      el("p", {}, "Check back later &mdash; the trivia jukebox will be spinning soon.")
    )
  );
  renderLeaderboard();
}

function renderNamePrompt() {
  const screen = $("#screen");
  clear(screen);
  const input = el("input", { placeholder: "Your name (e.g. Uncle Bob)", autofocus: true });
  const go = el("button", { class: "retro-btn retro-btn-primary" }, "LET'S PLAY!");
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
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });

  screen.append(
    el("div", { class: "name-card" },
      el("h1", {}, "🎉 Welcome, Sweetheart"),
      el("p", {}, "Grab a booth. Order a milkshake. See how well you know Sharon."),
      el("label", { style: { display: "block", fontFamily: "'Special Elite', monospace", fontSize: "16px", marginTop: "10px" } }, "WHAT'S YOUR NAME?"),
      input,
      go
    )
  );
  renderLeaderboard();
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
    await update(playerRef, {
      name: state.playerName,
      lastSeen: serverTimestamp()
    });
  }
}

async function loadMyScores() {
  const snap = await get(ref(db, "scores/" + state.playerId));
  state.answered = snap.exists() ? snap.val() : {};
}

/* ---------- Main render ---------- */

function render() {
  if (state.playable.length === 0) {
    return renderNoQuestions();
  }
  if (state.index >= state.playable.length) return renderComplete();

  const q = state.playable[state.index];
  const already = state.answered[q.id];
  const total = state.playable.length;
  const pct = Math.round((state.index / total) * 100);
  const myScore = Object.values(state.answered).filter(a => a && a.correct).length;

  const screen = $("#screen");
  clear(screen);

  const card = el("div", { class: "jukebox-card" });

  // Row 1: retro tag + question counter
  const meta = el("div", { class: "q-meta" },
    el("span", { class: "retro-tag" }, q.section || "TRIVIA"),
    el("span", { class: "q-counter" }, `#${state.index + 1} / ${total}`)
  );

  // Progress bar
  const progress = el("div", { class: "retro-progress" },
    el("div", { style: { width: pct + "%" } })
  );

  // Polaroid photo of Sharon (real photoUrl if set; otherwise rotate through the pool; otherwise placeholder)
  const chosenPhoto = q.photoUrl
    || (state.photoPool.length > 0 ? state.photoPool[state.index % state.photoPool.length] : null);
  const polaroid = el("div", { class: "polaroid" },
    el("div", { class: "photo-inner" },
      chosenPhoto
        ? el("img", { src: chosenPhoto, alt: "Sharon" })
        : el("div", { class: "photo-placeholder-inner" }, "☘", el("div", { class: "photo-placeholder-sub" }, "Sharon photo"))
    ),
    el("div", { class: "caption" }, "♥ SHARON ♥")
  );

  // Question text
  const qText = el("div", { class: "q-text" }, q.text);

  // Choices
  const choicesWrap = el("div", { class: "choices-grid" });
  q.choices.forEach((choice, i) => {
    const btn = el("button", {
      class: "retro-choice",
      type: "button",
      "data-letter": CHOICE_LETTERS[i] || (i + 1)
    }, choice);
    btn.addEventListener("click", () => pick(q, i, choicesWrap, card));
    if (already) {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add("correct");
      if (i === already.chosenIndex && i !== q.correctIndex) btn.classList.add("wrong");
    }
    choicesWrap.append(btn);
  });

  card.append(meta, progress, polaroid, qText, choicesWrap);

  // Action row (nav)
  const actions = el("div", { class: "retro-actions" });
  const backBtn = el("button", { class: "retro-btn retro-btn-ghost" }, "← BACK");
  backBtn.addEventListener("click", () => {
    if (state.index > 0) { state.index--; persistIndex(); render(); }
  });
  actions.append(backBtn);

  if (already) {
    // Show feedback badge for a previously answered question
    const badge = renderFeedbackBadge(already.correct, myScore);
    card.append(badge);

    const nextBtn = el("button", { class: "retro-btn retro-btn-primary" }, "NEXT →");
    nextBtn.addEventListener("click", () => { state.index++; persistIndex(); render(); });
    actions.append(nextBtn);
  }

  card.append(actions);
  screen.append(card);
  renderLeaderboard();
}

function renderNoQuestions() {
  const screen = $("#screen");
  clear(screen);
  screen.append(
    el("div", { class: "jukebox-card center" },
      el("h2", { class: "finale-title" }, "Almost Showtime!"),
      el("p", {}, "Dan is still writing the trivia choices. Come back in a bit &mdash; the fireworks are loaded and waiting.")
    )
  );
  renderLeaderboard();
}

function renderFeedbackBadge(correct, score) {
  if (correct) {
    // On every 10th correct answer, announce the milestone and firework tier.
    if (score > 0 && score % 10 === 0) {
      const milestone = score / 10;
      const tier = fireworks.tierFor(score);
      return el("div", { class: "feedback-badge feedback-correct feedback-milestone" },
        `🎇 MILESTONE ${score}! 🎇`,
        el("span", { class: "tier-name" }, tier.name + " · Firework #" + milestone + " of 20")
      );
    }
    return el("div", { class: "feedback-badge feedback-correct" },
      "✨ Correct!",
      el("span", { class: "tier-name" }, "Keep going — firework at " + (Math.floor(score / 10) * 10 + 10))
    );
  }
  return el("div", { class: "feedback-badge feedback-wrong" },
    "So close!",
    el("span", { class: "tier-name" }, "The correct answer is highlighted")
  );
}

/* ---------- Answer flow ---------- */

async function pick(q, chosenIndex, choicesWrap, card) {
  const correct = chosenIndex === q.correctIndex;
  const btns = choicesWrap.querySelectorAll(".retro-choice");
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

  const newScore = Object.values(state.answered).filter(a => a && a.correct).length;
  await recomputeTotal(newScore);

  // Feedback badge + fireworks
  const oldBadge = card.querySelector(".feedback-badge");
  if (oldBadge) oldBadge.remove();
  const badge = renderFeedbackBadge(correct, newScore);
  card.insertBefore(badge, card.querySelector(".retro-actions") || null);

  if (correct) {
    sfx.playCorrect();
    // Fireworks only fire on every 10th correct answer, escalating.
    if (newScore > 0 && newScore % 10 === 0) {
      const milestone = newScore / 10;
      const tier = fireworks.celebrateMilestone(milestone);
      badge.setAttribute("aria-label", `Correct. Milestone ${newScore}. ${tier.name} celebration.`);
    }
  } else {
    sfx.playWrong();
  }

  // Add / update Next button
  const actions = card.querySelector(".retro-actions");
  if (actions && !actions.querySelector(".retro-btn-primary")) {
    const nextBtn = el("button", { class: "retro-btn retro-btn-primary" }, "NEXT →");
    nextBtn.addEventListener("click", () => { state.index++; persistIndex(); render(); });
    actions.append(nextBtn);
  }
}

async function recomputeTotal(newScore) {
  await update(ref(db, "players/" + state.playerId), {
    totalScore: newScore,
    lastSeen: serverTimestamp()
  });
}

function persistIndex() { localStorage.setItem(INDEX_KEY, String(state.index)); }

/* ---------- Completion ---------- */

function renderComplete() {
  const totalCorrect = Object.values(state.answered).filter(a => a && a.correct).length;
  const totalPlayed = state.playable.length;
  const screen = $("#screen");
  clear(screen);

  // Grand finale on completion
  setTimeout(() => fireworks.celebrate(Math.max(200, totalCorrect)), 300);

  screen.append(
    el("div", { class: "jukebox-card finale-card" },
      el("div", { class: "finale-title" }, "You Did It!"),
      el("p", { class: "finale-sub" }, `${totalCorrect} out of ${totalPlayed} correct`),
      el("p", {}, "Happy 80th, Sharon ❤️"),
      el("div", { class: "retro-actions", style: { justifyContent: "center", marginTop: "20px" } },
        el("button", { class: "retro-btn retro-btn-secondary", onclick: () => {
          state.index = 0; persistIndex(); render();
        }}, "PLAY AGAIN"),
        el("button", { class: "retro-btn retro-btn-primary", onclick: () => {
          fireworks.celebrate(200);
        }}, "MORE FIREWORKS!")
      )
    )
  );
  renderLeaderboard();
}

/* ---------- Leaderboard (LIVE) ---------- */

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
    .slice(0, 25);

  if (players.length === 0) {
    wrap.append(
      el("div", { class: "scoreboard-empty" },
        "No scores yet.", el("br"), "Be the first on the board!"
      )
    );
    return;
  }

  players.forEach((p, idx) => {
    const rank = idx + 1;
    const rankClass = rank <= 3 ? `rank rank-${rank}` : "rank";
    const isYou = p.id === state.playerId;
    const row = el("div", { class: "scoreboard-row" + (isYou ? " you" : "") },
      el("span", { class: rankClass }, rank + "."),
      el("span", { class: "player-name" }, (p.name || "Anonymous") + (isYou ? " (you)" : "")),
      el("span", { class: "player-score" }, String(p.totalScore || 0))
    );
    wrap.append(row);
  });
}

/* ---------- Kickoff ---------- */

boot().catch((e) => {
  console.error(e);
  const screen = $("#screen");
  if (screen) {
    screen.innerHTML = "<div class='jukebox-card center'><h2>Uh oh, the jukebox skipped a beat.</h2><p>Try refreshing this page.</p></div>";
  }
});
