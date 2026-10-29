
'use strict';
(()=>{
 function items(xs){return (xs||[]).map(x=>typeof x==='string'?{text:x,role:'support'}:x).filter(x=>x?.text);}
 function getQuestionHelp(q){return {words:items(q.lexicalHints),grammar:items(q.grammarHints)};}
 function renderQuestionHintContent(q,kind){const h=getQuestionHelp(q),xs=kind==='words'?h.words:h.grammar;return xs.map(x=>`<p>${esc(x.text)}</p>`).join('')||'结合情境，再想一想。';}
 function markQuestionHelp(q,qs,kind){const h=getQuestionHelp(q),xs=kind==='words'?h.words:h.grammar;if(xs.some(x=>x.role==='target')){qs.targetSeen=true;qs.usedHint=true;}if(xs.some(x=>x.role!=='target'))qs.supportSeen=true;}
 Object.assign(window,{getQuestionHelp,renderQuestionHintContent,markQuestionHelp});
})();
