# Sharon's 80th Birthday App (`mom80th`)

A tiny 3-mode web app for Sharon Herlehy's 80th birthday (2026-07-04).

- **`/`** — Landing page with three big buttons.
- **`/mom`** — Sharon's questionnaire (mic + edit transcript + Firebase save + resume).
- **`/family`** — Async family trivia (multiple choice + live leaderboard).
- **`/admin`** — Dan-only dashboard (password gate, write distractors, assign photos, seed questions).

Vanilla HTML + CSS + JS. No framework. Firebase Realtime DB. Vercel hosting.

**Repo:** <https://github.com/genxaijourney/mom80th>
**Google account for everything:** `genxaijourney@gmail.com` (GitHub + Vercel + Firebase — same login).
**Target Vercel URL:** `mom80th.vercel.app` (or whatever Vercel auto-assigns).

---

## One-shot deploy (~10–15 minutes at the desktop)

The GitHub repo `genxaijourney/mom80th` already exists (public, has an initial README). Do these steps in order — all copy-paste ready.

### 1. Get the files into the repo (~3 min)

Orchestrator will upload these files to the repo via Browser 6 (already logged in as `genxaijourney`). If you're doing it manually instead:

1. Go to <https://github.com/genxaijourney/mom80th>
2. Click **Add file → Upload files**
3. Drag in EVERYTHING from `R:\Documents\Claude\Projects\Sharons_80th_Birthday\app_root\` (index.html, mom.html, family.html, admin.html, seed-questions.json, vercel.json, firebase.rules.json, README.md, the `css/` folder, the `js/` folder, and the empty `public/photos/` folder).
4. Commit message: `Initial build: 3-mode app`
5. Commit directly to `main`.

### 2. Deploy on Vercel (~3 min)

1. Go to <https://vercel.com/new> (log in as `genxaijourney@gmail.com`).
2. **Import** the `genxaijourney/mom80th` repo.
3. Framework preset: **Other** (leave everything default — it's static, no build step).
4. Root directory: **/** (repo root).
5. Click **Deploy**.
6. When it finishes, click the URL. You should see the landing page with three buttons. The buttons don't work yet — they need Firebase (next step).

Vercel will auto-deploy every push to `main`. To update later, just push commits (or use the GitHub web editor).

### 3. Create the Firebase project (~5 min)

1. Go to <https://console.firebase.google.com/> (log in as `genxaijourney@gmail.com`).
2. **Add project** → name it `mom80th` → Continue → disable Google Analytics → Create.
3. In the project: **Build → Realtime Database** → Create Database → US region → **Start in locked mode** → Enable.
4. In **Build → Authentication → Sign-in method**, enable **Anonymous**.
5. Register a **Web app** (click the `</>` icon in Project Settings): app nickname `mom80th-web` → no Firebase Hosting → Register.
6. Firebase shows you a `firebaseConfig` block. **Copy it.**
7. Edit `js/firebase.js` (in the GitHub web editor: navigate to the file, click the pencil icon). Replace every `REPLACE_ME_...` value in the `firebaseConfig` block with the real values from step 6. Commit.
8. Open `firebase.rules.json` in the repo, copy its contents, and paste into Firebase Console → **Realtime Database → Rules**, click **Publish**.

### 4. Set the admin password (~1 min)

In a browser DevTools console (open any page → F12 → Console), generate a SHA-256 hash of the password you want:

```
crypto.subtle.digest("SHA-256", new TextEncoder().encode("YOUR_PASSWORD_HERE")).then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")))
```

Copy the printed hex string. Edit `js/admin.js` in the GitHub web editor:

- Replace `REPLACE_ME_sha256_of_admin_password` with your hash.
- **DELETE the `FALLBACK_HASH` line** (that's a dev backdoor for `123456` — do not ship it).

Commit. Vercel redeploys in ~30 seconds.

### 5. Seed the 200 questions (~1 min)

1. Open `https://mom80th.vercel.app/admin` on your phone or laptop.
2. Enter the admin password.
3. Click **Seed 200 questions**. You should see `Seeded 200 questions.`
4. Toggle trivia to **hidden** for now (we'll flip it live on birthday morning).

### 6. Test Sharon's link (~2 min)

1. Open `https://mom80th.vercel.app/mom` **in Chrome on your phone**.
2. The first question should appear. Tap the 🎤, allow the microphone, and speak. The transcript should appear in the text box.
3. Fix a typo, tap **Save & next**. In `/admin` you should see the answer show up live.

If speech doesn't start on iOS, you're in Safari — open in Chrome for iOS instead. The `/mom` page auto-detects Safari and shows a yellow "please open this in Chrome" nudge.

### 7. Send Sharon her link

Text her the URL and a short note: **"Mom — open this in Chrome (not Safari)."**

---

## Photos

Two options:

- **Simplest:** drop JPGs into `public/photos/` in the repo (add via GitHub → Add file → Upload files), then paste paths like `/photos/sharon-1965.jpg` into the admin **Photo URL** field for each question.
- **Firebase Storage:** upload photos in the Firebase Console → Storage, get the public download URL, paste that into the Photo URL field.

You don't need photos for the app to work — the trivia page shows a nice placeholder if `photoUrl` is missing.

---

## TODOs before Sharon's link goes live

- [ ] Upload all `app_root/*` files to `genxaijourney/mom80th` (orchestrator handling via Browser 6).
- [ ] Replace `firebaseConfig` placeholders in `js/firebase.js` (from Firebase Console).
- [ ] Replace `ADMIN_HASH` in `js/admin.js` and DELETE `FALLBACK_HASH`.
- [ ] Paste `firebase.rules.json` into Firebase Console → Realtime DB → Rules → Publish.
- [ ] Enable Anonymous auth in Firebase Console.
- [ ] Seed the 200 questions (admin button).
- [ ] End-to-end test `/mom` in Chrome on Dan's phone.
- [ ] Write distractors + assign photos as Sharon answers (~5 seconds each).
- [ ] Toggle trivia **live** in admin when family is ready to play.

## Data model (Firebase Realtime DB)

```
/questions/{qid}
  order, section, text, hint?, answer?, answeredAt?, skipped?,
  photoUrl?, choices?, correctIndex?
/players/{uid}
  name, totalScore, createdAt, lastSeen
/scores/{uid}/{qid}
  chosenIndex, correct, answeredAt
/config
  live, totalQuestions, sectionsOrder
```

## Files in this repo (flat layout)

```
mom80th/
├─ index.html          Landing page (three buttons)
├─ mom.html            Sharon's questionnaire
├─ family.html         Family trivia
├─ admin.html          Dan-only dashboard
├─ seed-questions.json The 200 questions
├─ vercel.json         Rewrites so /mom /family /admin work
├─ firebase.rules.json Copy-paste into Firebase console
├─ README.md           This file
├─ css/
│  └─ style.css
├─ js/
│  ├─ firebase.js      REPLACE the firebaseConfig block
│  ├─ questions.js     Seed loader
│  ├─ ui.js            Small helpers
│  ├─ mom.js           Sharon's questionnaire logic
│  ├─ family.js        Family trivia logic
│  └─ admin.js         REPLACE the ADMIN_HASH, DELETE FALLBACK_HASH
└─ public/
   └─ photos/          Drop Sharon's photos here (or use Firebase Storage)
```

Happy birthday, Mom.
