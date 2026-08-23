// Cevren v0.18 context presentation hotfix
// Raw decision-context field names/answers belong to the engine trace, not the user-facing voice.
// Safari stability note: this observer intentionally watches only direct replacements of #main.
// Watching the full subtree while mutating descendant text can create a self-triggering MutationObserver loop.
(function(){
  function cleanPersonalization(){
    const root=document.getElementById('main');
    if(!root)return;
    const section=[...root.querySelectorAll('.dx13-section')].find(x=>x.querySelector('h3')?.textContent.trim()==="What matters because it's you");
    if(!section)return;
    const p=section.querySelector('p');
    if(!p)return;
    const d=(S.decisions||[]).find(x=>x.id===S.currentDecision);
    const e=d?.engineState;
    if(!e)return;
    const personal=String(e.personalization||'').trim();
    const desired=personal||'The personal context relevant to this decision was considered, but it does not materially change Cevren’s position.';
    // Idempotent write: never mutate the DOM when the desired copy is already present.
    if(p.textContent!==desired)p.textContent=desired;
  }

  const root=document.getElementById('main');
  if(root){
    // render() replaces #main contents directly, so subtree observation is unnecessary and risky.
    const observer=new MutationObserver(()=>cleanPersonalization());
    observer.observe(root,{childList:true});
  }
  cleanPersonalization();
})();
