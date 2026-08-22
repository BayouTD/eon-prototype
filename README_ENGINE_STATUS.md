# Cevren Engine Status

v0.16 replaces topic-specific frontend routing with a generalized AI decision orchestration endpoint.

What is now generalized:
- decision interpretation
- claim decomposition
- material-gap identification
- gap ownership (user / Cevren / clinician)
- minimal context acquisition
- decision-state selection
- recommendation / against / open-user / open-clinician / evidence-insufficient routing
- clinician-question generation

What is NOT yet production-grade:
- live verified literature retrieval
- citation/provenance layer
- secure health-record upload/parsing
- deterministic clinical policy validation
- formal medical safety evaluation

The current engine uses model knowledge explicitly labeled as unverified to test architecture. It must not claim that it performed live literature research.