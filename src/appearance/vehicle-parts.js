import {requestJSON} from '../handoff/services.js';
import {resolveVehicleParts} from '../source-vehicle-parts.js';
const labels={1:'鬃毛',2:'胸饰',3:'蹄部',4:'身体纹样',5:'翅膀'};
export class VehiclePartsPanel{
 constructor(onApply,message){
  this.onApply=onApply;this.message=message;this.selections=new Map();
  this.element=document.createElement('section');this.element.className='ui-vehicle-parts';this.element.hidden=true;this.element.setAttribute('aria-label','载具部件');document.querySelector('.canvas-area').append(this.element);
 }
 hide(){this.element.hidden=true;this.resource=null;}
 async show(resource,variant){
  if(!this.catalog)this.catalog=await requestJSON('/data/vehicle-parts.json').then(r=>{if(!r.ok)throw Error('载具部件目录未发布');return r.json();});
  const config=this.catalog.variants[variant.id];if(!config)throw Error('载具分部配置未发布');
  this.resource=resource;this.variant=variant;this.config=config;
  this.selection={...config.defaults,...this.selections.get(resource.id)};this.render();
  try{return resolveVehicleParts(config,this.selection);}catch(e){this.status.textContent=e.message+'；请选择可用部件';return null;}
 }
 render(){
  const box=this.element;box.replaceChildren();box.hidden=false;
  const title=document.createElement('strong');title.textContent='载具分部装配';box.append(title);
  for(const slot of this.config.slots){
   const label=document.createElement('label');label.textContent=labels[slot]||`部位 ${slot}`;
   const select=document.createElement('select');select.dataset.vehicleSlot=slot;select.setAttribute('aria-label',label.textContent);
   if(!(slot in this.config.defaults)){const none=new Option('不装配','');select.add(none);}
   for(const part of Object.values(this.config.parts).filter(p=>p.slot===slot)){
    const option=new Option(part.name+(part.ready?'':`（${part.previewReady?'部分预览：':''}${part.reasons.join('、')}）`),String(part.id));option.disabled=!part.ready&&!part.previewReady;select.add(option);
   }
   select.value=String(this.selection[slot]??'');select.onchange=()=>{this.selection[slot]=select.value;this.selections.set(this.resource.id,{...this.selection});this.status.textContent='已选择部件，点击预览应用';};
   label.append(select);box.append(label);
  }
  this.status=document.createElement('p');this.status.setAttribute('role','status');this.status.textContent='选择部件后预览当前装配';box.append(this.status);
  const apply=document.createElement('button');apply.type='button';apply.textContent='预览当前装配';apply.disabled=!this.config.dynamicsReady;
  if(apply.disabled)this.status.textContent='此版本的碰撞动态尚未接入';
  apply.onclick=async()=>{
   try{
    resolveVehicleParts(this.config,this.selection);
    const resource=this.resource,variant=this.variant;box.querySelectorAll('select,button').forEach(n=>n.disabled=true);
    await this.onApply(resource,variant);
   }catch(e){this.render();this.status.textContent=e.message;this.message(e.message,true);}
  };box.append(apply);
 }
}
