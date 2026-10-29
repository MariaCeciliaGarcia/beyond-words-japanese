'use strict';
// Metadata describes real authored practice; the same stable unit can be found along different paths.
(()=>{
 const all=[...(window.JUJIAN_CORE||[]),...(window.BW_JP_DAILY||[]),...(window.BW_JP_WORK||[])];
 const seed={
  'jp-yoyuu':{sceneTags:['plans','progress'],functionTag:'time',priority:11,effort:'steady'},
  'jp-teoku':{sceneTags:['plans','home','progress'],functionTag:'prepare',priority:10,effort:'steady'},
  'jp-sounandesune':{sceneTags:['social','exchange','coordination'],functionTag:'response',priority:3,effort:'easy'}
 };
 const sceneFixes={
  'jp-d-possibility':['plans','shopping','social'],
  'jp-d-feels-like':['wellbeing','social','exchange'],
  'jp-d-fair-point':['social','shopping','plans','exchange']
 };
 for(const unit of all){
  if(seed[unit.id])Object.assign(unit,seed[unit.id]);
  if(sceneFixes[unit.id])unit.sceneTags=sceneFixes[unit.id];
  if(['jp-d-permission','jp-w-temoyoroshii'].includes(unit.id))unit.functionTag='permission';
  if(unit.id==='jp-w-soudan')unit.functionTag='request';
  if(unit.id==='jp-w-joukyoukyouyuu')unit.functionTag='inform';
 }
 const categories=[
  ['d-arrangements','daily','日程与出行','约好时间、决定计划，说明途中和出发前的安排。',[['plans','计划与时间'],['travel','出行与等候']]],
  ['d-living','daily','生活与消费','生活习惯、购物点餐，以及身边物品的使用。',[['home','居家与习惯'],['shopping','购物与点餐']]],
  ['d-people','daily','相处与照顾','表达心情、接受好意，也能关心和照顾对方。',[['social','朋友与相处'],['wellbeing','心情与身体']]],
  ['d-conversation','daily','聊天与理解','没听清可以再问，也能接住对方刚说的话。',[['repair','听清与问明白'],['exchange','接话与表达看法']]],
  ['w-team','work','协作与沟通','请求帮助、主动承担，确认彼此说的是同一件事。',[['requests','请求与协助'],['coordination','联系与确认']]],
  ['w-delivery','work','时间与推进','安排工作时间、汇报进度、协调先后与期限。',[['schedule','安排与调整'],['progress','进度与交付']]],
  ['w-discussion','work','讨论与决策','提出建议、说明理由和顾虑，共同决定怎么做。',[['meetings','会议与讨论']]],
  ['w-relations','work','问题与往来','说明问题、表达歉意，在工作往来中礼貌回应。',[['problems','问题与补救'],['courtesy','招呼与感谢']]]
 ];
 const c=window.JUJIAN_CATALOG;
 c.scenes=categories.map(([id,domain,name,description,tags])=>({id,domain,name,description,children:tags.map(([tag,name])=>({id:domain+'-'+tag,name,units:all.filter(u=>(u.domains||[u.domain]).includes(domain)&&u.sceneTags?.includes(tag)).map(u=>u.id)})).filter(x=>x.units.length)})).filter(g=>g.children.length);
 const functions=[
  ['requests','请求与安排','请人帮忙、做决定，也为之后先做好准备。',[['permission','征求许可'],['request','请求与协助'],['plan','打算与安排'],['prepare','提前准备']]],
  ['situations','说明情况','说明时间、状态，以及事情发生的原因。',[['time','时间与期限'],['state','状态与变化'],['inform','说明与传达'],['cause','原因与结果']]],
  ['thoughts','表达想法','说出心情、看法、比较与条件。',[['feeling','感受与态度'],['opinion','看法与建议'],['compare','比较与选择'],['condition','条件与取舍']]],
  ['conversation','理解与回应','确认听懂，也作出符合心意的回应。',[['clarify','理解与确认'],['response','接话与回应']]]
 ];
 c.functions=functions.map(([id,name,description,tags])=>({id,name,description,children:tags.map(([tag,name])=>({id:'fn-'+tag,name,units:all.filter(u=>u.functionTag===tag).map(u=>u.id)})).filter(x=>x.units.length)})).filter(g=>g.children.length);
 const effort={easy:0,steady:7,stretch:15};
 c.learningOrder=[...all].sort((a,b)=>(Number(a.priority||30)+(effort[a.effort]||0))-(Number(b.priority||30)+(effort[b.effort]||0))||a.id.localeCompare(b.id)).map(u=>u.id);
 window.BW_JP_CATALOG_AUDIT=()=>{
  const errors=[];
  for(const u of all){
   for(const scope of u.domains||[u.domain])if(['daily','work'].includes(scope)&&!c.scenes.some(g=>g.domain===scope&&g.children.some(s=>s.units.includes(u.id))))errors.push(u.id+': missing scene in '+scope);
   if(c.functions.flatMap(g=>g.children).filter(s=>s.units.includes(u.id)).length!==1)errors.push(u.id+': primary function missing/duplicated');
   if(!Number.isFinite(u.priority)||!['easy','steady','stretch'].includes(u.effort))errors.push(u.id+': ordering metadata');
  }
  return errors;
 };
})();
