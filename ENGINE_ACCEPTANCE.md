# v0.16 acceptance criteria

The generalized engine is accepted for prototype testing only if a previously unseen health question can traverse the decision loop without a topic-specific handler.

Pass conditions:
- interpretation is a semantic restatement, not a prompt echo
- bundled claims are decomposed
- known context is considered before new questions
- requested user context is material and minimal
- Cevren-owned research is not assigned back to the user
- uncertainty alone does not trigger clinician escalation
- low-risk decisions can close for or against
- clinical escalation identifies a genuinely clinician-owned unresolved fact
- evidence insufficiency can remain an explicit terminal state
- live research is never falsely claimed
