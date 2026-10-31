'use strict';
// 笔记格式（v1.17.0）：存储形状、白名单、显示转义、备份往返与篡改拒绝、旧纯文本笔记兼容。
const assert=require('node:assert');
const {setup}=require('./validate.cjs');
const e=setup(),r=e.run;
const J=v=>JSON.stringify(v);

// ---- 形状校验：只认白名单 ----
const ok=(runs,text)=>r(`validNoteRuns(${J(runs)},${J(text)})`);
assert.equal(ok(undefined,'x'),true,'没有 runs 的旧笔记有效');
assert.equal(ok([{t:'ab',b:true},{t:' cd',c:'blue'}],'ab cd'),true);
assert.equal(ok([{t:'ab',c:'purple'}],'ab'),false,'未知颜色');
assert.equal(ok([{t:'ab',h:'pink'}],'ab'),false,'未知高亮');
assert.equal(ok([{t:'ab',b:'yes'}],'ab'),false,'布尔值必须为 true');
assert.equal(ok([{t:'ab',href:'x'}],'ab'),false,'未知字段');
assert.equal(ok([{t:'ab'}],'zz'),false,'runs 连起来必须等于 text');
assert.equal(ok([],'x'),false,'空数组无效');
assert.equal(ok([{t:''}],''),false,'空片段无效');
assert.equal(ok('<b>x</b>','x'),false,'字符串不是 runs');

// ---- 整理：合并同格式、无格式时按纯文本 ----
assert.deepEqual(JSON.parse(J(r(`cleanNoteRuns([{t:'a',b:true},{t:'b',b:true},{t:' c'}])`))),[{t:'ab',b:true},{t:' c'}]);
assert.equal(r(`cleanNoteRuns([{t:'a'},{t:'b'}])`),null,'没有任何格式则不保存 runs');
assert.deepEqual(JSON.parse(J(r(`cleanNoteRuns([{t:'a',c:'nope',b:true},{t:'',b:true}])`))),[{t:'a',b:true}],'未知颜色被丢弃、空片段被丢弃');

// ---- 显示：转义 + 白名单类名 ----
const html=r(`noteRunsHTML([{t:'<img src=x onerror=alert(1)>',b:true},{t:' & ',c:'red',h:'yellow',u:true}])`);
assert(!html.includes('<img'),'文字必须转义');
assert(html.includes('&lt;img')&&html.includes('&amp;'));
assert(html.includes('note-c-red')&&html.includes('note-h-yellow')&&html.includes('<u>')&&html.includes('<b>'));

// ---- 保存与读取 ----
r("selectLesson('c28-normal');state.learn=newLearning();view='study';state.learn.stage='exercise';state.learn.q.revealed=true;");
const id=r('questionNoteId(learningQuestion())');
assert.equal(r(`saveNoteText('question',${J(id)},'ab cd',[{t:'ab',b:true},{t:' cd',c:'blue'}])`),true);
assert.equal(r(`noteValue('question',${J(id)})`),'ab cd','text 始终是纯文本');
assert.deepEqual(JSON.parse(J(r(`noteRuns('question',${J(id)})`))),[{t:'ab',b:true},{t:' cd',c:'blue'}]);
assert(r(`noteCopyHTML('question',${J(id)})`).includes('note-c-blue'));
// 无格式保存会清掉 runs，不留残余
assert.equal(r(`saveNoteText('question',${J(id)},'plain only',[{t:'plain only'}])`),true);
assert.equal(r(`'runs' in noteOwner('question',${J(id)}).note`),false);
// runs 与 text 不一致时不接受 runs，退回纯文本
assert.equal(r(`saveNoteText('question',${J(id)},'abc',[{t:'zzz',b:true}])`),true);
assert.equal(r(`'runs' in noteOwner('question',${J(id)}).note`),false);
// 旧纯文本笔记：显示为转义文本，编辑器以单段载入
r(`state.questionNotes[${J(id)}].note={text:'旧笔记 <b>x</b>',updatedAt:Date.now()}`);
assert.equal(r(`noteCopyHTML('question',${J(id)})`),'旧笔记 &lt;b&gt;x&lt;/b&gt;');
assert.deepEqual(JSON.parse(J(r(`noteRuns('question',${J(id)})`))),[{t:'旧笔记 <b>x</b>'}]);
// 上限仍然有效
assert.equal(r(`saveNoteText('question',${J(id)},'x'.repeat(10001),null)`),false);

// ---- 编辑区标记 ----
r(`openPersonalNoteEditors.clear()`);
const editor=r(`noteEditorMarkup('draft','','draft')`);
assert(editor.includes('contenteditable="true"')&&editor.includes('data-note-rich="1"')&&editor.includes('note-input'));
assert(editor.includes('data-fmt="bold"')&&editor.includes('data-fmt="painter"')&&editor.includes('data-fmt="clear"'));
assert(editor.includes('收起笔记')&&editor.includes('输入后自动保存'));

// ---- 备份往返与篡改 ----
r(`saveNoteText('question',${J(id)},'ab cd',[{t:'ab',b:true},{t:' cd',c:'blue'}])`);
const text=r('JSON.stringify(progressBackup())');
assert(text.includes('"runs"'),'备份带上格式');
const tryImport=t=>{const v=r(`previewProgressImport(${J(t)})`);r("try{dialog.close()}catch{}");return v;};
assert.equal(tryImport(text),true,'合法备份可导入');
const mutate=fn=>{const b=JSON.parse(text);for(const rec of Object.values(b.data.records))for(const n of Object.values(rec.questionNotes||{}))fn(n.note);return JSON.stringify(b);};
assert.equal(tryImport(mutate(n=>{n.runs=[{t:'ab',c:'purple'},{t:' cd'}];})),false);
assert.equal(tryImport(mutate(n=>{n.runs=[{t:'zz',b:true}];})),false);
assert.equal(tryImport(mutate(n=>{n.runs=[{t:'ab cd',b:true,href:'x'}];})),false);
assert.equal(tryImport(mutate(n=>{delete n.runs;})),true,'没有格式的旧备份仍可导入');
// 例句笔记同样校验
r("state.custom=[{id:'c-fmt',zh:'中',en:'En.'}]");
r(`saveNoteText('custom','c-fmt','hi',[{t:'hi',b:true}])`);
assert(r('JSON.stringify(progressBackup())').includes('"hi"'));

console.log('PASS: note formats store only whitelisted runs beside plain text, escape on display, round-trip through backup, reject tampered runs, and keep legacy plain notes working.');
