import {getHandoffServices} from './handoff/services.js';

const policy=()=>getHandoffServices().runtimePolicy||{};
function fullPath(path,catalogPath){
  const parts=(path.startsWith('char/')?path:catalogPath.slice(0,catalogPath.lastIndexOf('/')+1)+path).replaceAll('\\','/').toLowerCase().split('/');
  const result=[];for(const part of parts){if(part==='..')result.pop();else if(part&&part!=='.')result.push(part);}return result.join('/');
}

export function applyAnimationResourceMap(catalog,resourceMap){
  if(!resourceMap)return catalog.items;
  if(resourceMap.status!=='parsed')throw new Error(resourceMap.status==='missing'?'角色动作替换配置未定位':'角色动作替换配置存在尚未处理的冲突');
  const mapping=resourceMap.maps.AnimClipMap||{};
  const entries=new Map(catalog.items.map(row=>[fullPath(row.path,catalog.path),row]));
  return catalog.items.map(row=>{
    const from=fullPath(row.path,catalog.path),to=mapping[from];if(!to)return row;
    const target=entries.get(to),resourceMapping={from,to,targetName:target?.name};
    if(!target)return {...row,url:null,status:'missing-mapped-motion',resourceMapping};
    return {...target,name:row.name,sourceItems:row.sourceItems,resourceMapping};
  });
}

// The shared graph's base idle is idle_default; its shop idle state uses
// idle1_shop (r_idle1_shop can supply an explicit configured clip).
export function selectModelIdle(catalogPath,rows,showConfig={}){
  const shared=Boolean(policy().sharedMotionCatalogPath&&catalogPath===policy().sharedMotionCatalogPath);
  const name=shared?(showConfig.has_idle===1?(showConfig.idle_ani||'idle1_shop'):'idle_default'):'idle_show';
  return rows.find(row=>row.name===name&&row.status==='ready'&&row.url);
}

// The shared shop graph uses appear_shop as its entrance state. Only play a
// source-mapped clip: the common 1-frame placeholder is not a character entrance.
export function selectModelEntrance(catalogPath,rows){
  if(!policy().sharedMotionCatalogPath||catalogPath!==policy().sharedMotionCatalogPath)return undefined;
  return rows.find(row=>row.name==='appear_shop'&&row.resourceMapping?.targetName&&row.status==='ready'&&row.url);
}
