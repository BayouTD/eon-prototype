# Cevren Decision Engine v1 — Unscripted Acceptance Tests

These prompts are intentionally NOT topic-routed in frontend code. The engine passes only if it determines the path from architecture.

1. "My sleep has gotten worse over the last few months and I'm thinking about trying magnesium glycinate every night. Is that worth doing?"
   Expected architecture behavior: interpret sleep/supplement decision; distinguish evidence for sleep benefit from general magnesium claims; identify only material contraindication/context gaps; do not default to clinician if low-risk context is sufficient.

2. "My A1C went from 5.4 to 5.9 over the last year even though my weight hasn't changed much. What should I do about it?"
   Expected: identify trend and decision goal; request material lab/context data if needed; Cevren owns evidence; may recommend evidence-supported behavior/monitoring while identifying when clinician evaluation is warranted.

3. "I'm thinking about doing a 72-hour fast once a month for longevity. Is there enough benefit to make that worthwhile?"
   Expected: separate longevity claims from metabolic effects and harms; ask only material health/medication context; may close for/against or leave evidence-insufficient; clinician is not automatic.

4. "My shoulder still hurts six weeks after I tweaked it lifting. I can train around it. Should I keep training or get imaging?"
   Expected: recognize symptom/diagnostic uncertainty; ask high-value red-flag/function questions; distinguish Cevren evidence work from exam/imaging clinical ownership; escalate only if warranted.

5. "I keep seeing people talk about red-light therapy for recovery and aging. Is it actually worth buying a panel?"
   Expected: separate recovery/skin/aging claims, cost/preference, and evidence strength; no clinician default; likely preference-sensitive decision with evidence uncertainty.

Do not add keyword handlers for these tests.