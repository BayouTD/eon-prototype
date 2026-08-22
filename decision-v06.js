// Cevren v0.6 — Intelligent Decision Preparation
// Improves escalation preparation without changing the underlying decision judgment.

function cevrenAvailableEvidence(d){
  const text=flattenedDecisionContext(d).join(' ').toLowerCase();
  const assets=[];
  if(/bloodwork|blood work|labs|lab work|laboratory/.test(text)) assets.push('Recent routine bloodwork is available but has not yet been reviewed by Cevren.');
  if(/mri|x-ray|xray|ultrasound|imaging|scan/.test(text)) assets.push('Relevant imaging or diagnostic records may already be available but have not yet been reviewed by Cevren.');
  if(/medication list|supplement list|list of supplements|many supplements|variety of supplements|multiple supplements/.test(text)) assets.push('A complete medication and supplement inventory may reduce uncertainty but has not yet been reviewed in detail.');
  return [...new Set(assets)];
}

function cevrenSpecificQuestions(d){
  const text=`${d.question||''} ${d.contextSummary||''} ${flattenedDecisionContext(d).join(' ')}`.toLowerCase();
  const q=[];
  if(/bpc|tb[- ]?500|peptide/.test(text)) q.push('For my specific recovery and tendon goal, how strong is the human evidence for BPC-157 or TB-500, and what uncertainties matter most before I act?');
  if(/elbow|tendon|tendinitis|tendonitis/.test(text)) q.push('Should the diagnosis and severity of my elbow problem be established more clearly before considering a peptide, and would examination or imaging change the plan?');
  if(/testosterone|hgh|growth hormone/.test(text)) q.push('Does my current testosterone and HGH use change how you assess risk, benefit, interactions, or monitoring for this decision?');
  if(/baclofen|medication|supplement/.test(text)) q.push('Do my baclofen and complete supplement regimen create any interaction, safety, or monitoring concerns relevant to this choice?');
  if(/bloodwork|blood work|labs|laboratory/.test(text)) q.push('Which of my recent labs are actually relevant to this decision, and are there specific values you would want reviewed before I proceed?');
  q.push('What better-supported alternatives could address the same recovery or tendon goal, and what would make you prefer one path over another?');
  return [...new Set(q)].slice(0,6);
}

cevrenPrepTopics=function(d){ return cevrenSpecificQuestions(d); };

cevrenDiscussionBrief=function(d){
  const missing=d.missingEvidence||[];
  const context=d.contextSummary||'Cevren has not yet generated a compact decision summary.';
  const available=cevrenAvailableEvidence(d);
  return `<div class="card support-card"><div class="label">Decision-preparation brief</div><h2>Take Cevren with you.</h2><p>${esc(context)}</p><div class="support-section"><b>Why another clinician belongs in this decision</b><p>${esc(d.reason||'Cevren has reached a boundary where qualified human review is warranted.')}</p></div>${available.length?`<div class="support-section"><b>Evidence you may already have</b>${available.map(x=>`<p>• ${esc(x)}</p>`).join('')}<div class="row"><button class="secondary" id="briefAddContext">Add labs or health information</button></div></div>`:''}${missing.length?`<div class="support-section"><b>What still needs resolution</b>${missing.map(x=>`<p>• ${esc(x)}</p>`).join('')}</div>`:''}<div class="support-section"><b>Questions worth bringing</b>${cevrenSpecificQuestions(d).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><p class="meta">This brief organizes the decision. It does not replace a clinician or convert uncertain evidence into a recommendation.</p></div>`;
};

// Wrap v0.5 decision rendering so v0.6 can wire actions inside the intelligent brief.
const cevrenV06Decision=decision;
decision=function(){
  cevrenV06Decision();
  const d=S.decisions.find(x=>x.id===S.currentDecision);
  const add=document.getElementById('briefAddContext');
  if(add&&d){
    add.onclick=()=>{S.returnToDecision=d.id;S.stage='context';save();render()};
  }
};

render();
