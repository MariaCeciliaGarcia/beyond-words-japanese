'use strict';
// Authored-question notes follow the actual task; personal notes follow their example/scene. Legacy unit notes stay archived.
const openPersonalNoteEditors=new Set();
const noteLimit=10000;
function noteKey(kind,id=''){return kind+':'+id;}
// ---- 笔记格式（v1.17.0）----
// 存储：note.text 始终是纯文本（兼容旧版本、计数、校验）；有格式时另存 note.runs=[{t,b,i,u,c,h}]，且 runs 的 t 连起来必须等于 text。
// 只允许：b/i/u 布尔值、c 为 red|blue|green、h 为 yellow。显示时由代码生成标签，永远不保存或执行外部 HTML。
const NOTE_COLORS={red:'#c0392b',blue:'#1f6fb9',green:'#2a8a57'};
const NOTE_HIGHLIGHT='#ffe58a';
function noteRgb(hex){const n=parseInt(hex.slice(1),16);return `rgb(${n>>16}, ${(n>>8)&255}, ${n&255})`;}
const NOTE_RGB_TO_COLOR=Object.fromEntries(Object.entries(NOTE_COLORS).map(([k,v])=>[noteRgb(v),k]));
const NOTE_HL_RGB=noteRgb(NOTE_HIGHLIGHT);
const NOTE_FMT_KEYS=['b','i','u','c','h'];
function validNoteRuns(runs,text){
 if(runs===undefined)return true;
 if(!Array.isArray(runs)||!runs.length||runs.length>5000)return false;
 let joined='';
 for(const r of runs){
  if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.t!=='string'||!r.t)return false;
  for(const k of Object.keys(r))if(k!=='t'&&!NOTE_FMT_KEYS.includes(k))return false;
  for(const k of ['b','i','u'])if(r[k]!==undefined&&r[k]!==true)return false;
  if(r.c!==undefined&&!Object.prototype.hasOwnProperty.call(NOTE_COLORS,r.c))return false;
  if(r.h!==undefined&&r.h!=='yellow')return false;
  joined+=r.t;
 }
 return typeof text!=='string'||joined===text;
}
// 整理为最简形式：丢弃无效/空片段，合并相邻同格式片段；没有任何格式时返回 null（按纯文本保存）。
function cleanNoteRuns(runs){
 const out=[];
 for(const r of runs||[]){
  if(!r||typeof r.t!=='string'||!r.t)continue;
  const f={t:r.t};
  if(r.b===true)f.b=true;if(r.i===true)f.i=true;if(r.u===true)f.u=true;
  if(Object.prototype.hasOwnProperty.call(NOTE_COLORS,r.c))f.c=r.c;
  if(r.h==='yellow')f.h='yellow';
  const last=out[out.length-1];
  if(last&&NOTE_FMT_KEYS.every(k=>last[k]===f[k]))last.t+=f.t;else out.push(f);
 }
 return out.some(r=>NOTE_FMT_KEYS.some(k=>r[k]))?out:null;
}
function noteRunsHTML(runs){
 return runs.map(r=>{
  let h=esc(r.t);
  if(r.u)h=`<u>${h}</u>`;if(r.i)h=`<i>${h}</i>`;if(r.b)h=`<b>${h}</b>`;
  const cls=[r.c?'note-c-'+r.c:'',r.h?'note-h-yellow':''].filter(Boolean).join(' ');
  return cls?`<span class="${cls}">${h}</span>`:h;
 }).join('');
}
function noteRuns(kind,id=''){
 const n=noteOwner(kind,id)?.note;if(!n)return [];
 return Array.isArray(n.runs)&&validNoteRuns(n.runs,n.text)?n.runs:(n.text?[{t:n.text}]:[]);
}
function noteCopyHTML(kind,id=''){
 const n=noteOwner(kind,id)?.note;
 return Array.isArray(n?.runs)&&validNoteRuns(n.runs,n.text)?noteRunsHTML(n.runs):esc(n?.text||'');
}
// 从编辑区读出片段。只认白名单格式，其余（图片、链接、未知样式）一律忽略。
function noteStyleOf(node,host){
 const st={},el=node.nodeType===3?node.parentElement:node;if(!el)return st;
 const cs=getComputedStyle(el);
 if(parseInt(cs.fontWeight,10)>=600)st.b=true;
 if(cs.fontStyle==='italic')st.i=true;
 const color=NOTE_RGB_TO_COLOR[cs.color];if(color)st.c=color;
 for(let e=el;e&&e!==host;e=e.parentElement){
  const c=getComputedStyle(e);
  if((c.textDecorationLine||'').includes('underline'))st.u=true;
  if(c.backgroundColor===NOTE_HL_RGB)st.h='yellow';
 }
 return st;
}
function readNoteEditor(host){
 const out=[];
 const push=(t,st)=>{if(!t)return;const last=out[out.length-1];
  if(last&&NOTE_FMT_KEYS.every(k=>last[k]===st[k]))last.t+=t;else out.push({t,...st});};
 const endsNL=()=>out.length&&out[out.length-1].t.endsWith('\n');
 (function walk(n){
  if(n.nodeType===3)push(n.nodeValue.replace(/\u200b/g,''),noteStyleOf(n,host));
  else if(n.nodeName==='BR')push('\n',{});
  else if(n.nodeType===1){
   const block=/^(DIV|P)$/.test(n.nodeName)&&n!==host;
   if(block&&out.length&&!endsNL())push('\n',{});
   n.childNodes.forEach(walk);
  }
 })(host);
 if(out.length)out[out.length-1].t=out[out.length-1].t.replace(/\n$/,'');
 return out.filter(r=>r.t!=='');
}
let noteChord=false,noteChordTimer=null,noteFormatMemory=null,notePainter=false;
const NOTE_CHORD_HELP='格式快捷键：1 红 · 2 蓝 · 3 绿 · H 高亮 · X 清除 · C 拾取格式 · V 套用格式（Esc 取消）';
const NOTE_COMBO=(typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||''))?'Ctrl+⌘+':'Ctrl+Alt+';
const NOTE_IS_MAC=typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||'');
function noteHostOf(el){return el?.closest?.('[data-note-rich]')||null;}
function noteEditorHost(from){
 const active=document.activeElement;
 if(active?.dataset?.noteRich)return active;
 return from?.closest?.('.note-editor')?.querySelector?.('[data-note-rich]')||null;
}
function noteHint(host,text,chord=false){
 const hint=host?.closest?.('.note-editor')?.querySelector?.('.note-format-hint');
 if(!hint)return;hint.textContent=text;hint.classList.toggle('is-chord',chord);
}
function noteDescribe(st){
 const a=[];if(st.b)a.push('加粗');if(st.i)a.push('斜体');if(st.u)a.push('下划线');
 if(st.c)a.push({red:'红',blue:'蓝',green:'绿'}[st.c]+'色');if(st.h)a.push('高亮');
 return a.length?a.join('、'):'无格式';
}
function noteSelectionEl(host){
 const s=getSelection(),n=s.anchorNode;
 if(!n||!host.contains(n))return host;
 return n.nodeType===3?n.parentElement:n;
}
function noteExec(host,cmd,value){
 host.focus();
 try{document.execCommand('styleWithCSS',false,true);}catch{}
 document.execCommand(cmd,false,value);
 persistNoteEditor(host);refreshNoteTools(host);
}
function noteToggleColor(host,name){
 const now=NOTE_RGB_TO_COLOR[getComputedStyle(noteSelectionEl(host)).color];
 noteExec(host,'foreColor',now===name?(host.dataset.noteBaseColor||getComputedStyle(host).color):NOTE_COLORS[name]);
}
function noteToggleHighlight(host){
 let has=false;
 for(let e=noteSelectionEl(host);e&&e!==host;e=e.parentElement)if(getComputedStyle(e).backgroundColor===NOTE_HL_RGB)has=true;
 noteExec(host,'hiliteColor',has?'rgba(0, 0, 0, 0)':NOTE_HIGHLIGHT);
}
function noteClearFormat(host){
 noteExec(host,'removeFormat');
 noteExec(host,'foreColor',host.dataset.noteBaseColor||getComputedStyle(host).color);
}
function noteHasSelection(host){const s=getSelection();return !!(s&&s.rangeCount&&!s.isCollapsed&&host.contains(s.anchorNode));}
function notePickFormat(host){
 const s=getSelection();
 if(!s.anchorNode||!host.contains(s.anchorNode)){noteHint(host,'先把光标放进一段有格式的文字里。');return false;}
 noteFormatMemory=noteStyleOf(s.anchorNode,host);
 noteHint(host,'已拾取格式：'+noteDescribe(noteFormatMemory)+'。选中别处的文字，按 '+NOTE_COMBO+'V 套用。');
 return true;
}
function noteApplyFormat(host,st){
 const base=host.dataset.noteBaseColor||getComputedStyle(host).color;
 noteExec(host,'removeFormat');
 if(st.b)noteExec(host,'bold');
 if(st.i)noteExec(host,'italic');
 if(st.u)noteExec(host,'underline');
 noteExec(host,'foreColor',st.c?NOTE_COLORS[st.c]:base);
 if(st.h)noteExec(host,'hiliteColor',NOTE_HIGHLIGHT);
}
function notePasteFormat(host){
 if(!noteFormatMemory){noteHint(host,'还没有拾取格式：先在有格式的文字里按 '+NOTE_COMBO+'C。');return false;}
 if(!noteHasSelection(host)){noteHint(host,'先选中要套用格式的文字。');return false;}
 noteApplyFormat(host,noteFormatMemory);
 noteHint(host,'已套用：'+noteDescribe(noteFormatMemory)+'（可继续选别处再按 V）。');
 return true;
}
function setNotePainter(host,on){
 notePainter=!!on;
 host?.closest?.('.note-editor')?.querySelector?.('[data-fmt="painter"]')?.setAttribute?.('aria-pressed',String(!!on));
 host?.closest?.('.note-editor')?.querySelector?.('[data-fmt="painter"]')?.classList?.toggle('is-on',!!on);
 if(on)noteHint(host,'已拾取格式。现在选中要套用的文字，松开鼠标即可（按 Esc 取消）。');
 else if(host?.closest?.('.note-editor')?.querySelector?.('.note-format-hint')?.textContent?.startsWith('已拾取格式。现在'))noteHint(host,'');
}
function refreshNoteTools(host){
 const bar=host?.closest?.('.note-editor')?.querySelector?.('.note-format-bar');if(!bar||document.activeElement!==host)return;
 const color=NOTE_RGB_TO_COLOR[getComputedStyle(noteSelectionEl(host)).color];
 const on={bold:document.queryCommandState('bold'),italic:document.queryCommandState('italic'),underline:document.queryCommandState('underline'),red:color==='red',blue:color==='blue',green:color==='green'};
 bar.querySelectorAll('[data-fmt]').forEach(b=>{if(b.dataset.fmt in on){b.classList.toggle('is-on',on[b.dataset.fmt]);b.setAttribute('aria-pressed',String(on[b.dataset.fmt]));}});
}
function runNoteFormat(host,fmt){
 if(fmt==='bold'||fmt==='italic'||fmt==='underline')noteExec(host,fmt);
 else if(NOTE_COLORS[fmt])noteToggleColor(host,fmt);
 else if(fmt==='highlight')noteToggleHighlight(host);
 else if(fmt==='clear')noteClearFormat(host);
 else if(fmt==='painter'){
  if(notePainter){setNotePainter(host,false);return;}
  if(notePickFormat(host))setNotePainter(host,true);
 }
}
function endNoteChord(host){
 noteChord=false;clearTimeout(noteChordTimer);
 const hint=host?.closest?.('.note-editor')?.querySelector?.('.note-format-hint');
 if(hint&&hint.textContent===NOTE_CHORD_HELP)noteHint(host,'');else hint?.classList?.remove('is-chord');
}
// 键盘：⌘/Ctrl+B/I/U；前缀键 ⌘/Ctrl+; 后再按 1 2 3 H X C V。返回 true 表示已处理。
function handleNoteFormatKeydown(event){
 const host=noteHostOf(event.target);if(!host)return false;
 if(event.isComposing||event.keyCode===229)return false;
 if(noteChord){
  if(['Shift','Meta','Control','Alt'].includes(event.key))return true;
  event.preventDefault();
  const clean=!event.metaKey&&!event.ctrlKey&&!event.altKey;
  const map={Digit1:'red',Digit2:'blue',Digit3:'green',Numpad1:'red',Numpad2:'blue',Numpad3:'green',KeyH:'highlight',KeyX:'clear'};
  const code=event.code;
  endNoteChord(host);
  if(!clean||event.key==='Escape')return true;
  if(map[code])runNoteFormat(host,map[code]);
  else if(code==='KeyC')notePickFormat(host);
  else if(code==='KeyV')notePasteFormat(host);
  return true;
 }
 // 同时按：Mac 用 Ctrl+⌘+字母，其他系统用 Ctrl+Alt+字母，一步完成。
 const direct=NOTE_IS_MAC?(event.ctrlKey&&event.metaKey&&!event.altKey):(event.ctrlKey&&event.altKey&&!event.metaKey);
 if(direct&&!event.shiftKey){
  const dmap={Digit1:'red',Digit2:'blue',Digit3:'green',Numpad1:'red',Numpad2:'blue',Numpad3:'green',KeyH:'highlight',KeyX:'clear'};
  if(dmap[event.code]){event.preventDefault();runNoteFormat(host,dmap[event.code]);return true;}
  if(event.code==='KeyC'){event.preventDefault();notePickFormat(host);return true;}
  if(event.code==='KeyV'){event.preventDefault();notePasteFormat(host);return true;}
 }
 const mod=NOTE_IS_MAC?event.metaKey:event.ctrlKey;
 if(mod&&!event.shiftKey&&!event.altKey&&!event.ctrlKey===NOTE_IS_MAC&&event.code==='Semicolon'){
  event.preventDefault();noteChord=true;clearTimeout(noteChordTimer);
  noteChordTimer=setTimeout(()=>endNoteChord(host),3500);
  noteHint(host,NOTE_CHORD_HELP,true);return true;
 }
 const k=String(event.key||'').toLowerCase();
 if((event.metaKey||event.ctrlKey)&&!event.shiftKey&&!event.altKey&&['b','i','u'].includes(k)){
  event.preventDefault();runNoteFormat(host,{b:'bold',i:'italic',u:'underline'}[k]);return true;
 }
 if(event.key==='Escape'&&notePainter){event.preventDefault();setNotePainter(host,false);return true;}
 return false;
}
function noteFormatBarMarkup(){
 const b=(fmt,label,inner,title,extra='')=>`<button type="button" class="note-tool ${extra}" data-action="notes-fmt" data-fmt="${fmt}" aria-label="${label}" title="${title}" aria-pressed="false">${inner}</button>`;
 const swatch=(fmt,name,hex)=>b(fmt,name+'色文字',`<i style="background:${hex}"></i>`,`${name}色文字　${NOTE_COMBO}${{red:'1',blue:'2',green:'3'}[fmt]}`,'note-swatch');
 const mod=NOTE_IS_MAC?'⌘':'Ctrl';
 return `<div class="note-format-bar" role="toolbar" aria-label="笔记格式">${b('bold','加粗','<b>B</b>',`加粗　${mod}+B`)}${b('italic','斜体','<i>I</i>',`斜体　${mod}+I`)}${b('underline','下划线','<u>U</u>',`下划线　${mod}+U`)}<span class="note-tool-sep" aria-hidden="true"></span>${swatch('red','红','#c0392b')}${swatch('blue','蓝','#1f6fb9')}${swatch('green','绿','#2a8a57')}${b('highlight','黄色高亮','<span class="note-hl-sample">高亮</span>',`黄色高亮　${NOTE_COMBO}H`)}<span class="note-tool-sep" aria-hidden="true"></span>${b('painter','格式刷','格式刷',`格式刷：先把光标放在有格式的文字里，点它，再选中要套用的文字。快捷键：${NOTE_COMBO}C 拾取，${NOTE_COMBO}V 套用`)}${b('clear','清除格式','清除',`清除所选文字的格式　${NOTE_COMBO}X`)}</div><p class="note-format-hint small" role="status"></p>`;
}
function noteContext(){
 const c=currentContext();
 if(c)return c;
 if(view==='study'&&state.learn?.stage==='intro'){
  const l=state.learn;
  if(l.returnStage==='review'&&state.review)return {q:reviewQuestion(),qs:state.review.q,context:'review'};
  if(l.returnStage==='exercise')return {q:(l.pinnedLearning||lesson.learning)[l.index],qs:l.q,context:'learn'};
  return {q:l.pinnedEntry||lesson.entry,qs:l.entryAttempt||l.q,context:'entry'};
 }
 return null;
}
function questionNoteId(q){
 return 'q-'+encodeURIComponent(JSON.stringify([q.type||'input',q.zh,q.target||q.zh,q.scene||'',q.dialogue||'',q.intent||'',q.stem||'']));
}
function legacyNoteMarkup(){
 const text=state.note?.text;
 if(!text?.trim())return '';
 return `<details class="legacy-note-archive"><summary>旧版笔记（来源未记录）</summary><p class="small">旧版没有记录所属题目，原文保留在这里。可复制到对应题目的笔记中。</p><p class="note-copy is-full">${esc(text)}</p></details>`;
}
function noteOwner(kind,id='',create=false){
 if(kind==='question'){
  if(state.questionNotes?.[id])return state.questionNotes[id];
  const q=noteContext()?.q;
  if(!create||!q||questionNoteId(q)!==id)return null;
  state.questionNotes=state.questionNotes||{};
  return state.questionNotes[id]={question:JSON.parse(JSON.stringify(q))};
 }
 if(kind==='unit')return state;
 if(kind==='draft')return state.draft;
 if(kind==='custom')return state.custom.find(c=>c.id===id)||null;
 return null;
}
function noteValue(kind,id=''){return noteOwner(kind,id)?.note?.text||'';}
function noteHeading(kind,id=''){
 if(kind==='question')return '笔记';
 if(kind==='unit')return '旧版笔记';
 const item=kind==='custom'?state.custom.find(c=>c.id===id):null;
 return (item?.kind==='scenario'||scenarioUnit())?'场景笔记':'例句笔记';
}
function saveNoteText(kind,id,text,runs=null){
 const owner=noteOwner(kind,id,true);if(!owner||typeof text!=='string'||text.length>noteLimit)return false;
 const note={text,updatedAt:Math.max(Date.now(),Number(owner.note?.updatedAt||0)+1)};
 const clean=runs?cleanNoteRuns(runs):null;
 if(clean&&validNoteRuns(clean,text))note.runs=clean;
 owner.note=note;
 const ok=save();return !!ok&&noteValue(kind,id)===text;
}
// 把富文本编辑区的当前内容存入对应笔记，并更新“已自动保存”状态。
function persistNoteEditor(host){
 if(!host?.dataset||host.dataset.noteLesson!==lesson.id)return true;
 const runs=readNoteEditor(host),text=runs.map(r=>r.t).join('');
 const ok=saveNoteText(host.dataset.noteKind,host.dataset.noteId||'',text,runs);
 const status=host.closest?.('.note-editor')?.querySelector?.('.note-save-status');
 if(status){const message=ok?'已自动保存':'暂未保存，请勿关闭页面';if(status.textContent!==message)status.textContent=message;status.classList.toggle('save-failed',!ok);}
 return ok;
}
function noteIcon(){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4H6v16h12v-8M10 14l1-4 7-7 3 3-7 7-4 1ZM9 17h6"/></svg>';}
function noteAttrs(kind,id,surface){return `data-note-kind="${esc(kind)}" data-note-id="${esc(id)}" data-note-surface="${esc(surface)}" data-note-lesson="${esc(lesson.id)}"`;}
function noteEditorMarkup(kind,id,surface){
 const field='note-'+surface+'-'+kind+'-'+(id||'current');
 return `<div class="note-editor"><label class="note-title" id="${esc(field)}-label" for="${esc(field)}">${noteIcon()}${noteHeading(kind,id)}</label>${noteFormatBarMarkup()}<div id="${esc(field)}" class="note-input note-rich" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${esc(field)}-label" data-note-editor="true" data-note-rich="1" ${noteAttrs(kind,id,surface)} data-placeholder="写下容易忘记、下次想提醒自己的要点。" spellcheck="false">${noteCopyHTML(kind,id)}</div><div class="note-editor-footer"><span class="note-save-status" role="status">输入后自动保存</span>${button('收起笔记','notes-done','text-button',noteAttrs(kind,id,surface))}</div></div>`;
}
function notePanel(kind,id='',surface='question',qs=null,after=true){
 const text=noteValue(kind,id),key=noteKey(kind,id),attrs=noteAttrs(kind,id,surface);
 const editing=surface==='question'?qs?.noteEditing===key:openPersonalNoteEditors.has(lesson.id+':'+surface+':'+key);
 if(editing)return `<section class="personal-note is-editing" ${attrs}>${noteEditorMarkup(kind,id,surface)}</section>`;
 if(!after&&!text.trim())return '';
 if(!text.trim())return `<section class="personal-note is-empty" ${attrs}>${button('添加笔记','notes-edit','note-add',attrs+` aria-label="添加笔记：${noteHeading(kind,id)}"`)}</section>`;
 const opened=after||!!qs?.notesOpen?.[key],full=!!qs?.notesFull?.[key];
 const long=text.length>60||text.split('\n').length>3;
 return `<section class="personal-note ${after?'':'is-reminder'}" ${attrs}><div class="note-header">${after?`<span class="note-title">${noteIcon()}${noteHeading(kind,id)}</span>${button('编辑笔记','notes-edit','text-button',attrs)}`:button(`${noteIcon()}${noteHeading(kind,id)}<span class="note-toggle-label">${opened?'收起':'展开'}</span>`,'notes-toggle','note-reminder-toggle',attrs+` aria-expanded="${opened}"`)}</div>${opened?`<p class="note-copy ${full?'is-full':''}">${noteCopyHTML(kind,id)}</p>${long?button(full?'收起全文':'展开全文','notes-more','text-button',attrs+` aria-expanded="${full}"`):''}`:''}</section>`;
}
function questionNotesMarkup(q,qs,context,after=true){
 if(!after&&context!=='review')return '';
 const item=q.id?.startsWith('c-')&&state.custom.find(c=>c.id===q.id);
 return `<div class="question-notes">${item?notePanel('custom',item.id,'question',qs,after):notePanel('question',questionNoteId(q),'question',qs,after)}</div>`;
}
function introQuestionNotesMarkup(){const c=noteContext();return c?.q?questionNotesMarkup(c.q,c.qs,c.context,c.context!=='review'||!!c.qs.revealed):'';}
function personalDraftNotes(){return notePanel('draft','','draft');}
function personalItemNotes(c){return notePanel('custom',c.id,'list');}
function personalEditNotes(id){return notePanel(id?'custom':'draft',id||'','dialog');}
function copiedDraftNote(){return state.draft.note?{note:JSON.parse(JSON.stringify(state.draft.note))}:{};}
function handleNotesAction(action,el){
 if(!action.startsWith('notes-'))return false;
 if(action==='notes-fmt'){const host=noteEditorHost(el);if(host)runNoteFormat(host,el.dataset.fmt);return true;}
 const {noteKind:kind,noteId:id='',noteSurface:surface,noteLesson:unit}=el.dataset;
 if(unit!==lesson.id||!noteOwner(kind,id,true))return true;
 const ctx=noteContext(),qs=ctx?.qs,key=noteKey(kind,id),editorKey=lesson.id+':'+surface+':'+key;
 if(action==='notes-toggle'){
  if(!qs)return true;qs.notesOpen=qs.notesOpen||{};qs.notesOpen[key]=!qs.notesOpen[key];
  if(qs.notesOpen[key]&&ctx.context==='review'&&!qs.revealed)qs.noteBeforeSeen=true;
  save();render();return true;
 }
 if(action==='notes-more'){
  if(surface==='question'&&qs){qs.notesFull=qs.notesFull||{};qs.notesFull[key]=!qs.notesFull[key];save();render();}
  else {const panel=el.closest('.personal-note'),copy=panel?.querySelector('.note-copy');if(copy){copy.classList.toggle('is-full');el.textContent=copy.classList.contains('is-full')?'收起全文':'展开全文';}}
  return true;
 }
 if(action==='notes-edit'){
  if(surface==='question'){if(!qs)return true;qs.noteEditing=key;save();render();}
  else {openPersonalNoteEditors.add(editorKey);const panel=el.closest('.personal-note');if(panel)panel.innerHTML=noteEditorMarkup(kind,id,surface);}
  const root=surface==='dialog'?dialog:app;const field=[...(root.querySelectorAll?.('.note-input')||[])].find(f=>f.dataset.noteKind===kind&&f.dataset.noteId===id&&f.dataset.noteSurface===surface);field?.focus();
  if(field?.dataset?.noteRich&&typeof getSelection==='function'){try{const r=document.createRange();r.selectNodeContents(field);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);const cs=getComputedStyle(field);field.dataset.noteBaseColor=cs.color;}catch{}}
  return true;
 }
 if(action==='notes-done'){
  if(surface==='question'){if(qs){delete qs.noteEditing;save();render();window.keyboardDefaultButton?.()?.focus();}}
  else {openPersonalNoteEditors.delete(editorKey);const panel=el.closest('.personal-note');if(panel)panel.outerHTML=notePanel(kind,id,surface);}
  return true;
 }
 return true;
}
function handleNoteInput(event){
 const el=event.target;if(!el.dataset?.noteEditor)return false;if(el.dataset.noteLesson!==lesson.id)return true;
 if(el.dataset.noteRich){persistNoteEditor(el);refreshNoteTools(el);return true;}
 const ok=saveNoteText(el.dataset.noteKind,el.dataset.noteId||'',el.value);
 const status=el.closest('.note-editor')?.querySelector('.note-save-status');
 if(status){const message=ok?'已自动保存':'暂未保存，请勿关闭页面';if(status.textContent!==message)status.textContent=message;status.classList.toggle('save-failed',!ok);}
 return true;
}
function handleNoteKeydown(event){
 const el=event.target;if(!el?.dataset?.noteEditor||event.key!=='Enter'||event.isComposing||event.keyCode===229||event.repeat)return false;
 if((event.metaKey||event.ctrlKey)&&!event.shiftKey&&!event.altKey){event.preventDefault();el.closest('.personal-note')?.querySelector('[data-action="notes-done"]')?.click();return true;}
 return false;
}
// Move the same live node, not a duplicate editor: wide screens use spare task-pane space.
function layoutQuestionNotes(){
 const root=document.getElementById('app');if(!root?.querySelector)return;
 const sheet=root.querySelector('.question-sheet'),answer=sheet?.querySelector('.answer-box');if(!answer)return;
 const notes=sheet.querySelector('.question-notes');if(!notes)return;
 const wide=!!window.matchMedia?.(sheet.classList.contains('scenario-sheet')?'(min-width:1120px) and (min-height:740px)':'(min-width:1120px)').matches;
 const pane=sheet.querySelector('.question-workspace')||sheet.querySelector('.scenario-task-pane');
 const parent=wide?pane:answer;if(!parent||notes.parentElement===parent)return;
 const active=document.activeElement,focused=notes.contains(active),selection=focused&&active.tagName==='TEXTAREA'?[active.selectionStart,active.selectionEnd]:null;
 if(wide)parent.appendChild(notes);
 else parent.insertBefore(notes,answer.querySelector('.response-panel,.actions,.answer-followups'));
 if(focused){
  active.focus({preventScroll:true});if(selection)active.setSelectionRange(...selection);
  else if(active.dataset?.noteRich){try{const r=document.createRange();r.selectNodeContents(active);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);}catch{}}
 }
}
window.addEventListener('resize',layoutQuestionNotes);
if(typeof document!=='undefined'&&document.addEventListener){
 // 点工具条按钮时保持文字选区不丢。
 document.addEventListener('mousedown',event=>{if(event.target?.closest?.('.note-format-bar button'))event.preventDefault();});
 // 格式刷：拾取后在编辑区选中文字并松开即套用，只用一次。
 document.addEventListener('pointerup',()=>{
  if(!notePainter)return;
  const host=document.activeElement?.dataset?.noteRich?document.activeElement:null;if(!host||!noteHasSelection(host))return;
  noteApplyFormat(host,noteFormatMemory||{});setNotePainter(host,false);noteHint(host,'已套用格式。');
 });
 // 粘贴只保留纯文字，并受字数上限限制。
 document.addEventListener('paste',event=>{
  const host=noteHostOf(event.target);if(!host)return;
  event.preventDefault();
  const room=Math.max(0,noteLimit-readNoteEditor(host).map(r=>r.t).join('').length);
  const text=String((event.clipboardData||window.clipboardData)?.getData('text/plain')||'').slice(0,room);
  if(text)document.execCommand('insertText',false,text);
 });
}
