# Engine implementation notes

The active v0.16 browser experience calls `/api/decision-engine` for both INTERPRET and REASSESS phases. Topic-specific files remain in the repository for historical prototype comparison but v0.16 is loaded last and owns the active new-question flow.

Railway must deploy `backend/package.json` from this branch/main after merge so `server-v1.mjs` becomes the running service.
