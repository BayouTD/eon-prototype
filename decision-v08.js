// Cevren v0.8 — Evidence Resolution → Decision Architecture

async function cevrenResolveEvidenceV08(d,evidence){
  d.evidenceResolving=true;
  d.lastEvidenceError=null;
  save();
  decision();
  try{
    const r=await fetch(`${API}/api/evidence-resolve`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({decision:d,evidence})
    });
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);
    const x=j.resolution;
    d.evidenceHistory=d.evidenceHistory||[];
    d.evidenceHistory.push({entered:evidence,resolution:x,at:new Date().toISOString()});
    d.evidenceResolving=false;
    d.evidenceDraft='';
    d.missingEvidence=x.still_unresolved_uncertainties||[];
    d.action=x.proposed_service_action||d.action;
    d.reason=x.user_facing_message||d.reason;
    d.missing=(x.next_questions||[]).map(q=>q.question);
    d.questionReasons=(x.next_questions||[]).map(q=>q.why_needed);
    d.trace={
      ...(d.trace||{}),
      evidence_state:x.evidence_state,
      guidance_viability:x.guidance_viability,
      service_action:d.action,
      evidence_resolution:{
        relevance:x.relevance,
        decision_impact:x.decision_impact,
        resolved:x.resolved_uncertainties||[],
        partially_resolved:x.partially_resolved_uncertainties||[],
        still_unresolved:x.still_unresolved_uncertainties||[],
        evidence_limitations:x.evidence_limitations||[],
        new_uncertainties:x.newly_introduced_uncertainties||[],
        next_action_reason:x.next_action_reason
      }
    };
    save();
    decision();
  }catch(e){
    d.evidenceResolving=false;
    d.lastEvidenceError=String(e.message||e);
    save();
    decision();
  }
}

function cevrenEvidenceResolutionBlockV08(d){
  const latest=(d.evidenceHistory||[]).at(-1)?.resolution;
  if(!latest)return '';
  const group=(label,items)=>items?.length?`<div class="support-section"><b>${label}</b>${items.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:'';
  return `<div class="card support-card"><div class="label">Evidence resolution</div><h2>What changed — and what didn't.</h2><p>${esc(latest.evidence_summary)}</p><p><b>Decision impact:</b> ${esc(latest.decision_impact)}</p>${group('Resolved',latest.resolved_uncertainties)}${group('Partially resolved',latest.partially_resolved_uncertainties)}${group('Still unresolved',latest.still_unresolved_uncertainties)}${group('Limits of this evidence',latest.evidence_limitations)}${group('New uncertainty introduced',latest.newly_introduced_uncertainties)}<div class="support-section"><b>What Cevren does next</b><p><b>${esc(latest.proposed_service_action)}</b> — ${esc(latest.next_action_reason)}</p></div><p class="meta">This resolution reflects how user-supplied evidence changes the decision state. It does not independently verify the evidence or establish medical truth.</p></div>`;
}

// Replace v0.7 integration handler and renderer with the cleaned v0.8 loop.
cevrenResolveEvidence=cevrenResolveEvidenceV08;
cevrenEvidenceResolutionBlock=cevrenEvidenceResolutionBlockV08;

const cevrenV08BaseDecision=decision;
decision=function(){
  cevrenV08BaseDecision();
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(!d)return;
  const input=document.getElementById('evidenceInput');
  const btn=document.getElementById('resolveEvidence');
  if(input&&btn){
    input.addEventListener('input',()=>{d.evidenceDraft=input.value;save()});
    btn.onclick=async()=>{
      const v=input.value.trim();
      if(!v){d.lastEvidenceError='Add a piece of evidence before integrating it.';save();return decision()}
      await cevrenResolveEvidenceV08(d,v);
    };
  }
};

render();
