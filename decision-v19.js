// Cevren v0.19 — decision ending architecture
// Closed decisions distinguish evidence resolution from user readiness.
(function(){
  const baseDecision=decision;
  const esc19=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function current(){return (S.decisions||[]).find(x=>x.id===S.currentDecision)}
  function closed(d){return !!d?.engineState?.decision_state?.startsWith('CLOSE_')}
  function alternativesRemain(e){
    const a=e?.alternatives_remaining;
    if(typeof a==='boolean')return a;
    if(Array.isArray(a))return a.length>0;
    return false;
  }
  function addDecisionContext(d,text){
    d.decisionContext=d.decisionContext||[];
    d.decisionContext.push({type:'READINESS_BARRIER',statement:text,at:new Date().toISOString()});
    d.userContext=d.userContext||[];
    d.userContext.push({fact:'decision readiness / barrier',answer:text,source:'USER'});
  }
  function finish(d,status){d.status=status;d.resolvedAt=new Date().toISOString();save();S.currentDecision=null;S.stage='home';save();render()}

  decision=function(){
    baseDecision();
    const d=current();
    if(!d||!closed(d))return;
    // v0.18 renders asynchronously while investigating; only modify a completed result screen.
    const next=document.querySelector('.dx12-next');
    if(!next||!next.querySelector('#v18Resolve'))return;
    const e=d.engineState||{};
    const canExplore=alternativesRemain(e);
    next.innerHTML=`<div class="dx12-kicker">NEXT STEP</div><h2>This decision can close.</h2><p class="muted">Cevren's evidence judgment and your readiness to act are separate. You do not have to agree with the recommendation to close the investigation.</p><div class="dx12-actions"><button id="v19Resolve">Accept this path</button><button class="secondary" id="v19NotReady">I'm not ready to act</button>${canExplore?'<button class="secondary" id="v19Explore">Explore another viable path</button>':''}</div><div id="v19Readiness"></div>`;

    document.getElementById('v19Resolve').onclick=()=>finish(d,'RESOLVED');
    document.getElementById('v19NotReady').onclick=()=>{
      document.getElementById('v19Readiness').innerHTML=`<div class="card" style="margin-top:16px"><div class="dx12-kicker">HELP CEVREN UNDERSTAND THE DECISION</div><h3>What is keeping you from acting on this recommendation?</h3><p class="muted">This will be remembered as decision context. It will not change Cevren's evidence judgment simply because you disagree.</p><textarea id="v19Barrier" placeholder="Tell Cevren what's holding you back…"></textarea><div class="dx12-actions"><button id="v19SaveBarrier">Save my decision</button></div></div>`;
      document.getElementById('v19SaveBarrier').onclick=()=>{
        const v=document.getElementById('v19Barrier').value.trim();
        if(!v)return;
        addDecisionContext(d,v);
        d.userDecision='NOT_READY_TO_ACT';
        d.cevrenPosition=e.position||'';
        finish(d,'DEFERRED');
      };
    };
    if(canExplore){
      document.getElementById('v19Explore').onclick=()=>{
        const prior=e?.interpretation?.goals?.[0]||'the outcome I wanted';
        const q=`Given the goal from my previous decision — ${prior} — investigate the remaining materially different evidence-supported path.`;
        const nd={id:crypto.randomUUID(),question:q,originalQuestion:q,clarifications:[],status:'OPEN',created:new Date().toISOString(),engineHistory:[],userContext:[{fact:'prior decision context',answer:`Previous decision: ${d.originalQuestion}. Cevren position: ${e.position}`,source:'CEVREN'}]};
        S.decisions.unshift(nd);S.currentDecision=nd.id;save();
        // Let the v0.18 experience layer interpret the new decision through its normal New Question path.
        S.stage='home';save();render();
      };
    }
  };

  render();
})();
