/* Sharon 80 — Mode 3: Admin
 *
 * Password-gated (SHA-256). Live view of Sharon's answers, seed 200 questions,
 * toggle trivia live, write 3 distractors + assign photo per question.
 */

import {
  db, ref, get, set, update, onValue, ensureSignedIn
} from "./firebase.js";
import { seedQuestions, loadQuestions } from "./questions.js";
import { $, el, clear, fmtTime, debounce } from "./ui.js";

/* ============================================================
 * >>> REPLACE THIS HASH <<<
 * Generate a hash in a browser console:
 *   crypto.subtle.digest("SHA-256", new TextEncoder().encode("YOUR_PASSWORD"))
 *     .then(b => console.log(Array.from(new Uint8Array(b))
 *       .map(x=>x.toString(16).padStart(2,"0")).join("")))
 * FALLBACK_HASH below is sha256("123456") — DELETE it for prod.
 * ============================================================ */
const ADMIN_HASH    = "REPLACE_ME_sha256_of_admin_password";
const FALLBACK_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

const SESSION_KEY = "sharon80.adminOk";

async function boot() {
  await ensureSignedIn();
  if (sessionStorage.getItem(SESSION_KEY) === "yes") return renderApp();
  renderGate();
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, "0")).join("");
}

function renderGate() {
  const screen = $("#screen");
  clear(screen);
  const input = el("input", { class: "field", type: "password", placeholder: "Admin password", autofocus: true });
  const btn = el("button", { class: "btn btn-primary" }, "Unlock");
  const msg = el("p", { class: "hint" }, "");

  btn.addEventListener("click", async () => {
    const h = await sha256(input.value || "");
    if (h === ADMIN_HASH || h === FALLBACK_HASH) {
      sessionStorage.setItem(SESSION_KEY, "yes");
      renderApp();
    } else {
      msg.textContent = "Nope — try again.";
    }
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click(); });

  screen.append(el("div", { class: "card" },
    el("h1", {}, "🔐 Admin"),
    el("p", {}, "Dan-only. Enter the password."),
    el("div", { class: "field" }, el("label", {}, "Password"), input),
    el("div", { class: "big-spacer" }),
    btn, msg
  ));
}

async function renderApp() {
  const screen = $("#screen");
  clear(screen);

  const header = el("div", { class: "card" },
    el("h1", {}, "Admin dashboard"),
    el("p", { id: "adm-progress" }, "Loading…"),
    el("div", { class: "row" },
      el("button", { class: "btn btn-secondary", onclick: onSeed }, "Seed 200 questions"),
      el("button", { class: "btn btn-secondary", id: "toggle-live" }, "Toggle trivia live"),
      el("button", { class: "btn btn-ghost", onclick: () => { sessionStorage.removeItem(SESSION_KEY); renderGate(); } }, "Lock")
    ),
    el("p", { id: "seed-msg", class: "hint" }, "")
  );
  const list = el("div", { class: "admin-list", id: "adm-list" });
  screen.append(header, list);

  onValue(ref(db, "questions"), (snap) => {
    const map = snap.exists() ? snap.val() : {};
    const arr = Object.entries(map)
      .map(([id, q]) => ({ id, ...q }))
      .sort((a, b) => a.order - b.order);
    renderList(arr);
    updateProgress(arr);
  });

  onValue(ref(db, "config"), (snap) => {
    const cfg = snap.exists() ? snap.val() : { live: false };
    const btn = $("#toggle-live");
    if (!btn) return;
    btn.textContent = cfg.live ? "Trivia is LIVE — click to hide" : "Trivia hidden — click to go LIVE";
    btn.onclick = async () => { await update(ref(db, "config"), { live: !cfg.live }); };
  });
}

async function onSeed() {
  const msg = $("#seed-msg");
  msg.textContent = "Seeding…";
  try {
    const res = await seedQuestions({ overwrite: false });
    msg.textContent = res.skipped
      ? `Already seeded (${res.count} questions in Firebase).`
      : `Seeded ${res.count} questions.`;
  } catch (e) {
    msg.textContent = "Seed failed: " + e.message;
  }
}

function updateProgress(arr) {
  const total = arr.length;
  const answered = arr.filter(q => q.answer || q.skipped).length;
  const ready = arr.filter(q => Array.isArray(q.choices) && q.choices.length === 4 && typeof q.correctIndex === "number").length;
  $("#adm-progress").innerHTML =
    `<strong>${answered}/${total}</strong> answered · <strong>${ready}/${total}</strong> ready for trivia`;
}

function renderList(arr) {
  const wrap = $("#adm-list");
  clear(wrap);
  let lastSection = null;
  for (const q of arr) {
    if (q.section !== lastSection) {
      wrap.append(el("h2", { style: { color: "#A63848", marginTop: "18px" } }, q.section));
      lastSection = q.section;
    }
    wrap.append(renderQ(q));
  }
}

function renderQ(q) {
  const box = el("div", { class: "admin-q", "data-id": q.id });

  const chips = [];
  if (q.skipped)         chips.push(el("span", { class: "chip skipped" }, "SKIPPED"));
  else if (q.answer)     chips.push(el("span", { class: "chip ready" }, "ANSWERED"));
  else                   chips.push(el("span", { class: "chip pending" }, "WAITING"));
  if (q.choices && q.choices.length === 4 && typeof q.correctIndex === "number")
    chips.push(el("span", { class: "chip ready" }, "TRIVIA-READY"));

  box.append(
    el("div", {},
      el("span", { class: "chip" }, "#" + q.order),
      ...chips,
      q.answeredAt ? el("small", {}, " · " + fmtTime(q.answeredAt)) : null
    ),
    el("div", { class: "q-text" }, q.text)
  );

  if (q.answer || q.skipped) {
    const answerBox = el("textarea", { class: "answer-box", rows: 2 });
    answerBox.value = q.answer || "";
    if (q.skipped && !q.answer) answerBox.placeholder = "Sharon skipped — you can write an answer here if you want.";
    answerBox.addEventListener("input", debounce(async () => {
      await update(ref(db, "questions/" + q.id), { answer: answerBox.value });
    }, 500));
    box.append(el("label", {}, "Sharon's answer (this becomes the CORRECT choice):"), answerBox);

    const distractors = (q.choices && q.choices.length === 4 && typeof q.correctIndex === "number")
      ? q.choices.filter((_, i) => i !== q.correctIndex)
      : ["", "", ""];

    const dInputs = [];
    for (let i = 0; i < 3; i++) {
      const inp = el("input", { class: "distractor", placeholder: `Wrong answer #${i + 1}`, value: distractors[i] || "" });
      inp.addEventListener("input", debounce(() => rebuildChoices(q.id, answerBox, dInputs), 500));
      dInputs.push(inp);
      box.append(el("label", {}, `Distractor ${i + 1}:`), inp);
    }

    const photoInput = el("input", { class: "photo-url", placeholder: "Photo URL (e.g. /photos/sharon-1965.jpg)", value: q.photoUrl || "" });
    photoInput.addEventListener("input", debounce(async () => {
      await update(ref(db, "questions/" + q.id), { photoUrl: photoInput.value || null });
    }, 500));
    box.append(el("label", {}, "Photo URL for this question:"), photoInput);

    const genBtn = el("button", { class: "btn btn-secondary" }, "Build multiple-choice");
    genBtn.addEventListener("click", () => rebuildChoices(q.id, answerBox, dInputs));
    box.append(el("div", { class: "big-spacer" }), genBtn);
  }

  return box;
}

async function rebuildChoices(qid, answerBox, dInputs) {
  const correct = (answerBox.value || "").trim();
  const distractors = dInputs.map(i => (i.value || "").trim()).filter(Boolean);
  if (!correct || distractors.length < 3) {
    await update(ref(db, "questions/" + qid), { choices: null, correctIndex: null });
    return;
  }
  const options = [correct, ...distractors.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctIndex = options.indexOf(correct);
  await update(ref(db, "questions/" + qid), { choices: options, correctIndex });
}

boot().catch((e) => {
  console.error(e);
  $("#screen").innerHTML =
    "<div class='card'><h2>Admin failed to load.</h2><p>" + (e.message || e) + "</p></div>";
});
