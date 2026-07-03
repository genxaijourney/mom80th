/* Sharon 80 — one-time seed of the 200 questions into Firebase.
 * -------------------------------------------------------------
 * Run this ONCE from the admin route (button: "Seed 200 questions").
 * It's idempotent — it fetches /questions and only writes if empty,
 * unless you force it with { overwrite: true }.
 */

import { db, ref, get, set } from "./firebase.js";

export async function seedQuestions({ overwrite = false } = {}) {
  const questionsRef = ref(db, "questions");
  const snapshot = await get(questionsRef);

  if (snapshot.exists() && !overwrite) {
    return { skipped: true, count: Object.keys(snapshot.val() || {}).length };
  }

  const res = await fetch("./seed-questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not fetch seed-questions.json (" + res.status + ")");
  const questions = await res.json();

  // Build the map keyed by id
  const map = {};
  for (const q of questions) {
    if (!q.id || !q.order || !q.section || !q.text) {
      throw new Error("Bad question in seed: " + JSON.stringify(q));
    }
    map[q.id] = {
      order:   q.order,
      section: q.section,
      text:    q.text,
      hint:    q.hint || null
    };
  }

  await set(questionsRef, map);

  // Also seed /config if missing
  const configSnap = await get(ref(db, "config"));
  if (!configSnap.exists()) {
    // Compute sections order from data
    const sectionsOrder = [];
    for (const q of questions.sort((a, b) => a.order - b.order)) {
      if (!sectionsOrder.includes(q.section)) sectionsOrder.push(q.section);
    }
    await set(ref(db, "config"), {
      live: false,
      totalQuestions: questions.length,
      sectionsOrder
    });
  }

  return { skipped: false, count: questions.length };
}

/* Sorted array of questions from Firebase. */
export async function loadQuestions() {
  const snapshot = await get(ref(db, "questions"));
  if (!snapshot.exists()) return [];
  const raw = snapshot.val();
  return Object.entries(raw)
    .map(([id, q]) => ({ id, ...q }))
    .sort((a, b) => a.order - b.order);
}
