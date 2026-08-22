// Cevren v0.3.1 — state-preserving ASK-loop hotfix.
// This file intentionally patches the current prototype without resetting localStorage.

// Normalize legacy copy on already-saved decisions created before the Cevren rename.
try {
  if (typeof S !== 'undefined' && Array.isArray(S.decisions)) {
    let changed = false;
    for (const d of S.decisions) {
      if (typeof d.reason === 'string' && d.reason.includes('EON')) {
        d.reason = d.reason.replaceAll('EON', 'Cevren');
        changed = true;
      }
    }
    if (changed) {
      save();
      render();
    }
  }
} catch (e) {
  console.warn('Cevren copy normalization skipped:', e);
}

// Use event delegation so the Continue action works reliably in Safari even when
// dynamically-created element IDs are not exposed as global variables.
document.addEventListener('click', (event) => {
  const button = event.target.closest('#continueDecision');
  if (!button) return;

  event.preventDefault();

  try {
    const d = S.decisions.find(x => x.id === S.currentDecision);
    if (!d) return;

    const vals = [...document.querySelectorAll('.askanswer')].map(x => x.value.trim());
    if (!vals.some(Boolean)) {
      button.textContent = 'Add at least one answer';
      setTimeout(() => { button.textContent = 'Continue'; }, 1400);
      return;
    }

    d.answers = Array.isArray(d.answers) ? d.answers : [];
    d.answers.push(vals);
    d.round = (d.round || 1) + 1;

    d.trace = d.trace || {};
    d.trace.health_context_used = [];
    if (S.healthContext?.protocols) d.trace.health_context_used.push('User-entered medications / supplements / protocols');
    if (S.healthContext?.important) d.trace.health_context_used.push('User-entered health context');
    d.trace.decision_context_rounds = d.answers.length;
    d.trace.latest_user_context = vals.filter(Boolean);
    d.trace.service_action = 'ASK';
    d.trace.guidance_viability = 'PARTIALLY VIABLE';

    d.reason = 'Cevren has gathered another layer of decision-specific context. The next intelligence step is to reassess the decision using this new information before choosing what to do next.';
    d.missing = ['Is there any additional context that would materially change this decision?'];

    save();

    // Give visible feedback that the decision loop actually ran before re-rendering.
    button.disabled = true;
    button.textContent = 'Reassessing…';
    setTimeout(() => render(), 450);
  } catch (e) {
    console.error('Cevren ASK-loop error:', e);
    button.textContent = 'Try again';
  }
});
