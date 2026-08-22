# Cevren Decision Engine v1

## Purpose
Replace topic-specific scripted paths with a generalized decision architecture. Cevren should not know in advance that a question is about creatine, tadalafil, peptides, supplements, or any other named intervention in order to decide what to do next.

## Core loop

1. INTERPRET
   - Convert the user's words into a decision statement.
   - Identify the actual choice being considered.
   - Decompose bundled claims/goals.
   - State the interpretation in new language rather than repeating the prompt.
   - Ask for confirmation only when misinterpretation would materially change the path.

2. MAP THE DECISION
   Produce an internal Decision Map:
   - option/intervention/action being considered
   - intended goal(s)
   - expected benefit claims
   - meaningful harms/downside claims
   - relevant alternatives when necessary
   - decision horizon (one-time, trial, daily, long-term)
   - user-specific variables that could change benefit, harm, dose, monitoring, or appropriateness

3. CHECK EXISTING CONTEXT
   Before asking the user anything, compare the Decision Map against Cevren's Human Model / known context.
   - Use only context relevant to this decision.
   - Never ask for information Cevren already has.
   - Never perform a generic medical intake.

4. IDENTIFY MATERIAL GAPS
   For each missing fact, ask:
   "Could a plausible answer to this fact change Cevren's next action or recommendation?"
   If NO: do not ask for it.
   If YES: classify the owner of the fact.

5. ASSIGN EVIDENCE RESPONSIBILITY
   A missing item must be assigned to exactly one initial owner:

   CEVREN OWNS
   - published evidence
   - guidelines / consensus
   - known pharmacology / mechanisms
   - established interactions / contraindications available from reliable evidence
   - regulation / product-quality context
   - comparative evidence

   USER / USER DATA OWNS
   - symptoms/history not already known
   - medication/supplement use not already known
   - goals/preferences
   - prior response
   - home measurements
   - existing labs, imaging, records, wearable data

   CLINICIAN OWNS ONLY WHEN NECESSARY
   - physical examination
   - diagnosis that cannot responsibly be inferred from available evidence
   - ordering/interpreting new testing when professional judgment is required
   - prescribing/procedural decisions requiring licensed care
   - unresolved individualized risk after Cevren has exhausted evidence + obtainable user data

   Rule: uncertainty does NOT imply clinician ownership.

6. ACQUIRE THE SMALLEST MATERIAL CONTEXT
   If user-owned information could materially change the decision, request the minimum useful information before research closure.
   Preferred order:
   a. use known Human Model data
   b. ask a direct answer
   c. accept/upload existing labs or records
   d. request wearable/home data if material
   e. clinician only if the fact cannot otherwise be responsibly resolved

7. INVESTIGATE
   Cevren researches all Cevren-owned questions.
   User-facing progress may show conceptual stages such as:
   - Understanding the decision
   - Separating the claims
   - Sourcing relevant evidence
   - Comparing benefits and harms
   - Applying your context
   - Testing what remains uncertain
   - Building the recommendation

   Progress language must not falsely claim live sourcing unless a verified retrieval layer actually performed it.

8. TEST DECISION-WORTHINESS
   After evidence + available context, classify the state:

   A. CLOSE — RECOMMEND FOR
   Evidence and individualized context are sufficient for a responsible favorable recommendation.

   B. CLOSE — RECOMMEND AGAINST
   Evidence and individualized context are sufficient for a responsible unfavorable recommendation.

   C. OPEN — USER CONTEXT NEEDED
   One or more material user-owned facts remain missing. Ask only those facts.

   D. OPEN — CLINICAL INPUT NEEDED
   A genuinely clinician-owned fact remains unresolved. Convert it into the smallest precise question(s) the user can take to the clinician.

   E. OPEN — EVIDENCE INSUFFICIENT
   The evidence itself cannot support a confident recommendation. Explain what is known, unknown, and whether a preference-sensitive choice is still reasonable.

9. COMMUNICATE THE DECISION
   Default user-facing brief:
   - Cevren's position
   - Why
   - What matters because it's you
   - What I'd do / next action
   - What to expect
   - What would change this recommendation
   - optional evidence/reasoning transparency beneath

10. KEEP THE DECISION ALIVE
   Every decision stores:
   - decision statement
   - evidence state
   - relevant Human Model context
   - unresolved variables
   - recommendation + confidence
   - conditions that would reopen it
   - subsequent outcomes / clinician input / new labs

   New information updates the same decision rather than starting over.

## Non-negotiable behavioral rules

- Do not echo the user's question as "understanding."
- Do not hard-code medical topics to predetermined flows.
- Do not default uncertainty to a clinician.
- Do not ask users to research evidence Cevren can research.
- Do not ask for labs merely because labs exist; request them only when a result could materially change the decision.
- Do not require a clinician to close a low-risk decision that Cevren can responsibly close from evidence + context.
- Do not pretend research was verified if no live verified evidence layer ran.
- Escalation is an output of reasoning, never the default path.

## Architecture test

The engine passes only if we can submit a health decision that has never been explicitly programmed and observe Cevren independently determine:
1. what the person is deciding;
2. which claims require investigation;
3. what known personal context matters;
4. which missing facts could change the decision;
5. who owns each missing fact;
6. what evidence Cevren must obtain;
7. whether more user data is necessary;
8. whether the decision can close;
9. whether a clinician is genuinely required;
10. what specific next action follows.

Topic-specific keywords may help retrieve evidence, but they may not select a prewritten decision path.