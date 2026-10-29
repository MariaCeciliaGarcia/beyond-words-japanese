const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname+'/';
function setup(legacy=null,saved=null,options={}){
 const map=options.map||new Map(),handlers={},listeners={},elements=new Map(),downloads=[],blobs=new Map();
 if(legacy)map.set('beyondwords.japanese.legacy-unused',JSON.stringify(legacy));
 if(saved)map.set('beyondwords.japanese.v1',JSON.stringify(saved));
 const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',insertAdjacentHTML(_position,html){this.innerHTML+=html},textContent:'',value:'',hidden:true,open:false,classList:{add(){},remove(){}},querySelector(){return null},focus(){},setSelectionRange(){},select(){},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(id);};
 const history={state:null,entries:[],replaceState(state,_,url){this.state=state;this.entries[this.entries.length-1]={state,url};},pushState(state,_,url){this.state=state;this.entries.push({state,url});}};
 const ctx={window:{addEventListener:(t,f)=>listeners[t]=f,scrollTo(){}},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>{if(options.failWrites)throw Error('quota');if(options.failKey===k&&options.failCount>0){options.failCount--;throw Error('quota once');}map.set(k,v)},removeItem:k=>map.delete(k)},Blob:class{constructor(parts){this.parts=parts}},URL:{createObjectURL:b=>{const id='blob:test-'+blobs.size;blobs.set(id,b);return id},revokeObjectURL(){}},document:{body:{appendChild(){}},createElement:()=>({click(){downloads.push({filename:this.download,text:blobs.get(this.href).parts.join('')})},remove(){}}),getElementById:el,addEventListener:(t,f)=>handlers[t]=f},history,location:{pathname:'/',search:'',hash:''},crypto:require('crypto').webcrypto,setTimeout:()=>0,clearTimeout(){},Date,console};
 vm.createContext(ctx);
 const files=[...fs.readFileSync(root+'index.html','utf8').matchAll(/<script src="([^"?]+)/g)].map(x=>x[1]);
 for(const file of files)vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx,{filename:file});
 return {ctx,map,handlers,listeners,history,el,downloads,run:source=>vm.runInContext(source,ctx)};
}
module.exports={setup};
if(require.main===module){
const env=setup();const r=env.run;
const click=(action,extra={})=>env.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action,...extra}}}});
const total=r('units.length');assert(total>=60,'The library needs real breadth');assert.equal(r('new Set(units.map(u=>u.id)).size'),total);assert.deepEqual(Array.from(r('window.BW_JP_CATALOG_AUDIT()')),[]);
r(`for(const u of units){
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(u.id))throw Error('Backup-incompatible ID '+u.id);
 if(u.learning.length!==5||u.review.length!==5)throw Error(u.id+' count');
 const all=[u.entry,...u.learning,...u.review];
 if(u.practiceProfile==='compose'&&all.some(q=>q.type!=='input'||q.stem))throw Error('Only full translation for '+u.id);
 for(const q of all){if(!q.scene||!q.target||!q.answers.length||!Array.isArray(q.lexicalHints)||!q.grammarHints?.length)throw Error('Question missing '+u.id+q.id);if(q.type==='choice'&&!q.choices.some(c=>c.id===q.correctChoice))throw Error('Choice mismatch');}
 if(u.practiceProfile==='compose'&&u.learning.some(q=>q.target===u.entry.target))throw Error('Repeated initial');
}`);
// All authored units: real action dispatch through initial, explanation, 5 tasks and completion.
for(const id of r('units.map(u=>u.id)')){
 click('open-learn',{lesson:id});
 assert.equal(r('state.learn.stage'),'entry');
 assert(!r('app.innerHTML').includes('class="large-expression"'));
 if(r('questionType(learningQuestion())')==='input'){
  r('state.learn.q.input=learningQuestion().answers[0]');click('check');
  assert.equal(r('state.learn.stage'),'intro');assert(r('app.innerHTML').includes('entry-result-title'));
 }else{click('reveal');assert(r('app.innerHTML').includes('看看讲解'));click('entry-intro');}
 click('intro-next');assert.equal(r('state.learn.stage'),'exercise');
 for(let n=0;n<5;n++){
  const type=r('questionType(learningQuestion())');
  if(type==='choice'){click('choose-answer',{choice:r('learningQuestion().correctChoice')});assert(r('app.innerHTML').includes('判断正确'));click('choice-next');}
  else {if(type==='input'){r('state.learn.q.input=learningQuestion().answers[0]');click('check');assert(r('app.innerHTML').includes('答对了'));}else click('reveal');click('grade',{grade:'good'});}
 }
 assert.equal(r('state.learn.stage'),'custom');
 if(r('scenarioUnit()')){
  assert.equal(r('(app.innerHTML.match(/id="custom-scene"/g)||[]).length'),1);
  assert(!r('app.innerHTML').includes('id="custom-intent"'));
  r("state.draft.scene='同事说周五居家办公，我第一次知道。'");click('save-scenario');
 }else{r("state.draft={zh:'周末有时间，可以慢慢聊。',en:'週末は余裕があるので、ゆっくり話せます。'}");click('save-custom');}
 assert.equal(r('state.custom.length'),1);assert(r('app.innerHTML').includes('继续创建'));
 click('continue-create');click('finish-learn');assert.equal(r('state.learn.stage'),'done');
 assert(r('app.innerHTML').includes('复习这个表达'));
 // Main review round, with persistent cursor moving through all 5 authored questions over successive rounds.
 for(let round=0;round<2;round++){
  click('start-review');assert.equal(r('view'),'practice');
  for(let k=0;k<3;k++){
   const type=r('questionType(reviewQuestion())');
   if(type==='choice'){click('choose-answer',{choice:r('reviewQuestion().correctChoice')});click('choice-next');}
   else {if(type==='input'){r('state.review.q.input=reviewQuestion().answers[0]');click('check');}else click('reveal');click('grade',{grade:'good'});}
  }
  assert.equal(r('view'),'summary');assert.equal(r('state.review'),null);
 }
}
// Pause/resume keeps question, input, hints and origin; grammar and vocabulary have distinct effects.
r("selectLesson('jp-teoku');state.learn=newLearning();view='study';state.learn.q.input='明日は';window.markQuestionHelp(lesson.entry,state.learn.q,'words');state.learn.q.hints=['words'];save();");
assert.equal(r('state.learn.q.usedHint'),undefined);
const persisted=JSON.parse(env.map.get('beyondwords.japanese.v1'));
const restored=setup(null,persisted);assert.equal(restored.run('state.learn.q.input'),'明日は');assert.deepEqual(Array.from(restored.run('state.learn.q.hints')),['words']);
r("window.markQuestionHelp(lesson.entry,state.learn.q,'frame')");assert.equal(r('state.learn.q.usedHint'),true);
// Mastery retains a next action, cancellation leaves original material, restore reopens practice.
r("store.records['jp-sounandesune'].learn=null;save()");click('master');click('confirm-master');assert.equal(r('view'),'mastery');assert(r('app.innerHTML').includes('学习下一个表达'));
click('undo-master');assert.equal(r('state.mastered'),false);
// Future content corrections do not change an already-started task or its help.
const pinned=setup(),pr=pinned.run;
pr("selectLesson('jp-teoku');state.learn=newLearning();view='study';var originalEntry=JSON.stringify(learningQuestion());unitById.get('jp-teoku').entry.target='日后修订的新题';");
assert.equal(pr('JSON.stringify(learningQuestion())'),pr('originalEntry'));
pr("state.enrolled=true;startReview();var originalReview=JSON.stringify(reviewQuestion());unitById.get('jp-teoku').review[0].target='日后修订的新复习题';");assert.equal(pr('JSON.stringify(reviewQuestion())'),pr('originalReview'));
// Native punctuation and IME-related spaces do not produce spurious mismatches.
assert.equal(r("matches(' そうなんですね！',['そうなんですね。'])"),true);
assert.equal(r("matches('今日は余裕があります。',['今日は余裕がありません。'])"),false);
// Backup round trip is Japanese-only, and unknown English backup formats must be refused.
r('exportProgress()');const backup=JSON.parse(env.downloads.at(-1).text);assert.equal(backup.format,'beyondwords-japanese-progress');assert(r('parseProgressBackup(JSON.stringify(progressBackup())).data.records'));
assert.throws(()=>r("parseProgressBackup(JSON.stringify({format:'jujian-progress',formatVersion:1,data:store}))"));
assert([...env.map.keys()].every(k=>k.startsWith('beyondwords.japanese.')));
const transfer=setup(null,persisted),tr=transfer.run;
tr("var beforeTransfer=JSON.stringify(progressBackup());state.draft.en='変更した草稿';save();previewProgressImport(beforeTransfer);if(!applyProgressImport('replace'))throw Error('Restore failed');");
assert.equal(tr('state.draft.en'),'');tr('undoProgressImport()');assert.equal(tr('state.draft.en'),'変更した草稿');
const broken=setup(null,null,{map:new Map([['beyondwords.japanese.v1','unreadable original']])});assert.equal(broken.run('progressReadOnly'),true);assert.equal(broken.map.get('beyondwords.japanese.v1'),'unreadable original');

// Every authored review question renders with its own hints and solution, independent of round rotation.
r(`for(const u of units){selectLesson(u.id);for(const q of u.review){const qs=newQuestionState();qs.hints=['words','frame'];const html=questionSheet(q,qs,'review');if(!html.includes(esc(q.target)))throw Error('Review prompt '+u.id+q.id);qs.revealed=true;qs.checked=true;qs.input=q.answers[0];if(q.type==='choice')qs.choice=q.correctChoice;const result=questionSheet(q,qs,'review');if(!result.includes(esc(q.answers[0])))throw Error('Review solution '+u.id+q.id);}}`);
console.log(`PASS: ${total} units, ${total*11} authored tasks, full learning/review actions, creation, resume, mastery, backup and storage isolation.`);
}
