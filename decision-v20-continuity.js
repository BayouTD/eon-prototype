// Cevren v0.20 — continuity layer
// Persists active decision state across refreshes and injects known user context into every engine call.
(function(){
  const API='https://eon-prototype-production.up.railway.app';
  const main=()=>document.getElementById('main');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const rawSave=save;
  const rawFetch=window.fetch.bind(window);

  function activeDecision(){return (S.decisions||[]).find(d=>d.id===S.currentDecision)||null}
  function profileFacts(){
    const out=[];
    for(const [k,v] of Object.entries(S.answers||{})){
      const answer=String(v||'').trim();
      if(answer)out.push({fact:`known profile context — ${k}`,answer,source:'CEVREN_PROFILE'});
    }
    const h=S.healthContext||{};
    if(h.protocols)out.push({fact:'known health context — current protocols',answer:h.protocols,source:'CEVREN_PROFILE'});
    if(h.important)out.push({fact:'known health context — user-marked important context',answer:h.important,source:'CEVREN_PROFILE'});
    return out;
  }
  function dedupeContext(items){
    const seen=new Set();
    return (items||[]).filter(x=>{
      const key=`${String(x.fact||'').toLowerCase()}|${String(x.answer||'').toLowerCase()}`;
      if(seen.has(key))return false;seen.add(key);return true;
    });
  }
  function checkpoint(d,name){
    if(!d)return;
    d.session=d.session||{};
    d.session.checkpoint=name;
    d.session.updatedAt=new Date().toISOString();
    d.session.version='0.20';
  }

  // Make an active decision a real persisted application state, not just a transient screen.
  save=function(){
    const d=activeDecision();
    if(d&&d.status==='OPEN'){
      S.stage='decision';
      d.session=d.session||{};
      d.session.updatedAt=new Date().toISOString();
      d.session.version='0.20';
    }
    rawSave();
  };

  // Bridge the persistent Human Model/onboarding context into every generalized engine packet.
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    let nextInit=init;
    if(url.includes('/api/decision-engine')&&init?.body){
      try{
        const body=JSON.parse(init.body);
        const d=activeDecision();
        const known=profileFacts();
        body.userContext=dedupeContext([...(body.userContext||[]),...known]);
        body.humanModel=[...(body.humanModel||[]),...known.map(x=>({domain:'persistent_profile_context',statement:`${x.fact}: ${x.answer}`,allowed_adaptation:'Use this known fact when it is materially relevant; do not ask the user to repeat it.',confidence:'verified'}))];
        if(d){
          checkpoint(d,body.phase==='INVESTIGATE'?'INVESTIGATING':body.phase==='REASSESS'?'REASSESSING':'INTERPRETING');
          S.stage='decision';
          rawSave();
        }
        nextInit={...init,body:JSON.stringify(body)};
      }catch(_e){}
    }
    return rawFetch(input,nextInit);
  };

  async function engineCall(d,phase){
    checkpoint(d,phase==='INVESTIGATE'?'INVESTIGATING':'REASSESSING');save();
    const r=await fetch(`${API}/api/decision-engine`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      question:d.originalQuestion||d.question,
      clarifications:d.clarifications||[],
      phase,
      humanModel:(S.humanModel?.understandings||[]),
      healthContext:S.healthContext||{},
      userContext:d.userContext||[],
      priorState:d.engineState||null
    })});
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.detail||j.error||`HTTP ${r.status}`);
    d.engineState=j.engine;
    d.engineHistory=d.engineHistory||[];
    d.engineHistory.push({phase,at:new Date().toISOString(),state:j.engine});
    checkpoint(d,phase==='INVESTIGATE'?'INVESTIGATION_COMPLETE':'ENGINE_STATE_SAVED');
    save();
    return j.engine;
  }

  function gaps(e){return (e?.material_gaps||[]).filter(g=>g.owner==='USER'&&g.question_for_user)}
  function closed(e){return !!e?.decision_state?.startsWith('CLOSE_')}

  function renderResumeContext(d,e){
    const gs=gaps(e).slice(0,2);
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CONTINUE YOUR DECISION</div><h1>You're right where you left off.</h1><p class="dx12-lead">Cevren kept the decision and the context already gathered. Only the remaining material question${gs.length===1?'':'s'} are shown.</p>${gs.map((g,i)=>`<div class="card"><div class="dx12-kicker">WHY THIS MATTERS</div><p>${esc(g.why_material)}</p><p><b>${esc(g.question_for_user)}</b></p><textarea class="v20Answer" data-i="${i}" placeholder="Your answer…"></textarea></div>`).join('')}<div class="dx12-actions"><button id="v20Continue">Continue this decision</button></div></section>`;
    document.getElementById('v20Continue').onclick=async()=>{
      const vals=[...document.querySelectorAll('.v20Answer')].map((x,i)=>({fact:gs[i].fact,answer:x.value.trim(),source:'USER'})).filter(x=>x.answer);
      if(!vals.length)return;
      d.userContext=dedupeContext([...(d.userContext||[]),...vals]);
      checkpoint(d,'CONTEXT_GATHERED');save();
      renderWorking('Reassessing with the context you added.');
      try{const next=await engineCall(d,'REASSESS');routeRecovered(d,next)}catch(err){renderError(d,err)}
    };
  }

  function renderWorking(title='Continuing your decision.'){
    main().innerHTML=`<section class="dx12"><div class="thinking"><div class="spinner"></div><div class="dx12-kicker">CEVREN DECISION ENGINE</div><h1>${esc(title)}</h1><p class="dx12-lead">Your prior work is preserved. Cevren is continuing from the last saved decision state.</p></div></section>`;
  }

  function renderReady(d,e){
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">DECISION RESTORED</div><h1>I have enough to continue.</h1><p class="dx12-lead">This decision survived the refresh. Cevren still has the interpretation, the context you supplied, and the current engine state.</p><div class="dx12-note"><b>Nothing needs to be re-entered.</b><span>Continue from the investigation step.</span></div><div class="dx12-actions"><button id="v20Investigate">Continue investigation</button></div></section>`;
    document.getElementById('v20Investigate').onclick=async()=>{
      renderWorking('Working through the decision.');
      try{renderRecoveredResult(d,await engineCall(d,'INVESTIGATE'))}catch(err){renderError(d,err)}
    };
  }

  function renderRecoveredResult(d,e){
    const why=[...(e.evidence_assessment?.supports||[]).slice(0,1),...(e.evidence_assessment?.cautions||[]).slice(0,1)].join(' ');
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">INVESTIGATION ${closed(e)?'COMPLETE · DECISION CAN CLOSE':'RESTORED · DECISION REMAINS OPEN'}</div><h1>Here's where Cevren lands.</h1><div class="dx13-position"><div class="dx12-kicker">CEVREN'S POSITION</div><h2>${esc(e.position||'The decision remains open.')}</h2></div>${why?`<div class="dx13-section"><h3>Why</h3><p>${esc(why)}</p></div>`:''}<div class="dx13-section"><h3>What matters because it's you</h3><p>${esc(e.personalization||'Only context that materially affects this decision was applied.')}</p></div><div class="dx13-blocker"><div class="dx12-kicker">WHAT WOULD CHANGE THIS</div><p>${esc(e.what_would_change||'New material evidence or context could reopen the decision.')}</p></div><div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>${closed(e)?'This decision can close.':esc(e.next_action||'Keep this decision open.')}</h2><div class="dx12-actions">${closed(e)?'<button id="v20Resolve">Accept this path</button>':'<button id="v20Keep">Keep this decision open</button>'}</div></div></section>`;
    if(closed(e))document.getElementById('v20Resolve').onclick=()=>{d.status='RESOLVED';d.resolvedAt=new Date().toISOString();S.currentDecision=null;S.stage='home';rawSave();window.cevrenFreshDecisionV18?.()};
    else document.getElementById('v20Keep').onclick=()=>{checkpoint(d,'OPEN_WAITING');save()};
  }

  function renderError(d,err){
    checkpoint(d,'ERROR_RETRYABLE');save();
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">YOUR DECISION IS SAFE</div><h1>Cevren couldn't complete that step.</h1><p class="error">${esc(err?.message||err)}</p><p class="dx12-lead">The decision and everything you've already supplied are still saved. Refreshing will not erase this work.</p><div class="dx12-actions"><button id="v20Retry">Resume decision</button></div></section>`;
    document.getElementById('v20Retry').onclick=()=>resumeActiveDecision();
  }

  function routeRecovered(d,e){
    if(e?.decision_state==='OPEN_USER_CONTEXT_NEEDED'&&gaps(e).length)return renderResumeContext(d,e);
    if(closed(e)||e?.decision_state==='OPEN_CLINICAL_INPUT_NEEDED'||e?.decision_state==='OPEN_EVIDENCE_INSUFFICIENT')return renderRecoveredResult(d,e);
    renderReady(d,e);
  }

  function resumeActiveDecision(){
    const d=activeDecision();
    if(!d||d.status!=='OPEN')return;
    S.stage='decision';rawSave();
    const e=d.engineState;
    if(!e){
      main().innerHTML=`<section class="dx12"><div class="dx12-kicker">DECISION RESTORED</div><h1>Your question is still here.</h1><p class="dx12-lead">Cevren had not yet saved an engine state, so the safest recovery is to restart only the interpretation—not the whole decision.</p><div class="dx12-actions"><button id="v20Restart">Resume interpretation</button></div></section>`;
      document.getElementById('v20Restart').onclick=async()=>{renderWorking('Understanding your decision.');try{routeRecovered(d,await engineCall(d,'INTERPRET'))}catch(err){renderError(d,err)}};
      return;
    }
    routeRecovered(d,e);
  }

  // Record checkpoints from the existing v0.18 UI without changing its normal experience.
  document.addEventListener('click',ev=>{
    const id=ev.target?.id||'';
    setTimeout(()=>{
      const d=activeDecision();if(!d)return;
      const map={v18Start:'QUESTION_SAVED',v18Confirm:'INTERPRETATION_CONFIRMED',v18ContextContinue:'CONTEXT_GATHERED',v18Investigate:'INVESTIGATING'};
      if(map[id]){checkpoint(d,map[id]);save()}
    },0);
  });

  // v0.18 intentionally paints a fresh-question screen 100ms after load. Replace that
  // only when an unfinished persisted decision exists.
  setTimeout(()=>{
    const d=activeDecision();
    if(d&&d.status==='OPEN')resumeActiveDecision();
  },180);
})();
