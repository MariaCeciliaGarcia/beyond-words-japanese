'use strict';
const ceciliaDays=()=>{
 const dates=new Map();
 for(const raw of window.BW_JP_DAILY_MATERIALS||[]){
  if(!raw||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date||'')||raw.id!==raw.date||!Array.isArray(raw.items))continue;
  const day=dates.get(raw.id)||{...raw,items:[]};
  const seen=new Set(day.items.map(i=>i.id||`${i.expression}\u0000${i.meaning}`));
  for(const item of raw.items){const key=item.id||`${item.expression}\u0000${item.meaning}`;if(!seen.has(key)){day.items.push(item);seen.add(key);}}
  dates.set(raw.id,day);
 }
 return [...dates.values()].sort((a,b)=>b.date.localeCompare(a.date));
};
const ceciliaDay=id=>ceciliaDays().find(d=>d.id===id);
const ceciliaIds=id=>[...new Set((ceciliaDay(id)?.items||[]).flatMap(i=>[i.unitId,...(i.practiceIds||[])]).filter(id=>unitById.has(id)))];
const ceciliaDateLabel=id=>{const d=ceciliaDay(id);return d?d.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,(_,y,m,d)=>`${y}年${Number(m)}月${Number(d)}日`):'全部日期';};
const ceciliaVisit=(id,day)=>record(id).dailyVisits?.[day];
const isCeciliaOrigin=o=>o?.domain==='moena'&&!!ceciliaDay(o.dateId||o.filter);
const originDay=o=>isCeciliaOrigin(o)?o.dateId||o.filter:null;
const unitInOrigin=(u,o)=>o?.domain==='moena'?!!u&&(o.ids||ceciliaIds(o.dateId||o.filter)).includes(u.id):!!u&&u.domains.includes(o?.domain);
function currentDayOrigin(day=filter){return {domain:'moena',dateId:day,tab:'scene',filter:day,subfilter:'all',search:'',page:Number(page)||1,ids:ceciliaIds(day)};}
function dateLearningPending(id,day){const r=record(id);return !ceciliaVisit(id,day)&&!(r.learn?.stage==='done'&&originDay(r.learn.origin)===day);}
function dailyVisitContext(){if(view==='review')return store.reviewScope?.domain==='moena'?store.reviewScope.dateId||null:null;const reviewing=['practice','summary'].includes(view)||(view==='mastery'&&state.masteryOrigin==='review');return reviewing?(reviewScopeOrigin()?.domain==='moena'?reviewScopeOrigin().dateId||null:null):view==='study'?originDay(state.learn?.origin):null;}
function markDailyVisit(status,day=dailyVisitContext()){
 if(status==='mastered')delete state.dailyMasteryUndo;
 if(!day||!ceciliaIds(day).includes(lesson.id))return;
 state.dailyVisits=state.dailyVisits||{};const at=Date.now();
 if(status==='mastered')state.dailyMasteryUndo={dateId:day,markedAt:at,previous:state.dailyVisits[day]?{...state.dailyVisits[day]}:null};
 state.dailyVisits[day]={status,at,...(status==='done'?{attempted:!!state.learn?.results?.some(x=>x.grade!=='skip')}:{})};
}
function undoDailyMasteryVisit(){
 const memo=state.dailyMasteryUndo;delete state.dailyMasteryUndo;
 if(!memo||typeof memo.dateId!=='string')return false;
 const current=state.dailyVisits?.[memo.dateId];
 if(current?.status!=='mastered'||current.at!==memo.markedAt)return false;
 if(memo.previous)state.dailyVisits[memo.dateId]={...memo.previous};else delete state.dailyVisits[memo.dateId];
 return true;
}
function ceciliaProgress(day){const ids=ceciliaIds(day);return {total:ids.length,handled:ids.filter(id=>!dateLearningPending(id,day)).length,due:ids.filter(id=>{const r=record(id);return r.enrolled&&!r.mastered&&r.schedule.due<=Date.now()}).length};}
function ceciliaUpdateLabel(){const days=ceciliaDays();return days.length?`更新于 ${ceciliaDateLabel(days[0].id)} · ${days.length} 天材料`:'暂无每日更新';}
function ceciliaNavigation(){return `<section class="domain-panel" aria-label="学习内容"><div class="domain-tabs spoken-domains" role="group" aria-label="学习内容">${catalog.domains.filter(d=>d.track==='spoken').map(d=>button(`<strong>${esc(d.name)}</strong><span>${d.id==='moena'?esc(ceciliaUpdateLabel()):units.filter(u=>u.domains.includes(d.id)).length+' 个表达'}</span>`,'domain',`domain-option ${domain===d.id?'selected':''}`,`data-domain="${d.id}" aria-pressed="${domain===d.id}"`)).join('')}</div></section>`;}
function ceciliaBreadcrumb(day){return `<nav class="breadcrumbs" aria-label="当前位置">${button('首页','home','')}<span>/</span>${button('学习','cecilia-learning-root','')}<span>/</span>${day?button('小枝萌菜','cecilia-dates',''):'<span aria-current="page">小枝萌菜</span>'}${day?`<span>/</span><span aria-current="page">${esc(ceciliaDateLabel(day.id))}</span>`:''}</nav>`;}
function ceciliaLibraryPage(){
 const day=ceciliaDay(filter);
 if(day)return ceciliaDatePage(day);
 if(!ceciliaDays().length)return `${ceciliaBreadcrumb()}<div class="page-heading"><div><p class="eyebrow">小枝萌菜</p><h1>把每天遇见的日语，留在这里。</h1></div></div>${ceciliaNavigation()}<section class="empty"><h2>还没有每日语料</h2><p>新增的材料会按日期保存在这里。</p><div class="actions centered">${button('先学日常表达','cecilia-learning-root','button secondary')}</div></section>`;
 return `${ceciliaBreadcrumb()}<div class="page-heading"><div><p class="eyebrow">小枝萌菜</p><h1>小枝萌菜的每日语料</h1><p class="lead">选择日期，学习当天遇见的表达。</p></div></div>${ceciliaNavigation()}<div class="list-heading"><h2>按日期选择材料</h2><span class="small">${ceciliaDays().length} 天</span></div><div class="unit-grid">${ceciliaDays().map(d=>{const p=ceciliaProgress(d.id);return `<article class="library-item daily-card"><div><p class="tag">每日材料</p><h3>${esc(ceciliaDateLabel(d.id))}</h3>${libraryProgressMarkup(ceciliaIds(d.id),d.id)}<p class="small">${d.items.length} 条材料</p></div><div class="actions">${button('进入当天内容','cecilia-date','button',`data-day="${d.id}"`)}${button(p.due?'复习当天内容':'提前复习当天内容','cecilia-review-day','button secondary',`data-day="${d.id}" ${ceciliaIds(d.id).some(id=>record(id).enrolled&&!record(id).mastered)?'':'disabled'}`)}</div></article>`}).join('')}</div><div class="actions">${ceciliaDays().length?button('复习小枝萌菜全部到期内容','cecilia-review-all','button secondary',availableUnits().some(u=>ceciliaDays().some(d=>ceciliaIds(d.id).includes(u.id)))?'':'disabled'):''}</div>`;
}
function ceciliaDatePage(day){
 const ids=ceciliaIds(day.id),p=ceciliaProgress(day.id),pending=ids.find(id=>dateLearningPending(id,day.id)),query=search.trim().toLowerCase();
 const visible=ids.filter(id=>{const u=unitById.get(id);return !query||[u.meaning,u.expression].join(' ').toLowerCase().includes(query)});
 const pages=Math.max(1,Math.ceil(visible.length/24));page=Math.max(1,Math.min(Number(page)||1,pages));const shown=visible.slice((page-1)*24,page*24);
 return `${ceciliaBreadcrumb(day)}<div class="page-heading"><div><p class="eyebrow">小枝萌菜 · ${esc(day.date)}</p><h1>这一天遇见的表达。</h1></div></div>${libraryProgressMarkup(ids,day.id)}<div class="actions daily-toolbar">${pending?button(record(pending).learn&&record(pending).learn.stage!=='done'?'继续学习':'开始学习','cecilia-start-day','button',`data-day="${day.id}" data-enter-default`):`<p class="section-label">${ids.length?'当天内容已浏览完，可以复习或选择其他日期。':'这一天的材料以词语和说明为主，可以展开下方原始材料查看。'}</p>`}${button('复习当天内容','cecilia-review-day','button secondary',`data-day="${day.id}" ${ids.some(id=>record(id).enrolled&&!record(id).mastered)?'':'disabled'}`)}${button('返回日期目录','cecilia-dates','button secondary')}</div><label class="search-label daily-search" for="library-search">查找当天表达<input id="library-search" type="search" value="${esc(search)}" placeholder="输入意思或表达" autocomplete="off"></label><div class="unit-grid">${shown.map(id=>{const u=unitById.get(id),r=record(id),visit=ceciliaVisit(id,day.id),active=r.learn&&r.learn.stage!=='done',originalPending=active&&originDay(r.learn.origin)!==day.id;return `<article class="library-item unit-card"><div><p class="tag">${visit?visit.status==='mastered'?'当天已掌握':visit.status==='skip'||visit.attempted===false?'当天已略过':'当天已学完':active&&!originalPending?'当天学习中':'当天未练习'}</p><h3>${esc(u.meaning)}</h3>${r.mastered?'<p class="small">已掌握 · 可以再练，也可以略过本次材料</p>':originalPending?'<p class="small">先接着原来的练习；本日材料会保留，完成后可以回来。</p>':active?'<p class="small">继续时保留原题和输入。</p>':''}</div><div class="actions">${button(originalPending?'继续原练习':active?'继续练习':visit||r.mastered||r.learn?.stage==='done'?'再练一次':'开始学习','cecilia-open','button outline',`data-lesson="${id}" data-day="${day.id}" data-force="1"`)}${!visit?button('本日略过','cecilia-skip','text-button',`data-lesson="${id}" data-day="${day.id}"`):''}</div></article>`}).join('')}</div>${ids.length&&!visible.length?'<p class="empty">没有找到对应表达，可以换个关键词。</p>':''}${pages>1?`<nav class="library-pagination" aria-label="当天表达分页">${button('上一页','page','button secondary',`data-page="${page-1}" ${page===1?'disabled':''}`)}<span class="small">${page} / ${pages}</span>${button('下一页','page','button secondary',`data-page="${page+1}" ${page===pages?'disabled':''}`)}</nav>`:''}<details class="daily-source"><summary>查看当天原始材料 · ${day.items.length} 条</summary><p class="small">展开后会显示日语表达。</p>${day.items.map(i=>`<article><p lang="ja"><strong>${esc(i.expression)}</strong></p><p>${esc(i.meaning)}</p>${i.sourceText?`<p lang="ja">${esc(i.sourceText)}</p>`:''}${i.usageNote?`<p class="small">${esc(i.usageNote)}</p>`:''}${[...new Set([i.unitId,...(i.practiceIds||[]),...(i.relatedIds||[])])].filter(id=>id&&ceciliaIds(day.id).includes(id)).map(id=>button('练习：'+unitById.get(id).meaning,'cecilia-open','text-button',`data-lesson="${id}" data-day="${day.id}" data-force="1"`)).join('')}</article>`).join('')}</details>`;
}
function openCeciliaUnit(id,day,force=false){
 if(!ceciliaIds(day).includes(id))return;
 const r=record(id);domain='moena';filter=day;subfilter='all';tab='scene';search='';lastSpoken='moena';
 if(r.mastered&&!force){showDialog(`<h2>这个表达你已经掌握</h2><p>${esc(unitById.get(id).meaning)}</p><div class="actions">${button('再练一次','cecilia-open','button',`data-lesson="${id}" data-day="${day}" data-force="1"`)}${button('本日略过','cecilia-skip','button secondary',`data-lesson="${id}" data-day="${day}"`)}</div>`);return;}
 if(dialog.open)dialog.close();selectLesson(id);
 if(state.learn&&state.learn.stage!=='done'&&originDay(state.learn.origin)!==day){
  state.learn.pendingDailyDate=day;
  if(!state.learn.origin)state.learn.origin={domain:unitById.get(id).domain,tab:'scene',filter:'all',subfilter:'all',search:'',page:1,ids:[id]};
  applyLearningOrigin(state.learn.origin);state.learn.dailyReplay=!!state.mastered;save();go('study');toast('先接着原来的练习，本日材料会为你保留');return;
 }
 domain='moena';filter=day;
 if(!state.learn||state.learn.stage==='done')state.learn=newLearning();
 state.learn.origin=currentDayOrigin(day);state.learn.dailyReplay=!!state.mastered;save();go('study');
}
function pendingDailyContinuation(){
 const day=state.learn?.pendingDailyDate;
 if(state.learn?.stage!=='done'||!ceciliaDay(day)||!ceciliaIds(day).some(id=>dateLearningPending(id,day)))return '';
 return `<div class="continuation"><p class="section-label">接着学习 · 小枝萌菜</p><h3>${esc(ceciliaDateLabel(day))}</h3><div class="actions continuation-actions">${button('继续学习','cecilia-start-day','button',`data-day="${day}" data-enter-default`)}${button('返回本日语料','cecilia-date','button secondary',`data-day="${day}"`)}</div></div>`;
}
function nextCeciliaUnit(day=originDay(state.learn?.origin),afterId=lesson.id){const ids=ceciliaIds(day),at=ids.indexOf(afterId),ordered=at<0?ids:[...ids.slice(at+1),...ids.slice(0,at)];return ordered.map(id=>unitById.get(id)).find(u=>u.id!==afterId&&dateLearningPending(u.id,day));}
function continueCeciliaDay(day){const ids=ceciliaIds(day),recent=store.resume?.learn?.id,pending=ids.find(id=>id===recent&&dateLearningPending(id,day)&&record(id).learn?.stage!=='done')||ids.find(id=>dateLearningPending(id,day));if(pending)openCeciliaUnit(pending,day);else{domain='moena';filter=day;go('library');}}
function reviewScopeOrigin(){return state.review?.origin||((view==='summary'||view==='mastery')?state.summary?.origin:null)||store.reviewScope||null;}
function filterReviewScope(list,scope=reviewScopeOrigin()){
 if(scope?.domain!=='moena')return list;
 const ids=scope.dateId?ceciliaIds(scope.dateId):[...new Set(ceciliaDays().flatMap(d=>ceciliaIds(d.id)))];return list.filter(u=>ids.includes(u.id));
}
function reviewScopeControls(){if(!ceciliaDays().length)return '';const scope=store.reviewScope;return `<div class="daily-review-scope"><span class="section-label">复习范围</span><div class="chips">${button('全部表达','review-all-scope',`chip ${!scope?'active':''}`)}${button('小枝萌菜全部日期','cecilia-review-all',`chip ${scope?.domain==='moena'&&!scope.dateId?'active':''}`)}${ceciliaDays().map(d=>button(d.date,'cecilia-review-day',`chip ${scope?.dateId===d.id?'active':''}`,`data-day="${d.id}"`)).join('')}</div></div>`;}
function startCeciliaReview(day){store.reviewScope={domain:'moena',...(day?{dateId:day}:{})};domain='moena';filter=day||'all';lastSpoken='moena';save();go('review');}
function ceciliaContinuation(kind){
 const origin=kind==='review'?reviewScopeOrigin():learningOrigin(),day=originDay(origin)||origin?.dateId;
 const next=kind==='review'?nextReviewUnit():nextCeciliaUnit(day);
 const primary=next?button(kind==='review'?'继续复习':'继续学习',kind==='review'?'next-review':'cecilia-next','button',`data-next="${next.id}" data-day="${day||''}" data-enter-default`):kind==='review'?'':button('复习本日语料','cecilia-review-day','button secondary',`data-day="${day}" ${ceciliaIds(day).some(id=>record(id).enrolled&&!record(id).mastered)?'data-enter-default':'disabled'}`);
 const back=button(day?'返回本日语料':'返回日期目录',day?'cecilia-date':'cecilia-dates','button secondary',`data-day="${day||''}" ${!next&&kind==='review'?'data-enter-default':''}`);
 return `<div class="continuation"><p class="section-label">小枝萌菜 · ${esc(day?ceciliaDateLabel(day):'全部日期')}</p><h3>${next?esc(next.meaning):kind==='review'?'这个范围内暂时没有其他到期表达':'当天内容已浏览完'}</h3><div class="actions continuation-actions">${primary}${back}</div>${day?`<div class="continuation-more">${button('查看其他日期','cecilia-dates','text-button')}</div>`:''}</div>`;
}
function handleCeciliaAction(action,el){const day=el.dataset.day,id=el.dataset.lesson||el.dataset.next;
 switch(action){
 case 'cecilia-learning-root':domain='daily';lastSpoken='daily';filter='all';subfilter='all';search='';page=1;go('library');return true;
 case 'cecilia-date':domain='moena';filter=ceciliaDay(day)?day:'all';search='';page=1;lastSpoken='moena';go('library');return true;
 case 'cecilia-dates':domain='moena';filter='all';search='';page=1;lastSpoken='moena';go('library');return true;
 case 'cecilia-start-day':continueCeciliaDay(day);return true;
 case 'cecilia-open':openCeciliaUnit(id,day,el.dataset.force==='1');return true;
 case 'cecilia-next':openCeciliaUnit(id,day);return true;
 case 'cecilia-skip':if(ceciliaIds(day).includes(id)){selectLesson(id);markDailyVisit('skip',day);save();if(dialog.open)dialog.close();continueCeciliaDay(day);}return true;
 case 'cecilia-review-day':startCeciliaReview(day);return true;
 case 'cecilia-review-all':startCeciliaReview();return true;
 case 'review-all-scope':store.reviewScope=null;save();go('review');return true;
 default:return false;
 }
}
