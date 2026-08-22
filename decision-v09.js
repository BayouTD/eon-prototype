// Cevren v0.9 — Evidence Responsibility
// Assigns unresolved work to Cevren, the user, a clinician, or irreducible uncertainty.
// Also compacts development-heavy decision detail behind a disclosure.

function cevrenEvidenceResponsibility(d){
  const items=d.missingEvidence||[];
  const out={cevren:[],user:[],clinician:[],irreducible:[]};
  items.forEach(raw=>{
    const x=String(raw||'');
    const t=x.toLowerCase();
    if(/evidence|efficacy|harms|regulation|regulatory|product quality|source quality|contamination|adulteration|published|study|studies/.test(t)){
      out.cevren.push(x);
    }else if(/diagnosis|severity|clinical management|functional limitation|examination|imaging|treatment response|rehabilitation|monitoring.*clinically|clinician|pharmacist/.test(t)){
      out.clinician.push(x);
    }else if(/lab|blood|medication list|supplement list|history|record|dose|symptom|duration|wearable|protocol/.test(t)){
      out.user.push(x);
    }else{
      out.irreducible.push(x);
    }
  });
  return out;
}

function cevrenResponsibilityCard(d){
  const r=cevrenEvidenceResponsibility(d);
  const section=(label,lead,items,cls='')=>items.length?`<div class="support-section ${cls}"><b>${label}</b><p class="muted">${lead}</p>${items.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:'';
  return `<div class="card responsibility-card"><div class="label">Evidence responsibility</div><h2>Who owns the next work?</h2><p>Cevren should not send you away to collect evidence that Cevren itself should research.</p>${section('Cevren owns the research','General medical evidence belongs on Cevren’s side of the table. In this prototype, these items are queued for the next verified sourcing capability.',r.cevren,'cevren-owned')}${section('You can supply','Personal records or facts only you may have access to.',r.user)}${section('A clinician must resolve','These require examination, diagnosis, professional judgment, or clinical oversight rather than literature retrieval alone.',r.clinician)}${section('May remain uncertain','Some uncertainty cannot honestly be eliminated. Cevren should name it rather than manufacture confidence.',r.irreducible)}${r.cevren.length?`<div class="row"><button class="secondary" id="showResearchQueue">View Cevren’s research queue</button></div>`:''}</div>`;
}

function cevrenResearchQueueCard(d){
  const r=cevrenEvidenceResponsibility(d);
  if(!r.cevren.length)return '';
  return `<div class="card support-card"><div class="label">Cevren research queue</div><h2>This is Cevren’s job.</h2><p>These questions should eventually be resolved by a verified evidence-retrieval and appraisal layer—not by asking you to find studies.</p>${r.cevren.map(x=>`<p>• ${esc(x)}</p>`).join('')}<p class="meta">v0.9 assigns responsibility only. It does not yet claim that Cevren has retrieved or verified these sources.</p></div>`;
}

function cevrenCompactDecisionDetails(){
  const candidates=[...document.querySelectorAll('#main > .card')].filter(card=>{
    const label=card.querySelector('.label')?.textContent?.trim().toLowerCase()||'';
    return label==='what you\'ve told cevren'||label==='cevren\'s current understanding of the decision'||label==='what still limits stronger guidance'||label==='human model context currently permitted';
  });
  if(!candidates.length)return;
  const details=document.createElement('details');
  details.className='card';
  details.innerHTML='<summary><b>Decision context & reasoning</b></summary>';
  const anchor=candidates[0];
  anchor.parentNode.insertBefore(details,anchor);
  candidates.forEach(card=>details.appendChild(card));
}

const cevrenV09BaseDecision=decision;
decision=function(){
  cevrenV09BaseDecision();
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  if(!d||d.evidenceResolving)return;

  const worth=[...document.querySelectorAll('#main > .card')].find(card=>card.querySelector('.label')?.textContent?.trim().toLowerCase()==='decision-worthiness');
  if(worth&&!document.querySelector('.responsibility-card')&&(d.missingEvidence||[]).length){
    const wrap=document.createElement('div');
    wrap.innerHTML=cevrenResponsibilityCard(d);
    const card=wrap.firstElementChild;
    worth.parentNode.insertBefore(card,worth.nextSibling);
    const btn=document.getElementById('showResearchQueue');
    if(btn)btn.onclick=()=>{
      d.supportMode='RESEARCH_QUEUE';save();decision();
      setTimeout(()=>document.querySelector('.research-queue-marker')?.scrollIntoView({behavior:'smooth',block:'start'}),40);
    };
  }

  if(d.supportMode==='RESEARCH_QUEUE'){
    const responsibility=document.querySelector('.responsibility-card');
    if(responsibility){
      const wrap=document.createElement('div');
      wrap.className='research-queue-marker';
      wrap.innerHTML=cevrenResearchQueueCard(d);
      if(wrap.firstElementChild) responsibility.parentNode.insertBefore(wrap,responsibility.nextSibling);
    }
  }

  [...document.querySelectorAll('.evidence-entry-card .muted')].forEach(p=>{
    p.textContent='Describe a relevant lab result, clinician input, imaging finding, or other evidence in your own words. Cevren will treat it as user-supplied—not independently verified.';
  });

  cevrenCompactDecisionDetails();
};

render();
