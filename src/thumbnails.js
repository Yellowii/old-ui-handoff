import {requestJSON} from './handoff/services.js';

import {WardrobeViewer} from './viewer.js';
import {modelTextureOverrides} from './model-textures.js';
import {resolveFashionAssembly} from './source-fashion-assembly.js';

export class ModelThumbnails{
  constructor(isBusy,viewerOptions={}){this.isBusy=isBusy;this.viewerOptions=viewerOptions;this.cache=new Map();this.failed=new Set();this.pending=new Map();this.running=false;
    this.observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const item=this.items.get(e.target.dataset.id);if(item)this.pending.set(item.id,{item,target:e.target});this.observer.unobserve(e.target);}this.pump();},{root:document.querySelector('#items'),rootMargin:'80px'});
  }
  observe(container,items){this.observer.disconnect();this.pending.clear();this.items=new Map(items.map(i=>[i.id,i]));
    for(const target of container.querySelectorAll('.item')){const item=this.items.get(target.dataset.id);if(!item?.available||item.thumbnail)continue;
      if(this.cache.has(item.id))this.apply(target,this.cache.get(item.id));else if(!this.failed.has(item.id))this.observer.observe(target);
    }
  }
  apply(target,url){if(!target.isConnected)return;const host=target.querySelector('.item-image');host.querySelector('svg')?.remove();host.querySelector('img')?.remove();const img=new Image();img.alt=target.getAttribute('aria-label');img.src=url;host.prepend(img);}
  async pump(){if(this.running)return;this.running=true;
    try{while(this.pending.size){
      if(this.isBusy()){await new Promise(r=>setTimeout(r,250));continue;}
      const [key,{item,target}]=this.pending.entries().next().value;this.pending.delete(key);if(!target.isConnected)continue;
      try{
        if(!this.viewer){const host=document.createElement('div');host.style.cssText='position:fixed;left:-1000px;top:0;width:160px;height:160px;pointer-events:none';host.setAttribute('aria-hidden','true');document.body.append(host);this.viewer=new WardrobeViewer(host,undefined,this.viewerOptions);this.viewer.renderer.setAnimationLoop(null);this.viewer.renderer.setPixelRatio(1);this.viewer.grid.visible=false;}
        const v=item.variants.find(v=>v.isDefault&&(v.runtime||v.preview))||item.variants.find(v=>v.runtime||v.preview);
        const modelRole=item.partAssemblyRoles?.length?(item.partAssemblyRoles.includes('runtime')?'runtime':'preview'):(v.runtime?'runtime':'preview');
        const modelId=v[modelRole];
        let overrides=modelTextureOverrides(item,v,modelId),poseOffsets=null;
        if(item.partAssemblyRoles?.length){
          if(!this.fashionCatalog){const r=await requestJSON('/data/fashion-parts.json');if(!r.ok)throw new Error('部件缩略图配置缺失');this.fashionCatalog=await r.json();}
          const plan=resolveFashionAssembly(this.fashionCatalog,modelRole,{[item.equipSlot]:item.itemId});overrides=plan.overrides[modelId];poseOffsets=plan.poseOffsets;
        }
        await this.viewer.show(modelId,overrides,{poseOffsets});
        const url=this.viewer.screenshot();this.cache.set(key,url);this.apply(target,url);
        if(this.cache.size>384)this.cache.delete(this.cache.keys().next().value);
        for(const p of this.viewer.textureCache.values())p.then(t=>t.dispose()).catch(()=>{});this.viewer.textureCache.clear();
      }catch{this.failed.add(key);}
      await new Promise(r=>setTimeout(r,25));
    }}finally{this.running=false;}
  }
}
