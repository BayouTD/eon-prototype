import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://bayoutd.github.io";
const model = process.env.EON_MODEL || "gpt-5.6-terra";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "300kb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === allowedOrigin || origin === "http://localhost:5500" || origin === "http://127.0.0.1:5500") return callback(null, true);
    return callback(new Error("Origin not allowed by Cevren prototype CORS policy"));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.get("/health", (_req, res) => res.json({ ok: true, service: "cevren-decision-engine", version: "1.0.0", model }));

const humanModelSchema = {
  type: "object", additionalProperties: false,
  properties: {
    mirror_summary: { type: "string" },
    understandings: { type: "array", minItems: 3, maxItems: 10, items: { type: "object", additionalProperties: false, properties: {
      domain: { type: "string", enum: ["life_context","future_self","decision_architecture","trust_architecture","evidence_relationship","agency_guidance","communication","behavior_follow_through","accountability_boundaries"] },
      type: { type: "string", enum: ["observation","inference","hypothesis","preference","boundary","uncertainty"] },
      statement: { type: "string" }, confidence: { type: "string", enum: ["tentative","emerging","strong","verified"] }, source_basis: { type: "string" },
      service_implication: { type: "string" }, allowed_adaptation: { type: "string" }, prohibited_use: { type: "string" }, verification_question: { type: ["string","null"] }
    }, required: ["domain","type","statement","confidence","source_basis","service_implication","allowed_adaptation","prohibited_use","verification_question"] } },
    best_next_question: { type: ["string","null"] }, model_caution: { type: "string" }
  }, required: ["mirror_summary","understandings","best_next_question","model_caution"]
};

const HUMAN_MODEL_SYSTEM = `You are the Human Model Intelligence Layer for Cevren, an experimental health decision-support system. Build a narrow service-relevant working understanding of how to help this person make health decisions. Human understanding may adapt communication and support, but NEVER medical truth, evidence quality, safety thresholds, or recommendation standards. Do not infer sensitive traits. Distinguish observation from inference. User corrections outrank prior inference. Keep the model compact.`;

app.post("/api/human-model", async (req, res) => {
  try {
    const { answers, existingHumanModel = [], corrections = [] } = req.body || {};
    if (!answers || typeof answers !== "object") return res.status(400).json({ error: "answers object is required" });
    const response = await openai.responses.create({
      model, reasoning: { effort: "medium" }, store: false, instructions: HUMAN_MODEL_SYSTEM,
      input: `Build or revise the service-relevant Human Model.\n\n${JSON.stringify({ onboarding_answers: answers, existing_human_model: existingHumanModel, user_corrections: corrections }, null, 2)}`,
      text: { format: { type: "json_schema", name: "cevren_human_model_update", strict: true, schema: humanModelSchema } }
    });
    res.json({ ok: true, model, humanModel: JSON.parse(response.output_text), usage: response.usage || null });
  } catch (error) {
    console.error("Human model error:", error);
    res.status(error?.status || 500).json({ ok: false, error: "Human Model Intelligence Layer failed", detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error) });
  }
});

const engineSchema = {
  type: "object", additionalProperties: false,
  properties: {
    interpretation: {
      type: "object", additionalProperties: false,
      properties: { decision_statement: { type: "string" }, plain_summary: { type: "string" }, goals: { type: "array", maxItems: 5, items: { type: "string" } }, claims_to_test: { type: "array", maxItems: 6, items: { type: "string" } }, horizon: { type: "string", enum: ["ONE_TIME","TRIAL","ONGOING","LONG_TERM","UNCLEAR"] } },
      required: ["decision_statement","plain_summary","goals","claims_to_test","horizon"]
    },
    material_gaps: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: {
      fact: { type: "string" }, owner: { type: "string", enum: ["USER","CEVREN","CLINICIAN"] }, why_material: { type: "string" }, acquisition: { type: "string", enum: ["DIRECT_ANSWER","EXISTING_LABS_OR_RECORDS","WEARABLE_OR_HOME_DATA","EVIDENCE_RESEARCH","CLINICAL_EXAM_OR_JUDGMENT"] }, question_for_user: { type: ["string","null"] }
    }, required: ["fact","owner","why_material","acquisition","question_for_user"] } },
    relevant_known_context: { type: "array", maxItems: 6, items: { type: "string" } },
    evidence_assessment: { type: "object", additionalProperties: false, properties: {
      basis: { type: "string", enum: ["MODEL_KNOWLEDGE_UNVERIFIED","USER_SUPPLIED","MIXED_UNVERIFIED"] },
      supports: { type: "array", maxItems: 5, items: { type: "string" } },
      cautions: { type: "array", maxItems: 5, items: { type: "string" } },
      uncertainty: { type: "array", maxItems: 5, items: { type: "string" } },
      evidence_strength: { type: "string", enum: ["INSUFFICIENT","WEAK","MODERATE","STRONG","MIXED"] }
    }, required: ["basis","supports","cautions","uncertainty","evidence_strength"] },
    decision_state: { type: "string", enum: ["CLOSE_RECOMMEND_FOR","CLOSE_RECOMMEND_AGAINST","OPEN_USER_CONTEXT_NEEDED","OPEN_CLINICAL_INPUT_NEEDED","OPEN_EVIDENCE_INSUFFICIENT"] },
    position: { type: "string" },
    recommendation: { type: ["string","null"] },
    personalization: { type: "string" },
    what_to_expect: { type: ["string","null"] },
    what_would_change: { type: "string" },
    next_action: { type: "string" },
    clinician_questions: { type: "array", maxItems: 4, items: { type: "string" } },
    safety_note: { type: ["string","null"] },
    confidence: { type: "string", enum: ["LOW","MODERATE","HIGH"] }
  },
  required: ["interpretation","material_gaps","relevant_known_context","evidence_assessment","decision_state","position","recommendation","personalization","what_to_expect","what_would_change","next_action","clinician_questions","safety_note","confidence"]
};

const DECISION_ENGINE_SYSTEM = `You are Cevren Decision Engine v1. You are not a chatbot and you are not a topic-specific rule table. You orchestrate a persistent health decision.

CORE LOOP:
INTERPRET -> MAP -> CHECK KNOWN CONTEXT -> IDENTIFY MATERIAL GAPS -> ASSIGN OWNERSHIP -> ACQUIRE SMALLEST NEEDED CONTEXT -> ASSESS EVIDENCE -> DECIDE -> COMMUNICATE -> KEEP DECISION OPEN OR CLOSE.

NON-NEGOTIABLE RULES:
1. Do not echo the user's question. Re-express what they are actually deciding in new language and decompose bundled claims.
2. Never ask for generic medical history. A missing fact is material only if a plausible answer could change the recommendation or next action.
3. Check supplied Human Model and health context before asking the user. Never ask for information already present.
4. Assign every material missing fact to USER, CEVREN, or CLINICIAN.
5. Uncertainty does NOT imply clinician ownership.
6. CEVREN owns general medical evidence, known pharmacology, guidelines/consensus available in model knowledge, known interactions/contraindications, comparative evidence, and regulation/product-quality context.
7. USER owns their symptoms/history, goals, prior response, current regimen, existing labs/records, wearables/home measurements not already supplied.
8. CLINICIAN owns only facts requiring examination, diagnosis/professional judgment, new testing/prescribing, procedures, or individualized risk that cannot responsibly be resolved from evidence + obtainable user data.
9. Prefer the smallest high-value user question. Usually 0-2 user-owned gaps should block investigation. Do not request labs merely because they exist; request existing labs only when a value could materially change the decision.
10. This engine has NO live verified retrieval tool. You may use general model medical knowledge to test the architecture, but evidence_assessment.basis MUST be MODEL_KNOWLEDGE_UNVERIFIED or MIXED_UNVERIFIED unless the user supplied the evidence. Never claim you searched, retrieved, verified, or cited live studies.
11. Low-risk decisions may close when evidence + context are sufficient. Do not send users to clinicians simply to finish a decision you can responsibly close.
12. Prescription initiation/change, high-consequence diagnosis/treatment, invasive procedures, dangerous symptoms, pregnancy-specific medication decisions, or other high-risk individualized choices normally require clinician involvement, but still do Cevren-owned evidence work first.
13. Separate established benefits from plausible, emerging, exaggerated, or unsupported claims.
14. Human Model preferences may affect explanation, not evidence or safety.
15. Preserve agency. State what would change the recommendation.

DECISION STATES:
- CLOSE_RECOMMEND_FOR: enough evidence/context for a favorable recommendation.
- CLOSE_RECOMMEND_AGAINST: enough evidence/context for an unfavorable recommendation.
- OPEN_USER_CONTEXT_NEEDED: one or more user-owned material facts remain missing. Ask only those.
- OPEN_CLINICAL_INPUT_NEEDED: a genuinely clinician-owned fact remains unresolved after Cevren has done its part.
- OPEN_EVIDENCE_INSUFFICIENT: evidence itself cannot support a confident recommendation; explain what is known and unknown.

When phase=INTERPRET, focus on accurate decision interpretation and material gaps; you may still populate a provisional evidence assessment and state. When phase=REASSESS, integrate the supplied answers and make the strongest responsible decision state you can.`;

app.post("/api/decision-engine", async (req, res) => {
  try {
    const { question, phase = "INTERPRET", humanModel = [], healthContext = {}, userContext = [], priorState = null } = req.body || {};
    if (!question || typeof question !== "string") return res.status(400).json({ ok: false, error: "question is required" });
    const payload = { phase, question, relevant_human_model: humanModel, optional_health_context: healthContext, user_supplied_decision_context: userContext, prior_engine_state: priorState };
    const response = await openai.responses.create({
      model, reasoning: { effort: "high" }, store: false, instructions: DECISION_ENGINE_SYSTEM,
      input: `Run the generalized Cevren Decision Engine on this decision. Do not use a topic-specific scripted path.\n\n${JSON.stringify(payload, null, 2)}`,
      text: { format: { type: "json_schema", name: "cevren_decision_engine_v1", strict: true, schema: engineSchema } }
    });
    res.json({ ok: true, model, engine: JSON.parse(response.output_text), usage: response.usage || null });
  } catch (error) {
    console.error("Decision engine error:", error);
    res.status(error?.status || 500).json({ ok: false, error: "Cevren Decision Engine failed", detail: process.env.NODE_ENV === "production" ? undefined : String(error?.message || error) });
  }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ ok: false, error: "Cevren backend error" }); });
app.listen(port, "0.0.0.0", () => console.log(`Cevren Decision Engine v1 listening on ${port} using ${model}`));
