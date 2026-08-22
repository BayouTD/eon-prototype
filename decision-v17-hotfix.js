// v0.17 compatibility shim: server-v1 does not yet destructure `clarifications`.
// Preserve the original decision and append corrections as context before the request reaches it.
(function(){
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(url.includes('/api/decision-engine')&&init&&typeof init.body==='string'){
        const body=JSON.parse(init.body);
        if(Array.isArray(body.clarifications)&&body.clarifications.length){
          body.question=`${body.question}\n\nUSER CLARIFICATION — preserve the original subject and use this only to correct/refine what the user is deciding:\n${body.clarifications.map((x,i)=>`${i+1}. ${x}`).join('\n')}`;
          init={...init,body:JSON.stringify(body)};
        }
      }
    }catch(_e){}
    return nativeFetch(input,init);
  };
})();