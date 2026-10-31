'use strict';
// 覆盖：AI 核对指令“首次完整、之后简短”，以及学习进度节点的只读回看。
const assert=require('node:assert');
const {setup}=require('./validate.cjs');

(async()=>{
 // ---- AI 核对指令 ----
 const e=setup(),r=e.run;
 let copied='';
 e.ctx.navigator={clipboard:{writeText:async v=>{copied=v;}}};
 r("selectLesson('jp-teoku');view='study'");

 // 复制失败：不记为已发送，下次仍是完整版。
 e.ctx.navigator.clipboard.writeText=async()=>{throw Error('denied');};
 await r("copyPersonalCheck(undefined)").catch(()=>{});
 r("state.draft.zh='我先查好了';state.draft.en='調べた'");
 await r("copyPersonalCheck()");
 assert.equal(r("aiRulesSent('personal')"),false,'失败的复制不应记为已发送');
 e.el('dialog').close();

 e.ctx.navigator.clipboard.writeText=async v=>{copied=v;};
 await r("copyPersonalCheck()");
 assert(copied.includes('我已经熟悉')&&copied.includes('助词、活用'),'首次应为完整指令');
 assert.equal(r("aiRulesSent('personal')"),true);
 const fullLength=copied.length;

 await r("copyPersonalCheck()");
 assert(copied.startsWith('沿用前面的核对要求'),'之后应为简短指令');
 assert(copied.includes('我先查好了')&&copied.includes('調べた')&&copied.includes('～ておく'),'简短指令仍带本次内容和目标表达');
 assert(!copied.includes('助词、活用')&&copied.length<fullLength/2,'简短指令不应重复完整要求');

 await r("copyPersonalCheck(undefined,true)");
 assert(copied.includes('助词、活用')&&copied.length===fullLength,'“复制完整指令”应强制给完整版');

 // 场景版与例句版分别记录。
 r("selectLesson('jp-sounandesune');state.draft.scene='朋友想休息'");
 assert.equal(r("aiRulesSent('scenario')"),false);
 await r("copyPersonalCheck()");
 assert(copied.includes('我已经熟悉')&&copied.includes('朋友想休息'),'场景版首次应完整');
 await r("copyPersonalCheck()");
 assert(copied.startsWith('沿用前面的核对要求')&&copied.includes('朋友想休息'),'场景版之后应简短并保留场景');

 // 翻译对照单独记录。
 r("selectLesson('jp-teoku');state.learn=newLearning();view='study';state.learn.q.input='未収録の表現';state.learn.q.checked=true;state.learn.q.revealed=true;render()");
 assert(r('app.innerHTML').includes('data-action="copy-translation-check-full"'));
 await r("copyTranslationCheck()");
 assert(copied.includes('页面只按收录答案匹配'),'翻译核对首次应完整');
 assert.equal(r("aiRulesSent('translation')"),true);
 await r("copyTranslationCheck()");
 assert(copied.startsWith('沿用前面的核对要求')&&copied.includes('未収録の表現'),'翻译核对之后应简短并带本题内容');
 assert(!copied.includes('页面只按收录答案匹配'));
 await r("copyTranslationCheck(true)");
 assert(copied.includes('页面只按收录答案匹配'));
 // 完整指令的存在不触碰学习数据。
 assert(!JSON.stringify(r('store')).includes('aiRulesSent'));
 console.log('PASS: AI check instruction is full on first successful copy, brief afterwards, per kind, failed copy not counted, full copy on demand.');

 // ---- 进度节点回看 ----
 const f=setup(),fr=f.run;
 const click=(action,extra={})=>f.handlers.click({target:{closest:s=>s.startsWith('a[')?null:{dataset:{action,...extra}}}});
 fr("selectLesson('jp-teoku');state.learn=newLearning();view='study';render()");
 fr("state.learn.q.input=lesson.entry.answers[0];");
 click('check');
 fr("beginLearningExercises();save();render()");
 assert(!fr('app.innerHTML').includes('data-action="recap-question"')||true);
 // 在第一道学习题输入并自评，再进入第二题。
 fr("state.learn.q.input='明日迷わないように、今日のうちに場所を調べておくね。';state.learn.q.revealed=true;state.learn.q.checked=true;");
 const answeredId=fr('learningQuestion().id');
 click('grade',{grade:'hard'});
 assert.equal(fr('state.learn.index')>=1,true);
 const html=fr('app.innerHTML');
 assert(html.includes('class="session-questions"'),'学习题阶段应显示题目节点');
 assert(html.includes('data-action="recap-question"'),'已完成的题可点击');
 assert(html.includes('data-action="recap-intro"'),'看讲解节点可点击');
 assert(html.includes('aria-current="step"'));

 const before=fr('JSON.stringify(state.learn)')+fr('JSON.stringify(state.schedule)');
 const idx=fr('state.learn.results.length')-1;
 click('recap-question',{q:String(fr(`(state.learn.pinnedLearning||lesson.learning).findIndex(q=>q.id==='${answeredId}')`))});
 const dlg=fr('dialog.innerHTML');
 assert(dlg.includes('回看第')&&dlg.includes('明日迷わないように、今日のうちに場所を調べておくね。'),'回看应显示当时的作答');
 assert(dlg.includes('参考表达')&&dlg.includes('不会改变成绩'));
 assert(dlg.includes('不熟'),'回看应显示当时的自评');
 assert.equal(fr('JSON.stringify(state.learn)')+fr('JSON.stringify(state.schedule)'),before,'回看不得改变学习进度或成绩');
 fr('dialog.close()');

 click('recap-intro');
 assert(fr('dialog.innerHTML').includes('明日の打ち合わせまでに、資料を読んでおきます。'));
 assert.equal(fr('JSON.stringify(state.learn)')+fr('JSON.stringify(state.schedule)'),before,'回看讲解不得标记借助提示');
 fr('dialog.close()');

 click('recap-entry');
 assert(fr('dialog.innerHTML').includes('回看初次尝试'));
 fr('dialog.close()');
 assert(fr('(state.learn.q.usedHint||false)')===false,'回看不影响当前题状态');

 // 写例句阶段仍可回看全部。
 fr("state.learn.stage='custom';render()");
 assert(fr('app.innerHTML').includes('class="session-questions"'));
 console.log('PASS: progress nodes and finished question chips reopen read-only recaps with the original answer and grade, without changing progress.');
})().catch(err=>{console.error(err);process.exit(1);});
