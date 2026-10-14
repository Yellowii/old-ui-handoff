// A session identity for the source conventional-parts defaults. This is not
// a fabricated fashion_suit record and does not change catalog counts.
export function defaultActorEntry(fashion,role='preview'){
 const upper=fashion.parts[String(fashion.defaults.upper)];
 if(!upper?.roles.preview||!upper?.roles.runtime)throw new Error('基础蛋角色尚未完整发布');
 const variant={id:0,name:'默认',isDefault:true,preview:upper.roles.preview.modelId,runtime:upper.roles.runtime.modelId,showConfig:{}};
 const item={id:'default:fashion-parts',itemId:0,name:'初始蛋',businessCategoryId:'skin',equipSlot:'skin',available:true,variants:[variant]};
 return {item,variant,role,fashionParts:{}};
}
