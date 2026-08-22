// Cevren v0.7 — Evidence Integration & Resolution

async function cevrenResolveEvidence(d,evidence){
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
    d.trace={...(d.trace||{}),evidence_resolution:{relevance:x.relevance,decision_impact:x.decision_impact,resolved:x.resolved_uncertainties||[],partially_resolved:x.partially_resolved_uncertainties||[],still_unresolved:x.still_unresolved_uncertainties||[],new_uncertainties:x.newly_introduced_uncertainties||[]},service_action:d.action};
    save();
    decision();
  }catch(e){
    d.evidenceResolving=false;
    d.lastEvidenceError=String(e.message||e);
    save();
    decision();
  }
}

function cevrenEvidenceResolutionBlock(d){
  const latest=(d.evidenceHistory||[]).at(-1)?.resolution;
  if(!latest)return '';
  const group=(label,items)=>items?.length?`<div class="support-section"><b>${label}</b>${items.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:'';
  return `<div class="card support-card"><div class="label">Evidence resolution</div><h2>What changed — and what didn't.</h2><p>${esc(latest.evidence_summary)}</p><p><b>Decision impact:</b> ${esc(latest.decision_impact)}</p>${group('Resolved',latest.resolved_uncertainties)}${group('Partially resolved',latest.partially_resolved_uncertainties)}${group('Still unresolved',latest.still_unresolved_uncertainties)}${group('New uncertainty introduced',latest.newly_introduced_uncertainties)}<p class="meta">This resolution reflects how user-supplied evidence changes the decision state. It does not independently verify the evidence or establish medical truth.</p></div>`;
}

const cevrenV07BaseDecision=decision;
decision=function(){
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(d?.evidenceResolving){
    main.innerHTML=`<div class="thinking"><div class="spinner"></div><h1>Cevren is integrating the new evidence.</h1><p class="muted">Determining which uncertainties it addresses, which remain, and whether the next action should change.</p></div>`;
    return;
  }
  cevrenV07BaseDecision();
  if(!d)return;

  const support=document.querySelector('.support-card');
  if(String(d.action)==='ESCALATE'&&support){
    const panel=document.createElement('div');
    panel.className='card evidence-entry-card';
    panel.innerHTML=`<div class="label">Simulated evidence integration</div><h2>Add new evidence to this open decision.</h2><p class="muted">For v0.7, describe the relevant lab result, clinician input, imaging finding, or other evidence in your own words. Cevren will treat it as user-supplied—not independently verified.</p><textarea id="evidenceInput" placeholder="Example: My recent CBC/CMP were within the lab's reference ranges. My clinician diagnosed lateral epicondylitis and did not see signs of tendon rupture.">${esc(d.evidenceDraft||'')}</textarea><div class="row"><button id="resolveEvidence">Integrate evidence</button></div>${d.lastEvidenceError?`<p class="error">${esc(d.lastEvidenceError)}</p>`:''}`;
    support.parentNode.insertBefore(panel,support.nextSibling);
    const prior=document.createElement('div');
    prior.innerHTML=cevrenEvidenceResolutionBlock(d);
    if(prior.firstElementChild)panel.parentNode.insertBefore(prior.firstElementChild,panel.nextSibling);
    const input=document.getElementById('evidenceInput');
    input.addEventListener('input',()=>{d.evidenceDraft=input.value;save()});
    document.getElementById('resolveEvidence').onclick=async()=>{
      const v=input.value.trim();
      if(!v){d.lastEvidenceError='Add a piece of evidence before integrating it.';save();return decision()}
      await cevrenResolveEvidence(d,v);
    };
  }
};

render();
