'use strict';
function expressionHint(q){
 const rules=window.JUJIAN_HINT_RULES?.[lesson.id];
 if(!rules)return q.hint||'先回忆这个表达的结构，再根据情境调整。';
 if(q.id.startsWith('c-'))return rules.core;
 const canonical=unitById.get(lesson.id),candidate=q.id==='entry'?canonical.entry:[...canonical.learning,...canonical.review].find(x=>x.id===q.id);
 if(candidate&&candidate.zh===q.zh&&candidate.answers.some(a=>q.answers.includes(a)))return q.id==='entry'?rules.entry:rules[q.id[0]==='l'?'learning':'review'][Number(q.id.slice(1))-1]||rules.core;
 return window.JUJIAN_HINT_FOR_QUESTION?.(lesson.id,q)||rules.core;
}
function personalCheckPrompt(content){
 const scope='结合场景和人物关系判断礼貌程度，保留原意，不擅自增加信息。';
 if(scenarioUnit())return `情境：${content.scene||content.zh||''}${content.intent?'\n想表达：'+content.intent:''}
用日语“${lesson.expression}”回应是否自然、得体？${scope}先给结论和合适的日语回应，再用中文简要解释必要的词语、语法或语气；根据情境解释清楚，保持精炼。不适用时说明原因，不要硬套。`;
 const attempt=content.en?.trim()?`\n我的日语尝试：${content.en.trim()}\n请先核对并给出自然日语。`:'请给出自然、完整的日语表达。';
 return `意思：${content.zh||''}
必须使用“${lesson.expression}”，可按语境调整时态、否定、活用和普通／礼貌语体。${scope}${attempt}
再用中文解释关键词语／搭配及助词、活用或句式中实际用到的语法，根据句子的长度和难点展开，复杂结构可分段拆解，讲清楚且保持精炼；语块不适用时说明原因，不要硬套。`;
}
function personalCheckControl(id=''){
 const ready=id|| (scenarioUnit()?state.draft.scene?.trim():state.draft.zh?.trim());
 return `<div class="ai-check-tools">${button('复制 AI 核对指令','copy-ai-check','button secondary',`data-id="${esc(id)}" ${ready?'':'disabled'}`)}</div>`;
}
async function copyPersonalCheck(id){
 let content;
 if(dialog.open&&document.getElementById(scenarioUnit()?'edit-scene':'edit-zh'))content=scenarioUnit()?{scene:document.getElementById('edit-scene').value,intent:document.getElementById('edit-intent')?.value||''}:{zh:document.getElementById('edit-zh').value,en:document.getElementById('edit-en')?.value||''};
 else content=id?state.custom.find(c=>c.id===id):state.draft;
 if(!content||(scenarioUnit()?!content.scene?.trim():!content.zh?.trim())){toast(scenarioUnit()?'先写下你想到的场景':'先写下中文意思');return;}
 const text=personalCheckPrompt(content);
 try{if(typeof navigator==='undefined'||!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);toast('指令已复制，粘贴给你常用的 AI 即可');}
 catch{
  const editor=dialog.open&&/id="edit-(?:zh|scene)"/.test(dialog.innerHTML);
  if(editor){const markup=`<h3>核对指令</h3><p class="small">当前浏览器未能自动复制，可以选中下方文字复制。填写中的内容已保留。</p><textarea id="ai-copy-text" readonly>${esc(text)}</textarea>${button('收起指令','close-ai-copy','button secondary')}`;let region=dialog.querySelector('#ai-fallback');if(region)region.innerHTML=markup;else dialog.insertAdjacentHTML('beforeend',`<div id="ai-fallback">${markup}</div>`);}
  else showDialog(`<h2>AI 核对指令</h2><p class="small">当前浏览器未能自动复制，已为你准备好文字。</p><textarea id="ai-copy-text" readonly>${esc(text)}</textarea><p class="small">选中复制后，粘贴给你常用的 AI。</p><div class="actions">${button('返回继续填写','close-dialog')}</div>`);
  const field=document.getElementById('ai-copy-text');field.focus();field.select?.();
 }

}
function updateCopyControls(){const el=app.querySelector('[data-action="copy-ai-check"][data-id=""]');if(el)el.disabled=scenarioUnit()?!(state.draft.scene?.trim()):!state.draft.zh?.trim();}
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
 return `<section class="home-intro"><p class="eyebrow">一点一点，把表达变成自己的。</p><h1>想说的话，<br>练到能用出来。</h1></section><section class="home-grid" aria-label="学习与复习">${card('learn','学习',learn?.unit.meaning,learningCopy,button('选择新表达','library','button home-action')+button('继续学习','continue-learning-home','button home-action',learn?'':'disabled aria-describedby="home-learn-empty"'))}${card('review','复习',review?.meaning,reviewCopy,button('查看复习库','review','button home-action')+button('继续复习','continue-review-home','button home-action',review?'':'disabled aria-describedby="home-review-empty"'))}</section>${!learn?'<p id="home-learn-empty" class="visually-hidden">暂无可继续的学习，请先选择新表达。</p>':''}${!review?'<p id="home-review-empty" class="visually-hidden">暂无可复习的表达，请先开始学习。</p>':''}`;
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
function libraryProgressMarkup(ids,day){
 const p=libraryProgress(ids,day),finished=p.completed+p.mastered,pc=n=>p.total?100*n/p.total:0;
 return `<section class="library-progress" aria-label="${day?'当天':'当前库'}学习与复习进度"><div class="library-learning-progress"><div class="library-progress-heading"><h2>学习进度</h2><p><strong>${finished}</strong><span> / ${p.total} 个表达</span></p></div><div class="library-progress-track" role="progressbar" aria-label="已学完或已掌握的表达" aria-valuemin="0" aria-valuemax="${p.total||1}" aria-valuenow="${finished}" aria-valuetext="已学完 ${p.completed}，已掌握 ${p.mastered}，共 ${p.total} 个表达"><span class="progress-learned" style="width:${pc(p.completed)}%"></span><span class="progress-mastered" style="width:${pc(p.mastered)}%"></span></div><div class="library-progress-legend"><span>已学完 <b>${p.completed}</b></span><span>已掌握 <b>${p.mastered}</b></span><span>学习中 <b>${p.active}</b></span>${p.skipped?`<span>已略过 <b>${p.skipped}</b></span>`:''}</div></div><div class="library-review-progress"><h2>复习安排</h2><div><span>已到期 <strong>${p.due}</strong> 个</span><span>未完成 <strong>${p.pendingReview}</strong> 轮</span></div></div></section>`;
}
