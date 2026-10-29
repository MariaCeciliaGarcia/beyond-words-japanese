'use strict';
// The three approved learning profiles share navigation and storage with the library.
function scenarioUnit(){return lesson.practiceProfile==='scenario';}
function questionType(q){return q.type||(scenarioUnit()?'recall':'input');}
function personalLabel(){return scenarioUnit()?'我的场景':'我的例句';}
function draftPresent(){return scenarioUnit()?!!(state.draft.scene?.trim()||state.draft.intent?.trim()||state.draft.note?.text?.trim()):!!(state.draft.zh?.trim()||state.draft.en?.trim()||state.draft.note?.text?.trim());}
function pilotHint(q,qs){
 if(qs.revealed)return '';
 const help=window.getQuestionHelp(q);
 return `<div class="hint-wrap recall-tools">${button(qs.hints.includes('frame')?'收起场合提示':'场合提示','hint','hint-button',`data-hint="frame" aria-expanded="${qs.hints.includes('frame')}"`)}${help.words.length?button(qs.hints.includes('words')?'收起词语提示':'词语提示','hint','hint-button',`data-hint="words" aria-expanded="${qs.hints.includes('words')}"`):''}</div>${qs.hints.includes('frame')?`<div class="hint-box">${window.renderQuestionHintContent(q,'frame')}</div>`:''}${qs.hints.includes('words')?`<div class="hint-box">${window.renderQuestionHintContent(q,'words')}</div>`:''}`;
}
function pilotQuestionSheet(q,qs,context){
 const entry=context==='entry',choice=questionType(q)==='choice';
 const selected=q.choices?.find(x=>x.id===qs.choice),correct=choice&&qs.revealed&&qs.choice===q.correctChoice;
 const choices=choice?`<div class="scenario-options" role="group" aria-label="选择回应的含义">${q.choices.map((x,i)=>button(`<span class="option-letter" aria-hidden="true">${String.fromCharCode(65+i)}</span><span lang="ja">${esc(x.text)}</span>`,'choose-answer',`scenario-option ${qs.choice===x.id?'is-selected':''} ${qs.revealed&&x.id===q.correctChoice?'is-answer':''}`,`data-choice="${x.id}" aria-pressed="${qs.choice===x.id}" ${qs.revealed?'disabled':''}`)).join('')}</div>`:'';
 return `<section class="sheet question-sheet scenario-sheet"><div class="scenario-task-pane"><div class="question-heading">${promptMarkup(q)}${!qs.revealed?questionNotesMarkup(q,qs,context,false):''}</div>${pilotHint(q,qs)}</div><div class="scenario-response-pane">${choices}${!choice&&!qs.revealed?`<p class="recall-help">先在心里想一句，或自己说一遍。</p><div class="actions">${button('看表达','reveal')}</div>`:''}
 ${qs.revealed?`<div class="answer-box ${correct?'is-correct':'is-comparison'}" aria-live="polite"><p class="result">${choice?(correct?'判断正确':'再看看这里的意思'):'可以这样回应'}</p>${choice?`<p class="answer-explanation"><strong>${esc(q.choices.find(x=>x.id===q.correctChoice)?.text||'')}</strong></p>`:`<p class="answer-en" lang="ja">${esc(q.answers[0])}</p>`}${!choice&&q.answers.length>1?`<details><summary>也可以这样回应</summary><p lang="ja">${q.answers.slice(1).map(esc).join('<br>')}</p></details>`:''}<p>${esc(q.feedback|| (q.id.startsWith('c-')?'对照自己的场景：这个回应是否适合你保存的场景？':'这句可以接住对方告诉你的情况。'))}</p>
 ${questionNotesMarkup(q,qs,context,true)}${entry?`<div class="actions">${button('看看讲解','entry-intro')}</div>`:choice?`<div class="actions">${button('下一题','choice-next')}</div>`:`<div class="response-panel"><p class="section-label">这次想起来了吗？</p><div class="grade-row">${button('会了','grade','','data-grade="good"')}${button('不熟','grade','','data-grade="hard"')}${button('不会','grade','','data-grade="again"')}</div><p class="small">按自己刚才的回忆判断。</p></div>`}${entry?'':`<div class="answer-followups">${button('看看讲解','supplement','utility-link')}</div>`}</div>`:''}</div></section>`;
}
function expressionComparisonMarkup(input,reference){
 return `<div class="expression-comparison entry-result-comparison">${[['你的表达：',input],['参考表达：',reference]].map(([label,text])=>`<div class="expression-comparison-item"><p class="expression-comparison-label">${label}</p><p class="expression-comparison-value" lang="ja">${esc(text)}</p></div>`).join('')}</div>`;
}
function pilotEntryFeedback(){
 const l=state.learn;
 if(!l||l.returnStage)return '';
 const attempt=l.entryAttempt||l.q,q=l.pinnedEntry||lesson.entry;
 if(questionType(q)!=='input'||!attempt||!attempt.revealed)return '';
 const correct=attempt.checked&&matches(attempt.input,q.answers),assisted=attempt.targetSeen||attempt.usedHint||attempt.exposed;
 const title=correct?(assisted?'借助提示，答对了':'答对了！'):attempt.checked?'对照一下刚才的表达':'先认识这个表达';
 const note=correct?'刚才这句话，你表达出来了。':attempt.checked?'先看看本题的表达，再对照你的尝试。':'先看看刚才这句话可以怎么说。';
 const path=correct?'m6 12 4 4 8-8':attempt.checked?'M5 8h14m-4-4 4 4-4 4M19 16H5m4-4-4 4 4 4':'M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4Zm8 2v14';
 return `<div id="entry-feedback" class="entry-feedback entry-result ${correct?'entry-result-success':'entry-result-neutral'}" tabindex="-1" role="status" aria-label="${title}"><span class="entry-result-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="${path}" pathLength="1"/></svg></span><h2 class="entry-result-title">${title}</h2><p class="entry-result-note">${note}</p>${correct?`<p class="entry-result-answer" lang="ja">${esc(attempt.input)}</p>`:attempt.checked?expressionComparisonMarkup(attempt.input,q.answers[0]):`<p class="entry-result-answer" lang="ja">${esc(q.answers[0])}</p>`}${attempt.checked&&!correct?translationCheckControls(q,attempt,'edit-entry'):''}<div class="entry-result-utilities">${attempt.input?.trim()&&(!attempt.checked||correct)?button('返回修改','edit-entry','text-button entry-edit'):''}${questionNotesMarkup(q,attempt,'entry',true)}</div><p class="entry-result-next">${entryCreditQuestion()?'这题已计入进度，接下来换个情境练。':'接下来，看看这个表达怎么用。'}</p>${correct?`<div class="actions entry-result-actions">${button(entryCreditQuestion()?'继续练新题':'开始练习','intro-next')}</div>`:''}</div>`;
}
function entryCreditQuestion(){
 const l=state.learn;if(!l||l.returnStage)return null;
 const a=l.entryAttempt||l.q,e=l.pinnedEntry||lesson.entry;
 if(!a?.checked||!a.revealed||a.exposed||questionType(e)!=='input'||!matches(a.input,e.answers))return null;
 return (l.pinnedLearning||lesson.learning).find(q=>questionType(q)==='input'&&normalize(q.target||q.zh)===normalize(e.target||e.zh)&&normalize(q.stem||'')===normalize(e.stem||'')&&matches(a.input,q.answers))||null;
}
function skipCreditedEntry(l){const questions=l.pinnedLearning||lesson.learning;while(l.index<questions.length&&questions[l.index].id===l.entryCreditId)l.index++;}
function beginLearningExercises(){const l=state.learn,credit=entryCreditQuestion(),a=l.entryAttempt||l.q;l.stage='exercise';l.index=0;
 if(credit&&!l.results.some(r=>r.id===credit.id)){l.entryCreditId=credit.id;l.results.push({id:credit.id,grade:'good',selfGrade:null,kind:'input',help:!!(a.usedHint||a.targetSeen),source:'entry-check',time:Date.now()});}
 l.q=newQuestionState();skipCreditedEntry(l);enrolled();
}
function focusEntryResult(){const result=app.querySelector('#entry-feedback');if(result){window.scrollTo(0,0);result.focus({preventScroll:true});}}
function personalDraftForm(){return `<label class="section-label" for="custom-scene">什么时候会这样回应？</label><textarea id="custom-scene" maxlength="600" placeholder="想想自己的生活，写下这个场景。">${esc(state.draft.scene||'')}</textarea>${personalCheckControl()}${personalDraftNotes()}`;}
function pilotCustomPage(){return creationLayout(true,personalDraftForm());}
function personalQuestion(c){
 if(scenarioUnit())return {id:c.id,type:'recall',zh:'先想一句回应，再看表达。',target:'先想一句回应，再看表达。',scene:c.scene||c.zh,intent:c.intent||'',answers:[c.kind==='scenario'?lesson.expression:c.en||lesson.expression],hint:'态度：结合你保存的场景，回忆这个回应的用途。',feedback:'这是你保存的个人场景。对照一下：这句回应能表达你当时的态度吗？场景不贴切时可以修改。'};
 return {id:c.id,zh:c.zh,answers:[c.en],hint:'先试着表达你保存的意思；想不起来时再看原句。'};
}
function pilotStatsMarkup(results){
 const choices=results.filter(r=>r.kind==='choice'),recalls=results.filter(r=>r.kind!=='choice'&&r.grade!=='skip');
 return `<div class="stats"><div class="stat"><strong>${choices.filter(r=>r.choiceCorrect).length}</strong><span>判断答对</span></div><div class="stat"><strong>${recalls.filter(r=>r.grade==='good').length}</strong><span>回忆出来（自评）</span></div><div class="stat"><strong>${results.filter(r=>r.grade==='hard'||r.grade==='again').length}</strong><span>需要再练</span></div></div>`;
}
function editScenario(id){
 editingCustom=id||null;const c=state.custom.find(x=>x.id===id);
 showDialog(`<h2>${c?'修改场景':'新增场景'}</h2><label class="section-label" for="edit-scene">什么时候会这样回应？</label><textarea id="edit-scene" maxlength="600">${esc(c?.scene||state.draft.scene||'')}</textarea>${personalEditNotes(id)}<div class="actions">${button('保存','commit-scenario','button',`data-id="${id||''}"`)}${button('取消','close-dialog','button secondary')}</div>`);
}
function saveScenario(scene,intent='',id){
 if(!scene.trim()){toast('先写下你想到的场景');return false;}
 const existing=state.custom.find(x=>x.id===id);
 if(existing)Object.assign(existing,{kind:'scenario',scene:scene.trim(),intent:intent.trim(),...copiedDraftNote()});
 else state.custom.push({id:`c-${crypto.randomUUID()}`,kind:'scenario',scene:scene.trim(),intent:intent.trim(),...copiedDraftNote()});
 if(!existing){state.draft.scene='';state.draft.intent='';delete state.draft.note;}save();return true;
}
