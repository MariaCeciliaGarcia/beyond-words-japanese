'use strict';
// A unit note travels with the expression; a personal note travels only with its example/scene.
const openPersonalNoteEditors=new Set();
const noteLimit=10000;
function noteKey(kind,id=''){return kind+':'+id;}
function noteContext(){
 const c=currentContext();
 if(c)return c;
 if(view==='study'&&state.learn?.stage==='intro')return {q:state.learn.pinnedEntry||lesson.entry,qs:state.learn.entryAttempt||state.learn.q,context:'entry'};
 return null;
}
function noteOwner(kind,id=''){
 if(kind==='unit')return state;
 if(kind==='draft')return state.draft;
 if(kind==='custom')return state.custom.find(c=>c.id===id)||null;
 return null;
}
function noteValue(kind,id=''){return noteOwner(kind,id)?.note?.text||'';}
function noteHeading(kind,id=''){
 if(kind==='unit')return noteContext()?.q?.id?.startsWith('c-')?'语块笔记':'我的笔记';
 const item=kind==='custom'?state.custom.find(c=>c.id===id):null;
 return (item?.kind==='scenario'||scenarioUnit())?'这个场景的笔记':'这条例句的笔记';
}
function saveNoteText(kind,id,text){
 const owner=noteOwner(kind,id);if(!owner||typeof text!=='string'||text.length>noteLimit)return false;
 owner.note={text,updatedAt:Math.max(Date.now(),Number(owner.note?.updatedAt||0)+1)};
 const ok=save();return !!ok&&noteValue(kind,id)===text;
}
function noteIcon(){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4H6v16h12v-8M10 14l1-4 7-7 3 3-7 7-4 1ZM9 17h6"/></svg>';}
function noteAttrs(kind,id,surface){return `data-note-kind="${esc(kind)}" data-note-id="${esc(id)}" data-note-surface="${esc(surface)}" data-note-lesson="${esc(lesson.id)}"`;}
function noteEditorMarkup(kind,id,surface){
 const field='note-'+surface+'-'+kind+'-'+(id||'current');
 return `<div class="note-editor"><label class="note-title" for="${esc(field)}">${noteIcon()}${noteHeading(kind,id)}</label><textarea id="${esc(field)}" class="note-input" data-note-editor="true" ${noteAttrs(kind,id,surface)} maxlength="${noteLimit}" rows="4" placeholder="写下容易忘记、下次想提醒自己的要点。">${esc(noteValue(kind,id))}</textarea><div class="note-editor-footer"><span class="note-save-status" role="status">输入后自动保存</span>${button('写好了','notes-done','text-button',noteAttrs(kind,id,surface))}</div></div>`;
}
function notePanel(kind,id='',surface='question',qs=null,after=true){
 const text=noteValue(kind,id),key=noteKey(kind,id),attrs=noteAttrs(kind,id,surface);
 const editing=surface==='question'?qs?.noteEditing===key:openPersonalNoteEditors.has(lesson.id+':'+surface+':'+key);
 if(editing)return `<section class="personal-note is-editing" ${attrs}>${noteEditorMarkup(kind,id,surface)}</section>`;
 if(!after&&!text.trim())return '';
 if(!text.trim())return `<section class="personal-note is-empty" ${attrs}>${button(kind==='unit'?'记个要点':noteHeading(kind,id),'notes-edit','note-add',attrs)}</section>`;
 const opened=after||!!qs?.notesOpen?.[key],full=!!qs?.notesFull?.[key];
 const long=text.length>60||text.split('\n').length>3;
 return `<section class="personal-note ${after?'':'is-reminder'}" ${attrs}><div class="note-header">${after?`<span class="note-title">${noteIcon()}${noteHeading(kind,id)}</span>${button('编辑','notes-edit','text-button',attrs)}`:button(`${noteIcon()}${noteHeading(kind,id)}<span class="note-toggle-label">${opened?'收起':'展开'}</span>`,'notes-toggle','note-reminder-toggle',attrs+` aria-expanded="${opened}"`)}</div>${opened?`<p class="note-copy ${full?'is-full':''}">${esc(text)}</p>${long?button(full?'收起全文':'展开全文','notes-more','text-button',attrs+` aria-expanded="${full}"`):''}`:''}</section>`;
}
function questionNotesMarkup(q,qs,context,after=true){
 if(!after&&context!=='review')return '';
 const item=q.id?.startsWith('c-')&&state.custom.find(c=>c.id===q.id);
 const unit=(!item||noteValue('unit').trim())?notePanel('unit','','question',qs,after):'';
 return `<div class="question-notes">${unit}${item?notePanel('custom',item.id,'question',qs,after):''}</div>`;
}
function personalDraftNotes(){return notePanel('draft','','draft');}
function personalItemNotes(c){return notePanel('custom',c.id,'list');}
function personalEditNotes(id){return notePanel(id?'custom':'draft',id||'','dialog');}
function copiedDraftNote(){return state.draft.note?{note:JSON.parse(JSON.stringify(state.draft.note))}:{};}
function handleNotesAction(action,el){
 if(!action.startsWith('notes-'))return false;
 const {noteKind:kind,noteId:id='',noteSurface:surface,noteLesson:unit}=el.dataset;
 if(unit!==lesson.id||!noteOwner(kind,id))return true;
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
  const root=surface==='dialog'?dialog:app;const field=[...(root.querySelectorAll?.('.note-input')||[])].find(f=>f.dataset.noteKind===kind&&f.dataset.noteId===id&&f.dataset.noteSurface===surface);field?.focus();return true;
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
 const ok=saveNoteText(el.dataset.noteKind,el.dataset.noteId||'',el.value);
 const status=el.closest('.note-editor')?.querySelector('.note-save-status');
 if(status){const message=ok?'已自动保存':'暂未保存，请先导出备份';if(status.textContent!==message)status.textContent=message;status.classList.toggle('save-failed',!ok);}
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
 const wide=!!window.matchMedia?.('(min-width:1120px)').matches;
 const pane=sheet.querySelector('.question-workspace')||sheet.querySelector('.scenario-task-pane');
 const parent=wide?pane:answer;if(!parent||notes.parentElement===parent)return;
 const active=document.activeElement,focused=notes.contains(active),selection=focused&&active.tagName==='TEXTAREA'?[active.selectionStart,active.selectionEnd]:null;
 if(wide)parent.appendChild(notes);
 else parent.insertBefore(notes,answer.querySelector('.response-panel,.actions,.answer-followups'));
 if(focused){active.focus({preventScroll:true});if(selection)active.setSelectionRange(...selection);}
}
window.addEventListener('resize',layoutQuestionNotes);
