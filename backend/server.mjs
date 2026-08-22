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
  res.json({ ok: true, service: "cevren-intelligence", version: "0.7.0", model });
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
          domain: { type: "string", enum: ["life_context","future_self","decision_architecture","trust_architecture","evidence_relationship","agency_guidance","communication","behavior_follow_through","accountability_boundaries"] },
          type: { type: "string", enum: ["observation","inference","hypothesis","preference","boundary","uncertainty"] },
          statement: { type: "string" },
          confidence: { type: "string", enum: ["tentative","emerging","strong","verified"] },
          source_basis: { type: "string" },
          service_implication: { type: "string" },
          allowed_adaptation: { type: "string" },
          prohibited_use: { type: "string" },
          verification_question: { type: ["string","null"] }
        },
        required: ["domain","type","statement","confidence","source_basis","service_implication","allowed_adaptation","prohibited_use","verification_question"]
      }
    },
    best_next_question: { type: ["string","null"] },
    model_caution: { type: "string" }
  },
  required: ["mirror_summary","understandings","best_next_question","model_caution"]
};

const HUMAN_MODEL_SYSTEM = `You are the Human Model Intelligence Layer for an experimental health decision-support system called Cevren.\n\nYour job is NOT to diagnose personality, mental health, medical conditions, ideology, or identity. Your job is to form a narrow, service-relevant working understanding of how to help this person make health decisions well.\n\nNon-negotiable architecture:\n1. Human understanding may adapt HOW, WHEN, HOW MUCH, and what support format Cevren uses.\n2. Human understanding may NEVER alter medical truth, evidence quality, safety thresholds, or the standard for recommending escalation.\n3. Never exploit fear, family, identity, vulnerability, shame, or trust preferences to produce compliance.\n4. Distinguish direct observations from inferences and hypotheses. Do not convert a single answer into a strong personality conclusion.\n5. Prefer uncertainty over over-interpretation.\n6. User corrections outrank prior inferences.\n7. This layer does not give medical advice. It only models service-relevant human context.\n8. Avoid sensitive-trait inference.\n9. Keep the model compact. Every understanding must earn its place by changing legitimate service behavior.\n\nThe output must be concise, transparent, and correctable.`;

app.post("/api/human-model", async (req, res) => {
  try {
    const { answers, existingHumanModel = [], corrections = [] } = req.body || {};
    if (!answers || typeof answers !== "object") return res.status(400).json({ error: "answers object is required" });
    const inputPayload = { onboarding_answers: answers, existing_human_model: existingHumanModel, user_corrections: corrections };
    const response = await openai.responses.create({
      model,
      reasoning: { effort: "medium" },
      store: false,
      instructions: HUMAN_MODEL_SYSTEM,
      input: `Build or revise the user's service-relevant Human Model from the following data.\n\n${JSON.stringify(inputPayload, null, 2)}`,
      text: { format: { type: "json_schema", name: "cevren_human_model_update", strict: true, schema: humanModelSchema } }
    });
    res.json({ ok: true, model, humanModel: JSON.parse(response.output_text), usage: response.usage || null });
  } catch (error) {
    console.error("Human model error:", error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({ ok: false, error: "Human Model Intelligence Layer failed", detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error) });
  }
});

const decisionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    service_action: { type: "string", enum: ["ASK","EDUCATE","OFFER OPTIONS","DEFER","ESCALATE","MONITOR"] },
    evidence_state: { type: "string", enum: ["INCOMPLETE","GENERAL ONLY","CONFLICTED","SUFFICIENT FOR EDUCATION"] },
    decision_worthiness: { type: "string", enum: ["LOW","MODERATE","HIGH"] },
    guidance_viability: { type: "string", enum: ["NOT YET VIABLE","PARTIALLY VIABLE","VIABLE FOR EDUCATION","HUMAN REVIEW WARRANTED"] },
    rationale: { type: "string" }, context_summary: { type: "string" }, user_facing_message: { type: "string" }, can_proceed_without_more_context: { type: "boolean" },
    next_questions: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, properties: { question: { type: "string" }, why_needed: { type: "string" } }, required: ["question","why_needed"] } },
    missing_evidence: { type: "array", maxItems: 5, items: { type: "string" } }, safety_note: { type: ["string","null"] }
  },
  required: ["service_action","evidence_state","decision_worthiness","guidance_viability","rationale","context_summary","user_facing_message","can_proceed_without_more_context","next_questions","missing_evidence","safety_note"]
};

const DECISION_SYSTEM = `You are Cevren's Decision Reassessment Layer. Your job is to decide WHAT Cevren should do next after a user supplies context for a health decision.\n\nYou are NOT an evidence retrieval service and must not invent medical evidence. You do not make a clinical recommendation in this prototype.\n\nNon-negotiable architecture:\n1. Evaluate decision state BEFORE adapting delivery to the Human Model.\n2. Human context may change wording, depth, sequencing, and support. It may NEVER change truth, evidence quality, safety thresholds, or escalation standards.\n3. Do not keep asking generic questions. Ask only information that is materially decision-relevant and explain why it matters.\n4. Do not ask for information already supplied.\n5. If enough context exists to stop interviewing but the system lacks verified evidence, select EDUCATE, OFFER OPTIONS, or DEFER rather than inventing a recommendation.\n6. If a qualified clinician or urgent evaluation may be warranted because consequences of error could be significant, select ESCALATE. Do not over-escalate routine questions.\n7. Prefer one or two high-value questions over exhaustive intake.\n8. Preserve user agency. State uncertainty plainly.\n9. This prototype does not diagnose and does not recommend prescription changes, drug dosing, unapproved compounds, or treatment initiation.`;

app.post("/api/decision-reassess", async (req, res) => {
  try {
    const { decision, humanModel = [], healthContext = {} } = req.body || {};
    if (!decision || typeof decision !== "object" || !decision.question) return res.status(400).json({ ok: false, error: "decision with question is required" });
    const inputPayload = { original_decision: decision.question, prior_action: decision.action, gathered_context: decision.answers || [], human_model_adaptations: humanModel, optional_health_context: healthContext, prior_trace: decision.trace || {} };
    const response = await openai.responses.create({ model, reasoning: { effort: "medium" }, store: false, instructions: DECISION_SYSTEM, input: `Reassess this decision state and choose the next service action. Do not provide a medical recommendation.\n\n${JSON.stringify(inputPayload, null, 2)}`, text: { format: { type: "json_schema", name: "cevren_decision_reassessment", strict: true, schema: decisionSchema } } });
    res.json({ ok: true, model, reassessment: JSON.parse(response.output_text), usage: response.usage || null });
  } catch (error) {
    console.error("Decision reassessment error:", error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({ ok: false, error: "Decision Reassessment Layer failed", detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error) });
  }
});

const evidenceResolutionSchema = {
  type: "object", additionalProperties: false,
  properties: {
    evidence_summary: { type: "string" },
    relevance: { type: "string", enum: ["LOW","MODERATE","HIGH"] },
    resolved_uncertainties: { type: "array", maxItems: 5, items: { type: "string" } },
    partially_resolved_uncertainties: { type: "array", maxItems: 5, items: { type: "string" } },
    still_unresolved_uncertainties: { type: "array", maxItems: 6, items: { type: "string" } },
    newly_introduced_uncertainties: { type: "array", maxItems: 4, items: { type: "string" } },
    decision_impact: { type: "string", enum: ["NO MATERIAL CHANGE","REDUCES UNCERTAINTY","INCREASES UNCERTAINTY","CHANGES NEXT ACTION"] },
    proposed_service_action: { type: "string", enum: ["ASK","EDUCATE","OFFER OPTIONS","DEFER","ESCALATE","MONITOR"] },
    user_facing_message: { type: "string" }
  },
  required: ["evidence_summary","relevance","resolved_uncertainties","partially_resolved_uncertainties","still_unresolved_uncertainties","newly_introduced_uncertainties","decision_impact","proposed_service_action","user_facing_message"]
};

const EVIDENCE_RESOLUTION_SYSTEM = `You are Cevren's Evidence Integration & Resolution Layer. You are given an OPEN health decision, its known uncertainties, and a new piece of user-supplied evidence.\n\nYour job is NOT to validate the medical truth of the evidence from external sources. Your job is to determine what this newly supplied evidence appears to address within the existing decision state, what remains unresolved, whether it introduces new uncertainty, and whether the next service action should change.\n\nRules:\n1. Treat user-entered evidence as USER-SUPPLIED, not independently verified.\n2. Do not infer that a normal lab, clinician note, or user claim proves an intervention is safe or effective.\n3. A new piece of evidence may resolve context uncertainty without resolving evidence-of-efficacy uncertainty.\n4. Preserve the prior safety threshold. Do not downgrade escalation merely because more data exists unless the data clearly resolves the reason for escalation; even then, explain cautiously.\n5. Never invent lab values, diagnoses, references, studies, or clinician conclusions.\n6. Distinguish RESOLVED, PARTIALLY RESOLVED, STILL UNRESOLVED, and NEWLY INTRODUCED uncertainties.\n7. Human Model preferences do not change the resolution classification.\n8. Keep the user-facing message direct and concise.\n9. This prototype is simulating integration logic, not verified evidence retrieval or clinical interpretation.`;

app.post("/api/evidence-resolve", async (req, res) => {
  try {
    const { decision, evidence } = req.body || {};
    if (!decision || !decision.question) return res.status(400).json({ ok: false, error: "decision is required" });
    if (!evidence || typeof evidence !== "string" || !evidence.trim()) return res.status(400).json({ ok: false, error: "evidence text is required" });
    const payload = { decision: decision.question, current_action: decision.action, current_context: decision.contextSummary || null, known_uncertainties: decision.missingEvidence || [], prior_trace: decision.trace || {}, new_user_supplied_evidence: evidence.trim() };
    const response = await openai.responses.create({ model, reasoning: { effort: "medium" }, store: false, instructions: EVIDENCE_RESOLUTION_SYSTEM, input: `Integrate this new user-supplied evidence into the existing decision state.\n\n${JSON.stringify(payload, null, 2)}`, text: { format: { type: "json_schema", name: "cevren_evidence_resolution", strict: true, schema: evidenceResolutionSchema } } });
    res.json({ ok: true, model, resolution: JSON.parse(response.output_text), usage: response.usage || null });
  } catch (error) {
    console.error("Evidence resolution error:", error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({ ok: false, error: "Evidence Resolution Layer failed", detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error) });
  }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ ok: false, error: "Cevren backend error" }); });
app.listen(port, "0.0.0.0", () => { console.log(`Cevren backend listening on port ${port} using ${model}`); });
