'use strict';
const assert=require('node:assert');
const {setup}=require('./validate.cjs');
const e=setup(),r=e.run;
const click=(action,extra={})=>e.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action,...extra}}}});
const saved=()=>JSON.parse(e.map.get('beyondwords.japanese.v1'));
r("selectLesson('jp-yoyuu');state.learn=newLearning();state.learn.stage='exercise';view='study';render()");
// No prompt before a learning attempt. After checking: entry exists and editing never advances the question.
assert(!r('app.innerHTML').includes('添加笔记'));
r('state.learn.q.input=learningQuestion().answers[0]');click('check');assert(r('app.innerHTML').includes('添加笔记'));
click('notes-edit',{noteKind:'unit',noteId:'',noteSurface:'question',noteLesson:'jp-yoyuu'});
assert(r('app.innerHTML').includes('note-input'));
e.handlers.input({target:{dataset:{noteEditor:'true',noteKind:'unit',noteId:'',noteLesson:'jp-yoyuu'},value:'余裕前面用に。\nある随时间变化。',closest:()=>null}});
assert.equal(saved().records['jp-yoyuu'].note.text,'余裕前面用に。\nある随时间变化。');
assert.equal(r('state.learn.index'),0);
click('grade',{grade:'good'});assert.equal(r('state.learn.index'),1);
const reload=setup(null,saved());assert.equal(reload.run("record('jp-yoyuu').note.text"),'余裕前面用に。\nある随时间变化。');assert.equal(reload.run('state.learn.index'),1);
// Review starts with a collapsed note, only reading it before the answer marks assisted recall.
r('enrolled();startReview()');assert(r('app.innerHTML').includes('语块笔记'));assert(!r('app.innerHTML').includes('余裕前面用に。'));
click('notes-toggle',{noteKind:'unit',noteId:'',noteSurface:'question',noteLesson:'jp-yoyuu'});assert(r('app.innerHTML').includes('余裕前面用に。'));assert.equal(r('state.review.q.noteBeforeSeen'),true);
click('reveal');assert(r('app.innerHTML').includes('余裕前面用に。'));click('grade',{grade:'good'});assert.equal(r('state.review.results[0].noteHelp'),true);assert.equal(r('state.review.results[0].help'),true);
r('state.review.q.revealed=true;render()');click('notes-edit',{noteKind:'unit',noteId:'',noteSurface:'question',noteLesson:'jp-yoyuu'});r("saveNoteText('unit','','新的语块笔记')");assert.equal(r('state.review.q.noteBeforeSeen'),undefined);
// Personal draft notes persist without requiring an English sentence; saving attaches them to that example.
r("state.review=null;state.learn.stage='custom';view='study';state.draft={zh:'周末有空慢慢聊。',en:'週末は余裕があるので、ゆっくり話せます。'};saveNoteText('draft','','有余裕不等于无事可做。');render()");
assert(r('app.innerHTML').includes('custom-layout'));click('save-custom');assert.equal(r('state.custom[0].note.text'),'有余裕不等于无事可做。');assert.equal(r('state.draft.note'),undefined);
r("state.draft={zh:'第二条草稿',en:'',note:{text:'未完成例句的笔记',updatedAt:1}};saveNoteText('custom',state.custom[0].id,'余裕前的助词是に');save()");
assert.equal(r('state.draft.note.text'),'未完成例句的笔记');assert.equal(r('state.custom.length'),1);
// Both shared expression and matching personal note show after a personal review, never on unrelated questions.
r("state.review={queue:[state.custom[0].id],index:0,q:newQuestionState(),results:[],retried:[],baseCount:1,scheduled:true};view='practice';render()");
assert(!r('app.innerHTML').includes('余裕前的助词是に'));
r('state.review.q.revealed=true;render()');assert(r('app.innerHTML').includes('余裕前的助词是に'));assert(r('app.innerHTML').includes('新的语块笔记'));
r("selectLesson('jp-teoku');state.learn=newLearning();state.learn.stage='exercise';state.learn.q.revealed=true;view='study';render()");assert(!r('app.innerHTML').includes('新的语块笔记'));
// Scene creation and scene review also retain individual notes.
r("selectLesson('jp-sounandesune');state.learn=newLearning();state.learn.stage='custom';view='study';state.draft.scene='同事告诉我她明天居家办公';state.draft.intent='听到新消息';saveNoteText('draft','','表示自己听进去了，不额外评价');");click('save-scenario');assert.equal(r('state.custom[0].note.text'),'表示自己听进去了，不额外评价');assert.equal(r('state.draft.note'),undefined);
r("state.learn.stage='done';view='detail';render()");assert(r('app.innerHTML').includes('personal-detail'));assert(r('app.innerHTML').includes('场景笔记'));
// Full portable backup, replace/undo and a legacy backup without notes.
const payload=r('JSON.stringify(progressBackup())');const target=setup(),tr=target.run;
tr(`previewProgressImport(${JSON.stringify(payload)});applyProgressImport('replace')`);assert.equal(tr("record('jp-yoyuu').custom[0].note.text"),'余裕前的助词是に');assert.equal(tr("record('jp-yoyuu').draft.note.text"),'未完成例句的笔记');assert.equal(tr("record('jp-sounandesune').custom[0].note.text"),'表示自己听进去了，不额外评价');
tr("selectLesson('jp-yoyuu');saveNoteText('unit','','导入前的笔记')");tr(`previewProgressImport(${JSON.stringify(payload)});applyProgressImport('replace');undoProgressImport()`);assert.equal(tr("record('jp-yoyuu').note.text"),'导入前的笔记');
const legacy=saved();for(const x of Object.values(legacy.records)){delete x.note;delete x.draft.note;for(const c of x.custom)delete c.note;}assert.doesNotThrow(()=>tr(`checkedProgress(${JSON.stringify(legacy)})`));
const bad=saved();bad.records['jp-yoyuu'].note={text:123,updatedAt:1};assert.throws(()=>tr(`checkedProgress(${JSON.stringify(bad)})`));
// An emptied note is a real edit and must not be revived from an older backup on merge.
r("selectLesson('jp-yoyuu');saveNoteText('unit','','')");assert.equal(r("recordHasProgress({note:{text:'only note',updatedAt:1}})"),true);const old=JSON.parse(payload).data;r(`previewProgressImport(${JSON.stringify(payload)});applyProgressImport('merge')`);assert.equal(r("record('jp-yoyuu').note.text"),'');
// Notes are plain text, not executable markup, and failed persistence is reported honestly.
r("saveNoteText('unit','','<img src=x onerror=alert(1)>');state.review=null;state.learn.stage='exercise';state.learn.q.revealed=true;view='study';render()");assert(!r('app.innerHTML').includes('<img src=x'));assert(r('app.innerHTML').includes('&lt;img'));
const blocked=setup(null,null,{failWrites:true});assert.equal(blocked.run("saveNoteText('unit','','quota failure')"),false);
// Saving notes uses the same keyboard protection as other multiline personal fields.
let pressed=0,prevented=0;assert.equal(r('state.learn.index')>=0,true);e.ctx.noteTest={key:'Enter',metaKey:true,target:{dataset:{noteEditor:'true'},closest:()=>({querySelector:()=>({click:()=>pressed++})})},preventDefault:()=>prevented++};assert.equal(r('handleNoteKeydown(noteTest)'),true);assert.equal(pressed,1);assert.equal(prevented,1);e.ctx.noteTest.metaKey=false;assert.equal(r('handleNoteKeydown(noteTest)'),false);
// AI copy prompts contain the intention, required target and a concise word/grammar explanation request.
r("selectLesson('jp-yoyuu')");const prompt=r("personalCheckPrompt({zh:'我还有时间',en:'余裕です'})");assert(prompt.includes('余裕'));assert(prompt.includes('余裕です'));assert(prompt.includes('关键词语'));assert(prompt.includes('实际用到的语法'));assert(!prompt.includes('最多3点')&&!prompt.includes('每点一句'));assert(prompt.includes('根据句子的长度和难点展开'));assert(!prompt.includes('只给日语'));
console.log('PASS: notes autosave, advance/reload, collapsed recall, personal examples/scenes, backup/undo/legacy, deletion, failed saves, escaping, shortcuts and concise AI explanations.');

// Choice results expose the same note entry and retain it through immediate next-question navigation.
const choiceFlow=setup(),cr=choiceFlow.run;const choose=(action,extra={})=>choiceFlow.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action,...extra}}}});
cr("selectLesson('jp-sounandesune');state.learn=newLearning();state.learn.stage='exercise';view='study';render()");
choose('choose-answer',{choice:cr('learningQuestion().correctChoice')});assert(cr('app.innerHTML').includes('添加笔记'));cr("saveNoteText('unit','','这句是听到新消息，不是热情赞同。')");choose('choice-next');assert.equal(cr('state.learn.index'),1);assert.equal(cr('state.note.text'),'这句是听到新消息，不是热情赞同。');
assert(!r("personalCheckPrompt({zh:'我还有时间'})").includes('我的尝试'));
assert(r('progressCounts(store).notes')>0);
console.log('PASS: choice-note continuation, empty-English AI request, and backup note counts.');

// Japanese-specific compatibility: English backup formats/keys never cross the boundary.
assert.equal(r('progressBackup().format'),'beyondwords-japanese-progress');
assert.throws(()=>r("parseProgressBackup(JSON.stringify({...progressBackup(),format:'jujian-progress'}))"));
assert([...e.map.keys()].every(k=>k.startsWith('beyondwords.japanese.')));
const jpPrompt=r("personalCheckPrompt({zh:'明天可以慢慢聊',en:'明日は余裕があります。'})");
assert(jpPrompt.includes('自然日语'));assert(jpPrompt.includes('助词'));assert(jpPrompt.includes('活用'));assert(jpPrompt.includes('礼貌'));assert(jpPrompt.includes('明日は余裕があります。'));
r("selectLesson('jp-sounandesune')");const scenePrompt=r("personalCheckPrompt({scene:'同事告诉我她明天居家办公'})");assert(scenePrompt.includes('自然、得体'));assert(!scenePrompt.includes('想表达：'));
assert(!r('personalDraftForm()').includes('custom-intent'));
console.log('PASS: Japanese-only keys/backup formats; natural Japanese, particles, inflections and politeness in AI prompts; one-field scene creation.');

{
 r("selectLesson(units.find(u=>u.practiceProfile!=='scenario').id)");
 const longMeaning='我想表达的长句。'.repeat(90),longAttempt='A long attempt with several clauses. '.repeat(50);
 const detailed=r(`personalCheckPrompt({zh:${JSON.stringify(longMeaning)},en:${JSON.stringify(longAttempt)}})`);
 assert(detailed.includes(longMeaning)&&detailed.includes(longAttempt.trim()));assert(!/最多\s*[三3]|每点一句|只给一[句条]/.test(detailed));
 r("selectLesson(units.find(u=>u.practiceProfile!=='scenario').id);state.draft={zh:'test',en:'test'}");
 assert(r("personalDraftNotes().includes('添加笔记')&&!personalDraftNotes().includes('这条例句的笔记')"));
 r("saveNoteText('draft','','A note that stays saved')");assert(r("personalDraftNotes().includes('编辑笔记')"));
 assert(r("noteEditorMarkup('draft','','draft').includes('收起笔记')"));
 console.log('PASS: untruncated long AI inputs without fixed explanation count; clear add/edit/collapse note actions.');
}
