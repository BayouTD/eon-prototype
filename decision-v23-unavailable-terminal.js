// Cevren v0.23 — unavailable-context terminal state
// Fixes the remaining loop where a fact explicitly marked unavailable could reappear
// through persisted engine state or a later INVESTIGATE response.
(function(){
  const priorFetch=window.fetch.bind(window);
  const now=()=>new Date().toISOString();
  const active=()=> (S.decisions||[]).find(d=>d.id===S.currentDecision)||null;
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const words=s=>norm(s).split(' ').filter(x=>x.length>2);
  const IMPORTANT=new Set(['ldl','ldlc','apob','apo','lipid','lipids','cholesterol','calcium','cac','plaque','statin','rosuvastatin','blood','pressure','diabetes','prediabetes','kidney','renal','smoking','nicotine','family','history','dose','medication','medicine','lab','labs','result','results']);

  function ensure(d){
    d.decisionControl=d.decisionControl||{};
    const c=d.decisionControl;
    c.unavailableFacts=Array.isArray(c.unavailableFacts)?c.unavailableFacts:[];
    c.unavailableTopics=Array.isArray(c.unavailableTopics)?c.unavailableTopics:[];
    c.intakeComplete=!!c.intakeComplete;
    c.investigationCommitted=!!c.investigationCommitted;
    return c;
  }

  function topicSignature(g){
    const src=`${g?.fact||''} ${g?.question_for_user||''}`;
    const all=words(src);
    const important=all.filter(x=>IMPORTANT.has(x));
    return [...new Set(important.length?important:all.slice(0,10))];
  }

  function overlap(a,b){
    const A=new Set(a||[]),B=new Set(b||[]);if(!A.size||!B.size)return 0;
    let hit=0;for(const x of A)if(B.has(x))hit++;
    return hit/Math.min(A.size,B.size);
  }

  function rememberUnavailable(d,g){
    const c=ensure(d);
    const sig=topicSignature(g);
    const key=norm(g?.fact||g?.question_for_user||'');
    if(!c.unavailableFacts.some(x=>norm(x.fact||x.question)===key)){
      c.unavailableFacts.push({fact:g?.fact||'',question:g?.question_for_user||'',declaredAt:now()});
    }
    if(sig.length&&!c.unavailableTopics.some(x=>overlap(x.tokens,sig)>=0.75)){
      c.unavailableTopics.push({tokens:sig,declaredAt:now()});
    }
    d.userContext=Array.isArray(d.userContext)?d.userContext:[];
    if(!d.userContext.some(x=>String(x.source||'').toUpperCase()==='USER_UNAVAILABLE'&&overlap(topicSignature({fact:x.fact}),sig)>=0.6)){
      d.userContext.push({fact:g?.fact||g?.question_for_user||'requested context',answer:'UNAVAILABLE — user explicitly does not have this information for this decision.',source:'USER_UNAVAILABLE',unavailable:true,declaredAt:now()});
    }
  }

  function isUnavailableTopic(d,g){
    const c=ensure(d);const sig=topicSignature(g);
    if(!sig.length)return false;
    return c.unavailableTopics.some(x=>overlap(x.tokens,sig)>=0.45);
  }

  function addResidualUncertainty(e,d){
    const c=ensure(d);
    e.evidence_assessment=e.evidence_assessment||{};
    e.evidence_assessment.uncertainty=Array.isArray(e.evidence_assessment.uncertainty)?e.evidence_assessment.uncertainty:[];
    const names=c.unavailableFacts.map(x=>x.fact||x.question).filter(Boolean).slice(0,3).join('; ');
    const msg=`Some decision-relevant information is unavailable${names?`: ${names}`:''}. Cevren proceeded without asking for it again; this limits confidence and may change the position if obtained later.`;
    if(!e.evidence_assessment.uncertainty.some(x=>/proceeded without asking|information is unavailable/i.test(String(x))))e.evidence_assessment.uncertainty.push(msg);
  }

  function neutralizeCurrentUnavailableGaps(d){
    const e=d?.engineState;if(!d||!e)return;
    const gaps=Array.isArray(e.material_gaps)?e.material_gaps:[];
    const current=gaps.filter(g=>g.owner==='USER'&&g.question_for_user);
    current.forEach(g=>rememberUnavailable(d,g));
    if(!current.length)return;
    e.material_gaps=gaps.filter(g=>!(g.owner==='USER'&&current.includes(g)));
    if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED')e.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
    addResidualUncertainty(e,d);
    e.next_action='Proceed with the investigation using the evidence and context already available.';
    e.what_would_change=e.what_would_change||'Obtaining the unavailable information later could refine this position, but it is not required to continue now.';
    const c=ensure(d);c.lastUnavailableAt=now();
    try{save()}catch(_e){}
  }

  // Capture the dedicated unavailable button before older handlers call ready()/save().
  document.addEventListener('click',ev=>{
    if(ev.target?.id!=='v18Skip')return;
    const d=active();if(!d)return;
    neutralizeCurrentUnavailableGaps(d);
  },true);

  // Once Cevren has said it has enough and investigation begins, intake is closed.
  document.addEventListener('click',ev=>{
    const id=ev.target?.id||'';
    if(id!=='v18Investigate'&&id!=='v20Investigate')return;
    const d=active();if(!d)return;
    const c=ensure(d);c.intakeComplete=true;c.investigationCommitted=true;c.investigationCommittedAt=now();
    // Persist a sanitized prior state so continuity/recovery cannot resurrect an old USER gap.
    if(d.engineState){
      d.engineState.material_gaps=(d.engineState.material_gaps||[]).filter(g=>g.owner!=='USER');
      if(d.engineState.decision_state==='OPEN_USER_CONTEXT_NEEDED')d.engineState.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
      addResidualUncertainty(d.engineState,d);
    }
    try{save()}catch(_e){}
  },true);

  function sanitizeResult(data,d,phase){
    const e=data?.engine;if(!e||!d)return data;
    const c=ensure(d);
    let gaps=Array.isArray(e.material_gaps)?e.material_gaps:[];

    if(phase==='INVESTIGATE'&&c.investigationCommitted){
      // Hard boundary: after explicit investigation commitment, the engine may not route
      // back to USER intake. New discoveries become residual uncertainty / what-would-change.
      const userGaps=gaps.filter(g=>g.owner==='USER');
      if(userGaps.length){
        gaps=gaps.filter(g=>g.owner!=='USER');
        e.material_gaps=gaps;
        addResidualUncertainty(e,d);
        if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED')e.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
        e.next_action=e.next_action&& !/ask|obtain|paste|provide|send/i.test(e.next_action)
          ? e.next_action
          : 'Proceed with the strongest responsible position supported by the evidence already available.';
        e.what_would_change=e.what_would_change||'Additional unavailable context could refine the position later.';
      }
    } else if(c.unavailableTopics.length){
      const repeated=gaps.filter(g=>g.owner==='USER'&&isUnavailableTopic(d,g));
      if(repeated.length){
        gaps=gaps.filter(g=>!(g.owner==='USER'&&isUnavailableTopic(d,g)));
        e.material_gaps=gaps;
        addResidualUncertainty(e,d);
        if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&!gaps.some(g=>g.owner==='USER'&&g.question_for_user))e.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
        e.next_action='Proceed using the evidence and context already available; do not ask again for information the user marked unavailable.';
      }
    }

    // Never let a persisted/open state contradict the hard investigation boundary.
    if(c.investigationCommitted&&e.decision_state==='OPEN_USER_CONTEXT_NEEDED'){
      e.material_gaps=(e.material_gaps||[]).filter(g=>g.owner!=='USER');
      e.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
      addResidualUncertainty(e,d);
    }
    c.lastSanitizedPhase=phase||null;c.lastSanitizedAt=now();
    try{save()}catch(_e){}
    return data;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/decision-engine'))return priorFetch(input,init);
    let phase=null;try{phase=JSON.parse(init?.body||'{}').phase||null}catch(_e){}
    const d=active();
    const response=await priorFetch(input,init);
    if(!d||!response.ok)return response;
    try{
      const data=await response.clone().json();
      sanitizeResult(data,d,phase);
      const headers=new Headers(response.headers);headers.set('content-type','application/json');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch(_e){return response}
  };

  // Final continuity safety rail: if an old persisted state still contains the exact
  // unavailable gap, sanitize it on load before v0.20's delayed resume routes the UI.
  const d=active();
  if(d){
    const c=ensure(d);
    if(c.unavailableFacts.length&&d.engineState){
      const before=(d.engineState.material_gaps||[]).length;
      d.engineState.material_gaps=(d.engineState.material_gaps||[]).filter(g=>!(g.owner==='USER'&&isUnavailableTopic(d,g)));
      if(before!==d.engineState.material_gaps.length&&d.engineState.decision_state==='OPEN_USER_CONTEXT_NEEDED')d.engineState.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
      if(c.investigationCommitted){
        d.engineState.material_gaps=(d.engineState.material_gaps||[]).filter(g=>g.owner!=='USER');
        if(d.engineState.decision_state==='OPEN_USER_CONTEXT_NEEDED')d.engineState.decision_state='OPEN_EVIDENCE_INSUFFICIENT';
      }
      try{save()}catch(_e){}
    }
  }
})();
