// Cevren v0.16 — generalized decision-engine experience
(function(){
  const API='https://eon-prototype-production.up.railway.app';
  const main=()=>document.getElementById('main');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const current=()=>S.decisions&&S.decisions.find(d=>d.id===S.currentDecision);
  const humanContext=()=> (S.humanModel?.understandings||[]).filter(x=>['strong','verified','emerging'].includes(x.confidence)).map(x=>({domain:x.domain,statement:x.statement,allowed_adaptation:x.allowed_adaptation,confidence:x.confidence}));

  function fresh(){
    main().innerHTML=`<section class="dx12 dx12-question"><div class="dx12-kicker">NEW DECISION</div><h1>What are you thinking about?</h1><p class="dx12-lead">Ask Cevren in your own words. You don't need to organize the question first.</p><textarea id="v16Question" placeholder="Tell Cevren what you are considering…"></textarea><div class="dx12-actions"><button id="v16Start">Talk it through with Cevren</button></div></section>`;
    document.getElementById('v16Start').onclick=()=>{const q=document.getElementById('v16Question').value.trim();if(!q)return;const d={id:crypto.randomUUID(),question:q,status:'OPEN',created:new Date().toISOString(),engineHistory:[],userContext:[]};S.decisions=S.decisions||[];S.decisions.unshift(d);S.currentDecision=d.id;save();interpret(d);};
  }

  async function callEngine(d,phase){
    const r=await fetch(`${API}/api/decision-engine`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:d.question,phase,humanModel:humanContext(),healthContext:S.healthContext||{},userContext:d.userContext||[],priorState:d.engineState||null})});
    const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);d.engineState=j.engine;d.engineHistory=d.engineHistory||[];d.engineHistory.push({phase,at:new Date().toISOString(),state:j.engine});save();return j.engine;
  }

  function thinking(title,detail){main().innerHTML=`<section class="dx12"><div class="thinking"><div class="spinner"></div><div class="dx12-kicker">CEVREN DECISION ENGINE</div><h1>${esc(title)}</h1><p class="dx12-lead">${esc(detail)}</p></div></section>`;}

  async function interpret(d){
    thinking('Understanding what you're actually deciding.','Separating the choice, the goals, and the claims that need to be tested.');
    try{const e=await callEngine(d,'INTERPRET');showInterpretation(d,e);}catch(err){showError(err,()=>interpret(d));}
  }

  function showInterpretation(d,e){
    const i=e.interpretation;
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">UNDERSTANDING YOUR DECISION</div><h1>Here's what I think you're really asking.</h1><div class="dx13-position"><h2>${esc(i.decision_statement)}</h2><p>${esc(i.plain_summary)}</p></div>${i.claims_to_test?.length?`<div class="dx13-section"><h3>The parts I need to test</h3>${i.claims_to_test.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:''}<p class="dx12-lead">If that's right, I'll check what I already know, identify only the missing facts that could change the decision, and then investigate.</p><div class="dx12-actions"><button id="v16Confirm">That's right — continue</button><button class="secondary" id="v16Clarify">Not quite</button></div><div id="v16Correction"></div></section>`;
    document.getElementById('v16Confirm').onclick=()=>routeFromState(d,e);
    document.getElementById('v16Clarify').onclick=()=>{document.getElementById('v16Correction').innerHTML=`<div class="dx12-inline"><textarea id="v16Clarification" placeholder="What should Cevren understand differently?"></textarea><button id="v16Update">Update my decision</button></div>`;document.getElementById('v16Update').onclick=()=>{const v=document.getElementById('v16Clarification').value.trim();if(!v)return;d.question=v;d.userContext=[];d.engineState=null;save();interpret(d);};};
  }

  function userGaps(e){return (e.material_gaps||[]).filter(g=>g.owner==='USER'&&g.question_for_user);}
  function clinicianGaps(e){return (e.material_gaps||[]).filter(g=>g.owner==='CLINICIAN');}

  function routeFromState(d,e){
    const gaps=userGaps(e);
    if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&gaps.length) return askMaterialContext(d,e,gaps);
    return ready(d,e);
  }

  function askMaterialContext(d,e,gaps){
    const chosen=gaps.slice(0,2);
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">A LITTLE CONTEXT COULD CHANGE THIS DECISION</div><h1>${chosen.length===1?'I need one thing from you before I investigate.':'I need two things from you before I investigate.'}</h1><p class="dx12-lead">I'm asking only because these answers could materially change what I recommend or what I need to do next.</p>${chosen.map((g,i)=>`<div class="card"><div class="dx12-kicker">WHY THIS MATTERS</div><p>${esc(g.why_material)}</p><p><b>${esc(g.question_for_user)}</b></p><textarea class="v16Answer" data-i="${i}" placeholder="Your answer…"></textarea>${g.acquisition==='EXISTING_LABS_OR_RECORDS'?`<p class="meta">If you already have the relevant lab or record, you can enter the result here for this prototype. Secure upload will be a separate data capability.</p>`:''}</div>`).join('')}<div class="dx12-actions"><button id="v16ContextContinue">Continue</button><button class="secondary" id="v16SkipContext">I don't have this information</button></div></section>`;
    document.getElementById('v16ContextContinue').onclick=async()=>{const vals=[...document.querySelectorAll('.v16Answer')].map((x,i)=>({fact:chosen[i].fact,answer:x.value.trim(),source:'USER'})).filter(x=>x.answer);if(!vals.length)return;d.userContext=(d.userContext||[]).concat(vals);save();await reassess(d);};
    document.getElementById('v16SkipContext').onclick=()=>ready(d,e);
  }

  async function reassess(d){
    thinking('Reassessing with the context you added.','Checking whether that information closes uncertainty or changes who owns the next work.');
    try{const e=await callEngine(d,'REASSESS');const gaps=userGaps(e);if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&gaps.length)return askMaterialContext(d,e,gaps);ready(d,e);}catch(err){showError(err,()=>reassess(d));}
  }

  function ready(d,e){
    d.engineState=e;save();
    const cevrenWork=(e.material_gaps||[]).filter(g=>g.owner==='CEVREN');
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">READY TO INVESTIGATE</div><h1>I have enough to move forward.</h1><p class="dx12-lead">I'll evaluate the evidence Cevren owns, apply only the context that matters to you, test what remains uncertain, and determine whether this decision can close.</p>${cevrenWork.length?`<div class="dx12-note"><b>Cevren owns this work.</b><span>${cevrenWork.slice(0,3).map(x=>esc(x.fact)).join(' · ')}</span></div>`:`<div class="dx12-note"><b>I don't need to send you away for more research.</b><span>If something remains unresolved after this step, I'll tell you exactly what it is and who actually needs to resolve it.</span></div>`}<div class="dx12-actions"><button id="v16Investigate">Let Cevren investigate</button></div></section>`;
    document.getElementById('v16Investigate').onclick=()=>journey(d);
  }

  function journey(d){
    const stages=['Separating the decision claims','Evaluating benefits and harms','Checking the context that matters to you','Testing unresolved uncertainty','Determining whether the decision can close'];
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN IS INVESTIGATING</div><h1>Working through the decision.</h1><p class="dx12-lead">I'll show you where I am without making you operate the machinery underneath.</p><div class="dx12-journey">${stages.map(x=>`<div class="dx12-step"><span>○</span><b>${esc(x)}</b></div>`).join('')}</div><div class="dx12-live">Beginning…</div></section>`;
    let i=0;const tick=()=>{const els=[...document.querySelectorAll('.dx12-step')];els.forEach((el,n)=>{el.className='dx12-step '+(n<i?'done':n===i?'active':'');el.querySelector('span').textContent=n<i?'✓':n===i?'●':'○';});document.querySelector('.dx12-live').textContent=stages[i]+'…';if(i<stages.length-1){i++;setTimeout(tick,650)}else setTimeout(()=>finishInvestigation(d),700);};setTimeout(tick,180);
  }

  async function finishInvestigation(d){
    thinking('Building Cevren's position.','Turning the evidence and your relevant context into the strongest responsible next action.');
    try{const e=await callEngine(d,'REASSESS');showDecision(d,e);}catch(err){showError(err,()=>finishInvestigation(d));}
  }

  function showDecision(d,e){
    if(e.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&userGaps(e).length) return askMaterialContext(d,e,userGaps(e));
    if(e.decision_state==='OPEN_CLINICAL_INPUT_NEEDED') return showClinical(d,e);
    const closed=e.decision_state.startsWith('CLOSE_');
    const stateLabel=e.decision_state==='CLOSE_RECOMMEND_FOR'?'RECOMMEND':e.decision_state==='CLOSE_RECOMMEND_AGAINST'?'RECOMMEND AGAINST':'DECISION STILL OPEN';
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">INVESTIGATION COMPLETE · ${closed?'DECISION CAN CLOSE':'DECISION REMAINS OPEN'}</div><h1>Here's where Cevren lands.</h1><div class="dx13-position"><div class="dx12-kicker">CEVREN'S CURRENT POSITION</div><h2>${esc(e.position)}</h2></div>${e.recommendation?`<div class="dx13-section"><h3>What I'd do</h3><p>${esc(e.recommendation)}</p></div>`:''}<div class="dx13-section"><h3>Why</h3>${(e.evidence_assessment.supports||[]).slice(0,3).map(x=>`<p>✓ ${esc(x)}</p>`).join('')}${(e.evidence_assessment.cautions||[]).slice(0,2).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><div class="dx13-section"><h3>What matters because it's you</h3><p>${esc(e.personalization)}</p></div>${e.what_to_expect?`<div class="dx13-section"><h3>What to expect</h3><p>${esc(e.what_to_expect)}</p></div>`:''}<div class="dx13-blocker"><div class="dx12-kicker">WHAT WOULD CHANGE THIS</div><p>${esc(e.what_would_change)}</p></div>${e.safety_note?`<div class="card"><div class="dx12-kicker">SAFETY NOTE</div><p>${esc(e.safety_note)}</p></div>`:''}<div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>${esc(e.next_action)}</h2>${closed?`<button id="v16Resolve">Mark decision resolved</button>`:`<button id="v16Keep">Keep this decision open</button>`}</div><details class="dx12-details"><summary>See Cevren's evidence and uncertainty</summary><div class="dx13-evidence"><p><b>Evidence strength:</b> ${esc(e.evidence_assessment.evidence_strength)} · <b>Confidence:</b> ${esc(e.confidence)}</p>${(e.evidence_assessment.uncertainty||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')}<p class="meta"><b>Prototype evidence basis:</b> ${esc(e.evidence_assessment.basis)}. This is not a live verified literature retrieval layer.</p></div></details></section>`;
    if(closed)document.getElementById('v16Resolve').onclick=()=>{d.status='RESOLVED';d.resolvedAt=new Date().toISOString();save();fresh();};else document.getElementById('v16Keep').onclick=()=>{d.status='OPEN';save();fresh();};
  }

  function showClinical(d,e){
    const qs=(e.clinician_questions||[]).slice(0,4);
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">INVESTIGATION COMPLETE · CLINICAL INPUT NEEDED</div><h1>Cevren has taken this as far as it responsibly can alone.</h1><div class="dx13-position"><h2>${esc(e.position)}</h2><p>${esc(e.personalization)}</p></div><div class="dx13-section"><h3>Why a clinician belongs in this decision</h3><p>${esc(e.next_action)}</p></div>${clinicianGaps(e).length?`<div class="dx13-section"><h3>The specific thing Cevren cannot resolve alone</h3>${clinicianGaps(e).map(g=>`<p>• ${esc(g.fact)} — ${esc(g.why_material)}</p>`).join('')}</div>`:''}<div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>Take only the questions that matter.</h2><button id="v16Clinician">Prepare my clinician questions</button></div><details class="dx12-details"><summary>See Cevren's evidence and uncertainty</summary><p class="meta">Evidence basis: ${esc(e.evidence_assessment.basis)} · strength: ${esc(e.evidence_assessment.evidence_strength)} · confidence: ${esc(e.confidence)}</p></details></section>`;
    document.getElementById('v16Clinician').onclick=()=>showQuestions(d,e,qs);
  }

  function showQuestions(d,e,qs){
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">YOUR NEXT CONVERSATION</div><h1>Take these questions with you.</h1><p class="dx12-lead">These come from the unresolved part of this decision—not from a generic checklist.</p><div class="dx12-questions">${qs.map((q,i)=>`<div><span>${i+1}</span><p>${esc(q)}</p></div>`).join('')}</div><div class="dx12-next"><h2>Then bring the answers back.</h2><p>Cevren will integrate them into this same decision and reassess rather than starting over.</p><div class="dx12-actions"><button id="v16AddClinician">Add clinician input</button><button class="secondary" id="v16Print">Print / Save questions</button></div></div><button class="secondary" id="v16Leave">Leave this decision open</button></section>`;
    document.getElementById('v16AddClinician').onclick=()=>collectClinician(d);
    document.getElementById('v16Print').onclick=()=>printQuestions(e,qs);
    document.getElementById('v16Leave').onclick=fresh;
  }

  function collectClinician(d){
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CONTINUE THIS DECISION</div><h1>What did your clinician add?</h1><p class="dx12-lead">Tell Cevren in your own words. I'll integrate it into this same decision and reassess.</p><textarea id="v16ClinicianInput" placeholder="My clinician said…"></textarea><div class="dx12-actions"><button id="v16IntegrateClinician">Integrate and reassess</button></div></section>`;
    document.getElementById('v16IntegrateClinician').onclick=()=>{const v=document.getElementById('v16ClinicianInput').value.trim();if(!v)return;d.userContext=(d.userContext||[]).concat([{fact:'clinician input',answer:v,source:'CLINICIAN_REPORTED_BY_USER'}]);save();reassess(d);};
  }

  function printQuestions(e,qs){const w=window.open('','_blank');if(!w)return;w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cevren clinician questions</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:48px auto;color:#111;line-height:1.45}h1{font-size:30px}.brand{font-size:13px;font-weight:800;letter-spacing:.18em}.position{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:18px 0;margin:22px 0}.q{margin:24px 0}.q b{display:block;margin-bottom:8px}.notes{height:72px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 23px,#ddd 24px)}.foot{margin-top:34px;font-size:12px;color:#666}</style></head><body><div class="brand">CEVREN</div><h1>Questions for my clinician</h1><div class="position"><b>Cevren's current position</b><br>${esc(e.position)}</div>${qs.map((q,i)=>`<div class="q"><b>${i+1}. ${esc(q)}</b><div class="notes"></div></div>`).join('')}<div class="foot">Bring the answers back to Cevren to continue the same decision.</div><script>window.onload=()=>window.print();<\/script></body></html>`);w.document.close();}

  function showError(err,retry){main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN DECISION ENGINE</div><h1>I couldn't complete that step.</h1><p class="error">${esc(err.message||err)}</p><div class="dx12-actions"><button id="v16Retry">Try again</button><button class="secondary" id="v16New">New question</button></div></section>`;document.getElementById('v16Retry').onclick=retry;document.getElementById('v16New').onclick=fresh;}

  window.cevrenFreshDecisionV16=fresh;
  const reset=document.getElementById('resetBtn');if(reset)reset.onclick=fresh;
  setTimeout(fresh,20);
})();
