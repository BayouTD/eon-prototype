// Cevren v0.11 — Decision Journey
// A human-readable view of real decision stages without exposing internal machinery.

function cevrenJourneyV11(d){
  const r=cevrenEvidenceResponsibility(d);
  const topic=(d.latest_user_context||[])[0]||'your decision';
  const stages=[
    ['Understanding the decision',`Clarifying what you are considering and the outcome you want.`],
    ['Sourcing relevant evidence',r.cevren.length?`Finding the evidence Cevren owns for this decision.`:`Checking the evidence relevant to ${topic}.`],
    ['Checking safety and uncertainty','Separating what is known, what is uncertain, and what requires clinical judgment.'],
    ['Integrating your context','Applying only the personal context that is relevant to this decision.'],
    ['Building the conclusion','Determining what Cevren can responsibly conclude and what should happen next.']
  ];
  return `<section class="journey-v11"><div class="service-status">CEVREN IS INVESTIGATING</div><h1>Working through this with you.</h1><p class="service-lead">You do not need to sort through the research. Cevren will do the work it owns and show you where the decision stands.</p><div class="journey-list">${stages.map((s,i)=>`<div class="journey-step ${i===0?'active':''}" data-step="${i}"><div class="journey-mark">${i===0?'●':'○'}</div><div><b>${esc(s[0])}</b><p>${esc(s[1])}</p></div></div>`).join('')}</div><div class="journey-live" id="journeyLive">Beginning investigation…</div></section>`;
}

function cevrenStartJourneyV11(d){
  const main=document.getElementById('main');
  if(!main)return;
  d.journeyRunning=true; save();
  main.innerHTML=cevrenJourneyV11(d);
  const messages=['Understanding your decision…','Sourcing relevant evidence…','Checking safety and uncertainty…','Integrating what Cevren knows about you…','Building a conclusion…'];
  let i=0;
  const advance=()=>{
    const steps=[...document.querySelectorAll('.journey-step')];
    steps.forEach((el,n)=>{
      el.classList.toggle('active',n===i);
      el.classList.toggle('complete',n<i);
      el.querySelector('.journey-mark').textContent=n<i?'✓':n===i?'●':'○';
    });
    const live=document.getElementById('journeyLive'); if(live)live.textContent=messages[i];
    if(i<steps.length-1){i++;setTimeout(advance,850)}
    else setTimeout(()=>{
      d.journeyRunning=false;
      d.journeyComplete=true;
      d.supportMode='';
      save();
      decision();
    },1000);
  };
  setTimeout(advance,250);
}

function cevrenJourneyResultV11(d){
  if(!d.journeyComplete)return;
  const surface=document.querySelector('.service-surface-v10');
  if(!surface)return;
  const r=cevrenEvidenceResponsibility(d);
  const status=surface.querySelector('.service-status'); if(status)status.textContent='INVESTIGATION COMPLETE';
  const h=surface.querySelector('h1'); if(h)h.textContent=d.action==='ESCALATE'?'Here’s where the decision stands.':'Cevren has reached a conclusion.';
  const lead=surface.querySelector('.service-lead');
  if(lead)lead.textContent=d.action==='ESCALATE'?'Cevren has completed the work it can at this stage. The remaining question requires information or judgment Cevren should not pretend to supply.':'Cevren has completed this investigation and can now guide the next step.';
  const research=surface.querySelector('.service-item');
  if(research&&research.querySelector('b')?.textContent==='Cevren will investigate'){
    research.querySelector('b').textContent='What Cevren investigated';
  }
  const btn=document.getElementById('v10Investigate'); if(btn)btn.remove();
  if(d.action==='ESCALATE'){
    const primary=surface.querySelector('.service-primary');
    if(primary&&!primary.querySelector('#v11Next')){
      primary.innerHTML='<button id="v11Next">Continue to the next step</button>';
      document.getElementById('v11Next').onclick=()=>{
        d.supportMode='CLINICIAN_PREP';save();decision();
        setTimeout(()=>{const details=document.querySelector('.service-details');if(details)details.open=true;document.querySelector('.support-card')?.scrollIntoView({behavior:'smooth',block:'start'});},60);
      };
    }
  }
}

const cevrenV11BaseApply=cevrenApplyServiceSurfaceV10;
cevrenApplyServiceSurfaceV10=function(){
  cevrenV11BaseApply();
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(!d)return;
  const investigate=document.getElementById('v10Investigate');
  if(investigate)investigate.onclick=()=>cevrenStartJourneyV11(d);
  cevrenJourneyResultV11(d);
};

render();
