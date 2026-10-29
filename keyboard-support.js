'use strict';
/* Context-aware keyboard defaults. Native focused controls keep their own action. */
(() => {
 const safeDefaults = new Set(['check','grade','choice-next','entry-intro','intro-next','reveal','next-learning','next-review','continue-learning-home','continue-review-home','finish-learn','start-review','home','origin-library','cecilia-next','daily-next','continue-date-learning','continue-date-review','daily-continue','daily-review','daily-dates','cecilia-start-day','cecilia-review-day','cecilia-date','cecilia-dates']);
 const editActions = new Set(['save-custom','save-scenario','commit-edit','commit-scenario']);
 const dangerousActions = new Set(['confirm-master','confirm-delete','confirm-restart','apply-progress-import','replace-progress','confirm-import','undo-progress-import','restart-review','confirm-restart-review']);
 let installed=false, composing=false, compositionEnded=0, deliberateDialogFocus=null, tabMoving=false, lastQuestionIdentity='';
 const visible = element => !!element&&!element.disabled&&!element.hidden&&element.getAttribute?.('aria-disabled')!=='true'&&(!element.getClientRects||element.getClientRects().length>0);
 const query = (root,selector) => root?.querySelector?.(selector)||null;
 const all = (root,selector) => root?.querySelectorAll?Array.from(root.querySelectorAll(selector)):[];
 const action = button => button?.dataset?.action||'';
 function openDialog(){const d=document.getElementById('dialog');return d?.open?d:null;}
 function editingButton(root){for(const name of editActions){const b=query(root,`[data-action="${name}"]`);if(visible(b))return b;}return null;}
 function keyboardDefaultButton(root=document.getElementById('app')){
  if(openDialog())return null;
  const explicitlyMarked=query(root,'[data-enter-default]');
  if(visible(explicitlyMarked)&&safeDefaults.has(action(explicitlyMarked)))return explicitlyMarked;
  for(const selector of ['[data-action="grade"][data-grade="good"]','[data-action="choice-next"]','[data-action="entry-intro"]','[data-action="intro-next"]','[data-action="check"]','[data-action="next-learning"]','[data-action="next-review"]','[data-action="cecilia-next"]','[data-action="daily-next"]','[data-action="continue-date-learning"]','[data-action="continue-date-review"]','[data-action="daily-continue"]','[data-action="daily-review"]']){
   const button=query(root,selector);if(visible(button))return button;
  }
  // Do not turn an unanswered choice into a correct selection, or reveal input answers.
  const reveal=query(root,'[data-action="reveal"]');
  if(visible(reveal)&&typeof currentContext==='function'){
   const c=currentContext();if(c?.q&&typeof questionType==='function'&&questionType(c.q)==='recall')return reveal;
  }
  const finish=query(root,'[data-action="finish-learn"]');
  if(visible(finish)&&!finish.classList?.contains('secondary')&&!editingButton(root))return finish;
  if(typeof view!=='undefined'&&view==='home'){
   for(const name of ['continue-learning-home','continue-review-home']){const b=query(root,`[data-action="${name}"]`);if(visible(b))return b;}
  }
  // Scope-filter chips are navigation, not a review-session continuation.
  if(typeof view!=='undefined'&&view==='review'){
   const start=query(root,'[data-action="start-review"]');if(visible(start))return start;
  }
  // At a completed session prefer a safe library/home continuation, never mastery.
  if(typeof view!=='undefined'&&['summary','mastery'].includes(view)){
   for(const name of ['start-review','daily-dates','origin-library','home']){const b=query(root,`[data-action="${name}"]`);if(visible(b))return b;}
  }
  return null;
 }
 function appendKey(button,text){
  if(!button?.appendChild||query(button,'.keyboard-shortcut'))return;
  const badge=document.createElement('kbd');badge.className='keyboard-shortcut';badge.textContent=text;badge.setAttribute?.('aria-hidden','true');button.appendChild(badge);
 }
 function focusNewQuestion(){
  if(openDialog())return;
  const context=typeof currentContext==='function'?currentContext():null;
  if(!context?.q){lastQuestionIdentity='';return;}
  if(typeof questionType!=='function'||questionType(context.q)!=='input'){
   lastQuestionIdentity='';return;
  }
  const lessonId=typeof lesson==='undefined'?'':lesson.id;
  const index=typeof state==='undefined'?'':context.context==='review'?state.review?.index:state.learn?.index;
  const identity=[lessonId,context.context,context.q.id,index].join('|');
  if(context.qs?.revealed)return;
  if(identity===lastQuestionIdentity)return;
  lastQuestionIdentity=identity;
  const field=document.getElementById('answer');
  if(field?.focus&&!field.disabled)field.focus({preventScroll:true});
 }
 function decorateKeyboardActions(){
  focusNewQuestion();
  all(document,'.keyboard-shortcut').forEach(el=>el.remove());
  all(document,'[data-keyboard-default]').forEach(el=>el.removeAttribute('data-keyboard-default'));
  const d=openDialog(),root=d||document.getElementById('app'),edit=editingButton(root);
  if(edit){appendKey(edit,'⌘ ↵');edit.setAttribute?.('aria-keyshortcuts','Meta+Enter Control+Enter');}
  if(d)return;
  const button=keyboardDefaultButton(root);
  if(button){button.setAttribute?.('data-keyboard-default','true');button.setAttribute?.('aria-keyshortcuts','Enter');appendKey(button,'↵');}
 }
 function handleKeyboardSupport(event){
  if(event.key==='Tab'){tabMoving=true;deliberateDialogFocus=null;return;}
  if(event.key!=='Enter')return;
  if(event.defaultPrevented)return;
  if(typeof handleNoteKeydown==='function'&&handleNoteKeydown(event))return;
  if(event.isComposing||event.keyCode===229||composing)return; // IME owns confirmation; do not cancel character selection.
  if(event.repeat||Date.now()-compositionEnded<180){event.preventDefault();return;}
  const target=event.target||document.activeElement,dialog=openDialog(),root=dialog||document.getElementById('app');
  if(event.altKey||event.shiftKey)return;
  const editable=target?.tagName==='TEXTAREA'||target?.tagName==='INPUT'||target?.isContentEditable;
  if(event.metaKey||event.ctrlKey){
   // The modified shortcut is scoped to personal-content editing, never import or deletion.
   const save=editingButton(root);if(save){event.preventDefault();save.click();}return;
  }
  const control=target?.closest?.('button,a,summary,input[type="checkbox"],input[type="radio"],select');
  if(dialog){
   // The first autofocus button in a confirmation dialog is not an implicit approval.
   if(control&&dangerousActions.has(action(control))&&control!==deliberateDialogFocus)event.preventDefault();
   return;
  }
  if(control)return; // Tab then Enter follows that deliberately focused control.
  if(editable&&target.id!=='answer')return; // Personal multiline inputs retain Enter/newlines.
  if(target?.id==='answer'){
   const text=String(target.value||'').trim();
   const check=query(root,'[data-action="check"]');
   if(check){event.preventDefault();if(text&&visible(check))check.click();return;}
  }
  const button=keyboardDefaultButton(root);if(button){event.preventDefault();button.click();}
 }
 function installKeyboardSupport(){
  if(installed)return;installed=true;
  document.addEventListener('compositionstart',()=>{composing=true;});
  document.addEventListener('compositionend',()=>{composing=false;compositionEnded=Date.now();});
  document.addEventListener('focusin',event=>{if(tabMoving&&openDialog()){deliberateDialogFocus=event.target;tabMoving=false;}else if(!openDialog())deliberateDialogFocus=null;});
  document.addEventListener('pointerdown',()=>{tabMoving=false;deliberateDialogFocus=null;});
  document.addEventListener('keyup',event=>{if(event.key==='Tab')tabMoving=false;});
  document.addEventListener('keydown',handleKeyboardSupport,true);
 }
 Object.assign(window,{keyboardDefaultButton,decorateKeyboardActions,installKeyboardSupport,handleKeyboardSupport});
})();
// Also expose lexical bindings for the project's VM harness (window is separate there).
var keyboardDefaultButton=window.keyboardDefaultButton;
var decorateKeyboardActions=window.decorateKeyboardActions;
var installKeyboardSupport=window.installKeyboardSupport;
var handleKeyboardSupport=window.handleKeyboardSupport;
