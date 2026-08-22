// Cevren v0.15 — genuine understanding + context acquisition before escalation
(function(){
  const main=()=>document.getElementById('main');
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const current=()=>S.decisions&&S.decisions.find(x=>x.id===S.currentDecision);

  function classify(q){
    const t=q.toLowerCase();
    if(/creatine/.test(t))return 'creatine';
    if(/tadalafil|cialis|pde5/.test(t))return 'tadalafil';
    return 'general';
  }

  function summarize(q,type){
    if(type==='creatine') return {
      title:'You’re deciding whether daily creatine belongs in your long-term health strategy.',
      detail:'The decision includes three separate questions: whether it meaningfully supports muscle and performance as you age, whether the brain/longevity claims are strong enough to matter, and whether daily long-term use is safe for you.'
    };
    if(type==='tadalafil') return {
      title:'You’re deciding whether daily tadalafil is worth considering for vascular and exercise-related benefits.',
      detail:'The key question is not simply whether tadalafil works, but whether the evidence for circulation or workout benefit is strong enough for your goal and whether your individual cardiovascular and medication context makes daily use reasonable.'
    };
    return {
      title:'You’re trying to decide whether this belongs in your health strategy.',
      detail:'Cevren will separate the claims inside your question, identify which facts could materially change the decision, and investigate only after it understands what actually needs to be decided.'
    };
  }

  function fresh(){
    main().innerHTML=`<section class="dx12 dx12-question"><div class="dx12-kicker">NEW DECISION</div><h1>What are you thinking about?</h1><p class="dx12-lead">Ask Cevren in your own words. You don’t need to organize the question first.</p><textarea id="v15Question" placeholder="Tell Cevren what you are considering…"></textarea><div class="dx12-actions"><button id="v15Start">Talk it through with Cevren</button></div></section>`;
    document.getElementById('v15Start').onclick=()=>{
      const q=document.getElementById('v15Question').value.trim();if(!q)return;
      const d={id:'d'+Date.now(),created_at:Date.now(),question:q,latest_user_context:[q],v15Type:classify(q),v15Context:{}};
      S.decisions=S.decisions||[];S.decisions.push(d);S.currentDecision=d.id;save();understand(d);
    };
  }

  function understand(d){
    const s=summarize(d.question,d.v15Type);
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">UNDERSTANDING YOUR DECISION</div><h1>Here’s what I think you’re really asking.</h1><div class="dx13-position"><h2>${esc(s.title)}</h2><p>${esc(s.detail)}</p></div><p class="dx12-lead">If that’s right, I’ll check whether I already have enough context to investigate responsibly. I won’t ask for information unless it could change what I do next.</p><div class="dx12-actions"><button id="v15Right">That’s right — continue</button><button class="secondary" id="v15Clarify">Not quite</button></div><div id="v15Correction"></div></section>`;
    document.getElementById('v15Right').onclick=()=>contextGate(d);
    document.getElementById('v15Clarify').onclick=()=>{
      document.getElementById('v15Correction').innerHTML=`<div class="dx12-inline"><textarea id="v15Clarification" placeholder="What should Cevren understand differently?"></textarea><button id="v15Update">Update my decision</button></div>`;
      document.getElementById('v15Update').onclick=()=>{const v=document.getElementById('v15Clarification').value.trim();if(!v)return;d.question=v;d.latest_user_context=[v];d.v15Type=classify(v);save();understand(d);};
    };
  }

  function contextGate(d){
    if(d.v15Type==='creatine'&&!d.v15Context.kidneyStatus) return creatineContext(d);
    ready(d);
  }

  function creatineContext(d){
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">ONE THING COULD CHANGE THIS DECISION</div><h1>Before I investigate, I want to understand your kidney context.</h1><p class="dx12-lead">For most healthy adults this may not change the decision. But a history of kidney disease or abnormal renal function could materially change how Cevren evaluates long-term creatine use.</p><div class="dx12-next"><h2>Which best describes you?</h2><div class="dx12-actions"><button id="v15KidneyNormal">No known kidney disease or abnormal kidney labs</button><button class="secondary" id="v15KidneyConcern">I have a kidney concern or abnormal result</button></div><div class="dx12-actions"><button class="secondary" id="v15Labs">Add recent kidney-related labs</button><button class="secondary" id="v15SkipLabs">I don’t have labs handy</button></div><div id="v15LabBox"></div></div><p class="meta">Cevren is asking because the answer can materially change the decision—not because every decision needs a medical intake.</p></section>`;
    document.getElementById('v15KidneyNormal').onclick=()=>{d.v15Context.kidneyStatus='no_known_concern';save();ready(d);};
    document.getElementById('v15KidneyConcern').onclick=()=>{d.v15Context.kidneyStatus='concern';save();collectConcern(d);};
    document.getElementById('v15SkipLabs').onclick=()=>{d.v15Context.kidneyStatus='unknown_no_labs';save();ready(d);};
    document.getElementById('v15Labs').onclick=()=>{document.getElementById('v15LabBox').innerHTML=`<div class="dx12-inline"><p><b>Prototype lab entry</b></p><p class="muted">Secure file upload is a later data capability. For now, enter the relevant result in your own words.</p><textarea id="v15LabText" placeholder="Example: Creatinine 1.0 mg/dL, eGFR 88, dated…"></textarea><button id="v15SaveLabs">Use these results</button></div>`;document.getElementById('v15SaveLabs').onclick=()=>{const v=document.getElementById('v15LabText').value.trim();if(!v)return;d.v15Context.kidneyStatus='labs_supplied';d.v15Context.kidneyLabs=v;save();ready(d);};};
  }

  function collectConcern(d){
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">THIS COULD MATERIALLY CHANGE THE DECISION</div><h1>Tell me what you know.</h1><p class="dx12-lead">A diagnosis, recent creatinine/eGFR, or what your clinician has told you is enough to continue. You don’t need to reconstruct your whole medical history.</p><textarea id="v15Concern" placeholder="I was told…"></textarea><div class="dx12-actions"><button id="v15ConcernGo">Continue</button></div></section>`;
    document.getElementById('v15ConcernGo').onclick=()=>{const v=document.getElementById('v15Concern').value.trim();if(!v)return;d.v15Context.kidneyDetail=v;save();ready(d);};
  }

  function ready(d){
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">READY TO INVESTIGATE</div><h1>I have enough to start.</h1><p class="dx12-lead">I’ll separate the claims in your question, evaluate what the evidence supports, apply the health context that actually matters, and decide whether I can close this without sending you elsewhere.</p><div class="dx12-note"><b>Cevren owns the research.</b><span>If I still need something afterward, I’ll tell you the smallest unresolved fact—not default to a clinician.</span></div><div class="dx12-actions"><button id="v15Investigate">Let Cevren investigate</button></div></section>`;
    document.getElementById('v15Investigate').onclick=()=>journey(d);
  }

  function journey(d){
    const stages=['Separating the claims in your question','Reviewing evidence for benefit','Checking long-term safety','Applying your relevant health context','Determining whether the decision can close'];
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN IS INVESTIGATING</div><h1>Working through the decision.</h1><div class="dx12-journey">${stages.map((x,i)=>`<div class="dx12-step"><span>○</span><b>${esc(x)}</b></div>`).join('')}</div><div class="dx12-live">Beginning…</div></section>`;
    let i=0;const tick=()=>{const els=[...document.querySelectorAll('.dx12-step')];els.forEach((el,n)=>{el.className='dx12-step '+(n<i?'done':n===i?'active':'');el.querySelector('span').textContent=n<i?'✓':n===i?'●':'○';});document.querySelector('.dx12-live').textContent=stages[i]+'…';if(i<stages.length-1){i++;setTimeout(tick,750)}else setTimeout(()=>result(d),900);};setTimeout(tick,200);
  }

  function result(d){
    if(d.v15Type==='creatine') return creatineResult(d);
    if(window.cevrenDecisionBriefV14) return window.cevrenDecisionBriefV14(d);
    return window.cevrenDecisionBriefV13&&window.cevrenDecisionBriefV13(d);
  }

  function creatineResult(d){
    const concern=d.v15Context.kidneyStatus==='concern';
    if(concern){
      main().innerHTML=`<section class="dx12"><div class="dx12-kicker">INVESTIGATION COMPLETE · DECISION STILL OPEN</div><h1>Your kidney context changes the path.</h1><p class="dx12-verdict">The general creatine evidence is not enough to close this responsibly because you flagged a kidney concern. That specific issue now matters more than the general supplement question.</p><div class="dx12-next"><h2>Next: resolve the kidney-specific uncertainty.</h2><p>Cevren should use the renal information you provide and only involve a clinician if that information cannot safely resolve the decision.</p></div></section>`;return;
    }
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">INVESTIGATION COMPLETE · DECISION CLOSED</div><h1>Cevren can make a recommendation here.</h1><p class="dx12-verdict">For an otherwise healthy adult who trains regularly and has no known kidney disease, daily creatine monohydrate is a reasonable addition for strength, training support, and preservation of lean mass. The evidence for brain-health benefits is promising but less definitive, and “longevity” should not be treated as an established outcome.</p><div class="dx13-position"><div class="dx12-kicker">CEVREN'S CURRENT POSITION</div><h2>Reasonable to recommend.</h2></div><div class="dx13-section"><h3>What I’d do</h3><p>Use creatine monohydrate consistently. A typical maintenance approach is 3–5 g daily; a loading phase is not necessary for most people.</p></div><div class="dx13-section"><h3>What matters because it’s you</h3><p>Your regular resistance/conditioning work makes the muscle and performance evidence more relevant than the broader longevity claims. Your high protein intake does not replace creatine because they serve different physiological roles.</p></div><div class="dx13-section"><h3>What to expect</h3><p>Some people gain a small amount of scale weight from increased intracellular water. GI discomfort can occur, especially with larger doses. These are different from evidence of kidney injury in healthy users.</p></div><div class="dx13-blocker"><div class="dx12-kicker">WHAT WOULD CHANGE THIS RECOMMENDATION</div><p>Known kidney disease, meaningfully abnormal renal function, or another medical factor that changes creatine handling would reopen the decision.</p></div><div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>This decision can close.</h2><p>Cevren does not need to send you to a clinician simply to finish this question based on the context you provided.</p><button id="v15Close">Mark decision resolved</button></div><details class="dx12-details"><summary>See evidence and uncertainty</summary><p>Production Cevren should show verified citations, evidence quality, and provenance here. This prototype is testing decision behavior and should not represent its evidence retrieval as live or verified.</p></details></section>`;
    document.getElementById('v15Close').onclick=()=>{d.status='resolved';save();fresh();};
  }

  window.cevrenFreshDecisionV15=fresh;
  const reset=document.getElementById('resetBtn');if(reset)reset.onclick=fresh;
  setTimeout(fresh,10);
})();