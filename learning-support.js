'use strict';
function expressionHint(q){
 const rules=window.JUJIAN_HINT_RULES?.[lesson.id];
 if(!rules)return q.hint||'先回忆这个表达的结构，再根据情境调整。';
 if(q.id.startsWith('c-'))return rules.core;
 const canonical=unitById.get(lesson.id),candidate=q.id==='entry'?canonical.entry:[...canonical.learning,...canonical.review].find(x=>x.id===q.id);
 if(candidate&&candidate.zh===q.zh&&candidate.answers.some(a=>q.answers.includes(a)))return q.id==='entry'?rules.entry:rules[q.id[0]==='l'?'learning':'review'][Number(q.id.slice(1))-1]||rules.core;
 return window.JUJIAN_HINT_FOR_QUESTION?.(lesson.id,q)||rules.core;
}
// 同一个 AI 对话只需发一次完整要求：按指令类型记录“已复制过完整版”，仅保存在本次浏览器会话（关闭页面后重置），
// 不写入 jujian.library.v2，也不进入备份。复制失败（未真正复制）不记录。
const aiRulesMemory={};
function aiRulesSent(kind){
 if(aiRulesMemory[kind])return true;
 try{if(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('jujian.aiRulesSent.'+kind)==='1'){aiRulesMemory[kind]=true;return true;}}catch{}
 return false;
}
function markAiRulesSent(kind){
 aiRulesMemory[kind]=true;
 try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem('jujian.aiRulesSent.'+kind,'1');}catch{}
 try{if(typeof document!=='undefined'&&document.querySelectorAll)document.querySelectorAll(`[data-ai-full="${kind}"]`).forEach(el=>{el.hidden=false;});}catch{}
}
function aiFullButton(kind,action,id=null,cls='text-button'){
 return `<button class="${cls}" data-action="${action}" data-ai-full="${kind}" ${id===null?'':`data-id="${esc(id)}"`} ${aiRulesSent(kind)?'':'hidden'}>复制完整指令</button>`;
}
function personalCheckPrompt(content,brief=false){
 if(brief&&scenarioUnit())return `沿用前面的核对要求。\n情境：${content.scene||content.zh||''}；想表达：${content.intent||''}\n请判断用日语“${lesson.expression}”回应是否自然、得体，并给出合适的日语回应。目标表达我已熟悉，不必讲解它本身。`;
 if(brief)return `沿用前面的核对要求。\n意思：${content.zh||''}\n必须使用“${lesson.expression}”，可按语境调整时态、否定、活用和普通／礼貌语体。${content.en?.trim()?`\n我的日语尝试：${content.en.trim()}\n请核对并给出自然日语。`:'\n请给出自然、完整的日语表达。'}\n目标表达我已熟悉，不必讲解它本身。`;
 const scope='结合场景和人物关系判断礼貌程度，保留原意，不擅自增加信息。';
 if(scenarioUnit())return `情境：${content.scene||content.zh||''}${content.intent?'\n想表达：'+content.intent:''}
用日语“${lesson.expression}”回应是否自然、得体？${scope}先给结论和合适的日语回应，再用中文简要解释回应中其他必要的词语、语法或语气，保持精炼。我已经熟悉正在练习的目标表达“${lesson.expression}”，不要重复解释它本身的意思、基本用法或对应知识点。解释只针对句中其他值得学习的词语、搭配和语法；若没有其他需要解释的内容，无需另加讲解。若目标表达在本句中使用有误或不适用，只指出具体问题及必要的修改理由，不展开复习它本身。`;
 const attempt=content.en?.trim()?`\n我的日语尝试：${content.en.trim()}\n请先核对并给出自然日语。`:'请给出自然、完整的日语表达。';
 return `意思：${content.zh||''}
必须使用“${lesson.expression}”，可按语境调整时态、否定、活用和普通／礼貌语体。${scope}${attempt}
再用中文解释句中其他关键词语／搭配及助词、活用或句式中实际用到的语法，根据句子的长度和难点展开，复杂结构可分段拆解，讲清楚且保持精炼。我已经熟悉正在练习的目标表达“${lesson.expression}”，不要重复解释它本身的意思、基本用法或对应知识点。解释只针对句中其他值得学习的词语、搭配和语法；若没有其他需要解释的内容，无需另加讲解。若目标表达在本句中使用有误或不适用，只指出具体问题及必要的修改理由，不展开复习它本身。`;
}
function translationCheckPrompt(q,qs,brief=false){
 const fields=[['情境',q.scene],['对方说',q.dialogue],['态度／意图',q.intent],['原题',q.zh],['要表达的意思',q.target],['填空句（如有）',q.stem],['本轮练习的目标表达',lesson.expression],['我的日语尝试（请优先核对这句）',qs.input],['页面参考表达（仅供对照，不是唯一答案）',(q.answers||[]).join('\n')]].filter(([,text])=>typeof text==='string'&&text.trim());
 if(brief)return `沿用前面的核对要求，请核对下面这道日语表达练习。\n${fields.map(([label,text])=>label+'：'+text).join('\n')}\n仍按之前的要求：独立判断我的原句，结合人物关系看礼貌程度、助词和活用，不因与参考表达不同就判错；目标表达我已熟悉，不必讲解它本身。`;
return `请核对下面这道日语表达练习。\n${fields.map(([label,text])=>label+'：'+text).join('\n')}\n页面只按收录答案匹配，未匹配不代表我写错。请根据题意、语境和实际日语用法，独立判断我的原句是否意思准确、语法正确、表达自然、得体，并结合人物关系检查礼貌程度、助词和活用；不要因为它与参考表达不同就判错。若是填空题，请把我的填写放回题干后判断。\n如果我的原句正确且自然，请明确说可以这样说，并简要说明；不要为贴近参考答案而强行改写。口语缩略、语体差异或只是可选润色，请与真正的错误区分。\n如果不准确、不正确或不自然，请具体指出哪里有问题、为什么，给出保留原意的自然修改；不要只贴一个答案。结合修改简要解释涉及的新单词、搭配或语法，按实际难点讲清楚，不限制条数或句数。\n我已熟悉本轮目标表达，不要重复解释它本身的意思、基本用法或对应知识点；只有它在这句话里确实用错或不适用时，才说明具体问题与必要修改理由。\n请用中文讲解，日语例句保留原文。`;
}
function translationCheckControls(q,qs,editAction='edit-answer'){
 if(questionType(q)!=='input'||!qs.checked||!qs.revealed||!qs.input?.trim())return '';
 return `<div class="translation-check-tools"><div class="actions translation-check-actions">${button('修改再试',editAction,'button secondary')}${button('复制 AI 核对指令','copy-translation-check','button secondary')}</div><p class="small translation-check-help">复制后粘贴发送给 AI，核对你的表达是否正确、自然。同一个 AI 对话里，第一次复制完整要求，之后只复制本题内容。${aiFullButton('translation','copy-translation-check-full')}</p></div>`;
}
async function copyTranslationCheck(forceFull=false){
 const c=currentContext()||(view==='study'&&state.learn?.stage==='intro'?{q:state.learn.pinnedEntry||lesson.entry,qs:state.learn.entryAttempt||state.learn.q}:null);
 if(!c||questionType(c.q)!=='input'||!c.qs.checked||!c.qs.revealed||!c.qs.input?.trim())return;
 const brief=!forceFull&&aiRulesSent('translation');
await copyCheckText(translationCheckPrompt(c.q,c.qs,brief),'translation',brief);
}
function personalAiKind(){return scenarioUnit()?'scenario':'personal';}
function personalCheckControl(id=''){
 const ready=id|| (scenarioUnit()?state.draft.scene?.trim():state.draft.zh?.trim());
 return `<div class="ai-check-tools">${button('复制 AI 核对指令','copy-ai-check','button secondary',`data-id="${esc(id)}" ${ready?'':'disabled'}`)}${aiFullButton(personalAiKind(),'copy-ai-check-full',id,'text-button')}</div>`;
}
async function copyPersonalCheck(id,forceFull=false){
 let content;
 if(dialog.open&&document.getElementById(scenarioUnit()?'edit-scene':'edit-zh'))content=scenarioUnit()?{scene:document.getElementById('edit-scene').value,intent:document.getElementById('edit-intent')?.value||''}:{zh:document.getElementById('edit-zh').value,en:document.getElementById('edit-en')?.value||''};
 else content=id?state.custom.find(c=>c.id===id):state.draft;
 if(!content||(scenarioUnit()?!content.scene?.trim():!content.zh?.trim())){toast(scenarioUnit()?'先写下你想到的场景':'先写下中文意思');return;}
 const kind=personalAiKind(),brief=!forceFull&&aiRulesSent(kind);
await copyCheckText(personalCheckPrompt(content,brief),kind,brief);
}
async function copyCheckText(text,kind,brief=false){
 let copied=false;
 try{if(typeof navigator==='undefined'||!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);copied=true;}
 catch{
  const editor=dialog.open&&/id="edit-(?:zh|scene)"/.test(dialog.innerHTML);
  if(editor){const markup=`<h3>核对指令</h3><p class="small">当前浏览器未能自动复制，可以选中下方文字复制。填写中的内容已保留。</p><textarea id="ai-copy-text" readonly>${esc(text)}</textarea>${button('收起指令','close-ai-copy','button secondary')}`;let region=dialog.querySelector('#ai-fallback');if(region)region.innerHTML=markup;else dialog.insertAdjacentHTML('beforeend',`<div id="ai-fallback">${markup}</div>`);}
  else showDialog(`<h2>AI 核对指令</h2><p class="small">当前浏览器未能自动复制，已为你准备好文字。</p><textarea id="ai-copy-text" readonly>${esc(text)}</textarea><p class="small">选中复制后，粘贴给你常用的 AI。</p><div class="actions">${button('返回继续填写','close-dialog')}</div>`);
  const field=document.getElementById('ai-copy-text');field.focus();field.select?.();
 }
 if(copied){if(kind)markAiRulesSent(kind);toast(brief?'已复制简短指令，沿用前面的核对要求':'已复制完整指令，粘贴给你常用的 AI 即可');}
}
function updateCopyControls(){const el=app.querySelector('[data-action="copy-ai-check"][data-id=""]');if(el)el.disabled=scenarioUnit()?!(state.draft.scene?.trim()):!state.draft.zh?.trim();}
// 学习进度条上的回看入口：只读查看，不修改成绩、进度、笔记或复习安排。
function learningStepAction(l,i,current){
 if(i>=current)return '';
 if(i===0)return l.entryAttempt?.revealed?'recap-entry':'';
 if(i===1)return 'recap-intro';
 return '';
}
function learningQuestionNav(l){
 if(!['exercise','custom'].includes(l.stage))return '';
 const questions=l.pinnedLearning||lesson.learning;
 const chips=questions.map((q,i)=>{
  const done=l.results.some(r=>r.id===q.id),current=l.stage==='exercise'&&i===l.index&&!done;
  if(done)return `<button type="button" class="question-chip done" data-action="recap-question" data-q="${i}" aria-label="回看第 ${i+1} 题">${i+1}</button>`;
  return `<span class="question-chip ${current?'current':'upcoming'}" ${current?'aria-current="step"':''}>${i+1}</span>`;
 }).join('');
 return `<div class="session-questions" role="group" aria-label="本轮学习题"><span class="session-questions-label">学习题</span>${chips}<span class="session-questions-hint">点已完成的题可回看，不影响成绩</span></div>`;
}
// 回看卡片：每个“标签＋内容”是同一层级（标签统一加粗放大，内容统一字号与间距）；情境和任务正文是主题，稍大。
function recapRow(label,text,{lang='',topic=false}={}){return `<div class="recap-row"><p class="recap-label">${esc(label)}</p><p class="recap-copy${topic?' is-topic':''}"${lang?` lang="${lang}"`:''}>${esc(text)}</p></div>`;}
function recapDialog(title,q,snap,gradeText){
  const type=questionType(q),parts=promptParts(q);
  const scene=parts.fields.filter(x=>x[1]==='情境').map(([text,label])=>recapRow(label,text,{topic:true})).join('');
  const context=parts.fields.filter(x=>x[1]!=='情境').map(([text,label])=>recapRow(label,text)).join('');
  const task=recapRow(parts.label,parts.target,{topic:true});
  const candidates=q.candidates?recapRow('比较回应',q.candidates,{lang:'ja'}):'';
  let mine='',reference;
  if(type==='choice'){
   const chosen=q.choices.find(x=>x.id===snap?.choice),right=q.choices.find(x=>x.id===q.correctChoice);
   mine=chosen?recapRow('你的选择',chosen.text):'';
   reference=recapRow('正确选项',right?.text||'');
  }else{
   if(type==='input'&&snap?.input?.trim())mine=recapRow('你的作答',snap.input,{lang:'ja'});
   reference=recapRow('参考表达',q.answers[0],{lang:'ja'});
  }
  showDialog(`<h2>${esc(title)}</h2><p class="small">仅供查看，不会改变成绩和进度。</p><div class="recap-body">${scene}${context}${task}${candidates}${mine}${reference}${q.feedback?`<p class="small">${esc(q.feedback)}</p>`:''}${gradeText?recapRow('当时的结果',gradeText):''}</div><div class="actions">${button('关闭','close-dialog','button secondary')}</div>`);
 }
function learningRecapQuestion(i){
 const l=state.learn;if(!l)return;
 const q=(l.pinnedLearning||lesson.learning)[i];if(!q)return;
 const r=[...l.results].reverse().find(x=>x.id===q.id);if(!r)return;
 const snap=r.source==='entry-check'?l.entryAttempt:r.snap;
 const text=r.source==='entry-check'?'初次尝试答对，已计入本题':questionType(q)==='choice'?(r.choiceCorrect?'判断正确':'这次选错了'):({good:'会了',hard:'不熟',again:'不会'}[r.grade]||'');
 recapDialog(`回看第 ${i+1} 题`,q,snap||null,text);
}
function learningRecapEntry(){
 const l=state.learn;if(!l?.entryAttempt?.revealed)return;
 recapDialog('回看初次尝试',l.pinnedEntry||lesson.entry,l.entryAttempt,'');
}
function learningRecapIntro(){
 showDialog(`<h2>${esc(lesson.expression)}</h2><p class="small">仅供查看，不会改变成绩和进度。</p><p>${esc(lesson.explanation)}</p><div class="formula">${esc(lesson.formula)}</div>${lesson.examples.map(e=>`<div class="example"><p class="en" lang="ja">${esc(e.en)}</p><p class="zh">${esc(e.zh)}</p></div>`).join('')}${lesson.boundary?`<p class="small">${esc(lesson.boundary)}</p>`:''}<div class="actions">${button('关闭','close-dialog','button secondary')}</div>`);
}
function orderedContinuation(id,origin){
 const scope=origin&&catalog.domains.some(d=>d.id===origin.domain)?origin:{domain:unitById.get(id)?.domain||domain,tab:'scene',filter:'all',subfilter:'all',search:''};
 const ordered=[...new Set([...(scope.ids||[]),...learningSelection(scope).map(u=>u.id)])].map(id=>unitById.get(id)).filter(u=>unitInOrigin(u,scope));
 const at=ordered.findIndex(u=>u.id===id),rest=at<0?ordered:[...ordered.slice(at+1),...ordered.slice(0,at)];
 const unit=rest.find(u=>!record(u.id).mastered&&record(u.id).learn?.stage!=='done');
 return unit?{unit,origin:scope,next:true}:null;
}
function learningResumeTarget(){
 const recent=store.resume?.learn?.id||store.activeId,last=unitById.get(recent),r=last&&record(recent);
 const waitingDay=r?.learn?.stage==='done'&&r.learn.pendingDailyDate;
 if(waitingDay&&ceciliaDay(waitingDay)){const unit=ceciliaIds(waitingDay).map(id=>unitById.get(id)).find(u=>dateLearningPending(u.id,waitingDay));if(unit)return {unit,origin:currentDayOrigin(waitingDay),next:true,dayRestart:true};}
 if(last&&r.learn&&(!r.mastered||r.learn.dailyReplay)&&r.learn.stage!=='done')return {unit:last,origin:r.learn.origin};
 if(last&&r.learn&&isCeciliaOrigin(r.learn.origin)){const next=nextCeciliaUnit(originDay(r.learn.origin),recent);if(next)return {unit:next,origin:r.learn.origin,next:true};return null;}
 const unfinished=learningUnits().sort((a,b)=>Number(record(b.id).updatedAt||0)-Number(record(a.id).updatedAt||0));
 if(unfinished.length)return {unit:unfinished[0],origin:record(unfinished[0].id).learn.origin};

 if(last&&r.learn)return orderedContinuation(last.id,r.learn.origin);
 return null;
}
function requestedReviewScope(){return Object.prototype.hasOwnProperty.call(store,'reviewScope')?store.reviewScope:store.resume?.review?.origin||null;}
function reviewResumeTarget(){
 const recent=store.resume?.review?.id,last=unitById.get(recent);
 if(last&&record(recent).review&&!record(recent).mastered)return last;
 const active=filterReviewScope(availableUnits(),requestedReviewScope()),pending=active.filter(u=>record(u.id).review).sort((a,b)=>Number(record(b.id).updatedAt||0)-Number(record(a.id).updatedAt||0));
 return pending[0]||active.sort((a,b)=>record(a.id).schedule.due-record(b.id).schedule.due)[0]||null;
}
function learningStatusFor(unit){const l=record(unit.id).learn;const prefix=isCeciliaOrigin(l?.origin)?'小枝萌菜 · '+ceciliaDateLabel(originDay(l.origin))+' · ':'';return prefix+(!l?'下一个表达':({entry:'初次尝试',intro:'看讲解',exercise:`学习题 ${Math.max(l.results.length,l.index)+1} / ${(l.pinnedLearning||unit.learning).length}`,custom:unit.practiceProfile==='scenario'?'写自己的场景':'写自己的例句',done:'已完成'}[l.stage]));}
function continueLearningHome(){
 const target=learningResumeTarget();if(!target){go('library');return;}
 if(target.dayRestart){openCeciliaUnit(target.unit.id,originDay(target.origin),true);return;}
 selectLesson(target.unit.id);if(target.origin)applyLearningOrigin(target.origin);
 if(!state.learn)state.learn=newLearning();if(target.origin){state.learn.origin=target.origin;state.learn.dailyReplay=!!state.mastered&&isCeciliaOrigin(target.origin);}
 save();go('study');
}
function continueReviewHome(){if(!Object.prototype.hasOwnProperty.call(store,'reviewScope'))store.reviewScope=requestedReviewScope();const target=reviewResumeTarget();if(!target){go('review');return;}selectLesson(target.id);if(state.review)go('practice');else startReview();}
function supportHomePage(){
 const learn=learningResumeTarget(),review=reviewResumeTarget(),r=review&&record(review.id);
 const learningCopy=learn?(learn.dayRestart?'小枝萌菜 · '+ceciliaDateLabel(originDay(learn.origin))+' · 本日未练习':learningStatusFor(learn.unit)):'按场景或表达功能，选择想练的内容';
 const reviewCopy=r?.review?`本轮已完成 ${r.review.index} / ${r.review.queue.length} 题`:review?(r.schedule.due<=Date.now()?'已到复习时间':'尚未到期，也可以提前练习'):'先学习一个表达，复习会从这里开始';
 const card=(kind,title,topic,copy,actions)=>`<article class="home-card home-${kind}" aria-labelledby="home-${kind}-title"><h2 id="home-${kind}-title" class="home-entry-title">${title}</h2><div class="home-card-center"><p class="home-topic-label">${topic?'本次主题':kind==='learn'?'从这里开始':'温故知新'}</p><h3 class="home-topic">${topic?esc(topic):kind==='learn'?'找到想说的表达':'让表达记得更牢'}</h3><p class="home-progress">${esc(copy)}</p></div><div class="home-actions">${actions}</div></article>`;
 return `<section class="home-intro"><p class="eyebrow">一点一点，把表达变成自己的。</p><h1>想说的话，<br>练到能用出来。</h1></section>${moodStripMarkup()}<section class="home-grid" aria-label="学习与复习">${card('learn','学习',learn?.unit.meaning,learningCopy,button('选择新表达','library','button home-action')+button('继续学习','continue-learning-home','button home-action',learn?'':'disabled aria-describedby="home-learn-empty"'))}${card('review','复习',review?.meaning,reviewCopy,button('查看复习库','review','button home-action')+button('继续复习','continue-review-home','button home-action',review?'':'disabled aria-describedby="home-review-empty"'))}</section>${!learn?'<p id="home-learn-empty" class="visually-hidden">暂无可继续的学习，请先选择新表达。</p>':''}${!review?'<p id="home-review-empty" class="visually-hidden">暂无可复习的表达，请先开始学习。</p>':''}`;
}
// A scope counts expression units, never raw source lines or individual questions.
function libraryProgress(ids,day){
 const unique=[...new Set(ids)].filter(id=>unitById.has(id));
 const p={total:unique.length,completed:0,mastered:0,active:0,skipped:0,due:0,pendingReview:0};
 for(const id of unique){const r=record(id),visit=day?ceciliaVisit(id,day):null,l=r.learn;
  const sameDay=!day||originDay(l?.origin)===day;
  const attempted=l?.results?.some(x=>x.grade!=='skip');
  if(day?visit?.status==='mastered':r.mastered)p.mastered++;
  else if(day&&visit?.status==='skip')p.skipped++;
  else if(day&&visit?.status==='done'){
   const didPractice=visit.attempted??(sameDay&&l?.stage==='done'?!!attempted:true);
   if(didPractice)p.completed++;else p.skipped++;
  }else if(sameDay&&l?.stage==='done'){if(attempted)p.completed++;else p.skipped++;}
  else if(l&&l.stage!=='done'&&sameDay)p.active++;
  if(r.enrolled&&!r.mastered){if(r.schedule.due<=Date.now())p.due++;if(r.review)p.pendingReview++;}
 }
 return p;
}
function completionScopeProgressData(){
 const origin=learningOrigin(),day=isCeciliaOrigin(origin)?originDay(origin):null;
 const meta=catalog.domains.find(d=>d.id===origin.domain);
 const groups=origin.tab==='scene'?catalog.scenes:catalog.functions;
 const group=groups.find(g=>g.id===origin.filter),sub=group?.children.find(c=>c.id===origin.subfilter);
 const label=day?[meta?.name,ceciliaDateLabel(day)].filter(Boolean).join(' · '):[meta?.name||'当前板块',group&&(group.nameByDomain?.[origin.domain]||group.name),sub?.name,origin.search?.trim()?`筛选“${origin.search.trim()}”`:null].filter(Boolean).join(' · ');
 const ids=day?ceciliaIds(day):([...(origin.ids||[]),...learningSelection(origin).map(u=>u.id)]).filter(id=>unitById.get(id)?.domains.includes(origin.domain));
 const progress=libraryProgress(ids,day),finished=progress.completed+progress.mastered;
 return {label,day,progress,finished,remaining:progress.total-finished};
}
function completionScopeProgressMarkup(){
 const {label,progress:p,finished,remaining}=completionScopeProgressData();
 const pc=n=>p.total?100*n/p.total:0;
 return `<section class="completion-scope-progress" aria-label="当前范围学习进度"><p class="completion-scope-label">${esc(label)}</p><div class="completion-scope-counts"><p>已完成 <strong>${finished}</strong> 个</p><p>还剩 <strong>${remaining}</strong> 个</p><span>共 ${p.total} 个表达</span></div><div class="library-progress-track" role="progressbar" aria-label="当前范围已完成表达" aria-valuemin="0" aria-valuemax="${p.total||1}" aria-valuenow="${finished}" aria-valuetext="共 ${p.total} 个表达，已完成 ${finished} 个，还剩 ${remaining} 个"><span class="progress-learned" style="width:${pc(p.completed)}%"></span><span class="progress-mastered" style="width:${pc(p.mastered)}%"></span></div><p class="completion-scope-detail">已学完 ${p.completed} · 已掌握 ${p.mastered}${p.skipped?` · 已略过 ${p.skipped}（未计入完成）`:''}</p></section>`;
}
function libraryProgressMarkup(ids,day){
 const p=libraryProgress(ids,day),finished=p.completed+p.mastered,pc=n=>p.total?100*n/p.total:0;
 return `<section class="library-progress" aria-label="${day?'当天':'当前库'}学习与复习进度"><div class="library-learning-progress"><div class="library-progress-heading"><h2>学习进度</h2><p><strong>${finished}</strong><span> / ${p.total} 个表达</span></p></div><div class="library-progress-track" role="progressbar" aria-label="已学完或已掌握的表达" aria-valuemin="0" aria-valuemax="${p.total||1}" aria-valuenow="${finished}" aria-valuetext="已学完 ${p.completed}，已掌握 ${p.mastered}，共 ${p.total} 个表达"><span class="progress-learned" style="width:${pc(p.completed)}%"></span><span class="progress-mastered" style="width:${pc(p.mastered)}%"></span></div><div class="library-progress-legend"><span>已学完 <b>${p.completed}</b></span><span>已掌握 <b>${p.mastered}</b></span><span>学习中 <b>${p.active}</b></span>${p.skipped?`<span>已略过 <b>${p.skipped}</b></span>`:''}</div></div><div class="library-review-progress"><h2>复习安排</h2><div><span>已到期 <strong>${p.due}</strong> 个</span><span>未完成 <strong>${p.pendingReview}</strong> 轮</span></div></div></section>`;
}
