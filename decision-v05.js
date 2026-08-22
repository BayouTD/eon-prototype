// Cevren v0.5 — Escalation Without Abandonment
// Extends the v0.4 decision experience while preserving all saved local state.

function cevrenEscalationType(d){
  const text=`${d.action||''} ${d.reason||''} ${d.safetyNote||''}`.toLowerCase();
  if(/call 911|emergency department|emergency room|immediate emergency|seek emergency|life-threatening/.test(text)) return 'URGENT';
  return 'CLINICIAN_REVIEW';
}

function cevrenPrepTopics(d){
  const topics=[];
  const gathered=flattenedDecisionContext(d);
  if(gathered.length) topics.push('Bring the health context you have already shared with Cevren so you do not have to reconstruct the decision from memory.');
  if((d.missingEvidence||[]).length) topics.push('Review the specific uncertainties Cevren identified below and ask which of them materially changes the decision.');
  topics.push('Ask what evidence, examination, diagnosis, or monitoring would make the clinician more or less comfortable with the option you are considering.');
  topics.push('Ask what reasonable alternatives should be considered before acting, and what would change the preferred path.');
  return topics;
}

function cevrenDiscussionBrief(d){
  const missing=d.missingEvidence||[];
  const context=d.contextSummary||'Cevren has not yet generated a compact decision summary.';
  return `<div class="card support-card"><div class="label">Decision-preparation brief</div><h2>Take Cevren with you.</h2><p>${esc(context)}</p><div class="support-section"><b>Why another clinician belongs in this decision</b><p>${esc(d.reason||'Cevren has reached a boundary where qualified human review is warranted.')}</p></div>${missing.length?`<div class="support-section"><b>What still needs resolution</b>${missing.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:''}<div class="support-section"><b>Questions worth bringing</b>${cevrenPrepTopics(d).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><p class="meta">This brief organizes the decision. It does not replace a clinician or convert uncertain evidence into a recommendation.</p></div>`;
}

function decision(){
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(!d){S.stage='home';return render()}
  d.answers=d.answers||[];
  d.draftAnswers=d.draftAnswers||[];
  d.supportMode=d.supportMode||null;
  const isAsk=d.action==='ASK'||String(d.action||'').startsWith('ASK');
  const isEscalate=d.action==='ESCALATE';
  const escalationType=isEscalate?cevrenEscalationType(d):null;
  const gathered=flattenedDecisionContext(d);
  const questionReasons=d.questionReasons||[];

  if(d.reassessing){
    main.innerHTML=`<div class="thinking"><div class="spinner"></div><h1>Cevren is reassessing the decision.</h1><p class="muted">Using what you've already shared to determine whether another question is actually necessary—or whether it's time to move forward.</p></div>`;
    return;
  }

  const askBlock=isAsk?`<div class="card"><div class="label">What Cevren needs next</div>${(d.missing||[]).map((x,i)=>`<div class="ask-item"><p><b>${esc(x)}</b></p>${questionReasons[i]?`<p class="meta">Why this matters: ${esc(questionReasons[i])}</p>`:''}<textarea class="askanswer" data-i="${i}" placeholder="Your answer...">${esc(d.draftAnswers[i]||'')}</textarea></div>`).join('')}<div class="row"><button id="continueDecision">${(d.missing||[]).length?'Continue':'Reassess now'}</button></div></div>`:'';

  const gatheredBlock=gathered.length?`<div class="card"><div class="label">What you've told Cevren</div>${gathered.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:'';
  const contextSummary=d.contextSummary?`<div class="card"><div class="label">Cevren's current understanding of the decision</div><p>${esc(d.contextSummary)}</p></div>`:'';
  const missingEvidence=(d.missingEvidence||[]).length?`<div class="card"><div class="label">What still limits stronger guidance</div>${d.missingEvidence.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:'';
  const safety=d.safetyNote?`<div class="card ${escalationType==='URGENT'?'urgent-card':''}"><div class="label">Safety note</div><p>${esc(d.safetyNote)}</p></div>`:'';
  const error=d.lastDecisionError?`<p class="error">${esc(d.lastDecisionError)}</p>`:'';

  const escalationSupport=isEscalate?`<div class="card escalation-card"><div class="label">${escalationType==='URGENT'?'Urgent escalation':'Escalation without abandonment'}</div><h2>${escalationType==='URGENT'?'Safety comes first.':'Cevren stays with the decision.'}</h2><p>${escalationType==='URGENT'?'Cevren can help organize context after the immediate safety need is addressed.':'Escalation changes who needs to participate; it does not end Cevren’s participation. This decision remains open and can be reassessed when you add clinician input, labs, records, or other relevant context.'}</p>${escalationType==='URGENT'?'<div class="row"><button id="back">Back home</button></div>':`<div class="support-actions"><button class="context-card" id="prepClinician"><b>Prepare my clinician discussion</b><span>Turn this decision into a concise brief and useful questions.</span></button><button class="context-card" id="addDecisionContext"><b>Add labs or health information</b><span>Add context now and return to this same open decision.</span></button><button class="context-card" id="reviewCevren"><b>Review what Cevren knows</b><span>Inspect the Human Model and correct anything that matters.</span></button><button class="context-card" id="keepOpen"><b>Leave this open</b><span>Return home without marking the decision resolved.</span></button></div>`}</div>${d.supportMode==='CLINICIAN_PREP'?cevrenDiscussionBrief(d):''}`:'';

  const footer=!isEscalate?`<div class="row"><button id="back">Back home</button><button class="secondary" id="resolve">Mark resolved</button></div>`:'';

  main.innerHTML=`<div class="label">Decision</div><h1>${esc(d.question)}</h1><div class="card"><div class="label">CEVREN'S CURRENT ACTION</div><div class="assessment">${esc(d.action)}</div><p>${esc(d.reason)}</p></div><div class="card"><div class="label">Decision-worthiness</div><h2>${esc(d.worth)}</h2><p class="muted">Decision-worthiness is evaluated before personalization.</p></div>${contextSummary}${askBlock}${gatheredBlock}${missingEvidence}${safety}${escalationSupport}${error}<div class="card"><div class="label">Human Model context currently permitted</div>${(d.trace?.human_context_used||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('')||'<p class="muted">None yet.</p>'}<p class="meta" style="margin-top:10px">Human context may change delivery and support. It may not change truth, evidence quality, or safety thresholds.</p></div><details class="card"><summary><b>Decision trace</b></summary><div class="trace">${esc(JSON.stringify({...d.trace,escalation_type:escalationType||'NONE',decision_status:d.status},null,2))}</div></details>${footer}`;

  if(!isEscalate){
    document.getElementById('back').onclick=()=>{S.stage='home';save();render()};
    document.getElementById('resolve').onclick=()=>{d.status='RESOLVED';S.stage='home';save();render()};
  } else if(escalationType==='URGENT'){
    const b=document.getElementById('back'); if(b)b.onclick=()=>{S.stage='home';save();render()};
  } else {
    document.getElementById('prepClinician').onclick=()=>{d.supportMode='CLINICIAN_PREP';save();decision();setTimeout(()=>document.querySelector('.support-card')?.scrollIntoView({behavior:'smooth',block:'start'}),50)};
    document.getElementById('addDecisionContext').onclick=()=>{S.returnToDecision=d.id;S.stage='context';save();render()};
    document.getElementById('reviewCevren').onclick=()=>{S.returnToDecision=d.id;S.stage='you';save();render()};
    document.getElementById('keepOpen').onclick=()=>{d.status='OPEN';S.stage='home';save();render()};
  }

  if(isAsk){
    const fields=[...document.querySelectorAll('.askanswer')];
    fields.forEach((field,i)=>field.addEventListener('input',()=>{
      d.draftAnswers[i]=field.value;
      save();
    }));
    const btn=document.getElementById('continueDecision');
    btn.onclick=async()=>{
      const vals=fields.map(x=>x.value.trim());
      if(!vals.some(Boolean)&&!d.answers.length){
        d.lastDecisionError='Answer at least one question so Cevren has something new to reassess.';
        save();
        return decision();
      }
      await reassessDecision(d,vals);
    };
  }
}

// Patch context/home navigation so an escalated decision can receive new context and resume.
const cevrenV05BaseContext=context;
context=function(){
  cevrenV05BaseContext();
  const begin=document.getElementById('begin');
  const skip=document.getElementById('skip');
  const resume=()=>{
    if(S.returnToDecision){
      const id=S.returnToDecision;S.returnToDecision=null;S.currentDecision=id;S.stage='decision';save();decision();
    }else{S.stage='home';save();render()}
  };
  if(begin)begin.onclick=resume;
  if(skip)skip.onclick=resume;
};

// Re-render current state with v0.5 behavior while preserving the user's open decision.
render();
