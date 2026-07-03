/* Sharon 80 — Mode 1: Sharon's questionnaire
 *
 * One question at a time, big type, mic button, editable transcript,
 * skip button, saves to Firebase, resumes where she left off.
 * -------------------------------------------------------------
 * Audio is discarded — the Web Speech API returns text and we save
 * only text. No audio ever leaves the phone.
 */

import { db, ref, update, get, ensureSignedIn, serverTimestamp } from "./firebase.js";
import { loadQuestions } from "./questions.js";
import {
  $, $$, el, clear,
  isSafariOrIOS, hasSpeechRecognition,
  debounce
} from "./ui.js";

const STORAGE_KEY = "sharon80.momIndex";

const state = {
  questions: [],
  index: 0,
  recognizer: null,
  listening: false,
  currentAnswer: "",
};

/* ---------- Boot ---------- */
async function boot() {
  await ensureSignedIn();

  // Show Safari nudge if needed (non-blocking, just informative)
  const notice = $("#browser-notice");
  if (isSafariOrIOS() || !hasSpeechRecognition()) {
    notice.classList.remove("hidden");
  }

  state.questions = await loadQuestions();
  if (state.questions.length === 0) {
    $("#screen").innerHTML =
      "<div class='card'><h2>We're still setting things up.</h2>" +
      "<p>Please try again in a few minutes, sweetheart.</p></div>";
    return;
  }

  // Pull any previously saved answers to know where she left off
  const answersSnap = await get(ref(db, "questions"));
  const answered = new Set();
  if (answersSnap.exists()) {
    const raw = answersSnap.val();
    for (const [qid, q] of Object.entries(raw)) {
      if (q.answer || q.skipped) answered.add(qid);
    }
  }

  // Resume: first unanswered question, or the one saved in localStorage
  const savedIndex = parseInt(localStorage.getItem(STORAGE_KEY) || "-1", 10);
  let startIndex = 0;
  for (let i = 0; i < state.questions.length; i++) {
    if (!answered.has(state.questions[i].id)) { startIndex = i; break; }
    startIndex = i + 1;
  }
  if (savedIndex >= 0 && savedIndex < state.questions.length && !answered.has(state.questions[savedIndex].id)) {
    startIndex = Math.min(savedIndex, startIndex);
  }

  state.index = Math.min(startIndex, state.questions.length - 1);
  render();
}

/* ---------- Render ---------- */
function render() {
  if (state.index >= state.questions.length) {
    renderComplete();
    return;
  }

  const q = state.questions[state.index];
  const screen = $("#screen");
  clear(screen);

  // Progress bar
  const pct = Math.round((state.index / state.questions.length) * 100);
  const progressLabel = el("p", { class: "progress-label" },
    `Question ${state.index + 1} of ${state.questions.length}`);
  const progressBar = el("div", { class: "progress" }, el("div", { style: { width: pct + "%" } }));

  // Section banner when a new section starts
  const prevSection = state.index > 0 ? state.questions[state.index - 1].section : null;
  const banner = (prevSection !== q.section)
    ? el("div", { class: "section-banner" },
        el("div", { class: "tag" }, q.section),
        el("h2", {}, "A new chapter."),
        el("p", {}, "Take your time. There's no rush."))
    : null;

  // Question card
  const card = el("div", { class: "card question-block" });
  const sectionLabel = el("div", { class: "section-label" }, q.section);
  const questionText = el("div", { class: "question-text" }, q.text);
  const hint = q.hint ? el("div", { class: "hint" }, q.hint) : null;

  const textarea = el("textarea", {
    class: "answer",
    placeholder: "Tap the mic and speak, or type here…",
    autocomplete: "off",
    autocapitalize: "sentences"
  });
  textarea.value = state.currentAnswer || "";
  textarea.addEventListener("input", () => {
    state.currentAnswer = textarea.value;
    autoSave(q.id, textarea.value);
  });

  const micLabel = el("span", { class: "mic-label", id: "mic-label" }, "Tap to speak");
  const micBtn = el("button", { class: "mic-btn", id: "mic-btn", type: "button", "aria-label": "Start speaking" }, "🎤");
  micBtn.addEventListener("click", () => toggleMic(textarea));
  const micRow = el("div", { class: "mic-row" }, micBtn, micLabel);

  const nextBtn = el("button", { class: "btn btn-primary", type: "button" }, "Save & next →");
  nextBtn.addEventListener("click", () => saveAndAdvance(q.id, textarea.value));

  const skipBtn = el("button", { class: "btn btn-secondary", type: "button" }, "Skip this one");
  skipBtn.addEventListener("click", () => skipQuestion(q.id));

  const backBtn = el("button", { class: "btn btn-ghost", type: "button" }, "← Back");
  backBtn.addEventListener("click", () => {
    if (state.index > 0) {
      state.index--;
      state.currentAnswer = "";
      persistIndex();
      render();
    }
  });

  const actions = el("div", { class: "actions" }, backBtn, skipBtn, nextBtn);

  card.append(sectionLabel, questionText);
  if (hint) card.append(hint);
  card.append(micRow, textarea, actions);

  screen.append(progressLabel, progressBar);
  if (banner) screen.append(banner);
  screen.append(card);

  textarea.focus({ preventScroll: true });
}

function renderComplete() {
  const screen = $("#screen");
  clear(screen);
  screen.append(el("div", { class: "card center" },
    el("h1", {}, "Thank you, Sharon 💛"),
    el("p", {}, "You've done it. Every answer is saved."),
    el("p", {}, "The family is going to love hearing all of this on your birthday."),
    el("div", { class: "big-spacer" }),
    el("button", { class: "btn btn-secondary", onclick: () => { state.index = 0; render(); } }, "Look back at questions")
  ));
}

/* ---------- Save ---------- */
const autoSave = debounce(async (qid, text) => {
  try {
    await update(ref(db, "questions/" + qid), { answer: text, draft: true });
  } catch (e) { console.warn("autosave failed", e); }
}, 800);

async function saveAndAdvance(qid, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    if (!confirm("This looks blank. Skip this question?")) return;
    return skipQuestion(qid);
  }
  await update(ref(db, "questions/" + qid), {
    answer:     trimmed,
    answeredAt: serverTimestamp(),
    skipped:    false,
    draft:      false
  });
  state.currentAnswer = "";
  state.index++;
  persistIndex();
  stopMic();
  render();
}

async function skipQuestion(qid) {
  await update(ref(db, "questions/" + qid), {
    skipped:    true,
    answeredAt: serverTimestamp()
  });
  state.currentAnswer = "";
  state.index++;
  persistIndex();
  stopMic();
  render();
}

function persistIndex() {
  localStorage.setItem(STORAGE_KEY, String(state.index));
}

/* ---------- Web Speech API ---------- */
function toggleMic(textarea) {
  if (!hasSpeechRecognition()) {
    alert("Speech recognition isn't available in this browser. Please open this link in Chrome.");
    return;
  }
  if (state.listening) { stopMic(); return; }
  startMic(textarea);
}

function startMic(textarea) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = true;

  let finalBuffer = textarea.value ? (textarea.value.trim() + " ") : "";

  rec.onresult = (evt) => {
    let interim = "";
    for (let i = evt.resultIndex; i < evt.results.length; i++) {
      const t = evt.results[i][0].transcript;
      if (evt.results[i].isFinal) finalBuffer += t + " ";
      else interim += t;
    }
    textarea.value = (finalBuffer + interim).replace(/\s+/g, " ").trim();
    state.currentAnswer = textarea.value;
    autoSave(state.questions[state.index].id, textarea.value);
  };

  rec.onerror = (e) => {
    console.warn("speech error", e);
    stopMic();
  };
  rec.onend = () => {
    // If user is still "listening", auto-restart (Chrome cuts off after ~1min)
    if (state.listening) {
      try { rec.start(); } catch (_) { stopMic(); }
    }
  };

  state.recognizer = rec;
  state.listening = true;
  rec.start();

  const btn = $("#mic-btn");
  const lbl = $("#mic-label");
  if (btn) btn.classList.add("listening");
  if (lbl) lbl.textContent = "Listening… tap to stop";
}

function stopMic() {
  state.listening = false;
  try { state.recognizer && state.recognizer.stop(); } catch (_) {}
  state.recognizer = null;
  const btn = $("#mic-btn");
  const lbl = $("#mic-label");
  if (btn) btn.classList.remove("listening");
  if (lbl) lbl.textContent = "Tap to speak";
}

/* ---------- Go ---------- */
boot().catch((e) => {
  console.error(e);
  $("#screen").innerHTML =
    "<div class='card'><h2>Sorry, something went wrong.</h2>" +
    "<p>Please close this and reopen it, or call Dan.</p></div>";
});
