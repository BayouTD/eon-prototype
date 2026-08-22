import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://bayoutd.github.io";
const model = process.env.EON_MODEL || "gpt-5.6-terra";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. /api/human-model will fail until Railway provides it.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "250kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === allowedOrigin || origin === "http://localhost:5500" || origin === "http://127.0.0.1:5500") {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by EON prototype CORS policy"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "eon-human-model", version: "0.2.0", model });
});

const humanModelSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mirror_summary: { type: "string" },
    understandings: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          domain: {
            type: "string",
            enum: [
              "life_context",
              "future_self",
              "decision_architecture",
              "trust_architecture",
              "evidence_relationship",
              "agency_guidance",
              "communication",
              "behavior_follow_through",
              "accountability_boundaries"
            ]
          },
          type: { type: "string", enum: ["observation", "inference", "hypothesis", "preference", "boundary", "uncertainty"] },
          statement: { type: "string" },
          confidence: { type: "string", enum: ["tentative", "emerging", "strong", "verified"] },
          source_basis: { type: "string" },
          service_implication: { type: "string" },
          allowed_adaptation: { type: "string" },
          prohibited_use: { type: "string" },
          verification_question: { type: ["string", "null"] }
        },
        required: [
          "domain",
          "type",
          "statement",
          "confidence",
          "source_basis",
          "service_implication",
          "allowed_adaptation",
          "prohibited_use",
          "verification_question"
        ]
      }
    },
    best_next_question: { type: ["string", "null"] },
    model_caution: { type: "string" }
  },
  required: ["mirror_summary", "understandings", "best_next_question", "model_caution"]
};

const SYSTEM = `You are the Human Model Intelligence Layer for an experimental health decision-support system called EON.

Your job is NOT to diagnose personality, mental health, medical conditions, ideology, or identity. Your job is to form a narrow, service-relevant working understanding of how to help this person make health decisions well.

Non-negotiable architecture:
1. Human understanding may adapt HOW, WHEN, HOW MUCH, and what support format EON uses.
2. Human understanding may NEVER alter medical truth, evidence quality, safety thresholds, or the standard for recommending escalation.
3. Never exploit fear, family, identity, vulnerability, shame, or trust preferences to produce compliance.
4. Distinguish direct observations from inferences and hypotheses. Do not convert a single answer into a strong personality conclusion.
5. Prefer uncertainty over over-interpretation.
6. User corrections outrank prior inferences.
7. This layer does not give medical advice. It only models service-relevant human context.
8. Avoid sensitive-trait inference. Do not infer religion, politics, diagnoses, sexuality, race, or other protected/sensitive characteristics unless the user explicitly volunteered a fact AND it is directly necessary to the immediate service model; even then, do not turn it into a personality conclusion.
9. Keep the model compact. Every understanding must earn its place by changing legitimate service behavior.

Confidence rules:
- tentative: weak signal or one ambiguous statement
- emerging: plausible pattern supported by more than one clue or a clear but unverified interpretation
- strong: directly stated preference/boundary or repeatedly supported pattern
- verified: only when the supplied data says the user explicitly confirmed/corrected the interpretation

The output must be concise, transparent, and correctable.`;

app.post("/api/human-model", async (req, res) => {
  try {
    const { answers, existingHumanModel = [], corrections = [] } = req.body || {};
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "answers object is required" });
    }

    const inputPayload = {
      onboarding_answers: answers,
      existing_human_model: existingHumanModel,
      user_corrections: corrections
    };

    const response = await openai.responses.create({
      model,
      reasoning: { effort: "medium" },
      store: false,
      instructions: SYSTEM,
      input: `Build or revise the user's service-relevant Human Model from the following data.\n\n${JSON.stringify(inputPayload, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "eon_human_model_update",
          strict: true,
          schema: humanModelSchema
        }
      }
    });

    const parsed = JSON.parse(response.output_text);
    res.json({
      ok: true,
      model,
      humanModel: parsed,
      usage: response.usage || null
    });
  } catch (error) {
    console.error("Human model error:", error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
      ok: false,
      error: "Human Model Intelligence Layer failed",
      detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error)
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "EON backend error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`EON backend listening on port ${port} using ${model}`);
});
