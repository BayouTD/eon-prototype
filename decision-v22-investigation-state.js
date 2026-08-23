// Cevren v0.22 — investigation state guard
// Makes "I don't have this information" a durable epistemic state and prevents
// previously declined/unavailable facts from sending an investigation back into intake.
(function(){
  const priorFetch=window.fetch.bind(window);
  const now=()=>new Date().toISOString();
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const active=()=> (S.decisions||[]).find(d=>d.id===S.currentDecision)||null;

  function ensureControl(d){
    d.decisionControl=d.decisionControl||{};
    d.decisionControl.unavailableFacts=Array.isArray(d.decisionControl.unavailableFacts)?d.decisionControl.unavailableFacts:[];
    d.decisionControl.intakeComplete=!!d.decisionControl.intakeComplete;
    d.decisionControl.investigationCommitted=!!d.decisionControl.investigationCommitted;
    return d.decisionControl;
  }

  function tokens(s){return new Set(norm(s).split(' ').filter(x=>x.length>2))}
  function sameFact(a,b){
    const A=norm(a),B=norm(b);if(!A||!B)return false;
    if(A===B||A.includes(B)||B.includes(A))return true;
    const ta=tokens(A),tb=tokens(B);if(!ta.size||!tb.size)return false;
    let hit=0;for(const x of ta)if(tb.has(x))hit++;
    return hit/Math.min(ta.size,tb.size)>=0.72;
  }

  function unavailableMatches(d,gap){
    const c=ensureControl(d);
    return c.unavailableFacts.some(x=>sameFact(x.fact,gap?.fact)||sameFact(x.question,gap?.question_for_user));
  }

  function markCurrentUserGapsUnavailable(d){
    const e=d?.engineState;if(!d||!e)return;
    const c=ensureControl(d);
    const gaps=(e.material_gaps||[]).filter(g=>g.owner==='USER'&&g.question_for_user);
    for(const g of gaps){
      if(!c.unavailableFacts.some(x=>sameFact(x.fact,g.fact)||sameFact(x.question,g.question_for_user))){
        c.unavailableFacts.push({fact:g.fact,question:g.question_for_user,declaredAt:now()});
      }
      d.userContext=d.userContext||[];
      if(!d.userContext.some(x=>String(x.source||'').toUpperCase()==='USER_UNAVAILABLE'&&sameFact(x.fact,g.fact))){
        d.userContext.push({
          fact:g.fact,
          answer:'UNAVAILABLE — the user explicitly said they do not have this information for this decision.',
          source:'USER_UNAVAILABLE',
          unavailable:true,
          declaredAt:now()
        });
      }
    }
    c.lastUnavailableAt=now();
    try{save()}catch(_e){}
  }

  function markInvestigationCommitted(d){
    if(!d)return;const c=ensureControl(d);
    c.intakeComplete=true;
    c.investigationCommitted=true;
    c.investigationCommittedAt=now();
    try{save()}catch(_e){}
  }

  // Capture before the existing v0.18 handlers run so their next engine call sees the state.
  document.addEventListener('click',ev=>{
    const id=ev.target?.id||'';const d=active();if(!d)return;
    if(id==='v18Skip')markCurrentUserGapsUnavailable(d);
    if(id==='v18Investigate'||id==='v20Investigate')markInvestigationCommitted(d);
  },true);

  function addControlPacket(body,d){
    const c=ensureControl(d);
    body.userContext=Array.isArray(body.userContext)?body.userContext:[];
    for(const x of c.unavailableFacts){
      if(!body.userContext.some(y=>String(y.source||'').toUpperCase()==='USER_UNAVAILABLE'&&sameFact(y.fact,x.fact))){
        body.userContext.push({
          fact:x.fact,
          answer:'UNAVAILABLE — user has explicitly said this information is not available. Do not ask for it again in this decision. Carry the missing fact forward as uncertainty.',
          source:'USER_UNAVAILABLE',
          unavailable:true
        });
      }
    }
    if(c.intakeComplete||c.investigationCommitted){
      body.userContext.push({
        fact:'CEVREN DECISION CONTROL — intake status',
        answer:'INTAKE COMPLETE. Cevren has already told the user it has enough to start. Do not return to intake for a fact already asked, answered, declined, or marked unavailable. If an unavailable fact prevents closure, preserve it as residual uncertainty and continue to the strongest responsible position. Ask again only for a genuinely new decision-critical fact discovered after investigation.',
        source:'CEVREN_DECISION_CONTROL'
      });
    }
    body.humanModel=Array.isArray(body.humanModel)?body.humanModel:[];
    if(c.unavailableFacts.length){
      body.humanModel.push({
        domain:'decision_state_control',
        statement:`For this decision the user has explicitly marked ${c.unavailableFacts.length} requested fact${c.unavailableFacts.length===1?'':'s'} unavailable.`,
        allowed_adaptation:'Treat those facts as known-to-be-unavailable epistemic state. Do not ask for them again; reflect their absence in uncertainty/confidence instead.',
        prohibited_use:'Do not invent the missing information or treat unavailability as evidence for or against the intervention.',
        confidence:'verified'
      });
    }
    body.decisionControl={
      intakeComplete:c.intakeComplete,
      investigationCommitted:c.investigationCommitted,
      unavailableFacts:c.unavailableFacts
    };
    return body;
  }

  function guardEngineResult(data,d,phase){
    const e=data?.engine;if(!e||!d)return data;
    const c=ensureControl(d);
    if(!c.unavailableFacts.length)return data;

    const gaps=Array.isArray(e.material_gaps)?e.material_gaps:[];
    const repeated=gaps.filter(g=>g.owner==='USER'&&unavailableMatches(d,g));
    if(!repeated.length)return data;

    // A model may still regenerate the same gap with slightly different wording.
    // Remove only gaps already declared unavailable; genuinely new user gaps survive.
    e.material_gaps=gaps.filter(g=>!(g.owner==='USER'&&unavailableMatches(d,g)));
    const remainingUser=e.material_gaps.filter(g=>g.owner==='USER'&&g.question_for_user);

    if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&remainingUser.length===0){
      e.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
      const unavailableNames=c.unavailableFacts.map(x=>x.fact).filter(Boolean).slice(0,2).join('; ');
      const residual=`Requested information remains unavailable${unavailableNames?`: ${unavailableNames}`:''}. Cevren will not ask for it again in this decision.`;
      e.evidence_assessment=e.evidence_assessment||{};
      e.evidence_assessment.uncertainty=Array.isArray(e.evidence_assessment.uncertainty)?e.evidence_assessment.uncertainty:[];
      if(!e.evidence_assessment.uncertainty.some(x=>/remains unavailable/i.test(x)))e.evidence_assessment.uncertainty.push(residual);
      e.next_action='Proceed using the evidence and context already available. The unavailable information may limit confidence, but it does not restart intake.';
      e.what_would_change=e.what_would_change||'Obtaining the unavailable information later could refine this position; it is not required to continue this investigation now.';
      if(!e.position)e.position='The decision remains open because some decision-relevant information is unavailable, but Cevren has taken the available evidence as far as it can without asking you to repeat yourself.';
    }

    d.decisionControl.lastGuardedPhase=phase||null;
    d.decisionControl.lastGuardedAt=now();
    try{save()}catch(_e){}
    return data;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/decision-engine'))return priorFetch(input,init);

    let next=init;let phase=null;const d=active();
    if(d&&init?.body){
      try{
        const body=JSON.parse(init.body);
        phase=body.phase||null;
        next={...init,body:JSON.stringify(addControlPacket(body,d))};
      }catch(_e){}
    }

    const response=await priorFetch(input,next);
    if(!d||!response.ok)return response;
    try{
      const data=await response.clone().json();
      guardEngineResult(data,d,phase);
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch(_e){return response}
  };
})();
