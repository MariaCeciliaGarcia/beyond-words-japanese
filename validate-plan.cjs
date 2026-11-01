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
console.log('PASS: question plan',JSON.stringify(stat),'and mark-correct');
