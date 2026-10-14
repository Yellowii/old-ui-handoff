import {fragmentSuitSelection} from '../source-fragment-assembly.js';

const reasons={
  'fragment-business-row-missing':'缺少此版本的服饰规则',
  'fragment-submodel-animation-not-integrated':'附属模型动作待接入',
  'fragment-spring-not-integrated':'服饰动态待接入',
  'fragment-addpose-not-integrated':'服饰姿态待接入',
  'fragment-model-partial':'必需贴图或模型待补齐',
};

export function openFragmentWardrobe({wardrobe,openDetails,operation,slot='suit',saveLook,restoreLook,openResourceInfo}) {
  const config=wardrobe.fragmentConfig();
  if(!config)return;
  openDetails(`${wardrobe.actor.item.name} · 衣橱`,'<div id="fragment-wardrobe"></div>');
  const host=document.querySelector('#fragment-wardrobe');
  const text=document.createElement('p');text.textContent='选择共享服饰，或恢复此角色自己的默认穿搭。';host.append(text);
  const suitLabel=document.createElement('label');suitLabel.textContent='套装 ';const suits=document.createElement('select');suits.id='fragment-suit';suitLabel.append(suits);host.append(suitLabel);
  const choose=document.createElement('option');choose.value='';choose.textContent='选择套装';suits.append(choose);
  for(const [id,suit] of Object.entries(config.fragment_suit_data)){
    const option=document.createElement('option');option.value=id;option.disabled=suit.resourceStatus!=='ready';
    option.textContent=Number(id)===config.default_fragment_suit_id?'角色默认穿搭':`套装 ${id}`;
    if(option.disabled)option.textContent+=` · ${[...new Set(suit.reasons.map(r=>reasons[r]||r))].join('、')}`;
    suits.append(option);
  }
  const selection={...(wardrobe.actor.fragmentParts||{})},selectors=[];
  for(const [pos,label] of [[11,'头部'],[12,'上装'],[13,'下装']]){
    const row=document.createElement('p'),field=document.createElement('label');field.textContent=`${label} `;
    const select=document.createElement('select');select.dataset.fragmentSlot=pos;select.setAttribute('aria-label',`衣橱${label}`);
    const option=document.createElement('option');option.value='';option.textContent='角色默认';select.append(option);
    for(const [id,part] of Object.entries(config.fragment_parts_data)){
      if(part.slot_idx!==pos)continue;
      const option=document.createElement('option');option.value=id;option.disabled=part.resourceStatus!=='ready';
      option.textContent=`${label} ${id}${option.disabled?' · 待补齐':''}`;select.append(option);
    }
    select.value=selection[pos]||'';
    select.onchange=()=>{if(select.value)selection[pos]=Number(select.value);else delete selection[pos];suits.value='';};
    selectors.push(select);field.append(select);row.append(field);host.append(row);
  }
  suits.onchange=()=>{
    if(!suits.value)return;
    const next=fragmentSuitSelection(config,suits.value);
    for(const key of Object.keys(selection))delete selection[key];Object.assign(selection,next);
    for(const select of selectors)select.value=selection[select.dataset.fragmentSlot]||'';
  };
  const apply=document.createElement('button');apply.id='fragment-apply';apply.textContent='穿戴';
  const reset=document.createElement('button');reset.id='fragment-reset';reset.textContent='恢复角色默认';
  const status=document.createElement('p');status.setAttribute('role','status');
  const run=async selected=>{
    apply.disabled=reset.disabled=true;status.textContent='正在装配…';
    const ok=await operation(()=>wardrobe.changeFragments(selected));
    status.textContent=ok?'已穿戴，可关闭窗口查看':'穿戴未成功，请查看错误提示';
    apply.disabled=reset.disabled=false;
    if(ok){for(const key of Object.keys(selection))delete selection[key];Object.assign(selection,selected);for(const select of selectors)select.value=selection[select.dataset.fragmentSlot]||'';}
  };
  apply.onclick=()=>run({...selection});reset.onclick=()=>{suits.value=String(config.default_fragment_suit_id);void run({});};
  host.append(apply,reset,status);
  // The four-slot panel hides the ordinary action rail. Reuse its existing
  // actions here so saved outfits and model versions remain reachable.
  for(const [id,label,action] of [['fragment-save','保存搭配',saveLook],['fragment-restore','恢复已存搭配',restoreLook],['fragment-info','资源信息',openResourceInfo]]){
    if(!action)continue;const button=document.createElement('button');button.id=id;button.textContent=label;
    button.onclick=async()=>{document.querySelector('#ui-details').close();await action();};host.append(button);
  }
  const pos={hair:11,upper:12,lower:13}[slot];
  (pos?selectors.find(select=>Number(select.dataset.fragmentSlot)===pos):suits).focus();
}
