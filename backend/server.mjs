import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://bayoutd.github.io";
const model = process.env.EON_MODEL || "gpt-5.6-terra";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. AI endpoints will fail until Railway provides it.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "250kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === allowedOrigin || origin === "http://localhost:5500" || origin === "http://127.0.0.1:5500") {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by Cevren prototype CORS policy"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cevren-intelligence", version: "0.4.0", model });
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
          "domain", "type", "statement", "confidence", "source_basis",
          "service_implication", "allowed_adaptation", "prohibited_use", "verification_question"
        ]
      }
    },
    best_next_question: { type: ["string", "null"] },
    model_caution: { type: "string" }
  },
  required: ["mirror_summary", "understandings", "best_next_question", "model_caution"]
};

const HUMAN_MODEL_SYSTEM = `You are the Human Model Intelligence Layer for an experimental health decision-support system called Cevren.

Your job is NOT to diagnose personality, mental health, medical conditions, ideology, or identity. Your job is to form a narrow, service-relevant working understanding of how to help this person make health decisions well.

Non-negotiable architecture:
1. Human understanding may adapt HOW, WHEN, HOW MUCH, and what support format Cevren uses.
2. Human understanding may NEVER alter medical truth, evidence quality, safety thresholds, or the standard for recommending escalation.
3. Never exploit fear, family, identity, vulnerability, shame, or trust preferences to produce compliance.
4. Distinguish direct observations from inferences and hypotheses. Do not convert a single answer into a strong personality conclusion.
5. Prefer uncertainty over over-interpretation.
6. User corrections outrank prior inferences.
7. This layer does not give medical advice. It only models service-relevant human context.
8. Avoid sensitive-trait inference.
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
      instructions: HUMAN_MODEL_SYSTEM,
      input: `Build or revise the user's service-relevant Human Model from the following data.\n\n${JSON.stringify(inputPayload, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "cevren_human_model_update",
          strict: true,
          schema: humanModelSchema
        }
      }
    });

    const parsed = JSON.parse(response.output_text);
    res.json({ ok: true, model, humanModel: parsed, usage: response.usage || null });
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

const decisionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    service_action: { type: "string", enum: ["ASK", "EDUCATE", "OFFER OPTIONS", "DEFER", "ESCALATE", "MONITOR"] },
    evidence_state: { type: "string", enum: ["INCOMPLETE", "GENERAL ONLY", "CONFLICTED", "SUFFICIENT FOR EDUCATION"] },
    decision_worthiness: { type: "string", enum: ["LOW", "MODERATE", "HIGH"] },
    guidance_viability: { type: "string", enum: ["NOT YET VIABLE", "PARTIALLY VIABLE", "VIABLE FOR EDUCATION", "HUMAN REVIEW WARRANTED"] },
    rationale: { type: "string" },
    context_summary: { type: "string" },
    user_facing_message: { type: "string" },
    can_proceed_without_more_context: { type: "boolean" },
    next_questions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          why_needed: { type: "string" }
        },
        required: ["question", "why_needed"]
      }
    },
    missing_evidence: { type: "array", maxItems: 5, items: { type: "string" } },
    safety_note: { type: ["string", "null"] }
  },
  required: [
    "service_action", "evidence_state", "decision_worthiness", "guidance_viability",
    "rationale", "context_summary", "user_facing_message", "can_proceed_without_more_context",
    "next_questions", "missing_evidence", "safety_note"
  ]
};

const DECISION_SYSTEM = `You are Cevren's Decision Reassessment Layer. Your job is to decide WHAT Cevren should do next after a user supplies context for a health decision.

You are NOT an evidence retrieval service and must not invent medical evidence. You do not make a clinical recommendation in this prototype.

Non-negotiable architecture:
1. Evaluate decision state BEFORE adapting delivery to the Human Model.
2. Human context may change wording, depth, sequencing, and support. It may NEVER change truth, evidence quality, safety thresholds, or escalation standards.
3. Do not keep asking generic questions. Ask only information that is materially decision-relevant and explain why it matters.
4. Do not ask for information already supplied.
5. If enough context exists to stop interviewing but the system lacks verified evidence, select EDUCATE, OFFER OPTIONS, or DEFER rather than inventing a recommendation.
6. If a qualified clinician or urgent evaluation may be warranted because consequences of error could be significant, select ESCALATE. Do not over-escalate routine questions.
7. Prefer one or two high-value questions over exhaustive intake.
8. Never use fear, shame, family, identity, or vulnerability as leverage.
9. Preserve user agency. State uncertainty plainly.
10. This prototype does not diagnose and does not recommend prescription changes, drug dosing, unapproved compounds, or treatment initiation.

Service actions:
- ASK: specific missing context is material enough that the next useful step is to ask for it.
- EDUCATE: enough context exists to explain the evidence landscape, but verified evidence retrieval is still required before stronger guidance.
- OFFER OPTIONS: the decision is preference-sensitive and options can be framed without a clinical recommendation.
- DEFER: the system cannot responsibly advance without better evidence or professional input.
- ESCALATE: qualified human clinical review is warranted.
- MONITOR: no immediate decision is needed; tracking or follow-up is the appropriate next action.

Be concise. The user-facing message should sound direct, calm, and non-patronizing.`;

app.post("/api/decision-reassess", async (req, res) => {
  try {
    const { decision, humanModel = [], healthContext = {} } = req.body || {};
    if (!decision || typeof decision !== "object" || !decision.question) {
      return res.status(400).json({ ok: false, error: "decision with question is required" });
    }

    const inputPayload = {
      original_decision: decision.question,
      prior_action: decision.action,
      gathered_context: decision.answers || [],
      human_model_adaptations: humanModel,
      optional_health_context: healthContext,
      prior_trace: decision.trace || {}
    };

    const response = await openai.responses.create({
      model,
      reasoning: { effort: "medium" },
      store: false,
      instructions: DECISION_SYSTEM,
      input: `Reassess this decision state and choose the next service action. Do not provide a medical recommendation.\n\n${JSON.stringify(inputPayload, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "cevren_decision_reassessment",
          strict: true,
          schema: decisionSchema
        }
      }
    });

    const parsed = JSON.parse(response.output_text);
    res.json({ ok: true, model, reassessment: parsed, usage: response.usage || null });
  } catch (error) {
    console.error("Decision reassessment error:", error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
      ok: false,
      error: "Decision Reassessment Layer failed",
      detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error)
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Cevren backend error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Cevren backend listening on port ${port} using ${model}`);
});
