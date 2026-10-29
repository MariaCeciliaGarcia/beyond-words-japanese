'use strict';
const assert=require('node:assert');
const {setup}=require('./validate.cjs');
const env=setup(),r=env.run;
const click=(action,extra={})=>env.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action,...extra}}}});
r(`for(const d of window.BW_JP_DAILY_MATERIALS||[]){if(d.id!==d.date||!/^\\d{4}-\\d{2}-\\d{2}$/.test(d.date)||!Array.isArray(d.items))throw Error('Malformed date archive');for(const item of d.items){if(!item.id||!item.expression||!item.meaning)throw Error('Missing source material');for(const id of [item.unitId,...(item.practiceIds||[])].filter(Boolean))if(!unitById.has(id))throw Error('Unknown daily unit '+id);}}for(const u of window.BW_JP_MOENA||[]){if(u.domain!=='moena'||u.domains.some(d=>d!=='moena'))throw Error('Personal unit leaked into public library');}`);
// Empty-state fixtures stay valid after real daily materials have been added.
r('window.BW_JP_DAILY_MATERIALS=[];window.BW_JP_MOENA=[]');
assert(r("catalog.domains.some(d=>d.id==='moena'&&d.name==='小枝萌菜')"));
r("domain='moena';filter='all';view='library';render()");
assert(r('app.innerHTML').includes('还没有每日语料'));
assert(!r('app.innerHTML').includes('Cecilia'));
assert.equal(r('routeURL("library")'),'/'+'#library/moena');
r("view='home';render()");assert(!r('app.innerHTML').includes('daily-home-entry'));assert(r('app.innerHTML').includes('home-learn-title'));r("view='library';domain='moena';render()");assert(r('app.innerHTML').includes('小枝萌菜'));
// Fixture data lives only in this VM, never in daily-materials.js or a browser.
r(`
var privateFixture=JSON.parse(JSON.stringify(unitById.get('jp-yoyuu')));
privateFixture.id='jp-m-fixture';privateFixture.domain='moena';privateFixture.domains=['moena'];
units.push(privateFixture);unitById.set(privateFixture.id,privateFixture);
window.BW_JP_DAILY_MATERIALS=[
 {id:'2026-10-28',date:'2026-10-28',items:[{id:'source-old-shared',expression:'時間に余裕がある',meaning:'时间宽裕',unitId:'jp-yoyuu',kind:'expression'},{id:'source-old-private',expression:'测试个人语料',meaning:'仅测试',unitId:'jp-m-fixture',kind:'expression'}]},
 {id:'2026-10-29',date:'2026-10-29',items:[{id:'source-new-shared',expression:'時間に余裕がある',meaning:'时间宽裕',unitId:'jp-yoyuu',kind:'expression'},{id:'source-support',expression:'词语支持',meaning:'仅作为配套',kind:'support'}]},
 {id:'2026-10-28',date:'2026-10-28',items:[{id:'source-old-shared',expression:'時間に余裕がある',meaning:'重复原材料应去重',unitId:'jp-yoyuu',kind:'expression'},{id:'source-added',expression:'〜ておく',meaning:'同日补充',unitId:'jp-teoku',kind:'expression'}]}
];
`);
assert.deepEqual(Array.from(r('ceciliaDays().map(d=>d.id)')),['2026-10-29','2026-10-28']);
assert.equal(r('ceciliaDay("2026-10-28").items.length'),3);
assert.equal(r('ceciliaDay("2026-10-29").items.length'),2);
assert.deepEqual(Array.from(r('ceciliaIds("2026-10-29")')),['jp-yoyuu']);
assert.deepEqual(Array.from(r('ceciliaIds("2026-10-28")')),['jp-yoyuu','jp-m-fixture','jp-teoku']);
assert.equal(r("unitById.get('jp-yoyuu').domains.includes('moena')"),false,'Referencing a public unit must not change membership');
assert.equal(r("learningSelection({domain:'daily',tab:'scene',filter:'all',subfilter:'all',search:''}).some(u=>u.id==='jp-m-fixture')"),false);
r("domain='moena';filter='all';view='library';render()");
assert(r('app.innerHTML.indexOf("2026年10月29日")<app.innerHTML.indexOf("2026年10月28日")'));
click('cecilia-date',{day:'2026-10-28'});
assert.equal(r('filter'),'2026-10-28');assert.equal(r('routeURL("library")'),'/'+'#library/moena/2026-10-28');
assert(r('app.innerHTML').includes('返回日期目录'));
// Earlier global mastery is not automatic processing of either day's material.
r("selectLesson('jp-yoyuu');state.mastered=true;state.enrolled=true;save()");
assert.equal(r("dateLearningPending('jp-yoyuu','2026-10-28')"),true);
assert.equal(r("dateLearningPending('jp-yoyuu','2026-10-29')"),true);
r("openCeciliaUnit('jp-yoyuu','2026-10-28',true);state.learn.q.input='未完成の入力';state.learn.q.hints=['words'];save()");
assert.equal(r('view'),'study');assert.equal(r('state.mastered'),true);assert.equal(r('state.learn.dailyReplay'),true);
assert.equal(r('state.learn.origin.dateId'),'2026-10-28');
assert.equal(r('state.learn.origin.domain'),'moena');
// Future source edits do not rewrite a learner's active round.
const entryBefore=r('learningQuestion().target');
r("unitById.get('jp-yoyuu').entry={...unitById.get('jp-yoyuu').entry,target:'A later corrected prompt'}");
assert.equal(r('learningQuestion().target'),entryBefore);
r("go('home');continueLearningHome()");
assert.equal(r('state.learn.q.input'),'未完成の入力');assert.equal(r('state.learn.q.hints[0]'),'words');
assert.equal(r('state.learn.origin.dateId'),'2026-10-28');
r("state.learn.stage='custom';finishLearning()");
assert.equal(r("record('jp-yoyuu').dailyVisits['2026-10-28'].status"),'done');
assert.equal(r("dateLearningPending('jp-yoyuu','2026-10-29')"),true);
assert.equal(r("nextCeciliaUnit('2026-10-28','jp-yoyuu').id"),'jp-m-fixture');
click('cecilia-next',{next:'jp-m-fixture',day:'2026-10-28'});
assert.equal(r('lesson.id'),'jp-m-fixture');assert.equal(r('domain'),'moena');
assert.equal(r('state.learn.origin.dateId'),'2026-10-28');
// A day-only skip preserves the global mastery flag and other day visits.
click('cecilia-skip',{lesson:'jp-yoyuu',day:'2026-10-29'});
assert.equal(r("record('jp-yoyuu').dailyVisits['2026-10-29'].status"),'skip');
assert.equal(r("record('jp-yoyuu').dailyVisits['2026-10-28'].status"),'done');
assert.equal(r("record('jp-yoyuu').mastered"),true);
// Opening a date never steals an unfinished public round or counts it for that date.
r("selectLesson('jp-teoku');domain='work';view='library';state.learn=newLearning();state.learn.q.input='原公共练习';save();openCeciliaUnit('jp-teoku','2026-10-28',true)");
assert.equal(r('state.learn.origin.domain'),'work');assert.equal(r('state.learn.q.input'),'原公共练习');
assert.equal(r('state.learn.pendingDailyDate'),'2026-10-28');assert.equal(r("dateLearningPending('jp-teoku','2026-10-28')"),true);
r("state.learn.stage='custom';finishLearning()");
assert.equal(r("dateLearningPending('jp-teoku','2026-10-28')"),true);
assert(r('pendingDailyContinuation()').includes('继续学习'));
// Same protection for a round that originally belongs to another date.
r("selectLesson('jp-yoyuu');state.mastered=false;state.learn=newLearning();state.learn.origin=currentDayOrigin('2026-10-28');state.learn.q.input='原日期草稿';delete state.dailyVisits['2026-10-29'];save();openCeciliaUnit('jp-yoyuu','2026-10-29',true)");
assert.equal(r('state.learn.origin.dateId'),'2026-10-28');assert.equal(r('state.learn.q.input'),'原日期草稿');
assert.equal(r('state.learn.pendingDailyDate'),'2026-10-29');
r("state.learn.stage='custom';finishLearning();go('home')");
assert.equal(r("dateLearningPending('jp-yoyuu','2026-10-29')"),true);
assert.equal(r('learningResumeTarget().dayRestart'),true);
r('continueLearningHome()');assert.equal(r('state.learn.origin.dateId'),'2026-10-29');
assert.equal(r('state.learn.stage'),'entry');assert.equal(r("dateLearningPending('jp-yoyuu','2026-10-29')"),true);
r("markDailyVisit('skip','2026-10-29');save()");
// Scope keeps reviewed references together, while excluding a non-member public unit.
r("for(const id of ['jp-yoyuu','jp-teoku','jp-sounandesune','jp-m-fixture']){store.records[id]=store.records[id]||emptyState();store.records[id].enrolled=true;store.records[id].mastered=false;}save()");
assert.equal(r("filterReviewScope(availableUnits(),{domain:'moena',dateId:'2026-10-29'}).length"),1);
assert.equal(r("filterReviewScope(availableUnits(),{domain:'moena',dateId:'2026-10-28'}).some(u=>u.id==='jp-sounandesune')"),false);
r("selectLesson('jp-yoyuu');startCeciliaReview('2026-10-28');startReview();state.review.q.input='復習の入力';save();go('home');continueReviewHome()");
assert.equal(r('view'),'practice');assert.equal(r('state.review.origin.dateId'),'2026-10-28');
assert.equal(r('state.review.q.input'),'復習の入力');
assert(r('state.review.pinnedQuestions?.length===5'));
// Marking mastery while reviewing a date touches the review date, not a previous learn date.
r("state.learn.origin=currentDayOrigin('2026-10-29');markDailyVisit('mastered')");
assert.equal(r("state.dailyVisits['2026-10-28'].status"),'mastered');
assert.equal(r("state.dailyVisits['2026-10-29'].status"),'skip');
const roundtrip=JSON.parse(r('JSON.stringify(parseProgressBackup(JSON.stringify(progressBackup())))'));
assert.equal(roundtrip.format,'beyondwords-japanese-progress');
assert.equal(roundtrip.data.reviewScope.domain,'moena');
assert.equal(roundtrip.data.records['jp-yoyuu'].review.origin.dateId,'2026-10-28');
assert.equal(roundtrip.data.records['jp-yoyuu'].dailyVisits['2026-10-29'].status,'skip');
// A date request cannot relabel an unfinished public review round.
r("selectLesson('jp-yoyuu');store.reviewScope=null;startReview();state.review.q.input='原公共复习草稿';save()");
const publicQueue=Array.from(r('state.review.queue'));
r("startCeciliaReview('2026-10-28')");click('start-review',{lesson:'jp-yoyuu'});
assert.equal(r('state.review.origin'),null);assert.equal(r('state.review.q.input'),'原公共复习草稿');
assert.deepEqual(Array.from(r('state.review.queue')),publicQueue);
assert.equal(r('store.reviewScope.dateId'),'2026-10-28');
r("go('home');continueReviewHome()");
assert.equal(r('state.review.origin'),null);assert.equal(r('store.reviewScope.dateId'),'2026-10-28');
r("finishReview();go('review')");assert.equal(r('store.reviewScope.dateId'),'2026-10-28');
// Next-review can encounter a shared unit whose earlier round belongs to another date.
r("ceciliaDay('2026-10-29');window.BW_JP_DAILY_MATERIALS[1].items.push({id:'source-new-private',expression:'测试个人语料',meaning:'另一天再次遇见',unitId:'jp-m-fixture',kind:'expression'});selectLesson('jp-m-fixture');store.reviewScope={domain:'moena',dateId:'2026-10-29'};startReview();state.review.q.input='原29日复习草稿';save()");
const privateQueue=Array.from(r('state.review.queue'));
r("selectLesson('jp-yoyuu');store.reviewScope={domain:'moena',dateId:'2026-10-28'};startReview();finishReview();render()");
assert.equal(r('nextReviewUnit().id'),'jp-m-fixture');
click('next-review',{next:'jp-m-fixture'});
assert.equal(r('state.review.origin.dateId'),'2026-10-29');
assert.equal(r('state.review.q.input'),'原29日复习草稿');assert.deepEqual(Array.from(r('state.review.queue')),privateQueue);
assert.equal(r('store.reviewScope.dateId'),'2026-10-28');
r("go('home');continueReviewHome()");assert.equal(r('state.review.origin.dateId'),'2026-10-29');assert.equal(r('store.reviewScope.dateId'),'2026-10-28');
r("finishReview();go('review')");assert.equal(r('store.reviewScope.dateId'),'2026-10-28');
// Undoing mastery rolls back only the date state created by that exact confirmation.
r("selectLesson('jp-yoyuu');view='study';state.learn=state.learn||newLearning();state.learn.origin=currentDayOrigin('2026-10-29');delete state.dailyVisits['2026-10-29'];markDailyVisit('mastered');save()");
assert.equal(r("state.dailyVisits['2026-10-29'].status"),'mastered');
assert.equal(r('undoDailyMasteryVisit()'),true);assert.equal(r("state.dailyVisits['2026-10-29']"),undefined);
r("state.dailyVisits['2026-10-29']={status:'done',at:10};markDailyVisit('mastered');undoDailyMasteryVisit()");
assert.equal(r("state.dailyVisits['2026-10-29'].status"),'done');assert.equal(r("state.dailyVisits['2026-10-29'].at"),10);
r("state.dailyVisits['2026-10-29']={status:'skip',at:20};markDailyVisit('mastered');undoDailyMasteryVisit()");
assert.equal(r("state.dailyVisits['2026-10-29'].status"),'skip');assert.equal(r("state.dailyVisits['2026-10-29'].at"),20);
r("markDailyVisit('mastered');state.dailyVisits['2026-10-29']={status:'done',at:Date.now()+1}");
assert.equal(r('undoDailyMasteryVisit()'),false);assert.equal(r("state.dailyVisits['2026-10-29'].status"),'done');
r("markDailyVisit('mastered');state.dailyVisits['2026-10-29'].at++");assert.equal(r('undoDailyMasteryVisit()'),false);
r("markDailyVisit('mastered');save()");assert(r('parseProgressBackup(JSON.stringify(progressBackup())).data.records[lesson.id].dailyMasteryUndo'));
r("undoDailyMasteryVisit();delete state.dailyVisits['2026-10-29'];state.mastered=false;save()");
click('master');click('confirm-master');assert.equal(r("state.dailyVisits['2026-10-29'].status"),'mastered');click('undo-master');
assert.equal(r('state.mastered'),false);assert.equal(r("state.dailyVisits['2026-10-29']"),undefined);
// Old Japanese v0.1 progress without daily metadata remains valid.
assert(r("checkedProgress({version:2,activeId:'jp-yoyuu',records:{'jp-yoyuu':emptyState()},ui:{}}).records['jp-yoyuu']"));
assert([...env.map.keys()].every(k=>k.startsWith('beyondwords.japanese.')));
console.log('PASS: truthful empty personal archive, sibling entry, descending dates, same-day append/dedupe, shared/private isolation, day-specific mastery/skip, continuation, pinned rounds, date review scope and Japanese backup compatibility.');

// Undoing today's reconfirmation must retain a mastery decision made earlier.
r("selectLesson('jp-yoyuu');state.mastered=true;state.learn=newLearning();state.learn.origin=currentDayOrigin('2026-10-29');state.learn.dailyReplay=true;view='study';render()");
click('master');click('confirm-master');click('undo-master');assert.equal(r('state.mastered'),true);assert.equal(r('view'),'study');
console.log('PASS: undoing a date reconfirmation preserves prior global mastery.');
