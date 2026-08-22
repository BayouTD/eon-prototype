// Cevren v0.18 context presentation hotfix
// Raw decision-context field names/answers belong to the engine trace, not the user-facing voice.
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
    p.textContent=personal||'The personal context relevant to this decision was considered, but it does not materially change Cevren’s position.';
  }
  const observer=new MutationObserver(()=>cleanPersonalization());
  const root=document.getElementById('main');
  if(root)observer.observe(root,{childList:true,subtree:true});
  cleanPersonalization();
})();
