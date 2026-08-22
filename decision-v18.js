// Cevren v0.18 — experience layer refinement; v0.17 decision logic remains authoritative
(function(){
  const API='https://eon-prototype-production.up.railway.app';
  const main=()=>document.getElementById('main');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const humanContext=()=> (S.humanModel?.understandings||[]).filter(x=>['strong','verified','emerging'].includes(x.confidence)).map(x=>({domain:x.domain,statement:x.statement,allowed_adaptation:x.allowed_adaptation,confidence:x.confidence}));
  const userGaps=e=>(e.material_gaps||[]).filter(g=>g.owner==='USER'&&g.question_for_user);
  const clinicianGaps=e=>(e.material_gaps||[]).filter(g=>g.owner==='CLINICIAN');

  function fresh(){
    main().innerHTML=`<section class="dx12 dx12-question"><div class="dx12-kicker">NEW DECISION</div><h1>What are you thinking about?</h1><p class="dx12-lead">Ask Cevren in your own words. You don't need to organize the question first.</p><textarea id="v18Question" placeholder="Tell Cevren what you are considering…"></textarea><div class="dx12-actions"><button id="v18Start">Talk it through with Cevren</button></div></section>`;
    document.getElementById('v18Start').onclick=()=>{const q=document.getElementById('v18Question').value.trim();if(!q)return;const d={id:crypto.randomUUID(),question:q,originalQuestion:q,clarifications:[],status:'OPEN',created:new Date().toISOString(),engineHistory:[],userContext:[]};S.decisions=S.decisions||[];S.decisions.unshift(d);S.currentDecision=d.id;save();interpret(d)};
  }

  async function callEngine(d,phase){
    const r=await fetch(`${API}/api/decision-engine`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:d.originalQuestion||d.question,clarifications:d.clarifications||[],phase,humanModel:humanContext(),healthContext:S.healthContext||{},userContext:d.userContext||[],priorState:d.engineState||null})});
    const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);d.engineState=j.engine;d.engineHistory=d.engineHistory||[];d.engineHistory.push({phase,at:new Date().toISOString(),state:j.engine});save();return j.engine;
  }

  function thinking(title,detail){main().innerHTML=`<section class="dx12"><div class="thinking"><div class="spinner"></div><div class="dx12-kicker">CEVREN DECISION ENGINE</div><h1>${esc(title)}</h1><p class="dx12-lead">${esc(detail)}</p></div></section>`}
  async function interpret(d){thinking('Understanding what you’re actually deciding.','Preserving your original question while separating the choice, goals, claims, and decision criteria.');try{showInterpretation(d,await callEngine(d,'INTERPRET'))}catch(err){showError(err,()=>interpret(d))}}

  function showInterpretation(d,e){
    const i=e.interpretation;
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">UNDERSTANDING YOUR DECISION</div><h1>Here's what I think you're really asking.</h1><div class="dx13-position"><h2>${esc(i.decision_statement)}</h2><p>${esc(i.plain_summary)}</p></div>${i.claims_to_test?.length?`<div class="dx13-section"><h3>The parts I need to test</h3>${i.claims_to_test.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:''}<p class="dx12-lead">If that's right, I'll check what I already know, identify only missing facts that could change the decision, and investigate.</p><div class="dx12-actions"><button id="v18Confirm">That's right — continue</button><button class="secondary" id="v18Clarify">Not quite</button></div><div id="v18Correction"></div></section>`;
    document.getElementById('v18Confirm').onclick=()=>route(d,e);
    document.getElementById('v18Clarify').onclick=()=>{document.getElementById('v18Correction').innerHTML=`<div class="dx12-inline"><textarea id="v18Clarification" placeholder="What should Cevren understand differently?"></textarea><button id="v18Update">Update my decision</button></div>`;document.getElementById('v18Update').onclick=()=>{const v=document.getElementById('v18Clarification').value.trim();if(!v)return;d.clarifications=(d.clarifications||[]).concat(v);d.engineState=null;save();interpret(d)}};
  }

  function route(d,e){const gaps=userGaps(e);if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&gaps.length)return askContext(d,e,gaps);ready(d,e)}
  function askContext(d,e,gaps){const chosen=gaps.slice(0,2);main().innerHTML=`<section class="dx12"><div class="dx12-kicker">A LITTLE CONTEXT COULD CHANGE THIS DECISION</div><h1>${chosen.length===1?'I need one thing from you before I investigate.':'I need two things from you before I investigate.'}</h1><p class="dx12-lead">I'm asking only because the answer could materially change what I recommend.</p>${chosen.map((g,i)=>`<div class="card"><div class="dx12-kicker">WHY THIS MATTERS</div><p>${esc(g.why_material)}</p><p><b>${esc(g.question_for_user)}</b></p><textarea class="v18Answer" data-i="${i}" placeholder="Your answer…"></textarea></div>`).join('')}<div class="dx12-actions"><button id="v18ContextContinue">Continue</button><button class="secondary" id="v18Skip">I don't have this information</button></div></section>`;document.getElementById('v18ContextContinue').onclick=async()=>{const vals=[...document.querySelectorAll('.v18Answer')].map((x,i)=>({fact:chosen[i].fact,answer:x.value.trim(),source:'USER'})).filter(x=>x.answer);if(!vals.length)return;d.userContext=(d.userContext||[]).concat(vals);save();await reassess(d)};document.getElementById('v18Skip').onclick=()=>ready(d,e)}
  async function reassess(d){thinking('Reassessing with the context you added.','Checking whether it changes the recommendation, evidence work, or ownership of the next step.');try{const e=await callEngine(d,'REASSESS');const gaps=userGaps(e);if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&gaps.length)return askContext(d,e,gaps);ready(d,e)}catch(err){showError(err,()=>reassess(d))}}

  function ready(d,e){d.engineState=e;save();const work=(e.material_gaps||[]).filter(g=>g.owner==='CEVREN');main().innerHTML=`<section class="dx12"><div class="dx12-kicker">READY TO INVESTIGATE</div><h1>I have enough to start.</h1><p class="dx12-lead">I'll test the evidence, apply only the context that matters to you, challenge any proposed escalation, and determine whether the decision can close.</p><div class="dx12-note"><b>Cevren owns the research.</b><span>${work.length?work.slice(0,3).map(x=>esc(x.fact)).join(' · '):'I will not manufacture a referral simply because uncertainty remains.'}</span></div><div class="dx12-actions"><button id="v18Investigate">Let Cevren investigate</button></div></section>`;document.getElementById('v18Investigate').onclick=()=>investigate(d,e)}

  function renderJourney(d,e){
    const hasContext=(d.userContext||[]).length>0||(e.relevant_known_context||[]).length>0;
    const stages=[
      {id:'understood',label:'Decision understood',state:'done'},
      {id:'claims',label:'Claims separated',state:'done'},
      {id:'evidence',label:'Relevant evidence being tested',state:'active'},
      {id:'context',label:hasContext?'Your relevant context will be applied':'No additional personal context appears necessary',state:'pending'},
      {id:'challenge',label:'Escalation and uncertainty will be challenged',state:'pending'},
      {id:'position',label:'Cevren position',state:'pending'}
    ];
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN IS INVESTIGATING</div><h1>Working through the decision.</h1><p class="dx12-lead">This is a receipt of the work Cevren is actually doing—not a generic loading animation.</p><div class="dx12-journey" id="v18Journey">${stages.map(s=>`<div class="dx12-step ${s.state==='done'?'done':s.state==='active'?'active':''}" data-id="${s.id}"><span>${s.state==='done'?'✓':s.state==='active'?'●':'○'}</span><b>${esc(s.label)}</b></div>`).join('')}</div><div class="dx12-live" id="v18Live">Evaluating the evidence Cevren owns…</div></section>`;
    return {hasContext};
  }
  function setStage(id,state,label){const el=document.querySelector(`.dx12-step[data-id="${id}"]`);if(!el)return;el.className='dx12-step '+(state==='done'?'done':state==='active'?'active':'');el.querySelector('span').textContent=state==='done'?'✓':state==='active'?'●':'○';if(label)el.querySelector('b').textContent=label}

  async function investigate(d,e0){
    const meta=renderJourney(d,e0);
    try{
      const e=await callEngine(d,'INVESTIGATE');
      setStage('evidence','done','Relevant evidence tested');
      setStage('context','active',meta.hasContext?'Applying only relevant personal context':'No additional personal context was needed');
      document.getElementById('v18Live').textContent=meta.hasContext?'Applying the personal context that materially affects this decision…':'No extra personal context materially changes this decision.';
      setTimeout(()=>{
        setStage('context','done',meta.hasContext?'Relevant personal context applied':'No additional personal context needed');
        setStage('challenge','active','Testing what could change the answer');
        document.getElementById('v18Live').textContent='Challenging uncertainty and any proposed escalation…';
        setTimeout(()=>{
          setStage('challenge','done','What could change the answer tested');
          setStage('position','active','Forming Cevren position');
          document.getElementById('v18Live').textContent='Forming the strongest responsible position…';
          setTimeout(()=>{setStage('position','done','Position formed');document.getElementById('v18Live').textContent='Investigation complete.';setTimeout(()=>showDecision(d,e),350)},450);
        },450);
      },450);
    }catch(err){showError(err,()=>investigate(d,e0))}
  }

  function validClinical(e){const gaps=clinicianGaps(e).filter(g=>g.fact&&g.why_material&&g.acquisition==='CLINICAL_EXAM_OR_JUDGMENT');const qs=(e.clinician_questions||[]).filter(Boolean);return gaps.length>0&&qs.length>0}
  function provenance(d,e){
    const user=(d.userContext||[]).filter(x=>x.answer).slice(-2);
    const known=(e.relevant_known_context||[]).slice(0,2);
    if(user.length)return `For this decision, you told me ${user.map(x=>`${x.fact}: ${x.answer}`).join('; ')}. ${e.personalization||''}`;
    if(known.length)return `I already know ${known.join('; ')}. ${e.personalization||''}`;
    return e.personalization||'No additional personal context materially changed this recommendation.';
  }
  function whyLine(e){const s=(e.evidence_assessment?.supports||[])[0];const c=(e.evidence_assessment?.cautions||[])[0];return [s,c].filter(Boolean).join(' ')}

  function showDecision(d,e){
    if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&userGaps(e).length)return askContext(d,e,userGaps(e));
    if(e.decision_state==='OPEN_CLINICAL_INPUT_NEEDED'&&validClinical(e))return showClinical(d,e);
    if(e.decision_state==='OPEN_CLINICAL_INPUT_NEEDED'&&!validClinical(e)){e.decision_state='OPEN_EVIDENCE_INSUFFICIENT';e.position=e.position||'The decision remains open, but there is no justified clinical blocker.';e.next_action='Keep the decision open until evidence or obtainable context can resolve it.'}
    const closed=e.decision_state.startsWith('CLOSE_');
    const personal=provenance(d,e);
    const why=whyLine(e);
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">INVESTIGATION COMPLETE · ${closed?'DECISION CAN CLOSE':'DECISION REMAINS OPEN'}</div><h1>Here's where Cevren lands.</h1><div class="dx13-position"><div class="dx12-kicker">CEVREN'S POSITION</div><h2>${esc(e.position)}</h2></div>${why?`<div class="dx13-section"><h3>Why</h3><p>${esc(why)}</p></div>`:''}<div class="dx13-section"><h3>What matters because it's you</h3><p>${esc(personal)}</p></div><div class="dx13-blocker"><div class="dx12-kicker">WHAT WOULD CHANGE THIS</div><p>${esc(e.what_would_change)}</p></div><div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>${closed?'This decision can close.':esc(e.next_action)}</h2>${closed?`<div class="dx12-actions"><button id="v18Resolve">Mark decision resolved</button><button class="secondary" id="v18Explore">Explore a better path for this goal</button></div>`:`<button id="v18Keep">Keep this decision open</button>`}</div><details class="dx12-details"><summary>See Cevren's evidence and uncertainty</summary><div class="dx13-evidence">${(e.evidence_assessment?.supports||[]).map(x=>`<p>✓ ${esc(x)}</p>`).join('')}${(e.evidence_assessment?.cautions||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')}${(e.evidence_assessment?.uncertainty||[]).length?`<h3>Uncertainty</h3>${e.evidence_assessment.uncertainty.map(x=>`<p>• ${esc(x)}</p>`).join('')}`:''}<p class="meta">Evidence basis: ${esc(e.evidence_assessment?.basis)} · strength: ${esc(e.evidence_assessment?.evidence_strength)} · confidence: ${esc(e.confidence)}. This prototype does not yet use live verified literature retrieval.</p></div></details></section>`;
    if(closed){document.getElementById('v18Resolve').onclick=()=>{d.status='RESOLVED';d.resolvedAt=new Date().toISOString();save();fresh()};document.getElementById('v18Explore').onclick=()=>{const prior=d.engineState?.interpretation?.goals?.[0]||'the outcome I wanted';const q=`Given the goal from my previous decision — ${prior} — what options are more likely to be worth my time, money, and effort?`;const nd={id:crypto.randomUUID(),question:q,originalQuestion:q,clarifications:[],status:'OPEN',created:new Date().toISOString(),engineHistory:[],userContext:[{fact:'prior decision context',answer:`Previous decision: ${d.originalQuestion}. Cevren position: ${e.position}`,source:'CEVREN'}]};S.decisions.unshift(nd);S.currentDecision=nd.id;save();interpret(nd)}}else document.getElementById('v18Keep').onclick=()=>{d.status='OPEN';save();fresh()};
  }

  function showClinical(d,e){const gaps=clinicianGaps(e),qs=(e.clinician_questions||[]).filter(Boolean).slice(0,4);main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">INVESTIGATION COMPLETE · CLINICAL INPUT NEEDED</div><h1>Cevren has taken this as far as it responsibly can alone.</h1><div class="dx13-position"><h2>${esc(e.position)}</h2></div><div class="dx13-section"><h3>The exact clinical blocker</h3>${gaps.map(g=>`<p>• <b>${esc(g.fact)}</b> — ${esc(g.why_material)}</p>`).join('')}</div><div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>Take only the questions that can change this decision.</h2>${qs.map((q,i)=>`<p><b>${i+1}.</b> ${esc(q)}</p>`).join('')}<button id="v18Leave">Leave this decision open</button></div></section>`;document.getElementById('v18Leave').onclick=fresh}
  function showError(err,retry){main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN DECISION ENGINE</div><h1>I couldn't complete that step.</h1><p class="error">${esc(err.message||err)}</p><div class="dx12-actions"><button id="v18Retry">Try again</button><button class="secondary" id="v18New">New question</button></div></section>`;document.getElementById('v18Retry').onclick=retry;document.getElementById('v18New').onclick=fresh}

  window.cevrenFreshDecisionV18=fresh;
  const reset=document.getElementById('resetBtn');if(reset)reset.onclick=fresh;
  setTimeout(fresh,100);
})();