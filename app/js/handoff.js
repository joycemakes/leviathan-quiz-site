// The hand-off to Leviathan (ENDGAME_CONTRACT section 4): a block with the button to handoff.url. Pressing
// it copies the player's LVQ1 code and says so, then opens Leviathan in a new tab. Everything about the
// hand-off lives in this module, so the unbranded copy can drop it in one place.

import { handoffView } from './endgame.js?v=3ca1ab6-1795004609';
import { copyText } from './sharesheet.js?v=3ca1ab6-1795004609';
import { haptic } from './feel.js?v=3ca1ab6-1795004609';

const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// { endgame, reading, lvq (the LVQ1 code), shared }. Returns null when endgame.json has no hand-off.
export function handoffBlock({ endgame, reading, lvq, shared = false }) {
  const v = handoffView(endgame, reading);
  if (!v) return null;
  const box = h('section', 'handoff');
  box.setAttribute('aria-label', v.title || 'Leviathan');
  box.append(h('h3', 'handoff-title', v.title));
  if (v.text && !shared) box.append(h('p', 'handoff-text', v.text));
  const a = h('a', 'btn primary handoff-go');
  a.href = v.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.append(h('span', 'btn-label', v.button));
  const note = h('p', 'handoff-note', shared ? 'The code copied is this file’s, so the character you build starts from it.' : v.codeNote);
  const status = h('p', 'handoff-status');
  status.setAttribute('role', 'status');
  // The copy happens on the press itself (a user gesture), before the new tab takes focus.
  a.addEventListener('click', () => {
    haptic('commit');
    copyText(lvq).then(ok => { status.textContent = ok ? 'Your Leviathan code is copied. Paste it in when Leviathan asks.' : `Could not copy. Your code is ${lvq}`; });
  });
  box.append(a, note, status);
  return box;
}
