'use strict';
// 心情打卡、学习日历与学习时间（v1.18.0）：存储形状、清洗、跨标签合并、备份往返、时间累计、页面行为。
const assert=require('node:assert');
const {setup}=require('./validate.cjs');
const env=setup(),r=env.run;
const J=v=>JSON.stringify(v);
const click=(action,data={})=>env.handlers.click({target:{closest:s=>s==='[data-action]'?{dataset:{action,...data}}:null}});
const saved=()=>JSON.parse(env.map.get('beyondwords.japanese.v1'));

// ---- 清洗：只留下合法字段，坏数据不拖垮整份进度 ----
const cleaned=JSON.parse(J(r(`cleanJournal({
 '2026-10-30':{mood:'e',moodAt:5,sec:600,expr:2,rev:4,endedAt:9,evil:'<img>'},
 '2026-10-29':{mood:'angry',sec:-4,expr:'x'},
 'not-a-date':{mood:'e'},
 '2026-10-28':{mood:'g',sec:999999999,expr:99999999},
 '2026-10-27':null
})`)));
assert.deepEqual(cleaned['2026-10-30'],{mood:'e',moodAt:5,sec:600,expr:2,rev:4,endedAt:9},'未知字段被丢弃');
assert.equal(cleaned['2026-10-29'],undefined,'未知心情和负数整条无效');
assert.equal(cleaned['not-a-date'],undefined);
assert.equal(cleaned['2026-10-28'].sec,86400,'学习秒数有上限');
assert.equal(cleaned['2026-10-28'].expr,10000,'计数有上限');
assert.equal(r('cleanJournal("x")&&Object.keys(cleanJournal("x")).length'),0);
assert.equal(r('Object.keys(cleanJournal([1,2])).length'),0);

// ---- 跨标签合并：时间取较大值，心情取较晚选择 ----
const merged=JSON.parse(J(r(`mergeJournal(
 {'2026-10-30':{mood:'e',moodAt:10,sec:300,expr:1}},
 {'2026-10-30':{mood:'g',moodAt:20,sec:200,rev:3},'2026-10-31':{mood:'s',moodAt:1}}
)`)));
assert.deepEqual(merged['2026-10-30'],{mood:'g',moodAt:20,sec:300,expr:1,rev:3});
assert.equal(merged['2026-10-31'].mood,'s');

// ---- 首页打卡 ----
r("selectLesson('c28-normal');view='home';render();");
const day=r('journalDay()');
assert(/^\d{4}-\d{2}-\d{2}$/.test(day));
let html=r('app.innerHTML');
assert(html.includes('今天，你是什么状态？'),'当天未打卡时首页出现打卡条');
assert.equal((html.match(/data-action="mood-pick"/g)||[]).length,3);
for(const name of ['元气满满','平平常常','全凭毅力'])assert(html.includes(name));
assert(html.includes('class="o-svg'),'打卡条用矢量小水獭');
assert(!/<img[^>]+otter/i.test(html),'小水獭不请求图片');
click('mood-pick',{mood:'g'});
assert.equal(saved().journal[day].mood,'g','选择后写入存储');
html=r('app.innerHTML');
assert(html.includes('今天：全凭毅力')&&html.includes('改选')&&html.includes('结束今天的学习'));
assert(!html.includes('今天，你是什么状态？'),'已打卡后不再重复弹出');
click('mood-change');assert(r('app.innerHTML').includes('今天，你是什么状态？')&&r('app.innerHTML').includes('不改了'));
click('mood-cancel');assert(r('app.innerHTML').includes('今天：全凭毅力'),'不改了回到已打卡');
click('mood-pick',{mood:'bogus'});assert.equal(saved().journal[day].mood,'g','非法心情被忽略');
click('mood-pick',{mood:'e'});assert.equal(saved().journal[day].mood,'e');

// ---- 学习时间：只累计有操作的时间，闲置超过 2 分钟不算 ----
r(`journalLast=0;store.journal[${J(day)}].sec=0;`);
const t0=Date.now();
r(`journalActivity(${t0})`);r(`journalActivity(${t0+60000})`);
assert.equal(r(`journalEntry(${J(day)}).sec`),60,'间隔 1 分钟计 60 秒');
r(`journalActivity(${t0+60000+300000})`);
assert.equal(r(`journalEntry(${J(day)}).sec`),60,'隔了 5 分钟不计入');
r(`journalActivity(${t0+60000+300000+30000})`);
assert.equal(r(`journalEntry(${J(day)}).sec`),90);
r('journalFlush()');assert.equal(saved().journal[day].sec,90,'刷新后写入存储');
assert.equal(r('journalCellTime(20)'),'','不足 30 秒不显示');
assert.equal(r('journalCellTime(90)'),'2 分');
assert.equal(r('journalCellTime(5400)'),'1.5 小时');
assert.equal(r('journalDuration(4500)'),'1 小时 15 分');

// ---- 完成数统计 ----
const beforeExpr=r(`journalEntry(${J(day)}).expr||0`);
r("journalBump('expr');journalBump('rev');journalBump('rev')");
assert.equal(r(`journalEntry(${J(day)}).expr`),beforeExpr+1);
assert.equal(r(`journalEntry(${J(day)}).rev`),2);

// ---- 学习日历 ----
click('calendar');assert.equal(r('view'),'calendar');
html=r('app.innerHTML');
assert(html.includes('学习日历')&&html.includes('class="cal-grid"'));
const now=new Date(),lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
assert.equal((html.match(/data-action="cal-day"/g)||[]).length,lastDay,'每个日期一格');
assert(html.includes('2 分'),'今天格子里显示学习时间');
assert(html.includes('cal-detail')&&html.includes('心情：元气满满'),'默认展示今天详情');
assert(html.includes('学习 2 分钟')&&html.includes('完成 ')&&html.includes('复习 2 道题'));
assert(html.includes('<button class="button secondary" data-action="end-day"'),'今天详情里有结束今天的学习');
// 下个月是未来，不可进入；上个月可看，没有记录时显示空状态
click('cal-next');assert(r('calMonth.m')===now.getMonth(),'不能翻到未来月份');
click('cal-prev');html=r('app.innerHTML');assert(html.includes('这个月还没有打卡')||html.includes('已打卡'));
assert(html.includes('点一天，看那天的详情'));
const prevDay=r('(()=>{const d=new Date(calMonth.y,calMonth.m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`})()');
r(`store.journal[${J(prevDay)}]={mood:'s',moodAt:1,sec:1800,expr:2}`);r('render()');
click('cal-day',{day:prevDay});html=r('app.innerHTML');
assert(html.includes('心情：平平常常')&&html.includes('学习 30 分钟')&&html.includes('完成 2 个表达'));
assert(!html.includes('结束今天的学习'),'过去的日期不显示结束今天的学习');
click('cal-today');assert.equal(r('calMonth.m'),now.getMonth());assert.equal(r('calMonth.y'),now.getFullYear());

// ---- 结束今天的学习 ----
click('end-day');
let dlg=r('dialog.innerHTML');
assert(dlg.includes('end-day')&&dlg.includes('好的，明天见')&&dlg.includes('再学一会'));
assert(dlg.includes('一点点，也是前进')||dlg.includes('今天辛苦啦'),'按完成情况给出鼓励');
assert(dlg.includes('不太轻松')===false,'没完成表达时不说额外的鼓励');
r(`store.journal[${J(day)}].expr=5;store.journal[${J(day)}].mood='g'`);
click('end-day');dlg=r('dialog.innerHTML');
assert(dlg.includes('今天辛苦啦')&&dlg.includes('完成 5 个表达')&&dlg.includes('不太轻松'),'毅力状态且完成较多时的鼓励');
assert(!/分钟|学习 \d/.test(dlg),'鼓励窗口不显示学习分钟数');
click('end-day-ok');assert(saved().journal[day].endedAt>0);
// 没做题也没关系
r(`store.journal[${J(day)}]={mood:'s',moodAt:1}`);click('end-day');dlg=r('dialog.innerHTML');
assert(dlg.includes('今天先休息')&&!dlg.includes('end-stats'));

// ---- 备份往返、旧备份与篡改 ----
const T=Date.now()+1e7;
r(`store.journal[${J(day)}]={mood:'e',moodAt:${T},sec:600,expr:2,rev:3}`);r('save()');
const text=r('JSON.stringify(progressBackup())');
assert(text.includes('"journal"'));
const tryImport=t=>{const v=r(`previewProgressImport(${J(t)})`);r("try{dialog.close()}catch{}");return v;};
assert.equal(tryImport(text),true,'带打卡的备份可导入');
const backup=JSON.parse(text);
backup.data.journal['2026-01-01']={mood:'evil',sec:-1};backup.data.journal['bad']={mood:'e'};backup.data.journal[day].extra='<script>';
assert.equal(tryImport(JSON.stringify(backup)),true,'坏打卡项被清洗而不是拒绝整份备份');
r(`applyProgressImport('replace')`);
const after=saved().journal;
assert.equal(after['2026-01-01'],undefined);assert.equal(after.bad,undefined);assert.equal(after[day].extra,undefined);assert.equal(after[day].mood,'e');
delete backup.data.journal;
assert.equal(tryImport(JSON.stringify(backup)),true,'没有打卡数据的旧备份仍可导入');
// 合并模式保留本地打卡
r(`store.journal[${J(day)}]={mood:'g',moodAt:${T+100},sec:100}`);r('save()');
const older=JSON.parse(text);older.data.journal[day]={mood:'e',moodAt:T,sec:600,expr:2};older.data.journal['2026-09-01']={mood:'s',moodAt:1,sec:60};
tryImport(JSON.stringify(older));r(`applyProgressImport('merge')`);
const mj=saved().journal;
assert.equal(mj[day].mood,'g','合并时较晚的心情选择保留');assert.equal(mj[day].sec,600,'合并时学习时间取较大值');assert.equal(mj['2026-09-01'].mood,'s','合并带入备份里的其他日期');

// ---- 其他标签页的打卡不会被覆盖 ----
const fresh=setup();
fresh.run("selectLesson('c28-normal');view='home';render();");
const key='beyondwords.japanese.v1';
const other=JSON.parse(fresh.map.get(key)||'{"version":2,"records":{}}');
other.journal={'2026-10-01':{mood:'s',moodAt:3,sec:120}};
fresh.map.set(key,JSON.stringify({...other,version:2,records:other.records||{},generation:Number(other.generation||0)}));
fresh.run("save()");
assert(JSON.parse(fresh.map.get(key)).journal?.['2026-10-01'],'另一标签页写入的打卡在本页保存后仍保留');

console.log('PASS: mood check-in, activity-based study time, calendar, end-of-day encouragement, backup/merge and sanitising all work.');
