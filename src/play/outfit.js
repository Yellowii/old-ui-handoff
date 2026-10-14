import {resolveModel,wearBlock} from '../appearance/wardrobe.js';
import {exactModelForRole} from '../appearance/model-role.js';

const key='neox23.play.outfit';
export function writePlayOutfit(wardrobe){
  if(!wardrobe.actor)throw new Error('请先选择角色');
  const entries=[wardrobe.actor,...wardrobe.outfit.values()].map(({item,variant,fragmentParts,fashionParts})=>({id:item.id,variantId:variant.id,...(fragmentParts?{fragmentParts}:{}),...(fashionParts?{fashionParts}:{})}));
  sessionStorage.setItem(key,JSON.stringify({version:1,entries}));
}
export function readPlayOutfit(){
  const raw=sessionStorage.getItem(key);if(!raw)return null;
  const value=JSON.parse(raw);
  if(value.version!==1||!Array.isArray(value.entries)||!value.entries.length||value.entries.length>10)throw new Error('当前穿搭记录格式错误，请返回衣橱重新进入');
  return value;
}
export function resolvePlayOutfit(items,snapshot,role='runtime',defaultEntry=null){
  if(!snapshot){
    if(!defaultEntry)throw new Error('默认角色尚未发布');
    return [{...defaultEntry,role}];
  }
  const entries=snapshot.entries.map(saved=>{
    const item=saved.id===defaultEntry?.item.id?defaultEntry.item:items.find(item=>item.id===saved.id),variant=item?.variants.find(v=>v.id===saved.variantId);
    const model = item?.businessCategoryId === 'skin' ? exactModelForRole(variant, role) : resolveModel(variant, role);
    if(!item||!variant||!model)throw new Error(`穿搭资源不可用：${saved.id} / ${saved.variantId}`);
    const blocked=wearBlock(item);if(blocked)throw new Error(`${item.name}：${blocked}`);
    return {item,variant,role,fragmentParts:saved.fragmentParts,fashionParts:saved.fashionParts};
  });
  if(entries[0].item.businessCategoryId!=='skin'||entries.slice(1).some(e=>e.item.businessCategoryId==='skin'))throw new Error('穿搭角色配置无效');
  return entries;
}
