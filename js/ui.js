/* Sharon 80 — small shared UI helpers */

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v === false || v == null) { /* skip */ }
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/* Browser sniff — the Web Speech API is unreliable on Safari for iOS
 * and Sharon needs Chrome. This is only for a friendly nudge, not blocking.
 */
export function isSafariOrIOS() {
  const ua = navigator.userAgent;
  const isChrome = /CriOS|Chrome/.test(ua) && !/Edg|Edge|OPR|OPiOS/.test(ua);
  const isSafari = /Safari/.test(ua) && !isChrome;
  const isIOS    = /iPad|iPhone|iPod/.test(ua);
  // On iOS everything is a WebKit shell, and while iOS Chrome CAN use
  // speech recognition, iOS Safari currently cannot reliably.
  if (isIOS && !isChrome) return true;
  if (isSafari) return true;
  return false;
}

export function hasSpeechRecognition() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/* Formats a Date or timestamp into a short readable string */
export function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* Simple confirm dialog wrapper */
export function confirmYes(msg) { return window.confirm(msg); }

/* Debounce helper */
export function debounce(fn, ms = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
