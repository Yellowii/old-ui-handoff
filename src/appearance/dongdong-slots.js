import {fragmentSuitSelection} from '../source-fragment-assembly.js';

export const hasDongdongSlots=item=>item?.businessCategoryId==='skin'&&item?.fragmentWardrobe===true;
const slots=[
  ['suit','套装',null,new URL('./assets/char.svg',import.meta.url).href],
  ['hair','头发',11,new URL('./assets/cap.svg',import.meta.url).href],
  ['upper','上装',12,new URL('./assets/shirt.svg',import.meta.url).href],
  ['lower','下装',13,new URL('./assets/pants.svg',import.meta.url).href],
];
const reasons={
 'fragment-business-row-missing':'缺少此版本服饰规则','fragment-submodel-animation-not-integrated':'附属模型动作待接入',
 'fragment-spring-not-integrated':'服饰动态待接入','fragment-addpose-not-integrated':'服饰姿态待接入','fragment-model-partial':'必需模型或贴图待补齐',
};
const same=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([key,id])=>Number(b[key])===Number(id));
export function renderDongdongSlots(grid,{config,selection={},effectiveParts=[],expanded=false,onSelect,onThumbnail,busy=false}={}){
 grid.replaceChildren();
 const suits=Object.entries(config?.fragment_suit_data||{}).sort(([a,aa],[b,bb])=>
  Number(Number(b)===config.default_fragment_suit_id)-Number(Number(a)===config.default_fragment_suit_id)
  ||Number(bb.resourceStatus==='ready')-Number(aa.resourceStatus==='ready')||Number(a)-Number(b));
 const visible=expanded?suits:suits.slice(0,2);
 if(!visible.length){const note=document.createElement('span');note.className='ui-dongdong-status';note.textContent='服饰目录待接入';grid.append(note);return;}
 for(const [index,[id,suit]]of visible.entries()){
  if(expanded&&index>0&&index%3===0){const separator=document.createElement('div');separator.className='ui-dongdong-separator';separator.setAttribute('role','separator');grid.append(separator);}
  const group=document.createElement('div');group.className='ui-dongdong-group';group.dataset.suitId=id;group.setAttribute('role','group');
  const isDefault=Number(id)===config.default_fragment_suit_id,label=isDefault?'角色默认穿搭':`套装 ${id}`;
  group.setAttribute('aria-label',label);
  for(const [key,name,pos,source]of slots){
   const partId=pos?suit.part_ids.find(partId=>config.fragment_parts_data[String(partId)]?.slot_idx===pos):null;
   const row=pos?config.fragment_parts_data[String(partId)]:suit;
   const ready=row?.resourceStatus==='ready';
   const selected=pos?Boolean(partId&&effectiveParts.map(String).includes(String(partId))):ready&&same(selection,fragmentSuitSelection(config,id));
   const button=document.createElement('button');button.type='button';button.className='dye-swatch ui-dongdong-slot';button.dataset.slot=key;
   if(partId)button.dataset.partId=String(partId);
   button.disabled=busy||!ready;button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));
   const missing=(row?.reasons||[]).map(reason=>reasons[reason]||reason).join('、')||'此套装未配置该部位';
   button.title=`${label} · ${name}${partId?` ${partId}`:''}${ready?(selected?' · 已穿戴，点击恢复默认':' · 点击穿戴'):` · ${missing}`}`;
   button.setAttribute('aria-label',button.title);
   const icon=new Image();icon.src=source;icon.alt='';button.append(icon);
   if(ready)onThumbnail?.(button,{suitId:id,partId});
   if(!ready){const badge=document.createElement('span');badge.className='ui-dongdong-blocked';badge.textContent='!';button.append(badge);}
   button.onclick=()=>{
    let next;
    if(key==='suit')next=selected?{}:fragmentSuitSelection(config,id);
    else {next={...selection};const position=row.modelPos;if(selected||isDefault)delete next[position];else next[position]=Number(partId);}
    void onSelect?.(next);
   };
   group.append(button);
  }
  grid.append(group);
 }
}
