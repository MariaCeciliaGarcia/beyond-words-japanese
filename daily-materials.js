'use strict';
// 小枝萌菜：只收用户明确交来的每日日语材料，不用公共库填充日期。
// Date schema: {id:'YYYY-MM-DD',date:'YYYY-MM-DD',items:[
//   {id:'stable-source-id',expression:'原表达',meaning:'中文意思',sourceText:'可选原句',
//    kind:'expression'|'support',unitId:'existing-or-personal-unit-id',usageNote:'必要语气说明'}
// ]}. Same date appends to items; shared expressions reference stable unit IDs.
window.BW_JP_DAILY_MATERIALS = [];
// Authored private-date practice units are added here (or in additional files merged here).
// Every new unit belongs to domains:['moena']; public reused IDs stay in their public domains.
window.BW_JP_MOENA = [];
