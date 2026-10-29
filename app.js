 'use strict';
const KEY = 'beyondwords.japanese.v1';
const catalog=window.JUJIAN_CATALOG;
const originalUnits=[...(window.JUJIAN_CORE||[]),...(window.BW_JP_DAILY||[]),...(window.BW_JP_WORK||[]),...(window.BW_JP_MOENA||[])];
const pilotUnits=[];
const units=[...originalUnits];
units.forEach(unit=>{unit.collection=unit.collection||'daily1';unit.domain=unit.domain||catalog.collections.find(c=>c.id===unit.collection)?.domain||'daily';unit.domains=unit.domains||[unit.domain];});
for(const [scope,ids]of Object.entries(catalog.scopeSharing||{}))for(const unit of units)if(ids.includes(unit.id))unit.domains=[...new Set([...unit.domains,scope])];
const unitById=new Map(units.map(unit=>[unit.id,unit]));
const learningOrder=new Map((catalog.learningOrder||[]).map((id,i)=>[id,i]));
const emptyState=()=>({version:1,enrolled:false,mastered:false,learn:null,review:null,custom:[],draft:{zh:'',en:''},cursor:0,schedule:{due:0,streak:0,last:null},history:[],summary:null});
let store={version:2,activeId:'jp-yoyuu',records:{},ui:{}};
try { const saved=loadStoredProgress(); if(saved?.version===2&&saved.records)store={...store,...saved}; } catch {document.getElementById('storage-warning').hidden=false;}
const recoveredPersonalCount=0;
let lesson=unitById.get(store.activeId)||units[0];
let state=store.records[lesson.id]||emptyState();
store.records[lesson.id]=state;
let view=store.ui.view||state.lastView||'home',tab=store.ui.tab||'scene',filter=store.ui.filter||'all',subfilter=store.ui.subfilter||'all',search=store.ui.search||'',editingCustom=null;
let domain=store.ui.domain||lesson.domain,page=Number(store.ui.page)||1;
let lastSpoken=store.ui.lastSpoken||'daily',lastExam=store.ui.lastExam||'ielts';
const app=document.getElementById('app'),dialog=document.getElementById('dialog');
function record(id){return store.records[id]||emptyState();}
function selectLesson(id){
  if(!unitById.has(id))return;
  if(lesson.id===id){if(!lesson.domains.includes(domain)&&!(domain==='moena'&&ceciliaIds(filter).includes(id))){domain=lesson.domains.includes(state.learn?.origin?.domain)?state.learn.origin.domain:lesson.domain;filter='all';subfilter='all';search='';page=1;}return;}
  save();lesson=unitById.get(id);state=store.records[id]||emptyState();store.records[id]=state;store.activeId=id;editingCustom=null;
  if(!lesson.domains.includes(domain)&&!(domain==='moena'&&ceciliaIds(filter).includes(id))){domain=lesson.domain;filter='all';subfilter='all';search='';page=1;}
}
const availableUnits=()=>units.filter(u=>record(u.id).enrolled&&!record(u.id).mastered);
const masteredUnits=()=>units.filter(u=>record(u.id).mastered);
const learningUnits=()=>units.filter(u=>{const r=record(u.id);return r.learn&&r.learn.stage!=='done'&&!r.mastered;});
const esc=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>s.normalize('NFKC').replace(/[、,。.!?！？\s]/g,'').trim();
const matches=(value,answers)=>answers.some(a=>normalize(value)===normalize(a));
function save(){return persistProgress();}

function toast(message){const t=document.getElementById('toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>{t.classList.remove('show');t.textContent='';},2400);}
const routes=new Set(['home','library','study','review','practice','detail','mastered','summary','mastery']);
const lessonRoutes=new Set(['study','practice','detail','summary','mastery']);
const routeURL=route=>`${location.pathname}${location.search}#${route}${route==='library'&&domain==='moena'?'/moena'+(ceciliaDay(filter)?'/'+filter:''):lessonRoutes.has(route)?'/'+lesson.id:''}`;
const routeState=route=>({jujianRoute:route,lessonId:lesson.id,tab,filter,subfilter,search,domain,page,lastSpoken,lastExam});
function go(next){
  if(!routes.has(next))return;
  if(next!==view||history.state?.lessonId!==lesson.id||next==='library'&&(history.state?.domain!==domain||history.state?.filter!==filter))history.pushState(routeState(next),'',routeURL(next));
  view=next;render();window.scrollTo(0,0);
}
function initializeNavigation(){
  const [requested,id,date]=location.hash.slice(1).split('/');
  if(requested==='library'&&id==='moena'){domain='moena';lastSpoken='moena';filter=ceciliaDay(date)?date:'all';page=1;}
  if(id&&unitById.has(id))selectLesson(id);
  if(routes.has(requested))view=requested;
  if(history.state?.jujianRoute){history.replaceState(routeState(view),'',routeURL(view));return;}
  // A direct/resumed inner page has a home entry beneath it, once per visit.
  history.replaceState(routeState('home'),'',routeURL('home'));
  if(view!=='home')history.pushState(routeState(view),'',routeURL(view));
}
function restoreNavigation(){
  const [route,id,date]=location.hash.slice(1).split('/');
  if(id&&unitById.has(id))selectLesson(id);
  const ui=history.state;
  if(ui?.tab){tab=ui.tab;filter=ui.filter||'all';subfilter=ui.subfilter||'all';search=ui.search||'';domain=ui.domain||lesson.domain;page=Number(ui.page)||1;lastSpoken=ui.lastSpoken||'daily';lastExam=ui.lastExam||'ielts';}
  if(route==='library'&&id==='moena'){domain='moena';lastSpoken='moena';filter=ceciliaDay(date)?date:'all';}
  view=routes.has(route)?route:'home';
  if(dialog.open)dialog.close();
  render();window.scrollTo(0,0);
}
window.addEventListener('popstate',restoreNavigation);
window.addEventListener('hashchange',()=>{const [route,id]=location.hash.slice(1).split('/');if(route!==view||(id&&id!==lesson.id))restoreNavigation();});
function button(label,action,cls='button',extra=''){return `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`;}
function crumbs(label){return `<div class="breadcrumbs">${button('首页','home','')}<span>/</span><span>${label}</span></div>`;}
function newQuestionState(){return {input:'',revealed:false,hints:[],checked:false,supportSeen:false,targetSeen:false};}
function lessonSnapshot(unit=lesson){return JSON.parse(JSON.stringify(Object.fromEntries(['expression','meaning','formula','explanation','boundary','checkpoint','examples'].map(k=>[k,unit[k]]))));}
function pinLearningRound(l,unit=lesson){if(!l||l.stage==='done')return;l.pinnedEntry=l.pinnedEntry||JSON.parse(JSON.stringify(unit.entry));l.pinnedLearning=l.pinnedLearning||JSON.parse(JSON.stringify(unit.learning));l.pinnedLesson=l.pinnedLesson||lessonSnapshot(unit);}
function newLearning(){const l={origin:captureLearningOrigin(),contentRevision:'1.6.0',stage:'entry',index:0,q:newQuestionState(),results:[],lastResult:null,returnStage:null};pinLearningRound(l,unitById.get(lesson.id)||lesson);return l;}

function enrolled(){if(!state.enrolled){state.enrolled=true;state.schedule.due=Date.now();}save();}
function stageLabel(){if(!state.learn)return '';return {entry:'初次尝试',intro:'表达讲解',exercise:`学习题 ${Math.max(state.learn.results.length,state.learn.index)+1} / ${(state.learn.pinnedLearning||lesson.learning).length}`,custom:scenarioUnit()?'写自己的场景':'写自己的例句',done:'已完成'}[state.learn.stage];}
function learningQuestion(){return state.learn.stage==='entry'?(state.learn.pinnedEntry||lesson.entry):(state.learn.pinnedLearning||lesson.learning)[state.learn.index];}
function activeLearning(){return state.learn&&state.learn.stage!=='done'&&!state.mastered;}
function dueText(){if(state.schedule.due<=Date.now())return '现在可以复习';return `下次复习：${new Date(state.schedule.due).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;}
function render(){
  const current=unitById.get(lesson.id);
  const pinned=view==='study'&&state.learn?.stage!=='done'?state.learn?.pinnedLesson:view==='practice'?state.review?.pinnedLesson:null;
  lesson=pinned?{...current,...pinned}:current;
  if(['study','practice'].includes(view)&&state.mastered&&!(view==='study'&&state.learn?.dailyReplay))view='mastery';
  if(view==='mastery'&&!state.mastered)view=state.learn&&state.learn.stage!=='done'?'study':'library';
  if(view==='study'&&!state.learn)view='library';
  if(view==='practice'&&!state.review)view='review';
  if(view==='summary'&&!state.summary)view='review';
  document.getElementById('mastered-count').textContent=masteredUnits().length;
  const backupButton=document.getElementById('progress-link'),needsBackup=!!backupReminder();
  backupButton.innerHTML=`进度备份${needsBackup?'<span class="backup-status-dot" aria-hidden="true"></span>':''}`;
  backupButton.title=needsBackup?'有新进度，建议导出备份':'导出或恢复学习进度';
  const pages={home:homePage,library:libraryPage,study:studyPage,review:reviewPage,practice:reviewPracticePage,detail:detailPage,mastered:masteredPage,summary:summaryPage,mastery:masteryPage};
  app.classList[['study','practice','summary','mastery','detail'].includes(view)?'add':'remove']('has-study-layout');
  app.classList[view!=='home'?'add':'remove']('learning-scale');
  app.innerHTML=(pages[view]||homePage)();
  state.lastView=view;save();history.replaceState(routeState(view),'',routeURL(view));
  document.title='Beyond Words · 日本語';
  layoutQuestionNotes();
  if(typeof window.decorateKeyboardActions==='function')window.decorateKeyboardActions();
}
function homePage(){return supportHomePage();}

function libraryPage(){
 if(domain==='moena')return ceciliaLibraryPage();
 const domainMeta=catalog.domains.find(d=>d.id===domain)||catalog.domains[0];
 domain=domainMeta.id;
 const isExam=domainMeta.track==='exam',track=isExam?'exam':'spoken';
 const eligible=units.filter(u=>u.domains.includes(domain)).sort((a,b)=>(learningOrder.get(a.id)??999)-(learningOrder.get(b.id)??999));
 const eligibleIds=new Set(eligible.map(u=>u.id));
 const allGroups=tab==='scene'?catalog.scenes.filter(g=>g.domain===domain||g.domains?.includes(domain)):catalog.functions;
 const groups=allGroups.map(g=>({...g,name:g.nameByDomain?.[domain]||g.name,children:g.children.map(c=>({...c,units:c.units.filter(id=>eligibleIds.has(id))})).filter(c=>c.units.length)})).filter(g=>g.children.length);
 const group=groups.find(g=>g.id===filter),sub=group?.children.find(c=>c.id===subfilter);
 if(filter!=='all'&&!group){filter='all';subfilter='all';}
 const ids=sub?sub.units:group?[...new Set(group.children.flatMap(c=>c.units))]:eligible.map(u=>u.id);
 const query=search.trim().toLowerCase();
 const visible=eligible.filter(u=>ids.includes(u.id)&&!record(u.id).mastered&&(!query||[u.meaning,u.expression,u.explanation].join(' ').toLowerCase().includes(query)));
 const countFor=ids=>eligible.filter(u=>ids.includes(u.id)&&!record(u.id).mastered).length;
 const pages=Math.max(1,Math.ceil(visible.length/24));page=Math.max(1,Math.min(page,pages));
 const shown=visible.slice((page-1)*24,page*24);
 return `${crumbs('学习')}<div class="page-heading"><div><p class="eyebrow">${esc(domainMeta.name)}</p><h1>从想表达的意思开始。</h1><p class="lead">${esc(domainMeta.description)}</p><p class="small">常用、容易上手的表达排在前面。</p></div></div>
 <section class="track-panel" aria-label="学习方向" hidden><div class="domain-tabs" role="group" aria-label="学习方向">${catalog.tracks.map(t=>button(`<strong>${t.name}</strong><span>${t.description}</span>`,'track',`domain-option ${track===t.id?'selected':''}`,`data-track="${t.id}" aria-pressed="${track===t.id}"`)).join('')}</div></section>
 <section class="domain-panel" aria-label="${isExam?'选择考试':'交流场景'}"><div class="domain-tabs ${isExam?'exam-domains':'spoken-domains'}" role="group" aria-label="${isExam?'选择考试':'交流场景'}">${catalog.domains.filter(d=>(d.track||'spoken')===track).map(d=>button(`<strong>${d.name}</strong><span>${d.id==='moena'?esc(ceciliaUpdateLabel()):units.filter(u=>u.domains.includes(d.id)).length+' 个表达'}</span>`,'domain',`domain-option ${domain===d.id?'selected':''}`,`data-domain="${d.id}" aria-pressed="${domain===d.id}"`)).join('')}</div>
 </section>
 ${libraryProgressMarkup(eligible.map(u=>u.id))}
 <div class="library-controls"><div class="tabs" role="tablist" aria-label="浏览方式">${button(isExam?'按练习目标':'按场景','tab',tab==='scene'?'active':'',`data-tab="scene" role="tab" aria-selected="${tab==='scene'}"`)}${button('按表达功能','tab',tab==='function'?'active':'',`data-tab="function" role="tab" aria-selected="${tab==='function'}"`)}</div><label class="search-label" for="library-search">查找表达<input type="search" id="library-search" placeholder="在当前路径内搜索" value="${esc(search)}" autocomplete="off"></label></div>
 <div class="category-grid" aria-label="${tab==='scene'?(isExam?'练习目标':'场景板块'):'功能板块'}">${button(`<span>全部表达</span><small>${countFor(eligible.map(u=>u.id))} 个</small>`,'filter',`category-card ${filter==='all'?'selected':''}`,'data-filter="all" aria-pressed="'+(filter==='all')+'"')}${groups.map(g=>button(`<span>${esc(g.name)}</span><small>${countFor(g.children.flatMap(c=>c.units))} 个表达</small>`,'filter',`category-card ${filter===g.id?'selected':''}`,`data-filter="${g.id}" aria-pressed="${filter===g.id}"`)).join('')}</div>
 ${group?`<div class="category-context"><h2>${esc(group.name)}</h2><p>${esc(group.description)}</p><div class="chips" aria-label="细分板块">${button('全部','subfilter',`chip ${subfilter==='all'?'active':''}`,'data-subfilter="all" aria-pressed="'+(subfilter==='all')+'"')}${group.children.map(c=>button(`${esc(c.name)} <span>${countFor(c.units)}</span>`,'subfilter',`chip ${subfilter===c.id?'active':''}`,`data-subfilter="${c.id}" aria-pressed="${subfilter===c.id}"`)).join('')}</div></div>`:''}
 <div class="list-heading"><h2>${sub?esc(sub.name):group?'这个板块的表达':'选择一个表达'}</h2><span class="small">${visible.length} 个可练习</span></div>
 ${visible.length?`<div class="unit-grid">${shown.map(unitCard).join('')}</div>`:`<div class="empty"><h3>${query?'没有找到匹配的表达':'这里的表达都已掌握'}</h3><p>${query?'试试更短的关键词，或换一个板块。':'可以从已掌握列表恢复练习。'}</p>${button(query?'清除搜索':'查看已掌握',query?'clear-search':'mastered','button secondary')}</div>`}
 ${pages>1?`<nav class="library-pagination" aria-label="表达列表分页">${button('上一页','page','button secondary',`data-page="${page-1}" ${page===1?'disabled':''}`)}<span class="small">${page} / ${pages}</span>${button('下一页','page','button secondary',`data-page="${page+1}" ${page===pages?'disabled':''}`)}</nav>`:''}
 <div class="note-line"><span class="dot"></span><span>同一个表达，从不同分类进入，学习进度也会保留。</span></div>`;
}
function unitCard(u){
 const r=record(u.id),active=r.learn&&r.learn.stage!=='done',draft=u.practiceProfile==='scenario'?!!(r.draft.scene?.trim()||r.draft.intent?.trim()||r.draft.note?.text?.trim()):!!(r.draft.zh?.trim()||r.draft.en?.trim()||r.draft.note?.text?.trim());
 const fn=catalog.functions.flatMap(g=>g.children).find(c=>c.units.includes(u.id));
 const status=r.mastered?'已掌握':active?'学习中 · '+({entry:'初次尝试',intro:'表达讲解',exercise:`学习题 ${Math.max(r.learn.results.length,r.learn.index)+1} / ${(r.learn.pinnedLearning||u.learning).length}`,custom:u.practiceProfile==='scenario'?'写自己的场景':'写自己的例句'}[r.learn.stage]||'进度已保存'):r.learn?.stage==='done'?'已学完':'';
 return `<article class="library-item unit-card"><div><span class="tag">${esc(fn?.name||'常用表达')}</span><h3>${esc(u.meaning)}</h3>${status?`<p class="small">${status}</p>`:''}</div>${button(draft&&r.learn?.stage==='done'?'继续填写草稿':active?'继续学习':r.learn?.stage==='done'?'重新学习':'开始学习',draft&&r.learn?.stage==='done'?'resume-custom':'open-learn','button outline',`data-lesson="${u.id}"`)}</article>`;
}

function learningTools(){return `<div class="session-tools">${button('标记为已掌握','master','button secondary mastery-control')}${button('退出学习','exit-learn','utility-link')}</div>`;}
// Continue within the learner's selected scope, category and search, across pagination.
function learningSelection(context){
 if(context.domain==='moena')return ceciliaIds(context.dateId||context.filter).map(id=>unitById.get(id));
 const groups=context.tab==='scene'?catalog.scenes.filter(g=>g.domain===context.domain||g.domains?.includes(context.domain)):catalog.functions;
 const group=groups.find(g=>g.id===context.filter),sub=group?.children.find(c=>c.id===context.subfilter);
 const ids=sub?sub.units:group?[...new Set(group.children.flatMap(c=>c.units))]:null;
 const query=(context.search||'').trim().toLowerCase();
 return units.filter(u=>u.domains.includes(context.domain)&&(!ids||ids.includes(u.id))&&(!query||[u.meaning,u.expression,u.explanation].join(' ').toLowerCase().includes(query))).sort((a,b)=>(learningOrder.get(a.id)??999)-(learningOrder.get(b.id)??999));
}
function captureLearningOrigin(){
 if(domain==='moena'&&ceciliaDay(filter))return currentDayOrigin(filter);
 if(view!=='library'&&state.learn?.origin)return state.learn.origin;
 const context=view==='library'?{domain,tab,filter,subfilter,search,page}:{domain:lesson.domains.includes(domain)?domain:lesson.domain,tab:'scene',filter:'all',subfilter:'all',search:''};
 return {...context,ids:learningSelection(context).map(u=>u.id)};
}
function learningOrigin(){return state.learn?.origin||captureLearningOrigin();}
function nextLearningUnit(){
 if(isCeciliaOrigin(learningOrigin()))return nextCeciliaUnit();
 const origin=learningOrigin();
 const ordered=[...new Set([...(origin.ids||[]),...learningSelection(origin).map(u=>u.id)])].map(id=>unitById.get(id)).filter(u=>u&&u.domains.includes(origin.domain));
 const at=ordered.findIndex(u=>u.id===lesson.id);
 const candidates=at<0?ordered:[...ordered.slice(at+1),...ordered.slice(0,at)];
 return candidates.find(u=>u.id!==lesson.id&&!record(u.id).mastered&&record(u.id).learn?.stage!=='done');
}
function applyLearningOrigin(origin){domain=origin.domain;tab=origin.tab;filter=origin.filter;subfilter=origin.subfilter;search=origin.search;page=Number(origin.page)||1;}
function nextReviewUnit(){return filterReviewScope(availableUnits()).filter(u=>u.id!==lesson.id&&(record(u.id).review||record(u.id).schedule.due<=Date.now())).sort((a,b)=>Number(!!record(b.id).review)-Number(!!record(a.id).review)||record(a.id).schedule.due-record(b.id).schedule.due)[0];}
function continuationMarkup(kind='learn'){
 if(kind==='learn'){const pending=pendingDailyContinuation();if(pending)return pending;}
 if(kind==='learn'?isCeciliaOrigin(learningOrigin()):reviewScopeOrigin()?.domain==='moena')return ceciliaContinuation(kind);
 const next=kind==='review'?nextReviewUnit():nextLearningUnit();
 if(!next)return `<div class="continuation"><p class="section-label">${kind==='review'?'其他表达暂时没有到期的复习':'当前选择中，暂时没有其他待学表达'}</p>${button(kind==='review'?'去选新表达':'返回当前选择',kind==='review'?'library':'origin-library','button secondary')}${kind==='review'?'':button('看看其他板块','browse-other','text-button')}</div>`;
 const pending=kind==='review'?!!record(next.id).review:!!record(next.id).learn;
 return `<div class="continuation"><p class="section-label">${kind==='review'?'接着复习':`接着学习 · ${esc(catalog.domains.find(d=>d.id===learningOrigin().domain)?.name||'当前选择')}`}</p><h3>${esc(next.meaning)}</h3>${button(kind==='review'?(pending?'继续下一组复习':'复习下一个表达'):(pending?'继续下一个表达':'学习下一个表达'),kind==='review'?'next-review':'next-learning','button',`data-next="${next.id}"`)}</div>`;
}
function masteryPage(){return `<div class="study-layout">${crumbs('已标记掌握')}<div class="outcome-layout"><section class="sheet outcome-main"><p class="eyebrow section-badge">已掌握</p><h1 class="outcome-title">${esc(lesson.meaning)}</h1><p class="lead">已从待学和待复习内容中收起。</p><p class="small">进度、自建内容和笔记都保留，随时可以在“已掌握”中恢复。</p>${notePanel('unit','','outcome')}</section><section class="sheet outcome-next"><p class="eyebrow section-badge">接下来</p>${continuationMarkup(state.masteryOrigin==='review'?'review':'learn')}<div class="actions outcome-actions">${button('撤销标记','undo-master','button secondary')}${button('查看已掌握','mastered','text-button')}${button('返回语块库',state.masteryOrigin==='review'?'library':'origin-library','text-button')}</div></section></div></div>`;}
function sessionBar({caption,label,percent,tools,steps}) {
  const bounded=Math.max(0,Math.min(100,percent));
  return `<section class="session-bar" aria-label="${caption}">
    <div class="study-header"><div class="session-title"><p class="session-caption">${caption} · ${esc(lesson.meaning)}</p><span class="step-label">${label}</span></div>${tools}</div>
    <div class="progress-track" role="progressbar" aria-label="${caption}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${bounded}" aria-valuetext="${label}"><span style="width:${bounded}%"></span></div>
    <div class="session-steps">${steps.map(x=>`<span class="session-step ${x.state}" ${x.state==='current'?'aria-current="step"':''}><i aria-hidden="true">${x.state==='done'?'<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>':x.number}</i>${x.label}</span>`).join('')}</div>
  </section>`;
}
function studyPage(){
  const l=state.learn;
  if(!l)return libraryPage();
  if(l.stage==='done')return completionPage();
  if(lesson.pilot&&l.stage==='entry'&&l.q.revealed&&questionType(l.pinnedEntry||lesson.entry)==='input')l.stage='intro';
  const phases=['entry','intro','exercise','custom'];
  const current=phases.indexOf(l.stage);
  const percent={entry:5,intro:15,exercise:20+Math.max(l.results.length,l.index)*12,custom:90}[l.stage];
  const steps=['先尝试','看讲解','练表达',scenarioUnit()?'写场景':'写例句'].map((label,i)=>({label,number:i+1,state:i<current?'done':i===current?'current':'upcoming'}));
  return `<div class="study-layout">${crumbs(isCeciliaOrigin(l.origin)?'小枝萌菜 / '+ceciliaDateLabel(originDay(l.origin))+' / 学习':'学习')}${sessionBar({caption:'学习进度',label:stageLabel(),percent,tools:learningTools(),steps})}${lesson.pilot&&l.pinnedLearning&&l.contentRevision!=='1.6.0'?`<aside class="round-update"><p>练习内容已更新。可以继续当前进度，也可以从头练习新题。</p>${button('从头练新题','restart-learn','button secondary')}</aside>`:''}${l.stage==='intro'?introPage():l.stage==='custom'?customPage():questionSheet(learningQuestion(),l.q,l.stage==='entry'?'entry':'learn')}</div>`;
}
function introPage(){const credited=entryCreditQuestion(),feedback=pilotEntryFeedback();return `<div class="intro-layout ${feedback?'has-entry-result':''}">${feedback?`<section class="sheet entry-result-sheet">${feedback}</section>`:''}<section class="sheet intro-sheet"><p class="eyebrow section-badge"><span class="eyebrow-symbol" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4Zm8 2v14"/></svg></span>先理解，再用出来</p><h1 class="large-expression">${esc(lesson.expression)}</h1>${lesson.examTaskLabel?`<p class="small">${esc(lesson.examTaskLabel)}</p>`:''}<p>${esc(lesson.explanation)}</p><div class="formula">${esc(lesson.formula)}</div>${lesson.examples.map(e=>`<div class="example"><p class="en">${esc(e.en)}</p><p class="zh">${esc(e.zh)}</p></div>`).join('')}<details><summary>用的时候留意什么？</summary><p>${esc(lesson.boundary)}</p></details>${!feedback?questionNotesMarkup(state.learn.pinnedEntry||lesson.entry,state.learn.entryAttempt||state.learn.q,'entry',true):''}<div class="actions">${button(state.learn.returnStage?'返回当前题':credited?'继续练新题':'开始练习','intro-next')}</div><p class="due-note">${credited?'初次尝试已计入本轮，接下来练其他 4 道题。':'接下来练 5 道题。'}先自己想，想不起来时再看提示。</p></section></div>`;}

function diffText(input,answer){const actual=input.trim().split(/\s+/),target=answer.trim().split(/\s+/);return actual.map((w,i)=>normalize(w)===normalize(target[i]||'')?esc(w):`<mark>${esc(w)}</mark>`).join(' ');}
function promptMarkup(q){
 let scene=q.scene||'',target=q.target||q.zh;
 if(!scene&&!q.target){const m=q.zh.match(/^(.{8,180}[：:])(.{1,100})$/);if(m&&/对方|朋友|同事|你(?:想|要|接受|回应|表示|请|提醒|希望|建议|拒绝|解释|尊重|同意|补充|决定)|转述/.test(m[1])){scene=m[1];target=m[2];}}
 const type=questionType(q),label=type==='choice'?'判断一下':type==='recall'?'想一句回应':q.stem?'补全语块':lesson.examSkill&&lesson.examSkill!=='speaking'?'试着用日语写':/[？?]$/.test(target.trim())?'试着用日语问':'试着用日语说';
 const fields=[[scene,'情境'],[q.dialogue,'对方说'],[q.intent,'你想表达']].filter(x=>x[0]);
 const background=fields.length?`<div class="prompt-background">${fields.map(([text,label])=>`<div class="context-field"><p class="context-label">${label}</p><p class="context-copy" ${label==='对方说'?'lang="ja"':''}>${esc(text)}</p></div>`).join('')}</div>`:'';
 if(type==='recall'&&fields.length)target='这时，你会怎么回应？';
 return `<div class="prompt-stack ${type==='recall'?'recall-prompt':''}">${background}<div class="prompt-task"><p class="task-label">${label}</p><h2 class="prompt">${esc(target)}</h2></div>${q.candidates?`<div class="prompt-candidates"><p class="context-label">比较回应</p><p lang="ja">${esc(q.candidates)}</p></div>`:''}</div>`;
}
function questionSheet(q, qs, context) {
  if(questionType(q)!=='input')return pilotQuestionSheet(q,qs,context);
  const isEntry = context === 'entry';
  const isCustom = q.id.startsWith('c-');
  const correct = qs.checked && matches(qs.input, q.answers);
  const displayedAnswer = correct ? q.answers.find(a => normalize(a) === normalize(qs.input)) : q.answers[0];
  const otherAnswers = q.answers.filter(a => a !== displayedAnswer);
  const lexicalHint=expressionHint(q);
  const hintControls = !qs.revealed ? `<div class="hint-wrap">
    ${button(qs.hints.includes('frame') ? '收起句式提示' : '句式提示', 'hint', 'hint-button', `data-hint="frame" aria-expanded="${qs.hints.includes('frame')}"`)}
    ${window.getQuestionHelp(q).words.length?button(qs.hints.includes('words') ? '收起词语提示' : '词语提示', 'hint', 'hint-button', `data-hint="words" aria-expanded="${qs.hints.includes('words')}"`):''}
  </div>` : '';
  const hints = !qs.revealed ? `
    ${qs.hints.includes('frame') ? `<div class="hint-box">${window.renderQuestionHintContent(q,'frame')}</div>` : ''}
    ${qs.hints.includes('words') ? `<div class="hint-box">${window.renderQuestionHintContent(q,'words')}</div>` : ''}` : '';
  const resultLabel = qs.checked
    ? correct ? (isCustom ? '和你之前写的相同' : '答对了')
      : (isCustom ? '看看你之前写的句子' : '对照一下')
    : isCustom ? '你之前写的句子' : '可以这样说';
  return `<section class="sheet question-sheet ${qs.revealed?'has-feedback':''}">
    <div class="question-workspace"><div class="question-heading">${promptMarkup(q)}${!qs.revealed?questionNotesMarkup(q,qs,context,false):''}
    </div><div class="composition ${qs.revealed?'is-reviewed':''}">
    ${q.stem?`<p class="sentence-stem" lang="ja">${esc(q.stem)}</p>`:''}<div class="input-toolbar"><div class="input-identity"><label class="input-label" for="answer"><span class="input-symbol" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5 4 4M5 19l4-1 11-11a2.8 2.8 0 0 0-4-4L5 14Z"/></svg></span>${esc(q.inputLabel||'你的日语')}</label>${!qs.revealed?`<span class="composition-help">${q.stem?'先说完整句。':lesson.examSkill&&lesson.examSkill!=='speaking'?'先想，再写。':'先说，再写。'}</span>`:''}</div>${hintControls}</div>
    <textarea id="answer" placeholder="在这里输入你的日语…" lang="ja" spellcheck="false" autocomplete="off" autocapitalize="off">${esc(qs.input)}</textarea>
    ${hints}
    ${!qs.revealed ? `<div class="answer-actions">
      ${button(isEntry ? '查看表达' : '查看答案', 'reveal', 'reveal-link')}
      <div class="submit-group">${button('核对表达', 'check', 'button primary-check', qs.input.trim() ? '' : 'disabled')}</div>
    </div>` : ''}</div></div>
    ${qs.revealed ? `<div class="answer-box ${correct?'is-correct':qs.checked?'is-comparison':'is-revealed'}" aria-live="polite">
      <p class="result ${qs.checked && !correct ? 'comparison' : ''}">${correct ? '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>' : '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 8h14m-4-4 4 4-4 4M19 16H5m4-4-4 4 4 4"/></svg>'}${resultLabel}</p>
      ${qs.checked && !correct ? `<p class="input-echo">你写的：${esc(qs.input)}</p>` : ''}
      ${qs.checked&&!correct?'<p class="section-label comparison-label">本题表达</p>':''}<p class="answer-en" lang="ja">${esc(displayedAnswer)}</p>
      ${otherAnswers.length ? `<details><summary>也可以这样说</summary><div class="variants">${otherAnswers.map(esc).join('<br>')}</div></details>` : ''}
      ${q.feedback?`<p class="small">${esc(q.feedback)}</p>`:''}${isCustom ? '<p class="small">这是你自己写的例句，语法请自行确认。</p>' : qs.checked && !correct ? `<div class="checkpoint"><p class="section-label">核对重点</p><p>${esc(lesson.checkpoint)}</p>${button('修改再试','edit-answer','utility-link')}</div>` : ''}
      ${questionNotesMarkup(q,qs,context,true)}
      ${isEntry ? `<div class="actions">${button('看看讲解', 'entry-intro')}</div>` : `
        <div class="response-panel"><p class="section-label">这次练得怎么样？</p>
          <div class="grade-row">${button('会了', 'grade', '', 'data-grade="good"')}${button('不熟', 'grade', '', 'data-grade="hard"')}${button('不会', 'grade', '', 'data-grade="again"')}</div>
          ${qs.noteBeforeSeen?'<p class="assistance-note">刚才参考了自己的笔记，之后再试着独立回忆。</p>':''}${qs.usedHint || qs.exposed ? '<p class="assistance-note">刚才查看目标提示或答案，之后再试着独立答出。</p>' : ''}
          <details class="grade-guide"><summary>这三个选项怎么选？</summary><p>会了：现在能完成。<br>不熟：还不熟练，或仍有差错。<br>不会：暂时想不起来。<br>看过提示也可以选“会了”，这类内容会在复习时再巩固。</p></details>
        </div>
        <div class="answer-followups">${button('再试一次', 'retry', 'utility-link')}${button('看看讲解', 'supplement', 'utility-link')}</div>`}
    </div>` : ''}
  </section>`;
}
function creationLayout(scenario,form){
 const saved=state.learn.savedCustom,label=scenario?'场景':'例句';
 const title=scenario?'想想你什么时候会这样回应。':lesson.examSkill?'把表达写进自己的回答。':'把表达放进你的生活。';
 const lead=scenario?'想想自己的生活，写下什么时候会这样回应。':lesson.examSkill?`想一句你会在${lesson.examSkill==='writing'?'写作':lesson.examSkill==='translation'?'翻译':'口头回答'}中用到的话，用刚学的表达写下来。`:'想一句真正会用到的话，用刚学的表达写下来。';
 return `<div class="custom-layout"><section class="sheet custom-guide"><p class="eyebrow section-badge">自己的${label}</p><h2>${title}</h2><p class="lead">${lead}</p><div class="creation-expression" lang="ja">${esc(lesson.expression)}</div><p class="small">${esc(lesson.meaning)}</p><div class="muted-box">已有 ${state.custom.length} 条${label}。保存后会加入复习，之后仍可修改。</div>${state.custom.length?button('查看全部'+label,'detail','text-button'):''}</section><section class="sheet custom-workspace">${saved?`<div class="success-symbol" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4 8-8"/></svg></div><h3>${label}已保存</h3>${customList(false,state.custom.slice(-1))}<div class="actions">${button('继续创建','continue-create','button secondary')}${button('结束创建','finish-learn')}</div>`:`${form}<div class="actions">${button('保存'+label,scenario?'save-scenario':'save-custom')}${button('稍后再写','finish-learn','button secondary')}</div>`}</section></div>`;
}
function customPage(){return scenarioUnit()?pilotCustomPage():creationLayout(false,customForm());}
function recentInputOption(field){const value=state.custom.at(-1)?.[field];return `<datalist id="recent-${field}">${value?`<option value="${esc(value)}"></option>`:''}</datalist>`;}
function customForm(){return `<label class="section-label" for="custom-zh">中文意思</label><input type="text" id="custom-zh" autocomplete="off" list="recent-zh" maxlength="300" placeholder="写一句你真正想表达的话" value="${esc(state.draft.zh)}">${recentInputOption('zh')}<label class="section-label" for="custom-en">日语表达</label><textarea id="custom-en" maxlength="600" lang="ja" placeholder="${esc(lesson.expression)}" spellcheck="false">${esc(state.draft.en)}</textarea>${personalCheckControl()}${personalDraftNotes()}`;}
function customList(editable=true,items=state.custom){return `<div class="custom-list">${items.map(c=>`<article class="custom-item">${c.kind==='scenario'?`<p class="section-label">发生了什么</p><p>${esc(c.scene)}</p>${c.intent?`<p class="section-label">想表达的意思</p><p>${esc(c.intent)}</p>`:''}<p class="en" lang="ja">${esc(lesson.expression)}</p>`:`<p>${esc(c.zh)}</p><p class="en" lang="ja">${esc(c.en)}</p>`}${personalItemNotes(c)}${editable?`<div class="item-actions">${button('编辑','edit-custom','text-button',`data-id="${c.id}"`)}${button('AI 核对','copy-ai-check','text-button',`data-id="${c.id}"`)}${button('删除','delete-custom','text-button',`data-id="${c.id}"`)}</div>`:''}</article>`).join('')}</div>`;}
function resultStats(results){return ['good','hard','again'].map(g=>results.filter(r=>r.grade===g).length);}
function statsMarkup(results){if(scenarioUnit())return pilotStatsMarkup(results);const credits=results.filter(r=>r.source==='entry-check'),n=resultStats(results.filter(r=>r.source!=='entry-check'));return `<div class="stats ${credits.length?'stats-with-entry':''}">${credits.length?`<div class="stat"><strong>${credits.length}</strong><span>初试答对</span></div>`:''}${['会了','不熟','不会'].map((label,i)=>`<div class="stat"><strong>${n[i]}</strong><span>${label}</span></div>`).join('')}</div>`;}

function completionPage(){
 const results=state.learn.results;
 return `<div class="study-layout">${crumbs('学习完成')}<div class="outcome-layout"><section class="sheet outcome-main"><div class="outcome-heading"><div class="success-symbol" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4 8-8"/></svg></div><p class="eyebrow section-badge">学习小结</p></div><h1 class="outcome-title">这组练习，完成了。</h1><p class="lead">${esc(lesson.meaning)}</p>${statsMarkup(results)}<details class="outcome-record"><summary>查看本轮记录</summary><p class="small">${scenarioUnit()?'判断题记录选择结果，情境回忆由你自评。':'独立回忆（自评）'+results.filter(x=>x.grade==='good'&&!x.help&&x.source!=='entry-check').length+' 次 · 借助提示或答案 '+results.filter(x=>x.help).length+' 次。'}</p></details><div class="muted-box">${personalLabel()} ${state.custom.length} 条 · ${dueText()}</div>${notePanel('unit','','outcome')}</section><section class="sheet outcome-next"><p class="eyebrow section-badge">接下来</p><p class="small">已加入复习库，下次换个问题再练。</p>${draftPresent()?`<div class="draft-resume"><p class="small">还有一条未完成的草稿，已为你保留。</p>${button('继续填写草稿','resume-custom','button secondary')}</div>`:''}${continuationMarkup()}<div class="actions outcome-actions">${button('复习这个表达','start-review','button secondary')}${button('查看'+personalLabel(),'detail','button secondary')}${button('返回首页','home','text-button')}</div></section></div></div>`;
}
function reviewPage(){
 const available=filterReviewScope(availableUnits(),store.reviewScope||null),due=available.filter(u=>record(u.id).schedule.due<=Date.now());
 const list=[...due,...available.filter(u=>!due.includes(u))];
 return `${crumbs('复习')}${reviewScopeControls()}<div class="page-heading"><div><p class="eyebrow">我的复习库</p><h1>让表达，再熟悉一点。</h1><p class="lead">按复习安排继续，或选择想巩固的表达。</p></div></div><dl class="review-library-counts" aria-label="当前复习库统计"><div><dt>库中表达</dt><dd>${available.length}<small> 个</small></dd></div><div><dt>已到期</dt><dd>${due.length}<small> 个</small></dd></div><div><dt>未完成轮次</dt><dd>${available.filter(u=>record(u.id).review).length}<small> 轮</small></dd></div></dl>${list.length?`<div class="unit-grid">${list.map(u=>{const r=record(u.id),pending=!!r.review;return `<article class="library-item unit-card"><div><span class="tag">${pending?'本轮未完成':r.schedule.due<=Date.now()?'可以复习了':'已学过'}</span><h3>${esc(u.meaning)}</h3><p class="due-note">${pending?`本轮已完成 ${r.review.index} / ${r.review.queue.length} 题`:r.schedule.due<=Date.now()?'现在可以复习':`下次：${new Date(r.schedule.due).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`}</p><p class="small">${r.custom.length} 条${u.practiceProfile==='scenario'?'个人场景':'自己的例句'}</p></div><div>${button(pending?'继续复习':'开始复习','start-review','button',`data-lesson="${u.id}"`)}<div class="actions compact-actions">${button(u.practiceProfile==='scenario'?'我的场景':'我的例句','detail','text-button',`data-lesson="${u.id}"`)}${pending?button('重开本轮','restart-review','text-button',`data-lesson="${u.id}"`):''}${button('标记为已掌握','master','text-button',`data-lesson="${u.id}"`)}</div></div></article>`;}).join('')}</div>`:`<div class="empty"><h3>还没有待复习的表达</h3><p>先选择一个表达开始练习；标记已掌握的内容可以随时恢复。</p><div class="actions centered">${button('去学习','library')}${masteredUnits().length?button('查看已掌握','mastered','button secondary'):''}</div></div>`}`;
}

function pool(){return [...(state.review?.pinnedQuestions||lesson.review),...state.custom.map(personalQuestion)];}
function startReview(){state.review=null;const all=pool(),count=Math.min(3,all.length),offset=state.cursor%all.length;state.review={origin:store.reviewScope||null,contentRevision:'1.6.0',pinnedQuestions:JSON.parse(JSON.stringify(unitById.get(lesson.id).review)),pinnedLesson:lessonSnapshot(unitById.get(lesson.id)),queue:Array.from({length:count},(_,i)=>all[(offset+i)%all.length].id),index:0,q:newQuestionState(),results:[],retried:[],baseCount:count,scheduled:state.schedule.due<=Date.now(),startedAt:Date.now()};state.cursor=(offset+count)%all.length;save();go('practice');}
function reviewQuestion(){return pool().find(q=>q.id===state.review?.queue[state.review.index]);}
function reviewPracticePage() {
  if (!state.review) return reviewPage();
  const r = state.review, q = reviewQuestion();
  if (!q) {
    r.index++;
    r.q = newQuestionState();
    save();
    if (r.index >= r.queue.length) { finishReview(); return summaryPage(); }
    return reviewPracticePage();
  }
  const extra = r.index >= r.baseCount;
  const position = extra ? r.index - r.baseCount + 1 : r.index + 1;
  const count = extra ? r.queue.length - r.baseCount : r.baseCount;
  const phase=r.q.revealed?2:0;
  const steps=(questionType(q)==='choice'?['读情境','作选择','看解析']:['先回忆','核对表达','选状态']).map((label,i)=>({label,number:i+1,state:i<phase?'done':i===phase?'current':'upcoming'}));
  const tools=`<div class="session-tools">${button('本题跳过','skip-review','utility-link')}${button('退出复习','exit-review','utility-link')}</div>`;
  return `<div class="study-layout">${crumbs('复习')}${sessionBar({caption:extra?'巩固加练':'复习进度',label:`${position} / ${count} 题`,percent:(position-1)/count*100,tools,steps})}
    ${extra?'<p class="due-note extra-caption">把刚才的表达再练一次。</p>':''}
    ${questionSheet(q,r.q,'review')}</div>`;
}
function finishReview() {
  const r = state.review;
  if (!r) return;
  const now = Date.now();
  const allGood = r.results.length > 0 && r.results.every(x => x.grade === 'good' && !x.help);
  const hasDifficulty = r.results.some(x => x.grade === 'again' || x.grade === 'hard' || x.help);
  const skipped = r.results.some(x => x.grade === 'skip');
  const scheduled = r.scheduled ?? state.schedule.due <= now;
  if (allGood && scheduled) {
    state.schedule.streak++;
    const days = [1, 3, 7, 14, 30][Math.min(state.schedule.streak - 1, 4)];
    state.schedule.due = now + days * 86400000;
  } else if (hasDifficulty) {
    state.schedule.streak = 0;
    state.schedule.due = state.schedule.due > now
      ? Math.min(state.schedule.due, now + 600000) : now + 600000;
  }
  state.schedule.last = now;
  state.summary = {kind:'review',origin:r.origin||null,results:r.results,baseCount:r.baseCount,date:now,due:state.schedule.due,earlyPractice:allGood&&!scheduled,skippedWithoutDifficulty:skipped&&!hasDifficulty};
  state.history.push(state.summary);
  state.history = state.history.slice(-30);
  state.review = null;
  save();
  view = 'summary';
}
function summaryPage(){
 const s=state.summary;if(!s)return reviewPage();
 const skipped=s.results.filter(x=>x.grade==='skip').length,attempts=s.results.length-skipped,allSkipped=!attempts;
 const helped=s.results.filter(x=>x.grade!=='skip'&&x.help).length,independent=s.results.filter(x=>x.grade==='good'&&!x.help).length;
 return `<div class="study-layout">${crumbs(allSkipped?'本轮已结束':'本轮完成')}<div class="outcome-layout"><section class="sheet outcome-main"><p class="eyebrow section-badge">复习小结</p><h1 class="outcome-title">${allSkipped?'本轮已结束':'这一轮，练到这里。'}</h1><p class="lead">${esc(lesson.meaning)}</p>${allSkipped?`<div class="muted-box">跳过 ${skipped} 题，本轮未完成练习。复习安排保持不变。</div>`:statsMarkup(s.results)}<details class="outcome-record"><summary>查看本轮记录</summary><p class="small">本轮练了 ${attempts} 次${skipped?'，跳过 '+skipped+' 题':''}。${s.baseCount&&s.results.length>s.baseCount?'其中包含加练。':''}${scenarioUnit()?'判断题记录选择结果，情境回忆由你自评。':'独立回忆（自评）'+independent+' 次 · 借助提示、笔记或答案 '+helped+' 次。'}</p></details><div class="muted-box">${dueText()}。${allSkipped?'复习安排保持不变。':s.skippedWithoutDifficulty?'本轮含跳过，保留原复习安排。':s.earlyPractice?'这次提前练习，下次复习时间不变。':'想继续练习，随时可以开始。'}</div>${notePanel('unit','','outcome')}</section><section class="sheet outcome-next"><p class="eyebrow section-badge">接下来</p>${continuationMarkup('review')}<div class="actions outcome-actions">${button('返回复习库','review','button secondary')}${button('再练一轮','start-review','button outline')}${button('首页','home','text-button')}</div></section></div></div>`;
}
function detailPage(){return `<div class="personal-detail">${crumbs(personalLabel())}<div class="page-heading"><div><p class="eyebrow">${personalLabel()}</p><h1>${esc(lesson.meaning)}</h1><p class="lead">${scenarioUnit()?'保留你想怎样回应的真实情境。':'保留那些真正与你有关的话。'}</p></div>${button(state.detailOrigin==='study'?'返回学习':state.detailOrigin==='summary'?'返回复习小结':state.detailOrigin==='practice'?'返回当前练习':'返回复习库','return-detail','button outline')}</div><div class="sheet"><h3>${personalLabel()} <span class="small">${state.custom.length} 条</span></h3>${state.custom.length?customList():`<p class="lead">${scenarioUnit()?'还没有自己的场景。想想你什么时候会这样回应，写下来。':'还没有自己的例句。写一句你真正会用到的话吧。'}</p>`}<div class="actions">${draftPresent()?button('继续填写草稿','resume-custom'):button(scenarioUnit()?'新增场景':'新增例句','new-custom')}</div><hr class="divider"><p class="small">想重新练一遍？也可以从头开始学习。</p><div class="actions">${button('重新学习','restart-learn','button outline')}${button('标记为已掌握','master','text-button')}</div></div></div>`;}
function masteredPage(){const done=masteredUnits();return `${crumbs('已掌握')}<div class="page-heading"><div><p class="eyebrow">已掌握的表达</p><h1>会了的，也随时能找回来。</h1><p class="lead">${done.length} 个表达。进度和自建内容都保留，恢复后可以继续练习。</p></div></div>${done.length?`<div class="unit-grid">${done.map(u=>`<article class="library-item unit-card"><div><span class="tag purple">已掌握</span><h3>${esc(u.meaning)}</h3><p class="small">${record(u.id).custom.length} 条${u.practiceProfile==='scenario'?'个人场景':'自己的例句'}</p></div>${button('恢复练习','restore','button outline',`data-lesson="${u.id}"`)}</article>`).join('')}</div>`:'<div class="empty"><h3>还没有标记已掌握的内容</h3><p>可以在学习中标记，之后随时恢复。</p></div>'}`;}

function currentContext(){if(view==='practice'&&state.review)return {q:reviewQuestion(),qs:state.review.q,context:'review'};if(view==='study'&&state.learn&&['entry','exercise'].includes(state.learn.stage))return {q:learningQuestion(),qs:state.learn.q,context:state.learn.stage==='entry'?'entry':'learn'};return null;}
function showDialog(html){dialog.classList[['study','practice','detail'].includes(view)?'add':'remove']('learning-dialog');dialog.innerHTML=`<button class="dialog-close" data-action="close-dialog" aria-label="关闭">×</button>${html}`;dialog.showModal();if(typeof window.decorateKeyboardActions==='function')window.decorateKeyboardActions();}
function askRestart(){showDialog(`<h2>重新开始这组学习？</h2><p class="small">${esc(lesson.meaning)}</p><p>这组学习将从头开始，你的${scenarioUnit()?'场景':'例句'}、草稿和复习记录会保留。</p><div class="actions">${button('重新开始','confirm-restart')}${button('取消','close-dialog','button secondary')}</div>`);}
function editCustom(id){if(scenarioUnit())return editScenario(id);editingCustom=id||null;const c=state.custom.find(x=>x.id===id);showDialog(`<h2>${c?'修改例句':'新增例句'}</h2><label class="section-label" for="edit-zh">中文意思</label><input id="edit-zh" type="text" autocomplete="off" list="recent-zh" maxlength="300" value="${esc(c?.zh||state.draft.zh||'')}">${recentInputOption('zh')}<label class="section-label" for="edit-en">日语表达</label><textarea id="edit-en" maxlength="600" lang="ja">${esc(c?.en||state.draft.en||'')}</textarea><div class="ai-check-tools">${button('复制 AI 核对指令','copy-ai-check','button secondary',`data-id="${id||''}"`)}</div><p class="due-note">核对后可以回来修改，再保存。</p>${personalEditNotes(id)}<div class="actions">${button('保存','commit-edit','button',`data-id="${id||''}"`)}${button('取消','close-dialog','button secondary')}</div>`);}
function grade(value){const c=currentContext();if(!c?.q)return;const effective=value;const result={id:c.q.id,grade:effective,selfGrade:questionType(c.q)==='choice'?null:value,kind:questionType(c.q),choiceCorrect:questionType(c.q)==='choice'&&c.qs.choice===c.q.correctChoice,help:!!(c.qs.usedHint||c.qs.exposed||c.qs.mistake||c.qs.noteBeforeSeen),noteHelp:!!c.qs.noteBeforeSeen,time:Date.now()};enrolled();if(c.context==='learn'){const l=state.learn;l.results.push(result);l.index++;skipCreditedEntry(l);l.q=newQuestionState();l.stage=l.index>=(l.pinnedLearning||lesson.learning).length?'custom':'exercise';}else if(c.context==='review'){const r=state.review;r.results.push(result);if((effective!=='good'||result.help)&&!r.retried.includes(c.q.id)&&r.retried.length<2){r.queue.push(c.q.id);r.retried.push(c.q.id);toast('这题稍后再练，先继续');}r.index++;r.q=newQuestionState();if(r.index>=r.queue.length)finishReview();}save();render();window.scrollTo(0,0);}
function finishLearning(){markDailyVisit('done');state.learn.stage='done';state.learn.savedCustom=false;enrolled();save();render();window.scrollTo(0,0);}
document.addEventListener('input',event=>{if(handleNoteInput(event))return;const el=event.target;if(el.id==='library-search'){if(event.isComposing){search=el.value;save();return;}const caret=el.selectionStart;search=el.value;page=1;render();const field=document.getElementById('library-search');field.focus();try{field.setSelectionRange(caret,caret);}catch{}}else if(el.id==='answer'){const c=currentContext();if(c){c.qs.input=el.value;if(c.qs.revealed){const caret=el.selectionStart;c.qs.exposed=true;c.qs.revealed=false;c.qs.checked=false;render();const fresh=document.getElementById('answer');fresh.focus();fresh.setSelectionRange(caret,caret);}save();const check=app.querySelector('[data-action="check"]');if(check){check.disabled=!el.value.trim();check.innerHTML='核对表达';}window.decorateKeyboardActions();}}else if(el.id==='custom-scene'||el.id==='custom-intent'){state.draft[el.id==='custom-scene'?'scene':'intent']=el.value;save();updateCopyControls();}else if((el.id==='edit-scene'||el.id==='edit-intent')&&!editingCustom){state.draft[el.id==='edit-scene'?'scene':'intent']=el.value;save();}else if(el.id==='custom-zh'||el.id==='custom-en'){state.draft[el.id==='custom-zh'?'zh':'en']=el.value;save();updateCopyControls();}else if((el.id==='edit-zh'||el.id==='edit-en')&&!editingCustom){state.draft[el.id==='edit-zh'?'zh':'en']=el.value;save();}});
document.addEventListener('click',event=>{const anchor=event.target.closest('a[href^="#"]');if(anchor){event.preventDefault();go(anchor.getAttribute('href').slice(1));return;}const el=event.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;if(handleNotesAction(action,el))return;if(el.dataset.lesson)selectLesson(el.dataset.lesson);if(handleCeciliaAction(action,el))return;const c=currentContext();switch(action){
case 'continue-learning-home':continueLearningHome();break;
case 'continue-review-home':continueReviewHome();break;
case 'copy-ai-check':copyPersonalCheck(el.dataset.id);break;
case 'close-ai-copy':document.getElementById('ai-fallback')?.remove();document.getElementById(scenarioUnit()?'edit-scene':'edit-zh')?.focus();break;
case 'manage-progress':progressManager();break;
case 'export-progress':exportProgress();break;
case 'export-progress-conflict':exportProgressConflict(el.dataset.index);break;
case 'export-damaged-progress':downloadProgressText(damagedProgress,'Beyond Words-原始进度.txt','text/plain');break;
case 'choose-progress-file':document.getElementById('progress-file').click();break;
case 'preview-progress-paste':previewProgressImport(document.getElementById('progress-paste').value);break;
case 'apply-progress-import':applyProgressImport(dialog.querySelector('input[name="restore-mode"]:checked')?.value||'merge');break;
case 'undo-progress-import':undoProgressImport();break;
case 'snooze-backup':store.backupMeta={...(store.backupMeta||{}),snoozeUntil:Date.now()+86400000};save();render();break;
case 'home':case 'library':case 'review':case 'mastered':go(action);break;
case 'detail':state.detailOrigin=view;save();go('detail');break;
case 'return-detail':go(['study','summary','review','practice'].includes(state.detailOrigin)?state.detailOrigin:'review');break;
case 'track':domain=el.dataset.track==='exam'?lastExam:lastSpoken;filter='all';subfilter='all';search='';page=1;go('library');break;
case 'domain':domain=el.dataset.domain;if(catalog.domains.find(d=>d.id===domain)?.track==='exam')lastExam=domain;else lastSpoken=domain;filter='all';subfilter='all';search='';page=1;go('library');break;
case 'page':page=Number(el.dataset.page)||1;render();app.querySelector('.list-heading')?.scrollIntoView({block:'start'});break;
case 'tab':tab=el.dataset.tab;filter='all';subfilter='all';page=1;render();break;
case 'filter':filter=el.dataset.filter;subfilter='all';page=1;render();break;
case 'subfilter':subfilter=el.dataset.subfilter;page=1;render();break;
case 'clear-search':search='';page=1;render();break;
case 'open-learn':
  if(state.learn&&view==='library')state.learn.origin=captureLearningOrigin();
  if(state.learn?.stage==='done') askRestart();
  else if(state.learn) go('study');
  else {state.learn=newLearning();save();go('study');}
  break;
case 'browse-other':applyLearningOrigin(learningOrigin());filter='all';subfilter='all';search='';page=1;go('library');break;
case 'origin-library':applyLearningOrigin(learningOrigin());go('library');break;
case 'next-learning':{const origin=learningOrigin(),next=nextLearningUnit();if(!next||next.id!==el.dataset.next){toast('这个表达的状态已变化，请重新选择');render();break;}selectLesson(next.id);applyLearningOrigin(origin);if(!state.learn)state.learn=newLearning();state.learn.origin=origin;save();go('study');break;}
case 'next-review':{const origin=reviewScopeOrigin();const next=nextReviewUnit();if(!next||next.id!==el.dataset.next){render();break;}selectLesson(next.id);store.reviewScope=origin;if(state.review){if(JSON.stringify(state.review.origin||null)!==JSON.stringify(origin||null))toast('先继续原来未完成的复习，当前范围已保留');go('practice');}else startReview();break;}
case 'resume-learn':dialog.close();go('study');break;
case 'restart-learn':dialog.close();askRestart();break;
case 'confirm-restart':state.learn=newLearning();save();dialog.close();go('study');break;
case 'dialog-review':dialog.close();go('review');break;
case 'exit-learn':case 'exit-review':save();go(action==='exit-learn'?'library':'review');toast('进度已保存');break;
case 'master':state.masteryOrigin=['review','practice','summary'].includes(view)?'review':'learn';if(dialog.open)dialog.close();showDialog(`<h2>标记为已掌握？</h2><p class="small">${esc(lesson.meaning)}</p><p>标记后，这个表达将从待学和待复习中收起。进度和自建内容会保留，之后可以恢复。</p><div class="actions">${button('确认已掌握','confirm-master')}${button('取消','close-dialog','button secondary')}</div>`);break;
case 'confirm-master':state.masteryUndoValue=state.mastered;markDailyVisit('mastered');state.mastered=true;save();dialog.close();go('mastery');break;
case 'undo-master':undoDailyMasteryVisit();state.mastered=state.masteryUndoValue===true;save();go(state.masteryOrigin==='review'?(state.review?'practice':'review'):state.learn&&state.learn.stage!=='done'?'study':'library');toast('已撤销本次标记');break;
case 'restore':state.mastered=false;state.schedule.due=Date.now();save();if(state.learn&&state.learn.stage!=='done')go('study');else if(state.enrolled){if(state.review)go('practice');else startReview();}else{state.learn=newLearning();save();go('study');}toast('已恢复，可以继续练习');break;
case 'check':if(!c||questionType(c.q)!=='input'||!c.qs.input.trim()){toast('先写下日语，或查看示范');break;}if(c.qs.revealed||!matches(c.qs.input,c.q.answers))c.qs.exposed=true;c.qs.checked=true;c.qs.revealed=true;if(c.context==='entry'&&lesson.pilot&&questionType(c.q)==='input'){state.learn.entryAttempt={...c.qs};state.learn.stage='intro';}save();render();if(c.context==='entry'&&state.learn?.stage==='intro')focusEntryResult();else app.querySelector('.answer-box')?.scrollIntoView({block:'nearest'});break;
case 'reveal':if(c){c.qs.revealed=true;c.qs.checked=false;if(questionType(c.q)==='input')c.qs.exposed=true;if(c.context==='entry'&&lesson.pilot&&questionType(c.q)==='input'){state.learn.entryAttempt={...c.qs};state.learn.stage='intro';}save();render();if(c.context==='entry'&&state.learn?.stage==='intro')focusEntryResult();else app.querySelector('.answer-box')?.scrollIntoView({block:'nearest'});}break;
case 'hint':if(c){const h=el.dataset.hint;c.qs.hints=c.qs.hints.includes(h)?c.qs.hints.filter(x=>x!==h):[...c.qs.hints,h];if(c.qs.hints.includes(h))window.markQuestionHelp(c.q,c.qs,h);save();render();}break;
case 'edit-entry':state.learn.stage='entry';state.learn.q.revealed=false;state.learn.q.checked=false;state.learn.q.exposed=true;save();render();break;
case 'choose-answer':if(c&&questionType(c.q)==='choice'&&!c.qs.revealed&&c.q.choices.some(x=>x.id===el.dataset.choice)){c.qs.choice=el.dataset.choice;c.qs.revealed=true;c.qs.checked=true;c.qs.mistake=c.qs.choice!==c.q.correctChoice;save();render();app.querySelector('.answer-box')?.scrollIntoView({block:'nearest'});}break;
case 'choice-next':if(c&&questionType(c.q)==='choice'&&c.qs.revealed)grade(c.qs.choice===c.q.correctChoice&&!c.qs.usedHint&&!c.qs.mistake&&!c.qs.noteBeforeSeen?'good':'hard');break;
case 'resume-custom':if(view==='library'&&state.learn)state.learn.origin=captureLearningOrigin();if(!state.learn)state.learn=newLearning();state.learn.stage='custom';state.learn.savedCustom=false;save();go('study');break;
case 'save-scenario':if(saveScenario(state.draft.scene||'',state.draft.intent||'')){state.learn.savedCustom=true;save();render();window.scrollTo(0,0);toast('场景已保存');}break;
case 'commit-scenario':if(saveScenario(document.getElementById('edit-scene').value,document.getElementById('edit-intent')?.value||'',el.dataset.id)){dialog.close();render();toast('场景已保存');}break;
case 'entry-intro':state.learn.stage='intro';save();render();window.scrollTo(0,0);focusEntryResult();break;
case 'intro-next':{const l=state.learn;if(l.returnStage){const returnStage=l.returnStage;l.returnStage=null;if(returnStage==='review'){save();go('practice');break;}l.stage=returnStage;}else{beginLearningExercises();}save();render();window.scrollTo(0,0);break;}
case 'edit-answer':if(c){c.qs.exposed=true;c.qs.revealed=false;c.qs.checked=false;save();render();document.getElementById('answer')?.focus();}break;
case 'retry':if(c){c.qs.input='';c.qs.revealed=false;c.qs.checked=false;c.qs.hints=[];c.qs.exposed=true;save();render();}break;
case 'supplement':if(c){c.qs.usedHint=true;save();showDialog(`<h2>${esc(lesson.expression)}</h2><p>${esc(lesson.explanation)}</p><div class="formula">${esc(lesson.formula)}</div><p>${esc(lesson.examples[0].en)}</p><p class="small">${esc(lesson.examples[0].zh)}</p><div class="actions">${button('返回练习','close-dialog')}</div>`);}break;
case 'grade':{if(!c?.q||!c.qs.revealed||questionType(c.q)==='choice')break;const g=el.dataset.grade;if(!['good','hard','again'].includes(g))break;grade(g);if(g==='again')showDialog(`<h2>${scenarioUnit()?'再看一眼用法':'再看一眼表达结构'}</h2><div class="formula">${esc(lesson.formula)}</div><p>${esc(lesson.explanation)}</p><p class="small">${esc(lesson.examples[0].en)}<br>${esc(lesson.examples[0].zh)}</p><div class="actions">${button('继续','close-dialog')}</div>`);break;}
case 'save-custom':if(!state.draft.zh.trim()||!state.draft.en.trim()){toast('请同时填写中文意思和日语表达');break;}state.custom.push({id:`c-${crypto.randomUUID()}`,zh:state.draft.zh.trim(),en:state.draft.en.trim(),...copiedDraftNote()});state.draft={zh:'',en:''};state.learn.savedCustom=true;save();render();window.scrollTo(0,0);toast('例句已保存');break;
case 'continue-create':state.learn.savedCustom=false;save();render();window.scrollTo(0,0);break;
case 'finish-learn':finishLearning();if(draftPresent())toast('草稿已保留，可在小结继续填写');break;
case 'confirm-finish':dialog.close();finishLearning();break;
case 'start-review':if(view==='study'||view==='mastery')store.reviewScope=isCeciliaOrigin(state.learn?.origin)?{domain:'moena',dateId:originDay(state.learn.origin)}:null;if(state.review){if(JSON.stringify(state.review.origin||null)!==JSON.stringify(store.reviewScope||null))toast('先继续原来未完成的复习，当前范围已保留');go('practice');}else startReview();break;
case 'resume-review':go('practice');break;
case 'restart-review':showDialog(`<h2>重新开始本轮复习？</h2><p>当前未完成轮次会重置，已完成的历史复习记录保留。</p><div class="actions">${button('重新开始','confirm-restart-review')}${button('取消','close-dialog','button secondary')}</div>`);break;
case 'confirm-restart-review':dialog.close();startReview();break;
case 'skip-review':{const r=state.review;r.results.push({id:c.q.id,grade:'skip',time:Date.now()});r.index++;r.q=newQuestionState();if(r.index>=r.queue.length)finishReview();save();render();break;}
case 'new-custom':editCustom();break;
case 'edit-custom':editCustom(el.dataset.id);break;
case 'commit-edit':{const zh=document.getElementById('edit-zh').value.trim(),en=document.getElementById('edit-en').value.trim();if(!zh||!en){toast('请同时填写中文和日语');break;}const existing=state.custom.find(x=>x.id===el.dataset.id);if(existing){existing.zh=zh;existing.en=en;}else{state.custom.push({id:`c-${crypto.randomUUID()}`,zh,en,...copiedDraftNote()});state.draft={zh:'',en:''};}save();dialog.close();render();toast('已保存');break;}
case 'delete-custom':showDialog(`<h2>删除这条${scenarioUnit()?'场景':'例句'}？</h2><p>删除后不再加入复习，其他内容不受影响。</p><div class="actions">${button('删除','confirm-delete','button danger',`data-id="${el.dataset.id}"`)}${button('取消','close-dialog','button secondary')}</div>`);break;
case 'confirm-delete':state.custom=state.custom.filter(x=>x.id!==el.dataset.id);save();dialog.close();render();break;
case 'close-dialog':dialog.close();break;
}});
for(const [id,saved] of Object.entries(store.records)){
 const unit=unitById.get(id);if(!unit)continue;
 pinLearningRound(saved.learn,unit);
 if(saved.review){saved.review.pinnedQuestions=saved.review.pinnedQuestions||JSON.parse(JSON.stringify(unit.review));saved.review.pinnedLesson=saved.review.pinnedLesson||lessonSnapshot(unit);}
}
document.getElementById('progress-link').addEventListener('click',progressManager);
window.addEventListener('storage',handleProgressStorage);
document.addEventListener('change',async event=>{if(event.target.id==='progress-file'&&event.target.files?.[0]){const file=event.target.files[0];if(file.size>8000000){toast('请选择小于 8 MB 的Beyond Words备份');return;}try{previewProgressImport(await file.text());}catch{toast('文件读取失败，请重新选择');}}});
document.getElementById('mastered-link').addEventListener('click',()=>go('mastered'));
window.addEventListener('beforeunload',save);
initializeNavigation();
render();
if(recoveredPersonalCount)toast(`已找回 ${recoveredPersonalCount} 条自建内容`);

window.installKeyboardSupport();
