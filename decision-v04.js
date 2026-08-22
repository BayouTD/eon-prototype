async function reassessDecision(d,newValues=[]){
  const meaningful=newValues.some(Boolean);
  if(meaningful)d.answers=(d.answers||[]).concat([newValues]);
  d.draftAnswers=[];
  d.reassessing=true;
  d.lastDecisionError=null;
  save();
  decision();
  try{
    const r=await fetch(`${API}/api/decision-reassess`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        decision:d,
        humanModel:(S.humanModel?.understandings||[]).map(x=>({
          domain:x.domain,
          confidence:x.confidence,
          allowed_adaptation:x.allowed_adaptation,
          prohibited_use:x.prohibited_use
        })),
        healthContext:S.healthContext||{}
      })
    });
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);
    const a=j.reassessment;
    d.action=a.service_action;
    d.reason=a.user_facing_message;
    d.worth=a.decision_worthiness;
    d.missing=(a.next_questions||[]).map(x=>x.question);
    d.questionReasons=(a.next_questions||[]).map(x=>x.why_needed);
    d.contextSummary=a.context_summary;
    d.missingEvidence=a.missing_evidence||[];
    d.safetyNote=a.safety_note||null;
    d.canProceedWithoutMoreContext=!!a.can_proceed_without_more_context;
    d.reassessing=false;
    d.trace={
      ...(d.trace||{}),
      evidence_state:a.evidence_state,
      decision_worthiness:a.decision_worthiness,
      guidance_viability:a.guidance_viability,
      service_action:a.service_action,
      missing_evidence:a.missing_evidence||[],
      human_context_used:humanAdaptations(),
      governor:'Truth, evidence, safety, trust and agency do not adapt'
    };
    save();
    decision();
  }catch(e){
    d.reassessing=false;
    d.lastDecisionError=String(e.message||e);
    save();
    decision();
  }
}

function flattenedDecisionContext(d){
  return(d.answers||[]).flat().filter(Boolean);
}

function decision(){
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(!d){S.stage='home';return render()}
  d.answers=d.answers||[];
  d.draftAnswers=d.draftAnswers||[];
  const isAsk=d.action==='ASK'||String(d.action||'').startsWith('ASK');
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
  const safety=d.safetyNote?`<div class="card"><div class="label">Safety note</div><p>${esc(d.safetyNote)}</p></div>`:'';
  const error=d.lastDecisionError?`<p class="error">${esc(d.lastDecisionError)}</p>`:'';

  main.innerHTML=`<div class="label">Decision</div><h1>${esc(d.question)}</h1><div class="card"><div class="label">CEVREN'S CURRENT ACTION</div><div class="assessment">${esc(d.action)}</div><p>${esc(d.reason)}</p></div><div class="card"><div class="label">Decision-worthiness</div><h2>${esc(d.worth)}</h2><p class="muted">Decision-worthiness is evaluated before personalization.</p></div>${contextSummary}${askBlock}${gatheredBlock}${missingEvidence}${safety}${error}<div class="card"><div class="label">Human Model context currently permitted</div>${(d.trace?.human_context_used||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('')||'<p class="muted">None yet.</p>'}<p class="meta" style="margin-top:10px">Human context may change delivery and support. It may not change truth, evidence quality, or safety thresholds.</p></div><details class="card"><summary><b>Decision trace</b></summary><div class="trace">${esc(JSON.stringify(d.trace,null,2))}</div></details><div class="row"><button id="back">Back home</button><button class="secondary" id="resolve">Mark resolved</button></div>`;

  document.getElementById('back').onclick=()=>{S.stage='home';save();render()};
  document.getElementById('resolve').onclick=()=>{d.status='RESOLVED';S.stage='home';save();render()};

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

// Re-render the current saved state using the v0.4 decision experience.
render();
