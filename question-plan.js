'use strict';
// 按语料类别决定每个表达的题量（2026-11-01 用户定）。内容文件里仍保留完整的 5＋5 题，这里只在装载时选用其中一部分，题目 ID 不变，提示与笔记照旧对应。
// 可造句表达（compose）：初试 1 ＋ 学习 3 ＋ 自建 1 句 ＋ 复习 3。
// 独立表达（scenario，如 Wait, no…）：初试 1 ＋ 学习最多 2（一道判断、一道回忆）＋ 不设自建 ＋ 复习 1（回忆，与初试同类）。
(()=>{
 const type=q=>q.type||'input';
 const pick=(list,idx)=>idx.filter(i=>i<list.length).map(i=>list[i]);
 function plan(unit){
  if(!unit||unit.questionPlan||!Array.isArray(unit.learning)||!Array.isArray(unit.review))return;
  const plain=!unit.practiceProfile&&unit.learning.length===5&&unit.review.length===5&&unit.learning.every(q=>type(q)==='input'); // 早期的翻译型表达，与可造句同样处理
  if(unit.practiceProfile==='compose'||plain){
   if(unit.learning.length>3)unit.learning=pick(unit.learning,[0,2,4]);
   if(unit.review.length>3)unit.review=pick(unit.review,[0,2,4]);
   unit.questionPlan='compose';
  }else if(unit.practiceProfile==='scenario'){
   const c=unit.learning.findIndex(q=>type(q)==='choice'),r=unit.learning.findIndex(q=>type(q)==='recall');
   const keep=[c,r].filter(i=>i>=0).sort((a,b)=>a-b);
   unit.learning=keep.length?pick(unit.learning,keep):unit.learning.slice(0,2);
   const rr=unit.review.findIndex(q=>type(q)==='recall');
   unit.review=[unit.review[rr>=0?rr:0]];
   unit.questionPlan='scenario';
  }
 }
 const seen=new Set();
 for(const key of Object.keys(window)){const v=window[key];if(Array.isArray(v)&&v.length&&v[0]&&typeof v[0]==='object'&&Array.isArray(v[0].learning)&&!seen.has(v)){seen.add(v);v.forEach(plan);}}
})();
