// Cevren v0.14 — compressed decision brief + take-it-with-you clinician questions
(function(){
  const main=()=>document.getElementById('main');
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function brief14(d){ return d.dx13Brief || {position:'Decision still open.',intro:'Cevren has narrowed the decision.',supports:[],cautions:[],personal:'',unresolved:'One decision-worthy question remains.',clinicianQuestions:[]}; }

  function renderBrief(d){
    const b=brief14(d);
    const why=(b.cautions&&b.cautions[0]) || (b.supports&&b.supports[0]) || '';
    main().innerHTML=`<section class="dx12 dx13">
      <div class="dx12-kicker">INVESTIGATION COMPLETE · DECISION BRIEF</div>
      <h1>Here's what Cevren found.</h1>
      <p class="dx12-verdict">${esc(b.intro)}</p>
      <div class="dx13-position"><div class="dx12-kicker">CEVREN'S CURRENT POSITION</div><h2>${esc(b.position)}</h2></div>
      <div class="dx13-section"><h3>Why</h3><p>${esc(why)}</p></div>
      <div class="dx13-section"><h3>For you</h3><p>${esc(b.personal)}</p></div>
      <div class="dx13-blocker"><div class="dx12-kicker">WHAT STILL MATTERS</div><p>${esc(b.unresolved)}</p></div>
      <div class="dx12-next"><div class="dx12-kicker">NEXT STEP</div><h2>Resolve the one remaining blocker.</h2><p>I'll turn it into the few questions needed for this decision and keep the decision open for your return.</p><button id="v14Questions">Prepare my clinician questions</button></div>
      <details class="dx12-details"><summary>See Cevren's evidence and reasoning</summary>
        <div class="dx13-evidence">
          <h3>What supports considering it</h3>${(b.supports||[]).map(x=>`<p>✓ ${esc(x)}</p>`).join('')}
          <h3>What makes Cevren cautious</h3>${(b.cautions||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')}
          <p><b>Evidence transparency</b></p><p>This prototype demonstrates the decision architecture. A production evidence layer must provide verified sourcing, evidence quality, uncertainty and provenance before Cevren represents research as verified.</p>
        </div>
      </details>
    </section>`;
    document.getElementById('v14Questions').onclick=()=>renderQuestions(d,b);
  }

  function renderQuestions(d,b){
    const qs=b.clinicianQuestions||[];
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">YOUR NEXT CONVERSATION</div><h1>Take these questions with you.</h1><p class="dx12-lead">These come directly from what remains unresolved in this decision. You don't need to explain Cevren's whole analysis.</p><div class="dx12-questions">${qs.map((q,i)=>`<div><span>${i+1}</span><p>${esc(q)}</p></div>`).join('')}</div><div class="dx12-next"><h2>Then bring the answers back.</h2><p>Cevren will integrate what you learn into this same decision and tell you whether its position changes.</p><div class="dx12-actions"><button id="v14Return">Add clinician input</button><button class="secondary" id="v14Print">Print / Save questions</button></div></div><button class="secondary" id="v14Leave">Leave this decision open</button></section>`;
    document.getElementById('v14Return').onclick=()=>collect(d);
    document.getElementById('v14Print').onclick=()=>printQuestions(d,b);
    document.getElementById('v14Leave').onclick=()=>window.cevrenFreshDecisionV12();
  }

  function printQuestions(d,b){
    const w=window.open('','_blank'); if(!w)return;
    const qs=b.clinicianQuestions||[];
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cevren clinician questions</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:48px auto;color:#111;line-height:1.45}h1{font-size:30px;margin-bottom:8px}.brand{font-size:13px;font-weight:800;letter-spacing:.18em}.position{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:18px 0;margin:22px 0}.q{margin:24px 0}.q b{display:block;margin-bottom:8px}.notes{height:72px;border-bottom:1px solid #bbb;background:repeating-linear-gradient(to bottom,transparent 0,transparent 23px,#ddd 24px)}.foot{margin-top:34px;font-size:12px;color:#666}@media print{body{margin:28px auto}}</style></head><body><div class="brand">CEVREN</div><h1>Questions for my clinician</h1><p>This page contains only the information needed to continue my current health decision.</p><div class="position"><b>Cevren's current position</b><br>${esc(b.position)}</div>${qs.map((q,i)=>`<div class="q"><b>${i+1}. ${esc(q)}</b><div class="notes"></div></div>`).join('')}<div class="foot">Bring the answers back to Cevren to continue the same decision.</div><script>window.onload=()=>window.print();<\/script></body></html>`);w.document.close();
  }

  function collect(d){
    main().innerHTML=`<section class="dx12 dx13"><div class="dx12-kicker">CONTINUE THIS DECISION</div><h1>What did you learn?</h1><p class="dx12-lead">Tell Cevren in your own words. I'll add it to this decision and reassess from here.</p><textarea id="v14Input" placeholder="My clinician said…"></textarea><div class="dx12-actions"><button id="v14Integrate">Integrate and reassess</button></div></section>`;
    document.getElementById('v14Integrate').onclick=()=>{const v=document.getElementById('v14Input').value.trim();if(!v)return;d.latest_user_context=d.latest_user_context||[];d.latest_user_context.push(v);d.dx13ClinicianInput=v;save();renderBrief(d);};
  }

  window.cevrenDecisionBriefV14=renderBrief;
  window.cevrenDecisionBriefV13=renderBrief;
  window.conclusion=renderBrief;
})();