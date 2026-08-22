// Cevren v0.12 — clean-slate user-facing Decision Experience
// Keeps the existing decision engine underneath; replaces the visible pathway.

(function(){
  const oldRender = window.render;
  const main = () => document.getElementById('main');
  const esc12 = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function current(){ return S.decisions && S.decisions.find(x=>x.id===S.currentDecision); }
  function existingUser(){ return !!(S.humanModel || S.profile || (S.decisions&&S.decisions.length)); }

  function freshQuestion(){
    main().innerHTML=`<section class="dx12 dx12-question">
      <div class="dx12-kicker">NEW DECISION</div>
      <h1>What are you thinking about?</h1>
      <p class="dx12-lead">Ask Cevren about a health decision in your own words. You don't need to organize it first.</p>
      <textarea id="dx12Question" placeholder="For example: I'm considering changing something about my health and I want help deciding whether it makes sense for me."></textarea>
      <div class="dx12-actions"><button id="dx12Start">Talk it through with Cevren</button></div>
    </section>`;
    document.getElementById('dx12Start').onclick=()=>{
      const q=document.getElementById('dx12Question').value.trim(); if(!q)return;
      // Use the established engine's decision creation when available.
      if(typeof startDecision==='function') return startDecision(q);
      if(typeof beginDecision==='function') return beginDecision(q);
      const d={id:'d'+Date.now(),created_at:Date.now(),latest_user_context:[q],question:q,dx12:true};
      S.decisions=S.decisions||[];S.decisions.push(d);S.currentDecision=d.id;save();
      understand(d);
    };
  }

  function understand(d){
    const q=d.question || (d.latest_user_context||[])[0] || 'this health decision';
    main().innerHTML=`<section class="dx12">
      <div class="dx12-kicker">UNDERSTANDING YOUR DECISION</div>
      <h1>Here's what I think you're deciding.</h1>
      <div class="dx12-statement">${esc12(q)}</div>
      <p class="dx12-lead">I'll use what I already know about you where it's relevant. If something important is missing, I'll ask only for what could materially change the decision.</p>
      <div class="dx12-actions"><button id="dx12Enough">That's right — continue</button><button class="secondary" id="dx12Correct">I want to clarify it</button></div>
      <div id="dx12Clarify"></div>
    </section>`;
    document.getElementById('dx12Enough').onclick=()=>ready(d);
    document.getElementById('dx12Correct').onclick=()=>{
      document.getElementById('dx12Clarify').innerHTML=`<div class="dx12-inline"><textarea id="dx12Correction" placeholder="What should Cevren understand differently?"></textarea><button id="dx12SaveCorrection">Update</button></div>`;
      document.getElementById('dx12SaveCorrection').onclick=()=>{
        const v=document.getElementById('dx12Correction').value.trim();if(!v)return;
        d.question=v;d.latest_user_context=[v];save();understand(d);
      };
    };
  }

  function ready(d){
    main().innerHTML=`<section class="dx12">
      <div class="dx12-kicker">READY TO INVESTIGATE</div>
      <h1>I have enough to start.</h1>
      <p class="dx12-lead">I'll evaluate the relevant evidence, check it against what matters about your situation, separate what is known from what remains uncertain, and determine what I can responsibly recommend.</p>
      <div class="dx12-note"><b>You don't need to collect the research.</b><span>That's Cevren's work. If I eventually need information only you or a clinician can provide, I'll tell you exactly what and why.</span></div>
      <div class="dx12-actions"><button id="dx12Investigate">Let Cevren investigate</button></div>
    </section>`;
    document.getElementById('dx12Investigate').onclick=()=>journey(d);
  }

  function journey(d){
    const stages=['Understanding the decision','Sourcing relevant evidence','Checking safety and uncertainty','Integrating your context','Building the conclusion'];
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN IS INVESTIGATING</div><h1>Working through this with you.</h1><p class="dx12-lead">I'll show you where I am without making you sort through the machinery underneath.</p><div class="dx12-journey">${stages.map((x,i)=>`<div class="dx12-step" data-i="${i}"><span>○</span><b>${x}</b></div>`).join('')}</div><div class="dx12-live">Beginning investigation…</div></section>`;
    let i=0; const tick=()=>{
      const els=[...document.querySelectorAll('.dx12-step')];
      els.forEach((e,n)=>{e.className='dx12-step '+(n<i?'done':n===i?'active':'');e.querySelector('span').textContent=n<i?'✓':n===i?'●':'○';});
      document.querySelector('.dx12-live').textContent=stages[i]+'…';
      if(i<stages.length-1){i++;setTimeout(tick,800)}else setTimeout(()=>conclusion(d),950);
    };setTimeout(tick,250);
  }

  function conclusion(d){
    // Existing engine remains authoritative. v0.12 translates its state into a human-sized result.
    const action=d.action||d.service_action||'ESCALATE';
    const needsClinician=action==='ESCALATE';
    d.dx12Complete=true;save();
    main().innerHTML=`<section class="dx12">
      <div class="dx12-kicker">INVESTIGATION COMPLETE · DECISION ${needsClinician?'STILL OPEN':'UPDATED'}</div>
      <h1>${needsClinician?"Here's where the decision stands.":"Cevren has reached a conclusion."}</h1>
      <p class="dx12-verdict">${needsClinician?`I can't responsibly close this decision yet. I've completed the work I can do from evidence and the context available to me; one part now needs information or judgment I shouldn't pretend to supply.`:`I have enough evidence and context to guide the next step.`}</p>
      <div class="dx12-why"><b>What this means for you</b><p>${needsClinician?`You don't need to do more research. The next useful move is to resolve the few questions that require clinical input, then bring those answers back to this same decision.`:`I'll keep the reasoning underneath and give you the action that matters now.`}</p></div>
      <div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>${needsClinician?'Let me prepare you for the clinician conversation.':'Continue with Cevren’s recommendation.'}</h2><p>${needsClinician?`I'll turn what remains unresolved into a short set of questions you can actually use. No dossier.`:`We'll move forward one step at a time.`}</p><button id="dx12Next">${needsClinician?'Prepare my questions':'Show me what to do next'}</button></div>
      <details class="dx12-details"><summary>See Cevren's research and reasoning</summary><div id="dx12Backstage"></div></details>
    </section>`;
    document.getElementById('dx12Next').onclick=()=>needsClinician?clinician(d):nextGuidance(d);
    document.querySelector('.dx12-details').ontoggle=e=>{if(e.target.open)backstage(d);};
  }

  function clinician(d){
    const qs=[
      'Is there anything about my diagnosis, exam, or current treatment plan that changes whether this option is appropriate for me?',
      'Does my current medication, hormone, or supplement regimen create a meaningful safety or monitoring concern for this decision?',
      'Are there specific labs, imaging, or other findings you would want before I proceed?',
      'What would make you recommend for or against this option in my case?'
    ];
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">YOUR NEXT CONVERSATION</div><h1>Take these questions with you.</h1><p class="dx12-lead">These are the few things Cevren needs your clinician to help resolve. You don't need to explain the whole analysis.</p><div class="dx12-questions">${qs.map((q,i)=>`<div><span>${i+1}</span><p>${q}</p></div>`).join('')}</div><div class="dx12-next"><h2>Then come back here.</h2><p>Add what your clinician tells you and Cevren will continue this same decision—not start over.</p><button id="dx12Return">Add clinician input</button></div><button class="secondary" id="dx12Leave">Leave this decision open</button></section>`;
    document.getElementById('dx12Return').onclick=()=>collectClinician(d);
    document.getElementById('dx12Leave').onclick=()=>freshQuestion();
  }

  function collectClinician(d){
    main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CONTINUE THIS DECISION</div><h1>What did your clinician add?</h1><p class="dx12-lead">Tell me in your own words. I'll integrate it into the existing decision and show you what changed.</p><textarea id="dx12Input" placeholder="My clinician said…"></textarea><div class="dx12-actions"><button id="dx12Integrate">Integrate this information</button></div></section>`;
    document.getElementById('dx12Integrate').onclick=()=>{const v=document.getElementById('dx12Input').value.trim();if(!v)return;d.latest_user_context=d.latest_user_context||[];d.latest_user_context.push(v);d.dx12ClinicianInput=v;save();journey(d);};
  }

  function nextGuidance(d){ conclusion(d); }
  function backstage(d){
    const box=document.getElementById('dx12Backstage');if(!box||box.dataset.loaded)return;box.dataset.loaded='1';
    box.innerHTML=`<p class="muted">Detailed evidence state, decision-worthiness, uncertainty, Human Model context, and decision trace remain available here for transparency, but they are not required to continue the decision.</p>`;
  }

  // New top-level entry. Reset/new question uses the clean experience; old engine remains loaded.
  window.cevrenFreshDecisionV12=freshQuestion;
  const reset=document.getElementById('resetBtn');
  if(reset) reset.onclick=()=>{ S.currentDecision=null; save(); freshQuestion(); };

  // For this prototype iteration, land an existing user directly at a fresh question.
  setTimeout(freshQuestion,0);
})();
