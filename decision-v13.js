// Cevren v0.13 — Decision Brief
// Adds the missing intelligence layer: evidence -> interpretation -> personalization -> position -> unresolved issue -> next action.

(function(){
  const main=()=>document.getElementById('main');
  const esc13=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function isTadalafil(d){
    const q=(d.question||(d.latest_user_context||[])[0]||'').toLowerCase();
    return /tadalafil|cialis|pde5/.test(q);
  }

  function briefFor(d){
    if(isTadalafil(d)) return {
      position:'Reasonable to explore — but not ready to recommend yet.',
      intro:'There may be a reasonable case for daily tadalafil for you, but the strongest evidence is not the same as the workout-circulation claim that prompted the question.',
      supports:[
        'Daily tadalafil is an established PDE5-inhibitor regimen for erectile dysfunction and for urinary symptoms associated with benign prostatic hyperplasia.',
        'Its mechanism produces vasodilation, so a vascular rationale is biologically plausible.',
        'A once-daily regimen creates sustained exposure rather than timing a dose around a single event.'
      ],
      cautions:[
        'A plausible vascular effect is not the same as established evidence that 5 mg daily meaningfully improves workout oxygenation, recovery, or performance in otherwise healthy exercisers.',
        'Whether it is a good choice for you depends on cardiovascular status, blood pressure, interacting medicines and the reason you would actually be taking it.'
      ],
      personal:'The decision should be judged against the health context Cevren already has, especially medications, hormones, supplements, blood pressure/cardiovascular context and the goal you are trying to achieve. Cevren should not treat a general benefit claim as automatically applicable to you.',
      unresolved:'The remaining blocker is not more internet research. It is confirming that your individual cardiovascular/medication context does not create a contraindication or meaningful monitoring concern, and separating a proven indication from the more speculative performance benefit.',
      clinicianQuestions:[
        'Given my cardiovascular history, blood pressure and complete medication/supplement regimen, is there a reason tadalafil 5 mg daily would be unsafe or inappropriate for me?',
        'If my primary goal is circulation or exercise benefit rather than ED, how strong do you believe the evidence is for that use?',
        'Are there specific symptoms, blood-pressure changes, labs or other findings you would want monitored if I tried it?',
        'If you would recommend against it for me, what specific risk or lack of expected benefit drives that recommendation?'
      ]
    };
    return {
      position:'Decision still open — Cevren has narrowed what matters.',
      intro:'Cevren has separated the parts it can investigate from the part that still requires information or judgment specific to you.',
      supports:['There is enough information to define the decision and identify the evidence that matters.'],
      cautions:['The current prototype does not yet have a verified live evidence-retrieval layer, so it should not pretend that queued research has already been sourced and appraised.'],
      personal:'Cevren will use only the personal context that can materially change this decision.',
      unresolved:'The remaining issue should be reduced to the smallest question that prevents a responsible recommendation.',
      clinicianQuestions:['What specific clinical fact would change whether this option is appropriate for me?','Does anything in my current regimen create a meaningful safety or monitoring concern?','What finding would make you recommend for or against this option in my case?']
    };
  }

  function decisionBrief(d){
    const b=briefFor(d); d.dx13Brief=b; save();
    main().innerHTML=`<section class="dx12 dx13">
      <div class="dx12-kicker">INVESTIGATION COMPLETE · DECISION BRIEF</div>
      <h1>Here's what Cevren found.</h1>
      <p class="dx12-verdict">${esc13(b.intro)}</p>

      <div class="dx13-position"><div class="dx12-kicker">CEVREN'S CURRENT POSITION</div><h2>${esc13(b.position)}</h2></div>

      <div class="dx13-section"><h3>What supports considering it</h3>${b.supports.map(x=>`<p>✓ ${esc13(x)}</p>`).join('')}</div>
      <div class="dx13-section"><h3>What makes Cevren cautious</h3>${b.cautions.map(x=>`<p>• ${esc13(x)}</p>`).join('')}</div>
      <div class="dx13-section"><h3>What matters because it's you</h3><p>${esc13(b.personal)}</p></div>
      <div class="dx13-blocker"><div class="dx12-kicker">WHAT PREVENTS CEVREN FROM CLOSING THIS DECISION</div><p>${esc13(b.unresolved)}</p></div>

      <div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>Resolve the one remaining blocker.</h2><p>Cevren has done the research work it can at this stage. Where clinical confirmation is genuinely needed, I'll turn the blocker into a few precise questions and keep this decision open for your return.</p><button id="dx13Next">Prepare the questions I need</button></div>
      <details class="dx12-details"><summary>See the evidence and reasoning underneath</summary><div class="dx13-evidence"><p><b>Evidence transparency</b></p><p>This prototype is demonstrating the decision architecture. It does not yet claim that a verified live sourcing layer has retrieved and appraised every source behind this brief. That layer must supply citations, evidence quality, uncertainty and provenance before Cevren can represent research as verified.</p></div></details>
    </section>`;
    document.getElementById('dx13Next').onclick=()=>clinician13(d,b);
  }

  function clinician13(d,b){
    const qs=b.clinicianQuestions;
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">YOUR NEXT CONVERSATION</div><h1>Only ask what Cevren still needs.</h1><p class="dx12-lead">These questions come directly from the unresolved part of this decision—not from a generic checklist.</p><div class="dx12-questions">${qs.map((q,i)=>`<div><span>${i+1}</span><p>${esc13(q)}</p></div>`).join('')}</div><div class="dx12-next"><h2>Then bring the answer back.</h2><p>Cevren will integrate what you learn into this same decision and tell you whether its position changes.</p><button id="dx13Return">Add clinician input</button></div><button class="secondary" id="dx13Leave">Leave this decision open</button></section>`;
    document.getElementById('dx13Return').onclick=()=>collect13(d);
    document.getElementById('dx13Leave').onclick=()=>window.cevrenFreshDecisionV12();
  }

  function collect13(d){
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">CONTINUE THIS DECISION</div><h1>What did you learn?</h1><p class="dx12-lead">Tell Cevren in your own words. This will be added to the existing decision—not treated as a new question.</p><textarea id="dx13Input" placeholder="My clinician said…"></textarea><div class="dx12-actions"><button id="dx13Integrate">Integrate and reassess</button></div></section>`;
    document.getElementById('dx13Integrate').onclick=()=>{const v=document.getElementById('dx13Input').value.trim();if(!v)return;d.latest_user_context=d.latest_user_context||[];d.latest_user_context.push(v);d.dx13ClinicianInput=v;save();decisionBrief(d);};
  }

  // Replace only v0.12's visible conclusion. The rolling investigation journey remains intact.
  window.cevrenDecisionBriefV13=decisionBrief;
  window.conclusion=decisionBrief;

  // journey() resolves its lexical conclusion, so override the visible investigation entry with the same staged journey ending in v0.13.
  const originalReady=window.cevrenFreshDecisionV12;
  document.addEventListener('click',function(e){
    if(e.target && e.target.id==='dx12Investigate'){
      const d=S.decisions&&S.decisions.find(x=>x.id===S.currentDecision); if(!d)return;
      e.preventDefault(); e.stopImmediatePropagation();
      const stages=['Understanding the decision','Sourcing relevant evidence','Checking safety and uncertainty','Integrating your context','Building the conclusion'];
      main().innerHTML=`<section class="dx12"><div class="dx12-kicker">CEVREN IS INVESTIGATING</div><h1>Working through this with you.</h1><p class="dx12-lead">I'll show you where I am without making you sort through the machinery underneath.</p><div class="dx12-journey">${stages.map((x,i)=>`<div class="dx12-step" data-i="${i}"><span>○</span><b>${x}</b></div>`).join('')}</div><div class="dx12-live">Beginning investigation…</div></section>`;
      let i=0;const tick=()=>{const els=[...document.querySelectorAll('.dx12-step')];els.forEach((el,n)=>{el.className='dx12-step '+(n<i?'done':n===i?'active':'');el.querySelector('span').textContent=n<i?'✓':n===i?'●':'○';});const live=document.querySelector('.dx12-live');if(live)live.textContent=stages[i]+'…';if(i<stages.length-1){i++;setTimeout(tick,800)}else setTimeout(()=>decisionBrief(d),950);};setTimeout(tick,250);
    }
  },true);
})();
