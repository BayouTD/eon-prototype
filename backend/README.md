# EON Human Model Intelligence Layer v0.2

This backend is designed to deploy on Railway and keep the OpenAI API key off the public GitHub Pages site.

## Railway setup

Create a Railway service from this GitHub repository and set the service **Root Directory** to:

`/backend`

Railway should detect Node.js and run:

`npm start`

## Required variable

Add this in Railway → Service → Variables:

- `OPENAI_API_KEY` = your OpenAI project secret key

Do **not** commit this key to GitHub or paste it into the frontend.

## Recommended variables

- `EON_MODEL` = `gpt-5.6-terra`
- `ALLOWED_ORIGIN` = `https://bayoutd.github.io`
- `NODE_ENV` = `production`

Railway supplies `PORT` automatically.

## Endpoints

- `GET /health` — confirms the service is alive and reports the configured model.
- `POST /api/human-model` — sends onboarding answers and prior corrections to the Human Model Intelligence Layer and returns structured understandings.

### Example request

```json
{
  "answers": {
    "about": "...",
    "future": "...",
    "why": "...",
    "trust": "...",
    "difficulty": "...",
    "accountability": "...",
    "boundary": "..."
  },
  "existingHumanModel": [],
  "corrections": []
}
```

## Architectural guardrail

The Human Model may adapt service delivery. It may not alter medical truth, evidence quality, safety thresholds, or escalation standards.

This endpoint intentionally does **not** provide medical recommendations. It only produces a narrow, correctable Service Model of the Person.
