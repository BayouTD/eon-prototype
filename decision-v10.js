// Cevren v0.10 — Service Surface
// Keep the decision engine intact; expose only what the user needs now.

function cevrenServiceSurfaceV10(d){
  const r=typeof cevrenEvidenceResponsibility==='function'
    ? cevrenEvidenceResponsibility(d)
    : {cevren:[],user:[],clinician:[],irreducible:[]};
  const isEscalate=d.action==='ESCALATE';
  const isAsk=d.action==='ASK'||String(d.action||'').startsWith('ASK');
  const latest=(d.evidenceHistory||[]).at(-1)?.resolution;

  let title='Cevren is working through this decision.';
  let lead=d.reason||'Cevren is determining what matters and what should happen next.';
  let status='IN PROGRESS';
  if(isEscalate){
    title='Cevren isn’t ready to recommend this yet.';
    status='NEEDS REVIEW';
    lead='There are still important questions to resolve before Cevren can support a stronger recommendation. Cevren will handle the research it can; a clinician should participate where examination, diagnosis, or clinical judgment is required.';
  }else if(isAsk){
    title='Cevren needs one more thing from you.';
    status='NEEDS CONTEXT';
    lead='A small amount of personal context could materially change the decision. Cevren will ask only for what it cannot responsibly determine on its own.';
  }else if(d.action==='RECOMMEND'){
    title='Cevren has enough to guide this decision.';
    status='READY';
  }

  const research=r.cevren.length?`<div class="service-item"><b>Cevren will investigate</b><p>${esc(r.cevren.slice(0,2).join(' '))}</p></div>`:'';
  const clinician=r.clinician.length?`<div class="service-item"><b>A clinician may need to help with</b><p>${esc(r.clinician.slice(0,2).join(' '))}</p></div>`:'';
  const user=r.user.length?`<div class="service-item"><b>What Cevren may need from you</b><p>${esc(r.user.slice(0,2).join(' '))}</p></div>`:'';
  const changed=latest?`<div class="service-item"><b>What changed</b><p>${esc(latest.evidence_summary||latest.next_action_reason||'New evidence was added to the decision.')}</p></div>`:'';

  let primary='';
  if(isAsk) primary='<button id="v10Continue">Continue</button>';
  else if(isEscalate) primary='<button id="v10Prep">Prepare for clinician</button>';
  else primary='<button id="v10Back">Back home</button>';

  return `<section class="service-surface-v10">
    <div class="service-status">${esc(status)}</div>
    <h1>${esc(title)}</h1>
    <p class="service-lead">${esc(lead)}</p>
    <div class="service-next">${changed}${research}${clinician}${user}</div>
    <div class="row service-primary">${primary}</div>
    <details class="card service-details"><summary><b>See why Cevren reached this point</b></summary><div id="v10Internal"></div></details>
  </section>`;
}

function cevrenApplyServiceSurfaceV10(){
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(!d||d.reassessing||d.evidenceResolving)return;
  const main=document.getElementById('main');
  if(!main||main.querySelector('.service-surface-v10'))return;

  // Preserve the complete prior architecture, but move it behind one transparency disclosure.
  const holding=document.createElement('div');
  holding.className='v10-internal-holding';
  while(main.firstChild) holding.appendChild(main.firstChild);
  main.innerHTML=cevrenServiceSurfaceV10(d);
  const internal=document.getElementById('v10Internal');
  if(internal) internal.appendChild(holding);

  const prep=document.getElementById('v10Prep');
  if(prep)prep.onclick=()=>{
    d.supportMode='CLINICIAN_PREP';save();decision();
    setTimeout(()=>{
      const details=document.querySelector('.service-details');
      if(details)details.open=true;
      document.querySelector('.support-card')?.scrollIntoView({behavior:'smooth',block:'start'});
    },60);
  };
  const back=document.getElementById('v10Back');
  if(back)back.onclick=()=>{S.stage='home';save();render()};
  const cont=document.getElementById('v10Continue');
  if(cont)cont.onclick=()=>{
    const details=document.querySelector('.service-details');
    if(details){details.open=true;setTimeout(()=>details.querySelector('.askanswer')?.focus(),30)}
  };
}

const cevrenV10BaseDecision=decision;
decision=function(){
  cevrenV10BaseDecision();
  cevrenApplyServiceSurfaceV10();
};

render();
