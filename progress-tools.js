'use strict';
// Local persistence and portable files. No account, server or network request.
let progressReadOnly=false,progressIssue='',damagedProgress='',pendingImport=null,lastSnapshotAt=0;
const progressSignatures=new Map(),locallyEditedProgress=new Set();
const progressSignature=r=>JSON.stringify(Object.fromEntries(Object.entries(r||{}).filter(([k])=>!['updatedAt','lastView'].includes(k))));
function basicProgress(value){return value&&value.version===2&&value.records&&typeof value.records==='object'&&!Array.isArray(value.records);}
function parseStored(raw,strict=false){try{const p=JSON.parse(raw||'null');if(!basicProgress(p))return null;if(Object.values(p.records).some(r=>!r||typeof r!=='object'||Array.isArray(r)||r.custom!==undefined&&!Array.isArray(r.custom)))return null;return strict?checkedProgress(p):p;}catch{return null;}}
const progressOrder=(a,b)=>Number(a?.generation||0)-Number(b?.generation||0)||Number(a?.updatedAt||0)-Number(b?.updatedAt||0);
function storageNotice(text){const el=document.getElementById('storage-warning');el.textContent=text;el.hidden=false;}
function loadStoredProgress(){
 let mainRaw=null,recoveryRaw=null;
 try{mainRaw=localStorage.getItem(KEY);recoveryRaw=localStorage.getItem(KEY+'.recovery');}catch{progressReadOnly=true;progressIssue='当前浏览器无法保存进度，请用文件备份保留本次练习。';storageNotice(progressIssue);return null;}
 const main=parseStored(mainRaw,true),recovery=parseStored(recoveryRaw,true);let previous=null;try{previous=parseStored(localStorage.getItem(KEY+'.previous'),true);}catch{}
 const selected=[main,recovery,previous].filter(Boolean).sort((a,b)=>progressOrder(b,a))[0]||null;
 if(selected){for(const [id,r]of Object.entries(selected.records))progressSignatures.set(id,progressSignature(r));if(!main&&mainRaw){damagedProgress=mainRaw;progressIssue='已从本地恢复副本找回进度，建议现在导出一份文件备份。';storageNotice(progressIssue);}return selected;}
 if(mainRaw||recoveryRaw){progressReadOnly=true;damagedProgress=mainRaw||recoveryRaw;progressIssue='原进度暂时无法读取，已停止覆盖。请导入有效备份，或先导出原始数据。';storageNotice(progressIssue);}
 return null;
}
function recordHasProgress(r){return !!(r&&(r.userModified||r.note?.updatedAt||r.draft?.note?.updatedAt||Object.keys(r.dailyVisits||{}).length||r.enrolled||r.mastered||r.learn||r.review||r.custom?.length||r.history?.length||r.draft&&Object.values(r.draft).some(v=>typeof v==='string'&&v.trim())));}
function mergeProgressRecords(local,remote){
 const out={...local};for(const [id,r]of Object.entries(remote||{}))if(!out[id]||!recordHasProgress(out[id])&&recordHasProgress(r)||(recordHasProgress(r)||!recordHasProgress(out[id]))&&Number(r.updatedAt||0)>Number(out[id].updatedAt||0))out[id]=r;return out;
}
function persistProgress(){
 const signature=progressSignature(state),edited=signature!==progressSignatures.get(lesson.id);
 if(edited&&(recordHasProgress(state)||recordHasProgress(JSON.parse(progressSignatures.get(lesson.id)||'null')))){state.userModified=true;state.updatedAt=Math.max(Date.now(),Number(state.updatedAt||0)+1);locallyEditedProgress.add(lesson.id);}
 store.records[lesson.id]=state;
 let latest=null;try{latest=parseStored(localStorage.getItem(KEY));}catch{}
 if(latest&&Number(latest.generation||0)>Number(store.generation||0)){keepProgressConflict();installProgressRuntime(latest);setTimeout(()=>render(),0);return persistProgress();}
 if(latest&&Number(latest.generation||0)===Number(store.generation||0)){preserveRecordConflicts(latest.records);store.records=mergeProgressRecords(store.records,latest.records);for(const kind of ['learn','review'])if(Number(latest.resume?.[kind]?.at||0)>Number(store.resume?.[kind]?.at||0)){store.resume=store.resume||{};store.resume[kind]=latest.resume[kind];}}
 state=store.records[lesson.id];store.activeId=lesson.id;store.ui={view,tab,filter,subfilter,search,domain,page,lastSpoken,lastExam};
 store.resume=store.resume||{};
 if(view==='study'&&state.learn&&(!state.mastered||state.learn.dailyReplay))store.resume.learn={id:lesson.id,origin:state.learn.origin,at:Date.now()};
 if(view==='practice'&&state.review&&!state.mastered)store.resume.review={id:lesson.id,origin:state.review.origin||null,at:Date.now()};
 store.updatedAt=Date.now();store.dataRevision=Math.max(Number(store.dataRevision||0),Number(latest?.dataRevision||0))+(edited?1:0);
 for(const [id,r]of Object.entries(store.records))progressSignatures.set(id,progressSignature(r));
 if(progressReadOnly)return false;
 const serialized=JSON.stringify(store);
 try{const oldRaw=localStorage.getItem(KEY);if(oldRaw&&Date.now()-lastSnapshotAt>60000&&parseStored(oldRaw,true)){localStorage.setItem(KEY+'.previous',oldRaw);lastSnapshotAt=Date.now();}}catch{}
 try{localStorage.setItem(KEY,serialized);}catch{storageNotice('本次修改暂时无法保存，请导出文件备份后再离开。');return false;}
 try{localStorage.setItem(KEY+'.recovery',serialized);}catch{/* Main save succeeded; the previous recovery copy remains. */}
 if(!progressIssue)document.getElementById('storage-warning').hidden=true;
 return true;
}
function handleProgressStorage(event){
 if(event.key!==KEY||!event.newValue)return;
 const incoming=parseStored(event.newValue,true);if(!incoming)return;
 if(Number(incoming.generation||0)>Number(store.generation||0)){keepProgressConflict();installProgressRuntime(incoming);render();toast('另一标签页恢复了备份，本页已同步');return;}
 if(Number(incoming.generation||0)<Number(store.generation||0)){persistProgress();return;}
 preserveRecordConflicts(incoming.records);
 const before=JSON.stringify(store.records),merged=mergeProgressRecords(store.records,incoming.records);
 const stale=Object.entries(store.records).some(([id,r])=>incoming.records[id]&&Number(r.updatedAt||0)>Number(incoming.records[id].updatedAt||0)&&progressSignature(r)!==progressSignature(incoming.records[id]));
 store.records=merged;state=store.records[lesson.id]||state;
 for(const kind of ['learn','review'])if(Number(incoming.resume?.[kind]?.at||0)>Number(store.resume?.[kind]?.at||0)){store.resume=store.resume||{};store.resume[kind]=incoming.resume[kind];}
 for(const [id,r]of Object.entries(store.records))progressSignatures.set(id,progressSignature(r));
 if(before!==JSON.stringify(merged)){render();toast('另一标签页的进度已更新');}else if(stale)persistProgress();
}
function progressConflictList(){try{const list=JSON.parse(localStorage.getItem(KEY+'.conflict-history')||'null');if(Array.isArray(list))return list;const old=parseStored(localStorage.getItem(KEY+'.conflict'));return old?[{at:old.updatedAt||Date.now(),data:old}]:[];}catch{return [];}}
function keepProgressConflict(snapshot=store){try{const data=JSON.parse(JSON.stringify(snapshot)),list=progressConflictList();if(!list.some(item=>JSON.stringify(item.data.records)===JSON.stringify(data.records)))list.push({at:Date.now(),data});localStorage.setItem(KEY+'.conflict-history',JSON.stringify(list.slice(-3)));localStorage.setItem(KEY+'.conflict',JSON.stringify(data));}catch{}}
function preserveRecordConflicts(incoming){for(const [id,r]of Object.entries(incoming||{})){const local=store.records[id];if(local&&locallyEditedProgress.has(id)&&Number(r.updatedAt||0)>Number(local.updatedAt||0)&&progressSignature(local)!==progressSignature(r)){keepProgressConflict({version:2,activeId:id,records:{[id]:local},ui:{view:'home',domain:unitById.get(id)?.domain||'daily'},generation:store.generation||0,updatedAt:Date.now()});locallyEditedProgress.delete(id);}}}
function installProgressRuntime(data){
 store=data;store.version=2;store.activeId=unitById.has(store.activeId)?store.activeId:'jp-yoyuu';lesson=unitById.get(store.activeId);state=store.records[lesson.id]||emptyState();store.records[lesson.id]=state;
 const context=store.ui||{};domain=catalog.domains.some(d=>d.id===context.domain)?context.domain:lesson.domain;tab=['scene','function'].includes(context.tab)?context.tab:'scene';filter=typeof context.filter==='string'?context.filter:'all';subfilter=typeof context.subfilter==='string'?context.subfilter:'all';search=typeof context.search==='string'?context.search:'';page=Number(context.page)||1;lastSpoken=context.lastSpoken||'daily';lastExam=context.lastExam||'ielts';view='home';
 progressSignatures.clear();locallyEditedProgress.clear();for(const [id,r]of Object.entries(store.records))progressSignatures.set(id,progressSignature(r));
}
function progressCounts(data){const all=Object.values(data.records||{});return {learning:all.filter(r=>r.learn&&r.learn.stage!=='done'&&!r.mastered).length,review:all.filter(r=>r.enrolled&&!r.mastered).length,mastered:all.filter(r=>r.mastered).length,custom:all.reduce((n,r)=>n+(r.custom?.length||0),0),notes:all.reduce((n,r)=>n+Number(!!r.note?.text?.trim())+Number(!!r.draft?.note?.text?.trim())+(r.custom||[]).filter(c=>c.note?.text?.trim()).length,0)};}
function progressBackup(){return {format:'beyondwords-japanese-progress',formatVersion:1,exportedAt:new Date().toISOString(),source:location.origin||'当前浏览器',data:JSON.parse(JSON.stringify(store))};}
function downloadProgressText(text,filename,mime='application/json'){
 const url=URL.createObjectURL(new Blob([text],{type:mime+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function exportProgress(){
 save();store.backupMeta={...(store.backupMeta||{}),exportedAt:Date.now(),revision:store.dataRevision};save();
 const text=JSON.stringify(progressBackup(),null,2),stamp=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).replace(/[ :]/g,'-');
 downloadProgressText(text,`Beyond Words 日本語-学习备份-${stamp}.json`);toast('备份文件已生成，请确认已保存到下载位置');
}
function validPersonalNote(n){return n===undefined||!!(n&&typeof n==='object'&&!Array.isArray(n)&&typeof n.text==='string'&&n.text.length<=10000&&Number.isFinite(n.updatedAt)&&n.updatedAt>=0);}
function validHelp(items){return items===undefined||Array.isArray(items)&&items.length<=40&&items.every(i=>typeof i==='string'||i&&typeof i==='object'&&!Array.isArray(i)&&['text','zh','en','label','value'].every(k=>i[k]===undefined||typeof i[k]==='string')&&(i.role===undefined||['support','target'].includes(i.role)));}
function validQuestion(q){return q&&validHelp(q.lexicalHints)&&validHelp(q.grammarHints)&&['target','scene','dialogue','intent','candidates','hint','frame','stem','inputLabel','feedback','guidance'].every(k=>q[k]===undefined||typeof q[k]==='string')&&typeof q.id==='string'&&typeof q.zh==='string'&&Array.isArray(q.answers)&&q.answers.length&&q.answers.every(a=>typeof a==='string')&&(!q.type||['input','choice','recall'].includes(q.type))&&(!q.type||q.type!=='choice'||Array.isArray(q.choices)&&q.choices.every(c=>typeof c.id==='string'&&typeof c.text==='string')&&q.choices.some(c=>c.id===q.correctChoice));}
function validQuestionState(q){return q&&typeof q.input==='string'&&Array.isArray(q.hints)&&q.hints.every(h=>typeof h==='string')&&['supportSeen','targetSeen'].every(k=>q[k]===undefined||typeof q[k]==='boolean');}
function validResults(list){return Array.isArray(list)&&list.every(r=>r&&['good','hard','again','skip'].includes(r.grade));}
function checkedProgress(data){
 if(!basicProgress(data))throw Error('这不是可识别的Beyond Words 日本語进度。');
 if(data.generation!==undefined&&(!Number.isSafeInteger(data.generation)||data.generation<0))throw Error('备份版本标记无法读取。');
 if(Object.keys(data.records).length>2000)throw Error('备份记录过多，暂时无法导入。');
 const copy=JSON.parse(JSON.stringify(data));
 for(const [id,raw]of Object.entries(copy.records)){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(id)||['constructor','prototype','__proto__'].includes(id)||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('备份中的表达记录不完整。');
  const r={...emptyState(),...raw};if(!Number.isSafeInteger(r.cursor)||r.cursor<0||r.updatedAt!==undefined&&(!Number.isFinite(r.updatedAt)||r.updatedAt<0))throw Error('备份中的进度序号无法读取。');
  if(typeof r.enrolled!=='boolean'||typeof r.mastered!=='boolean'||!Array.isArray(r.custom)||!r.draft||typeof r.draft!=='object'||typeof r.draft.zh!=='string'||typeof r.draft.en!=='string')throw Error('备份中的个人内容无法读取。');
  if(!validPersonalNote(r.note)||!validPersonalNote(r.draft.note))throw Error('备份中的笔记无法读取。');
  if(!r.schedule||!Number.isFinite(r.schedule.due)||!Number.isInteger(r.schedule.streak)||r.schedule.streak<0||!Array.isArray(r.history))throw Error('备份中的复习安排无法读取。');
  for(const c of r.custom)if(!c||typeof c.id!=='string'||(c.kind==='scenario'?(typeof c.scene!=='string'||typeof c.intent!=='string'):(typeof c.zh!=='string'||typeof c.en!=='string')))throw Error('备份中的例句或场景不完整。');
  for(const c of r.custom)if(!validPersonalNote(c.note))throw Error('备份中的例句笔记无法读取。');
  for(const field of ['scene','intent'])if(r.draft[field]!==undefined&&typeof r.draft[field]!=='string')throw Error('备份草稿无法读取。');
  if(r.learn){const l=r.learn;if(!['entry','intro','exercise','custom','done'].includes(l.stage)||!Number.isInteger(l.index)||l.index<0||l.index>5||!validQuestionState(l.q)||!validResults(l.results))throw Error('备份中的学习位置不完整。');if(l.pinnedEntry&&!validQuestion(l.pinnedEntry)||l.pinnedLearning&&(!Array.isArray(l.pinnedLearning)||!l.pinnedLearning.length||!l.pinnedLearning.every(validQuestion)))throw Error('备份中的原题无法读取。');const questionCount=l.pinnedLearning?.length||unitById.get(id)?.learning.length||5;if(l.stage==='exercise'&&l.index>=questionCount)throw Error('备份中的学习题号超出范围。');if(l.returnStage!==undefined&&l.returnStage!==null&&!['entry','exercise','review','custom'].includes(l.returnStage))throw Error('备份中的返回位置无法读取。');if(l.origin&&(!catalog.domains.some(d=>d.id===l.origin.domain)||!Array.isArray(l.origin.ids)||!l.origin.ids.every(id=>typeof id==='string')))throw Error('备份中的学习来源无法读取。');if(l.origin){l.origin.tab=['scene','function'].includes(l.origin.tab)?l.origin.tab:'scene';for(const name of ['filter','subfilter'])if(typeof l.origin[name]!=='string')l.origin[name]='all';if(typeof l.origin.search!=='string')l.origin.search='';}}
  if(r.review){const v=r.review;if(!Array.isArray(v.queue)||!v.queue.every(id=>typeof id==='string')||!Number.isInteger(v.index)||v.index<0||v.index>v.queue.length||!validQuestionState(v.q)||!validResults(v.results)||!Array.isArray(v.retried)||!v.retried.every(id=>typeof id==='string')||!Number.isInteger(v.baseCount)||v.baseCount<1||v.baseCount>5)throw Error('备份中的复习位置不完整。');if(v.pinnedQuestions&&(!Array.isArray(v.pinnedQuestions)||!v.pinnedQuestions.length||!v.pinnedQuestions.every(validQuestion)))throw Error('备份中的原复习题无法读取。');}
  if(r.summary&&!validResults(r.summary.results))throw Error('备份中的复习小结无法读取。');
  for(const round of [r.learn,r.review]){if(round?.pinnedLesson){for(const field of ['meaning','expression','formula','explanation','boundary','checkpoint'])if(round.pinnedLesson[field]!==undefined&&typeof round.pinnedLesson[field]!=='string')throw Error('备份中的讲解文字无法读取。');}if(round?.pinnedLesson?.examples&&(!Array.isArray(round.pinnedLesson.examples)||!round.pinnedLesson.examples.every(e=>typeof e.en==='string'&&typeof e.zh==='string')))throw Error('备份中的讲解无法读取。');}
  if(r.dailyVisits){if(typeof r.dailyVisits!=='object'||Array.isArray(r.dailyVisits))throw Error('每日进度无法读取。');for(const [day,visit]of Object.entries(r.dailyVisits))if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!visit||!['done','skip','mastered'].includes(visit.status)||!Number.isFinite(visit.at))throw Error('每日进度不完整。');}
  copy.records[id]=r;
 }
 if(copy.reviewScope&&(!['moena'].includes(copy.reviewScope.domain)||copy.reviewScope.dateId!==undefined&&typeof copy.reviewScope.dateId!=='string'))delete copy.reviewScope;
 copy.ui=copy.ui&&typeof copy.ui==='object'&&!Array.isArray(copy.ui)?copy.ui:{};for(const field of ['view','tab','domain','filter','subfilter','search','lastSpoken','lastExam'])if(copy.ui[field]!==undefined&&typeof copy.ui[field]!=='string')delete copy.ui[field];for(const field of ['updatedAt','dataRevision'])if(!Number.isFinite(copy[field])||copy[field]<0)copy[field]=0;if(copy.activeId!==undefined&&typeof copy.activeId!=='string')copy.activeId='jp-yoyuu';if(copy.backupMeta){const clean={};for(const field of ['exportedAt','revision','snoozeUntil'])if(Number.isFinite(copy.backupMeta[field]))clean[field]=copy.backupMeta[field];copy.backupMeta=clean;}if(copy.resume){const clean={};for(const kind of ['learn','review'])if(typeof copy.resume[kind]?.id==='string'&&Number.isFinite(copy.resume[kind]?.at))clean[kind]=copy.resume[kind];copy.resume=clean;}return copy;
}
function parseProgressBackup(text){
 if(typeof text!=='string'||text.length>8000000)throw Error('请选择小于 8 MB 的Beyond Words 日本語备份。');
 let payload;try{payload=JSON.parse(text);}catch{throw Error('文件内容无法读取，请选择Beyond Words 日本語导出的 JSON 备份。');}
 if(payload.format!=='beyondwords-japanese-progress'||payload.formatVersion!==1)throw Error('这不是Beyond Words 日本語导出的进度备份。');
 if(typeof payload.exportedAt!=='string'||!Number.isFinite(new Date(payload.exportedAt).getTime()))throw Error('备份时间信息不完整，请选择Beyond Words 日本語导出的原始文件。');return {...payload,data:checkedProgress(payload.data)};
}
function previewProgressImport(text){
 try{pendingImport=parseProgressBackup(text);}catch(e){pendingImport=null;toast(e.message);return false;}
 const n=progressCounts(pendingImport.data),conflicts=Object.keys(pendingImport.data.records).filter(id=>store.records[id]&&progressSignature(store.records[id])!==progressSignature(pendingImport.data.records[id])).length;
 showDialog(`<h2>确认恢复这份进度</h2><p class="small">备份时间：${esc(new Date(pendingImport.exportedAt).toLocaleString('zh-CN'))}</p><div class="muted-box">${n.learning} 个学习中 · ${n.review} 个待复习 · ${n.mastered} 个已掌握<br>${n.custom} 条个人例句或场景 · ${n.notes} 份笔记${conflicts?`<br>${conflicts} 个表达与当前记录不同`:''}</div><fieldset class="restore-options"><legend>恢复方式</legend><label><input type="radio" name="restore-mode" value="merge" checked>合并进度，保留各表达较新的记录</label><label><input type="radio" name="restore-mode" value="replace">恢复到备份中的状态</label></fieldset><p class="small">恢复前会在本机保留当前进度，可撤销本次导入。</p><div class="actions">${button('恢复进度','apply-progress-import')}${button('取消','close-dialog','button secondary')}</div>`);return true;
}
function applyProgressImport(mode){
 if(!pendingImport)return false;
 const incoming=pendingImport.data,previous=JSON.parse(JSON.stringify(store));let merged;
 if(mode==='replace')merged=incoming;
 else{merged={...store,records:mergeProgressRecords(incoming.records,store.records)};for(const [id,current]of Object.entries(store.records))if(incoming.records[id]&&Number(current.updatedAt||0)===Number(incoming.records[id].updatedAt||0)&&(recordHasProgress(current)||!recordHasProgress(incoming.records[id])))merged.records[id]=current;merged.resume={...(incoming.resume||{}),...(store.resume||{})};}
 let previousJournal=null;try{previousJournal=localStorage.getItem(KEY+'.before-import');localStorage.setItem(KEY+'.before-import',JSON.stringify(previous));}catch{toast('当前进度暂时无法留副本，请先导出备份再恢复');return false;}
 const previousReadOnly=progressReadOnly,previousIssue=progressIssue,previousView=view;progressReadOnly=false;progressIssue='';store=merged;store.version=2;store.updatedAt=Date.now();store.generation=Math.max(Number(previous.generation||0),Number(incoming.generation||0),Date.now())+1;
 store.activeId=unitById.has(store.activeId)?store.activeId:'jp-yoyuu';lesson=unitById.get(store.activeId);state=store.records[lesson.id]||emptyState();store.records[lesson.id]=state;progressSignatures.clear();for(const [id,r]of Object.entries(store.records))progressSignatures.set(id,progressSignature(r));
 const context=store.ui||{};domain=catalog.domains.some(d=>d.id===context.domain)?context.domain:lesson.domain;tab=['scene','function'].includes(context.tab)?context.tab:'scene';filter=context.filter||'all';subfilter=context.subfilter||'all';search=context.search||'';page=Number(context.page)||1;lastSpoken=context.lastSpoken||'daily';lastExam=context.lastExam||'ielts';
 view='home';dialog.close();const success=persistProgress();if(!success){installProgressRuntime(previous);view=previousView;progressReadOnly=previousReadOnly;progressIssue=previousIssue;try{if(previousJournal!==null)localStorage.setItem(KEY+'.before-import',previousJournal);else localStorage.removeItem(KEY+'.before-import');}catch{}toast('恢复未保存成功，当前进度已保留');render();return false;}
 pendingImport=null;go('home');toast('进度已恢复，可以从首页继续');return true;
}
function undoProgressImport(){
 let previous;try{previous=checkedProgress(JSON.parse(localStorage.getItem(KEY+'.before-import')||'null'));}catch{toast('没有可恢复的导入前进度');return;}
 pendingImport={data:previous};if(applyProgressImport('replace')){try{localStorage.removeItem(KEY+'.before-import');}catch{}toast('已回到导入前的进度');}
}
function progressManager(){
 save();const n=progressCounts(store);let undo=false;try{undo=!!localStorage.getItem(KEY+'.before-import');}catch{}
 showDialog(`<h2>进度备份</h2><p>导出一份文件，换浏览器或设备后可以导入，接着练。</p><div class="muted-box">${n.learning} 个学习中 · ${n.review} 个待复习 · ${n.mastered} 个已掌握<br>${n.custom} 条个人例句或场景 · ${n.notes} 份笔记</div><div class="actions">${button('导出备份','export-progress')}${button('导入备份','choose-progress-file','button secondary')}</div><input type="file" id="progress-file" accept=".json,application/json" hidden><p class="small">${store.backupMeta?.exportedAt?`上次生成备份：${esc(new Date(store.backupMeta.exportedAt).toLocaleString('zh-CN'))}`:'还没有生成过文件备份。'}请确认文件已保存到下载位置。</p><details class="import-paste"><summary>也可以粘贴备份内容</summary><label class="section-label" for="progress-paste">Beyond Words 日本語备份 JSON</label><textarea id="progress-paste" spellcheck="false"></textarea>${button('查看这份备份','preview-progress-paste','button secondary')}</details>${undo?`<div class="actions">${button('撤销上次导入','undo-progress-import','text-button')}</div>`:''}${hasProgressConflict()?`<details><summary>其他标签页留下的进度副本</summary>${progressConflictList().map((item,index)=>`<div class="actions">${button('导出副本 '+(index+1),'export-progress-conflict','text-button',`data-index="${index}"`)}<span class="small">${esc(new Date(item.at).toLocaleString('zh-CN'))}</span></div>`).join('')}</details>`:''}${damagedProgress?`<div class="actions">${button('导出原始数据','export-damaged-progress','text-button')}</div>`:''}<p class="small">普通刷新会保留已成功保存的进度；清除网站数据前请导出文件。不同浏览器和地址分别保存，可用备份迁移。</p><p class="storage-origin">当前入口：${esc(location.origin||'当前浏览器')}</p>`);
}
function backupReminder(){
 const meaningful=Object.values(store.records).some(r=>r.enrolled||r.custom?.length||r.learn?.results?.length),meta=store.backupMeta||{};
 if(!meaningful||meta.snoozeUntil>Date.now()||meta.exportedAt&&meta.revision===store.dataRevision)return '';
 return `<aside class="backup-reminder"><div><p>把进度留一份在手边。</p><span>清除网站数据或换浏览器前，可以导出备份。</span></div><div>${button('备份进度','manage-progress','button secondary')}${button('稍后提醒','snooze-backup','text-button')}</div></aside>`;
}

function hasProgressConflict(){try{return !!localStorage.getItem(KEY+'.conflict');}catch{return false;}}
function exportProgressConflict(index){let saved;try{const list=progressConflictList();saved=checkedProgress(list[Number(index)]?.data||JSON.parse(localStorage.getItem(KEY+'.conflict')||'null'));}catch{toast('暂时无法读取另一标签页副本');return;}downloadProgressText(JSON.stringify({format:'beyondwords-japanese-progress',formatVersion:1,exportedAt:new Date().toISOString(),data:saved},null,2),'Beyond Words 日本語-另一标签页进度副本.json');}

// Repair only the untouched compaction from the short-lived v1.9.3 release.
function recoverPersonalHistory(data){
 if(data.personalHistoryRepair==='1.9.4')return 0;
 let previous;try{previous=checkedProgress(JSON.parse(localStorage.getItem(KEY+'.previous')||'null'));}catch{return 0;}
 const badRelease=Date.parse('2026-10-28T23:34:10+08:00');
 if(Number(data.updatedAt||0)<badRelease||Number(previous.updatedAt||0)>=badRelease||Number(previous.generation||0)!==Number(data.generation||0))return 0;
 let restored=0;
 for(const [id,r]of Object.entries(data.records)){const old=previous.records[id];if(r.custom?.length===1&&old?.custom?.length>1&&Number(r.updatedAt||0)===Number(old.updatedAt||0)&&JSON.stringify(r.custom[0])===JSON.stringify(old.custom.at(-1))){restored+=old.custom.length-1;r.custom=old.custom;}}
 data.personalHistoryRepair='1.9.4';return restored;
}
