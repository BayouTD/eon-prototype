// Cevren v0.21 — durable continuity + reusable profile memory
// Adds a second persistence rail for the active decision, preserves user/account context across decisions,
// and makes “New question” start a new decision without erasing the user model.
(function(){
  const SNAP='cevren_active_decision_v21';
  const rawSave=save;
  const rawFetch=window.fetch.bind(window);

  const now=()=>new Date().toISOString();
  const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
  const active=()=> (S.decisions||[]).find(d=>d.id===S.currentDecision)||null;

  function ensureMemory(){
    S.profileMemory=Array.isArray(S.profileMemory)?S.profileMemory:[];
    return S.profileMemory;
  }

  function remember(fact,answer,meta={}){
    fact=String(fact||'').trim(); answer=String(answer||'').trim();
    if(!fact||!answer||/prior decision context/i.test(fact))return;
    const mem=ensureMemory();
    const key=norm(fact);
    const item={fact,answer,source:'CEVREN_PROFILE_MEMORY',updatedAt:now(),...meta};
    const i=mem.findIndex(x=>norm(x.fact)===key);
    if(i>=0)mem[i]=item; else mem.push(item);
    if(mem.length>80)S.profileMemory=mem.slice(-80);
  }

  function promoteUserFacts(){
    for(const d of (S.decisions||[])){
      for(const x of (d.userContext||[])){
        if(String(x.source||'USER').toUpperCase()==='USER'&&x.answer){
          remember(x.fact||'user supplied context',x.answer,{decisionId:d.id});
        }
      }
    }
  }

  function snapshot(){
    promoteUserFacts();
    const d=active();
    try{
      if(d&&d.status==='OPEN'){
        localStorage.setItem(SNAP,JSON.stringify({
          version:'0.21',savedAt:now(),currentDecision:d.id,decision:d,
          profileMemory:ensureMemory(),answers:S.answers||{},healthContext:S.healthContext||{},
          humanModel:S.humanModel||null
        }));
      }else{
        localStorage.removeItem(SNAP);
      }
    }catch(_e){}
  }

  function recover(){
    let snap=null;
    try{snap=JSON.parse(localStorage.getItem(SNAP)||'null')}catch(_e){}
    if(!snap?.decision||snap.decision.status!=='OPEN')return;
    S.decisions=Array.isArray(S.decisions)?S.decisions:[];
    const i=S.decisions.findIndex(d=>d.id===snap.decision.id);
    if(i>=0)S.decisions[i]={...S.decisions[i],...snap.decision}; else S.decisions.unshift(snap.decision);
    S.currentDecision=snap.currentDecision||snap.decision.id;
    S.stage='decision';
    if((!S.answers||!Object.values(S.answers).some(Boolean))&&snap.answers)S.answers=snap.answers;
    if((!S.healthContext||!Object.keys(S.healthContext).length)&&snap.healthContext)S.healthContext=snap.healthContext;
    if(!S.humanModel&&snap.humanModel)S.humanModel=snap.humanModel;
    S.profileMemory=Array.isArray(S.profileMemory)&&S.profileMemory.length?S.profileMemory:(snap.profileMemory||[]);
    try{rawSave()}catch(_e){}
  }

  // Recover immediately, before the v0.20 delayed resume check runs.
  recover();

  // Every existing save now also writes the durable active-decision snapshot and promotes reusable facts.
  save=function(){
    promoteUserFacts();
    rawSave();
    snapshot();
  };

  // Add durable profile memory to every decision-engine request.
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    let next=init;
    if(url.includes('/api/decision-engine')&&init?.body){
      try{
        promoteUserFacts();
        const body=JSON.parse(init.body);
        const mem=ensureMemory().map(x=>({fact:`known reusable user context — ${x.fact}`,answer:x.answer,source:'CEVREN_PROFILE'}));
        const seen=new Set();
        body.userContext=[...(body.userContext||[]),...mem].filter(x=>{
          const k=`${norm(x.fact)}|${norm(x.answer)}`; if(seen.has(k))return false; seen.add(k); return true;
        });
        body.humanModel=[...(body.humanModel||[]),...mem.map(x=>({
          domain:'persistent_profile_context',
          statement:`${x.fact}: ${x.answer}`,
          allowed_adaptation:'Use this already-known fact when materially relevant. Do not ask the user to repeat it unless it is contradictory, stale, or genuinely uncertain.',
          prohibited_use:'Do not let personal context alter evidence quality, truth, or safety thresholds.',
          confidence:'verified'
        }))];
        next={...init,body:JSON.stringify(body)};
      }catch(_e){}
    }
    return rawFetch(input,next);
  };

  // “New question” should never mean “erase my account.” It only exits the current decision.
  const reset=document.getElementById('resetBtn');
  if(reset){
    reset.onclick=(ev)=>{
      ev?.preventDefault?.();
      S.currentDecision=null;
      S.stage='home';
      try{rawSave()}catch(_e){}
      try{localStorage.removeItem(SNAP)}catch(_e){}
      location.reload();
    };
  }

  // Capture context immediately after existing UI handlers append it.
  document.addEventListener('click',()=>setTimeout(()=>{promoteUserFacts();snapshot()},25),true);
  window.addEventListener('pagehide',snapshot);
  window.addEventListener('beforeunload',snapshot);
})();
