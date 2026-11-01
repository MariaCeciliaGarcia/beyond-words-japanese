'use strict';
// 覆盖：按语料类别的题量方案（可造句 1+3+自建+复习3；独立表达 1+≤2、不设自建、复习1），以及“我答对了”。
process.env.BW_PLAN='1';
const assert=require('node:assert');
const {setup}=require('./validate.cjs');
const click=(e,action,data={})=>e.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action,...data}}}});
const e=setup(),r=e.run;
const stat=JSON.parse(r(`JSON.stringify(units.reduce((t,u)=>{const k=u.questionPlan||'other';t[k]=(t[k]||0)+1;if(u.questionPlan==='compose'&&(u.learning.length!==3||u.review.length!==3))throw Error('compose '+u.id);if(u.questionPlan==='scenario'&&(u.learning.length>2||u.review.length!==1||(u.review[0].type||'input')!=='recall'||!u.learning.some(q=>q.type==='choice')))throw Error('scenario '+u.id);return t;},{}))`));
assert(stat.compose>0&&stat.scenario>0);assert(!stat.other||stat.other===0);
// 独立表达：学完直接结束，没有自建环节
const sid=r("units.find(u=>u.questionPlan==='scenario').id");
r(`selectLesson(${JSON.stringify(sid)});state.learn=newLearning();view='study';state.learn.stage='intro';render();`);
click(e,'intro-next');
let guard=0;while(r("state.learn.stage")==='exercise'&&guard++<5){const q=r('questionType(learningQuestion())');if(q==='choice'){click(e,'choose-answer',{choice:r('learningQuestion().correctChoice')});click(e,'choice-next');}else{click(e,'reveal');click(e,'grade',{grade:'good'});}}
assert.equal(r('state.learn.stage'),'done');assert.equal(r('state.custom.length'),0);
// 可造句表达：答错后选“我答对了”直接进入下一题，不重复
const cid=r("units.find(u=>u.practiceProfile==='compose').id");
r(`selectLesson(${JSON.stringify(cid)});state.learn=newLearning();view='study';state.learn.stage='exercise';state.learn.index=0;state.learn.q.input='zzz';render();`);
click(e,'check');assert(r("app.innerHTML.includes('data-action=\"mark-correct\"')"));
click(e,'mark-correct');
assert.equal(r('state.learn.index'),1);assert.equal(r('state.learn.results[0].selfCorrect'),true);assert.equal(r('state.learn.results[0].grade'),'good');
// 初试答错后选“我答对了”：按答对处理，可继续练新题
r(`state.learn=newLearning();view='study';state.learn.q.input='zzz';render();`);
click(e,'check');assert.equal(r('state.learn.stage'),'intro');assert(r("app.innerHTML.includes('data-action=\"mark-correct\"')"));
click(e,'mark-correct');assert(r("app.innerHTML.includes('答对了')"));assert(r("app.innerHTML.includes('data-action=\"intro-next\"')"));
click(e,'intro-next');assert.equal(r('state.learn.stage'),'exercise');
// 已匹配的答案不出现“我答对了”
r(`state.learn=newLearning();view='study';state.learn.q.input=lesson.entry.answers[0];render();`);click(e,'check');assert(!r("app.innerHTML.includes('data-action=\"mark-correct\"')"));
// 升级前已经做到一半的轮次（旧题量 5+5）：不能被判成“原进度无法读取”，且要能照原题继续做完
{const toggle=on=>{if(on)process.env.BW_PLAN='1';else delete process.env.BW_PLAN;};
 toggle(false);const oldEnv=setup();
 const ids=JSON.parse(oldEnv.run("JSON.stringify({compose:units.find(u=>u.practiceProfile==='compose'||(!u.practiceProfile&&u.learning.length===5)).id,scenario:units.find(u=>u.practiceProfile==='scenario').id})"));
 for(const [kind,uid] of Object.entries(ids)){
  for(const idx of [3,4]){
   toggle(false);const a=setup();a.run(`selectLesson('${uid}');state.learn=newLearning();state.learn.stage='exercise';state.learn.index=${idx};state.learn.results=Array.from({length:${idx}},(_,i)=>({id:'l'+(i+1),grade:'good',kind:'input',time:1}));state.learn.pinnedLearning=unitById.get('${uid}').fullLearning||unitById.get('${uid}').learning;enrolled();save();`);
   const saved=JSON.parse(a.map.get(a.run('KEY')));for(const rec of Object.values(saved.records))if(rec.learn)delete rec.learn.pinnedLearning; // 升级前的轮次没有题目快照
   toggle(true);const b=setup(null,saved);
   assert.equal(b.run('progressReadOnly'),false,kind+' 学习中 '+idx);
   b.run(`selectLesson('${uid}');view='study';render();`);
   assert(b.run('!!learningQuestion()'),kind+' 题目缺失 '+idx);
  }
  toggle(false);const c=setup();c.run(`selectLesson('${uid}');enrolled();startReview();state.review.queue=[...state.review.queue,...((unitById.get('${uid}').fullReview||unitById.get('${uid}').review).slice(3).map(q=>q.id))];state.review.pinnedQuestions=unitById.get('${uid}').fullReview||unitById.get('${uid}').review;save();`);
  const savedReview=JSON.parse(c.map.get(c.run('KEY')));for(const rec of Object.values(savedReview.records))if(rec.review)delete rec.review.pinnedQuestions;
  toggle(true);const d=setup(null,savedReview);assert.equal(d.run('progressReadOnly'),false,kind+' 复习中');
  d.run(`selectLesson('${uid}');view='practice';render();`);
  assert(d.run('state.review.queue.every(id=>pool().some(q=>q.id===id))'),kind+' 复习题缺失');
 }
 toggle(true);
}
console.log('PASS: question plan',JSON.stringify(stat),'and mark-correct');
