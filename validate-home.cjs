'use strict';
const assert=require('node:assert');
const {setup}=require('./validate.cjs');
// Home hierarchy is stable; both entrances always retain two distinct actions.
{
 const h=setup(),hr=h.run;hr("window.BW_JP_DAILY_MATERIALS=[{id:'2026-10-28',date:'2026-10-28',items:[{id:'test',expression:'時間に余裕がある',meaning:'时间充裕',unitId:'jp-yoyuu',kind:'expression'}]}]");
 hr("view='home';render();var fixedHero=app.innerHTML.match(/<section class=\"home-intro\">[\\s\\S]*?<\\/section>/)[0]");
 let markup=hr('app.innerHTML');assert.equal((markup.match(/class="home-card home-/g)||[]).length,2);assert.equal((markup.match(/class="button home-action"/g)||[]).length,4);
 assert(!markup.includes('daily-home-entry'));assert(!markup.includes('最近更新'));assert(!markup.includes('接着上次'));assert(!markup.includes('backup-reminder'));
 assert(markup.includes('disabled aria-describedby="home-review-empty"'));assert(markup.includes('disabled aria-describedby="home-learn-empty"'));
 hr("selectLesson('jp-teoku');state.learn=newLearning();state.learn.stage='exercise';state.learn.index=2;state.learn.q.input='Progress preserved';state.note={text:'My note',updatedAt:Date.now()};enrolled();startReview();state.review.q.input='Review draft';state.review.index=1;view='home';save();render()");
 assert.equal(hr('app.innerHTML.match(/<section class="home-intro">[\\s\\S]*?<\\/section>/)[0]'),hr('fixedHero'));
 assert(!hr('app.innerHTML').includes('disabled aria-describedby='));
 h.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action:'continue-learning-home'}}}});
 assert.equal(hr('state.learn.q.input'),'Progress preserved');assert.equal(hr('state.learn.index'),2);assert.equal(hr('state.note.text'),'My note');
 h.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action:'continue-review-home'}}}});
 assert.equal(hr('state.review.q.input'),'Review draft');assert.equal(hr('state.review.index'),1);
 // Progress categories do not count skipped work as learnt. Duplicate IDs count once.
 hr("var scopeIds=['jp-yoyuu','jp-teoku','jp-sounandesune'];for(const id of scopeIds){const r=store.records[id]=record(id);r.learn=null;r.enrolled=false;r.mastered=false;r.review=null;}record('jp-yoyuu').learn={stage:'done',results:[{grade:'good'}]};record('jp-teoku').learn={stage:'done',results:[{grade:'skip'}]};record('jp-sounandesune').mastered=true");
 let counts=JSON.parse(hr('JSON.stringify(libraryProgress([...scopeIds,scopeIds[0]]))'));assert.equal(counts.total,3);assert.equal(counts.completed,1);assert.equal(counts.mastered,1);assert.equal(counts.skipped,1);
 hr("record('jp-yoyuu').learn={stage:'exercise',results:[],origin:{domain:'moena',dateId:'2026-10-28'}};record('jp-yoyuu').enrolled=true;record('jp-yoyuu').schedule.due=1;record('jp-yoyuu').review={index:1};record('jp-yoyuu').dailyVisits={'2026-10-28':{status:'skip'}}");
 counts=JSON.parse(hr("JSON.stringify(libraryProgress(['jp-yoyuu'],'2026-10-28'))"));assert.equal(counts.completed,0);assert.equal(counts.skipped,1);assert.equal(counts.due,1);assert.equal(counts.pendingReview,1);
 counts=JSON.parse(hr("JSON.stringify(libraryProgress(['jp-yoyuu'],'2026-10-29'))"));assert.equal(counts.active,0);assert.equal(counts.completed,0);assert.equal(counts.skipped,0);
 hr("record('jp-yoyuu').dailyVisits['2026-10-28']={status:'done',attempted:true,at:Date.now()};record('jp-yoyuu').learn={stage:'entry',results:[],origin:{domain:'moena',dateId:'2026-10-29'}}");assert.equal(hr("libraryProgress(['jp-yoyuu'],'2026-10-28').completed"),1);
 hr("record('jp-yoyuu').dailyVisits['2026-10-28'].attempted=false");assert.equal(hr("libraryProgress(['jp-yoyuu'],'2026-10-28').completed"),0);
 assert(hr("ceciliaNavigation().includes('更新于')&&!ceciliaNavigation().includes('按日期学习')"));
 console.log('PASS: fixed home philosophy, symmetric four actions, empty/resume states, notes preserved, precise unique scope/date progress and library update labels.');
}
