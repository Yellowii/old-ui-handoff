import {WardrobeViewer} from '../viewer.js';
import {resolveFragmentAssembly,fragmentSuitSelection} from '../source-fragment-assembly.js';
import {modelTextureOverrides} from '../model-textures.js';
import {fitThumbnail} from './thumbnail-fit.js';

// UI-only thumbnail queue. All model selection and assembly use published rules.
export class FragmentThumbnails {
 constructor(isBusy){
  this.isBusy=isBusy;this.cache=new Map();this.pending=new Map();this.jobs=new WeakMap();this.failed=new Map();
  this.observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const job=this.jobs.get(entry.target);if(job)this.pending.set(job.key,job);this.observer.unobserve(entry.target);}void this.pump();});
 }
 observe(target,{catalog,entry,suitId,partId}){
  const key=[entry.item.itemId,entry.variant.id,entry.role,partId?'part':'suit',partId||suitId].join(':');
  const job={key,target,catalog,entry,suitId,partId};target.dataset.fragmentThumbnail=key;
  if(this.cache.has(key))this.apply(job,this.cache.get(key));
  else if(this.failed.has(key))this.unavailable(job,this.failed.get(key));
  else{this.jobs.set(target,job);this.observer.observe(target);}
 }
 apply(job,url){
  for(const target of document.querySelectorAll('[data-fragment-thumbnail]'))if(target.dataset.fragmentThumbnail===job.key){
   const image=target.querySelector('img');if(image){image.src=url;image.hidden=false;}target.dataset.thumbnailState='ready';
  }
 }
 unavailable(job,reason){if(job.target.isConnected){job.target.dataset.thumbnailState='unavailable';job.target.title+=` · ${reason}`;}}
 async pump(){
  if(this.running)return;this.running=true;
  try{while(this.pending.size){
   if(this.isBusy()){await new Promise(resolve=>setTimeout(resolve,200));continue;}
   const [key,job]=this.pending.entries().next().value;this.pending.delete(key);
   if(!job.target.isConnected)continue;
   try{
    const {catalog,entry,suitId,partId}=job,config=catalog.characters[entry.item.itemId].variants[entry.variant.id][entry.role];
    let id,assembly=null;
    if(partId){
     const row=config.fragment_parts_data[partId],path=row.model_path_dict?.['0']||row.model_path;
     id=catalog.models[path]?.id;
     if(!id&&row.subModels?.length===1)id=row.subModels[0].modelId;
     if(!id)throw new Error('未发布独立部件缩略图模型');
    }else{assembly=resolveFragmentAssembly(catalog,entry.item.itemId,entry.variant.id,entry.role,fragmentSuitSelection(config,suitId));id=assembly.base;}
    if(!this.viewer){
     const host=document.createElement('div');host.style.cssText='position:fixed;left:-1000px;top:0;width:160px;height:160px;pointer-events:none';host.setAttribute('aria-hidden','true');document.body.append(host);
     this.viewer=new WardrobeViewer(host,undefined,{transparentBackground:true});this.viewer.renderer.setAnimationLoop(null);this.viewer.renderer.setPixelRatio(1);this.viewer.grid.visible=false;
    }
    await this.viewer.show(id,partId?{}:modelTextureOverrides(entry.item,entry.variant,id),{assembly,defaultFace:!partId});
    const url=await fitThumbnail(this.viewer.screenshot());this.cache.set(key,url);this.apply(job,url);
    if(this.cache.size>128)this.cache.delete(this.cache.keys().next().value);
    for(const promise of this.viewer.textureCache.values())promise.then(texture=>texture.dispose()).catch(()=>{});this.viewer.textureCache.clear();
   }catch(error){this.failed.set(key,error.message);this.unavailable(job,error.message);}
   await new Promise(resolve=>setTimeout(resolve,25));
  }}finally{this.running=false;}
 }
}
