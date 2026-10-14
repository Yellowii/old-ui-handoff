export function resolveVehicleParts(config,selected={}){
 if(!config?.dynamicsReady)throw Error('此载具的碰撞动态尚未接入');
 const selection={...config.defaults,...selected},additions=[],materials={},parts=[];
 for(const slot of config.slots){
  const id=selection[slot];if(id==null||id===''){if(slot in config.defaults)throw Error('原装配要求此槽位保留部件');continue;}
  const part=config.parts[id];
  if(!part||part.slot!==slot)throw Error('部件与原槽位不匹配');
  if(!part.ready&&!part.previewReady)throw Error(part.reasons.join('、'));
  parts.push(Number(id));if(part.modelId)additions.push(part.modelId);
  for(const [index,override]of Object.entries(part.materials)){
   const target=materials[index]??={sourceMaterialOverride:{parameters:{},textures:{}}};
   for(const field of ['parameters','textures'])for(const [key,value]of Object.entries(override[field])){
    if(key in target.sourceMaterialOverride[field])throw Error('部件材质覆盖冲突');
    target.sourceMaterialOverride[field][key]=value;
   }
  }
 }
 const specialEffects=parts.map(id=>config.parts[id]).filter(p=>p.effects).flatMap(p=>p.effects).filter(e=>['model-sprite-sphere-partial','authored-hoof-preview-ready'].includes(e.runtimeStatus));
 return {base:config.base,additions,overrides:{[config.base]:{materials}},parts,selected:selection,vehicleVariant:config.variantId,vehicleHoofEffects:specialEffects};
}
