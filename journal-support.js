'use strict';
// 心情打卡、学习日历、学习时间与“结束今天的学习”。数据放在 store.journal，随主存储与备份一起保存；无账号、无服务器、无网络请求。
// store.journal[YYYY-MM-DD]={mood:'e'|'s'|'g',moodAt,sec,expr,rev,endedAt}；学习时间只累计“有操作”的时间，是大约值。
const JOURNAL_MOODS={
 e:{name:'元气满满',kao:'(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',tip:'精神很好，想多学一点',reply:'太好了！今天也一起往前走一点点。'},
 s:{name:'平平常常',kao:'(・ω・)',tip:'不好不坏，按自己的节奏来',reply:'平平稳稳也很好，慢慢来。'},
 g:{name:'全凭毅力',kao:'(`･ω･´)ゞ',tip:'有点累，但还是来了',reply:'辛苦了。能打开这里，今天就已经算数，哪怕只学一点点。'}
};
const JOURNAL_IDLE_MS=120000,JOURNAL_SAVE_MS=30000,JOURNAL_MAX_SEC=86400,JOURNAL_MAX_COUNT=10000;
const journalPad=n=>String(n).padStart(2,'0');
function journalDay(t=Date.now()){const d=new Date(t);return `${d.getFullYear()}-${journalPad(d.getMonth()+1)}-${journalPad(d.getDate())}`;}
const journalMood=m=>['e','s','g'].includes(m)?m:null;
function journalClamp(value,max){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.min(max,Math.round(n)):null;}
// 读取时只留下合法字段，坏数据不会让整份进度读取失败。
function cleanJournal(raw){
 const out={};if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
 for(const [day,e] of Object.entries(raw).slice(0,4000)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!e||typeof e!=='object'||Array.isArray(e))continue;
  const c={},mood=journalMood(e.mood);
  if(mood){c.mood=mood;const at=journalClamp(e.moodAt,8.64e15);if(at!==null)c.moodAt=at;}
  for(const [field,max] of [['sec',JOURNAL_MAX_SEC],['expr',JOURNAL_MAX_COUNT],['rev',JOURNAL_MAX_COUNT],['endedAt',8.64e15]]){const n=journalClamp(e[field],max);if(n!==null&&n>0)c[field]=n;}
  if(Object.keys(c).length)out[day]=c;
 }
 return out;
}
function mergeJournal(a,b){
 const left=cleanJournal(a),right=cleanJournal(b),out={};
 for(const day of new Set([...Object.keys(left),...Object.keys(right)])){
  const x=left[day]||{},y=right[day]||{},c={},winner=(y.moodAt||0)>(x.moodAt||0)?y:(x.mood?x:y);
  if(winner.mood){c.mood=winner.mood;if(winner.moodAt)c.moodAt=winner.moodAt;}
  for(const field of ['sec','expr','rev','endedAt']){const n=Math.max(x[field]||0,y[field]||0);if(n)c[field]=n;}
  if(Object.keys(c).length)out[day]=c;
 }
 return out;
}
function journalEntry(day){return (store.journal&&typeof store.journal==='object'&&store.journal[day])||{};}
function journalEdit(day,fn){
 if(!store.journal||typeof store.journal!=='object'||Array.isArray(store.journal))store.journal={};
 const e={...(store.journal[day]||{})};fn(e);store.journal[day]=e;return e;
}
function journalBump(field){journalEdit(journalDay(),e=>{e[field]=Math.min(JOURNAL_MAX_COUNT,(e[field]||0)+1);});}
// ---- 学习时间：两次操作间隔不超过 2 分钟才计入 ----
let journalLast=0,journalDirty=false,journalSaved=0;
function journalFlush(){if(!journalDirty)return;journalDirty=false;journalSaved=Date.now();save();}
function journalActivity(now=Date.now()){
 if(typeof document!=='undefined'&&document.hidden)return;
 if(journalLast&&now-journalLast>0&&now-journalLast<=JOURNAL_IDLE_MS){
  journalEdit(journalDay(now),e=>{e.sec=Math.min(JOURNAL_MAX_SEC,(e.sec||0)+Math.round((now-journalLast)/1000));});journalDirty=true;
 }
 journalLast=now;
 if(journalDirty&&now-journalSaved>JOURNAL_SAVE_MS)journalFlush();
}
function journalMinutes(sec){return sec>=30?Math.max(1,Math.round(sec/60)):0;}
function journalDuration(sec){const m=journalMinutes(sec);if(!m)return '';return m>=60?`${Math.floor(m/60)} 小时${m%60?` ${m%60} 分`:''}`:`${m} 分`;}
function journalCellTime(sec){const m=journalMinutes(sec);if(!m)return '';return m>=60?`${(m/60).toFixed(1).replace(/\.0$/,'')} 小时`:`${m} 分`;}
// ---- 小水獭（矢量，无图片请求）----
function otterSVG(mood,size=96){
 const limb=(a,b,c,d)=>`<line class="o-lnk" x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke-width="17"/><line class="o-fk" x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke-width="11"/>`;
 const paw=(x,y)=>`<circle class="o-fur o-s" cx="${x}" cy="${y}" r="6.5"/>`;
 const spark=(x,y,c)=>`<g transform="translate(${x} ${y})"><path class="o-spark ${c}" d="M0-7Q0 0 7 0Q0 0 0 7Q0 0-7 0Q0 0 0-7Z"/></g>`;
 const m=journalMood(mood)||'s';
 const ears='<circle class="o-fur o-s" cx="29" cy="26" r="9"/><circle class="o-belly" cx="29" cy="27" r="4"/><circle class="o-fur o-s" cx="91" cy="26" r="9"/><circle class="o-belly" cx="91" cy="27" r="4"/>';
 const body='<ellipse class="o-fur o-s" cx="60" cy="93" rx="30" ry="24"/><ellipse class="o-belly" cx="60" cy="96" rx="18" ry="15"/>';
 const head='<ellipse class="o-fur o-s" cx="60" cy="48" rx="35" ry="30"/><ellipse class="o-belly" cx="60" cy="58" rx="17" ry="12"/><circle class="o-blush" cx="36" cy="56" r="4.5"/><circle class="o-blush" cx="84" cy="56" r="4.5"/><path class="o-ln w" d="M42 60L31 58M42 64L31 66M78 60L89 58M78 64L89 66"/><ellipse class="o-ink" cx="60" cy="52" rx="5.5" ry="3.5"/>';
 let arms,eyes,mouth,extra='';
 if(m==='e'){
  arms=limb(35,86,18,62)+limb(85,86,102,62)+paw(18,62)+paw(102,62);
  eyes='<g class="o-eyes"><circle class="o-ink" cx="45" cy="40" r="5.6"/><circle class="o-wh" cx="43" cy="38" r="2"/><circle class="o-wh" cx="47" cy="42.2" r="1"/><circle class="o-ink" cx="75" cy="40" r="5.6"/><circle class="o-wh" cx="73" cy="38" r="2"/><circle class="o-wh" cx="77" cy="42.2" r="1"/></g>';
  mouth='<path class="o-ln" d="M60 55.5V61"/><path class="o-open" d="M51 61Q60 75 69 61Z"/><ellipse class="o-tongue" cx="60" cy="66.5" rx="4.4" ry="2.4"/>';
  extra=spark(10,42,'')+spark(110,38,'d');
 }else if(m==='g'){
  arms=limb(36,88,41,82)+limb(84,88,79,82)+paw(41,81)+paw(79,81);
  eyes='<g class="o-eyes"><circle class="o-ink" cx="45" cy="42" r="3.8"/><circle class="o-ink" cx="75" cy="42" r="3.8"/></g><path class="o-ln b" d="M36.5 34L53 38.5M83.5 34L67 38.5"/>';
  mouth='<path class="o-ln" d="M60 55.5V60M52 65Q56 61 60 63.5T68 62"/>';
  extra='<path class="o-band-o" d="M27 34Q60 14 93 34"/><path class="o-band" d="M27 34Q60 14 93 34"/><path class="o-band-o" d="M93 34l8-5M93 34l9 5"/><path class="o-band" d="M93 34l8-5M93 34l9 5" stroke-width="3.2"/><path class="o-drop" d="M100 42Q105 50 100 54Q95 50 100 42Z"/>';
 }else{
  arms=limb(36,86,46,98)+limb(84,86,74,98)+paw(47,99)+paw(73,99);
  eyes='<g class="o-eyes"><circle class="o-ink" cx="45" cy="40" r="4.2"/><circle class="o-wh" cx="43.8" cy="38.6" r="1.4"/><circle class="o-ink" cx="75" cy="40" r="4.2"/><circle class="o-wh" cx="73.8" cy="38.6" r="1.4"/></g>';
  mouth='<path class="o-ln" d="M60 55.5V59.5M53 62Q56.5 66 60 59.5Q63.5 66 67 62"/>';
  extra='<circle class="o-bubble" cx="103" cy="40" r="4.6"/><circle class="o-bubble d" cx="111" cy="28" r="3.2"/>';
 }
 const cls={e:'o-e',s:'o-s2',g:'o-g'}[m];
 return `<svg class="o-svg ${cls}" viewBox="-4 8 128 112" width="${size}" height="${Math.round(size*112/128)}" aria-hidden="true" focusable="false"><g class="o-all">${ears}${body}${arms}${head}${eyes}${mouth}${extra}</g></svg>`;
}
// ---- 首页：每日打卡条 ----
let moodChanging=false;
function moodStripMarkup(){
 const day=journalDay(),today=journalEntry(day),mood=journalMood(today.mood);
 if(!mood||moodChanging){
  return `<section class="mood-strip" aria-labelledby="mood-title"><div class="mood-copy"><h2 id="mood-title">今天，你是什么状态？</h2><p>没有对错，选一个最像你的。</p></div><div class="mood-options" role="group" aria-label="今天的状态">${['e','s','g'].map(k=>`<button class="mood-option" data-action="mood-pick" data-mood="${k}" aria-label="${JOURNAL_MOODS[k].name}：${JOURNAL_MOODS[k].tip}">${otterSVG(k,64)}<span><b>${JOURNAL_MOODS[k].name}</b><small>${esc(JOURNAL_MOODS[k].kao)}</small></span></button>`).join('')}</div>${mood?`<button class="text-button mood-cancel" data-action="mood-cancel">不改了</button>`:''}</section>`;
 }
 const m=JOURNAL_MOODS[mood];
 return `<section class="mood-strip is-done" aria-label="今天的状态"><span class="mood-pet">${otterSVG(mood,60)}</span><div class="mood-copy"><p class="mood-line"><b>今天：${m.name}</b> <span class="mood-kao">${esc(m.kao)}</span></p><p class="mood-reply">${m.reply}</p></div><div class="mood-links"><button class="text-button" data-action="mood-change">改选</button><button class="text-button" data-action="end-day">结束今天的学习</button></div></section>`;
}
// ---- 学习日历 ----
let calMonth=null,calSel=null;
function calendarPage(){
 const now=new Date(),todayKey=journalDay();
 if(!calMonth)calMonth={y:now.getFullYear(),m:now.getMonth()};
 const {y,m}=calMonth,first=new Date(y,m,1).getDay(),offset=(first+6)%7,last=new Date(y,m+1,0).getDate();
 const key=d=>`${y}-${journalPad(m+1)}-${journalPad(d)}`,isCurrent=y===now.getFullYear()&&m===now.getMonth();
 if(!calSel||!calSel.startsWith(`${y}-${journalPad(m+1)}-`))calSel=isCurrent?todayKey:null;
 const counts={e:0,s:0,g:0};let studied=0;
 for(let d=1;d<=last;d++){const e=journalEntry(key(d));if(journalMood(e.mood))counts[e.mood]++;if(e.sec>=30||e.expr||e.rev)studied++;}
 const checked=counts.e+counts.s+counts.g;
 let cells=['一','二','三','四','五','六','日'].map(x=>`<div class="cal-dow" aria-hidden="true">${x}</div>`).join('')+'<div class="cal-day is-blank" aria-hidden="true"></div>'.repeat(offset);
 for(let d=1;d<=last;d++){
  const k=key(d),e=journalEntry(k),mood=journalMood(e.mood),future=k>todayKey;
  const label=`${m+1}月${d}日${mood?'，'+JOURNAL_MOODS[mood].name:future?'':'，未打卡'}${journalMinutes(e.sec)?'，学习 '+journalMinutes(e.sec)+' 分钟':''}`;
  cells+=`<button class="cal-day${k===todayKey?' is-today':''}${future?' is-future':''}" data-action="cal-day" data-day="${k}" aria-pressed="${calSel===k}" aria-label="${label}" ${future?'disabled':''}><span class="cal-n">${d}</span>${mood?otterSVG(mood,40):future?'<span class="cal-gap"></span>':'<span class="cal-gap is-empty"></span>'}<span class="cal-time">${journalCellTime(e.sec)}</span></button>`;
 }
 const sel=calSel&&journalEntry(calSel),detail=calSel?(()=>{
  const e=sel,mood=journalMood(e.mood),dt=new Date(calSel.replace(/-/g,'/')+' 00:00'),wk='日一二三四五六'[dt.getDay()],isToday=calSel===todayKey;
  const minutes=journalDuration(e.sec),study=[];if(e.expr)study.push(`完成 ${e.expr} 个表达`);if(e.rev)study.push(`复习 ${e.rev} 道题`);
  const time=minutes?`学习 ${minutes.replace(/分$/,'分钟')}`:'';
  const text=[mood?`心情：${JOURNAL_MOODS[mood].name}。`:isToday?'今天还没有打卡。':'这天没有打卡。',(time||study.length)?[time,...study].filter(Boolean).join('，')+'。':'这天没有学习记录。'].join('');
  return `<div class="cal-detail" aria-live="polite">${mood?otterSVG(mood,76):'<span class="cal-gap is-empty big"></span>'}<div><h3>${m+1} 月 ${Number(calSel.slice(8))} 日 周${wk}${isToday?'（今天）':''}</h3><p>${text}</p>${isToday?`<div class="cal-detail-actions">${mood?'':button('去首页打卡','cal-home','button secondary')}${button('结束今天的学习','end-day','button secondary')}</div>`:''}</div></div>`;
 })():'<p class="small cal-hint">点一天，看那天的详情。</p>';
 return `${crumbs('学习日历')}<div class="page-heading"><div><p class="eyebrow">学习日历</p><h1>${y} 年 ${m+1} 月</h1><p class="lead">${checked?`已打卡 ${checked} 天：元气满满 ${counts.e} · 平平常常 ${counts.s} · 全凭毅力 ${counts.g}`:'这个月还没有打卡。'}${studied?`　学习了 ${studied} 天`:''}</p></div><div class="cal-nav" role="group" aria-label="切换月份">${button('上个月','cal-prev','button secondary')}${button('回到本月','cal-today','button secondary',isCurrent?'disabled':'')}${button('下个月','cal-next','button secondary',isCurrent?'disabled':'')}</div></div><section class="cal-card" aria-label="${y}年${m+1}月"><div class="cal-grid">${cells}</div>${detail}</section><p class="note-line small"><span class="dot"></span><span>学习时间只统计页面里有操作的时间，是大约的数字。</span></p>`;
}
// ---- 结束今天的学习 ----
function endDayMarkup(){
 const e=journalEntry(journalDay()),mood=journalMood(e.mood)||'s',expr=e.expr||0,rev=e.rev||0;
 const kind=(expr>=3||rev>=8)?'lots':(expr||rev)?'little':'none';
 const copy={lots:['今天辛苦啦','今天的练习很扎实，学到的表达会慢慢变成自己的。好好休息一下吧。'],little:['一点点，也是前进','今天只做了一点，没关系，一点点也算数，明天再继续。'],none:['今天先休息','今天没有做题也没关系，打开看看就是好的开始。明天见。']}[kind];
 const stats=(expr||rev)?`<div class="end-stats">${expr?`<span>完成 ${expr} 个表达</span>`:''}${rev?`<span>复习 ${rev} 道题</span>`:''}</div>`:'';
 const extra=(mood==='g'&&expr)?'<p>你说今天状态不太轻松，还愿意学，真的很不容易。</p>':'';
 return `<div class="end-day">${otterSVG(mood,104)}<h2>${copy[0]}</h2>${stats}<p>${copy[1]}</p>${extra}<div class="actions centered">${button('好的，明天见','end-day-ok','button')}${button('再学一会','close-dialog','button secondary')}</div></div>`;
}
function handleJournalAction(action,el){
 switch(action){
  case 'calendar':calMonth=null;calSel=null;go('calendar');return true;
  case 'cal-home':go('home');return true;
  case 'mood-pick':{const mood=journalMood(el.dataset.mood);if(!mood)return true;const now=Date.now();journalEdit(journalDay(now),e=>{e.mood=mood;e.moodAt=now;});moodChanging=false;save();render();return true;}
  case 'mood-change':moodChanging=true;render();return true;
  case 'mood-cancel':moodChanging=false;render();return true;
  case 'cal-prev':case 'cal-next':{const step=action==='cal-prev'?-1:1,d=new Date(calMonth.y,calMonth.m+step,1),now=new Date();if(d>new Date(now.getFullYear(),now.getMonth(),1))return true;calMonth={y:d.getFullYear(),m:d.getMonth()};calSel=null;render();return true;}
  case 'cal-today':calMonth=null;calSel=null;render();return true;
  case 'cal-day':if(el.dataset.day&&el.dataset.day<=journalDay()){calSel=el.dataset.day;render();document.querySelector?.('.cal-day[aria-pressed="true"]')?.focus?.();}return true;
  case 'end-day':journalFlush();showDialog(endDayMarkup());return true;
  case 'end-day-ok':journalEdit(journalDay(),e=>{e.endedAt=Date.now();});save();dialog.close();return true;
 }
 return false;
}
if(typeof window!=='undefined'&&window.addEventListener){
 for(const type of ['pointerdown','keydown','input','wheel','touchstart','scroll'])window.addEventListener(type,()=>journalActivity(),{capture:true,passive:true});
 window.addEventListener('pagehide',()=>{journalFlush();});
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(document.hidden){journalFlush();journalLast=0;}});
