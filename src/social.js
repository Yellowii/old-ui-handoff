import {requestJSON,getHandoffServices} from './handoff/services.js';

import {resolveMotionEntries,resolveSequenceEntries} from './source-motion-sequence.js';
import {motionExtrasReady} from './source-motion-extras.js';
import {applyAnimationResourceMap,selectModelIdle} from './animation-resource-map.js';
import {createIcons,Play,Pause,Square,X,MessageCircle} from 'lucide';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=()=>createIcons({icons:{Play,Pause,Square,X,MessageCircle},attrs:{'stroke-width':1.65}});
const sharedPath=()=>getHandoffServices().runtimePolicy?.sharedMotionCatalogPath||'';
const unresolvedName=item=>/^MULTI_[A-Z0-9_]+$/.test(item?.name||'');
const itemLabel=(item,kind='动作')=>unresolvedName(item)?`${kind} ${item.id}（名称待解析）`:item.name||`${kind} ${item.id}`;
export class ExpressionGifPlayback{
  constructor(image,timers={set:setInterval,clear:clearInterval}){this.image=image;this.timers=timers;this.timer=null;this.token=0;}
  stop(){this.token++;if(this.timer!==null){this.timers.clear(this.timer);this.timer=null;}}
  play(animation){this.stop();const frames=animation?.frames;if(!Array.isArray(frames)||!frames.length)return;const token=this.token;let index=0;this.image.src=frames[index];this.timer=this.timers.set(()=>{if(token!==this.token)return;index=(index+1)%frames.length;this.image.src=frames[index];},Math.round(animation.interval*1000));}
}
export class ExpressionBubbleLifetime{
  constructor(clear,timers={set:setInterval,clear:clearInterval}){this.clear=clear;this.timers=timers;this.timer=null;this.token=0;}
  stop(){this.token++;if(this.timer!==null){this.timers.clear(this.timer);this.timer=null;}}
  start(keepTime=3){this.stop();const token=this.token;let remaining=keepTime;this.timer=this.timers.set(()=>{if(token!==this.token)return;if(--remaining<0)this.clear();},1000);}
}
export class SocialPanel{
  constructor(viewer,toast){this.viewer=viewer;this.toast=toast;this.rows=[];this.token=0;this.playRequest=0;this.catalogPath='';this.sequenceItems=[];this.actionItems=[];
    const section=document.createElement('section');section.className='detail-section social';section.innerHTML=`<div class="segmented"><button id="motions-tab" aria-pressed="true">动作</button><button id="expressions-tab" aria-pressed="false">气泡表情</button></div><div id="motions-panel"><input id="motion-search" type="search" aria-label="搜索动作" placeholder="搜索动作"><select id="motion-select" aria-label="动作"></select><div class="motion-controls"><button id="motion-play" class="icon-btn" title="播放" aria-label="播放动作"><i data-lucide="play"></i></button><button id="motion-pause" class="icon-btn" title="暂停 / 继续" aria-label="暂停动作"><i data-lucide="pause"></i></button><button id="motion-stop" class="icon-btn" title="停止" aria-label="停止动作"><i data-lucide="square"></i></button><select id="motion-speed" aria-label="播放速度"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></div><input id="motion-seek" aria-label="动作进度" type="range" min="0" max="1" step="0.001" value="0"><div id="motion-time" class="muted">0.00 / 0.00 s</div><div id="motion-status" class="muted">动作目录载入中</div></div><div id="expressions-panel" hidden><div class="expression-heading"><span id="expression-count" class="muted"></span><button id="bubble-clear" class="icon-btn" title="清除气泡" aria-label="清除气泡"><i data-lucide="x"></i></button></div><div id="expressions"></div></div>`;
    document.querySelector('.inspector details').before(section);this.host=section;this.$=s=>section.querySelector(s);icons();
    this.bubble=document.createElement('div');this.bubble.className='expression-bubble';this.bubble.hidden=true;document.querySelector('.stage').append(this.bubble);this.gifPlayer=null;this.bubbleLifetime=new ExpressionBubbleLifetime(()=>this.clearBubble());
    for(const mode of ['motions','expressions'])this.$(`#${mode}-tab`).onclick=()=>{for(const m of ['motions','expressions']){this.$(`#${m}-tab`).setAttribute('aria-pressed',String(m===mode));this.$(`#${m}-panel`).hidden=m!==mode;}if(mode!=='expressions')this.clearBubble();};
    this.$('#motion-search').oninput=()=>this.renderMotions();
    this.$('#motion-select').onchange=()=>{this.playRequest++;viewer.stopMotion();this.$('#motion-play').disabled=!this.$('#motion-select').value;this.renderMotionPreview();};
    this.$('#motion-play').onclick=async()=>{
      const value=this.$('#motion-select').value,item=value.startsWith('item:')?this.actionItems.find(i=>String(i.id)===value.slice(5)):null;
      const row=item?null:this.rows.find(r=>r.name===value);if(!row&&!item)return;
      const request=++this.playRequest;this.$('#motion-play').disabled=true;
      try{
        if(item)await viewer.playMotionItem(item,this.rows,this.catalogPath);else await viewer.playMotion(row);
        if(request!==this.playRequest)return;
        viewer.setMotionSpeed(Number(this.$('#motion-speed').value));
        const notices=[];
        if(item&&viewer.motionExtraWarnings?.length)notices.push(...viewer.motionExtraWarnings);
        if(item&&(item.sfxPath||item.deliveryStatus==='partial-sfx-not-integrated'||item.rule?.out_game_sfx_infos?.length))notices.push('配套特效尚未还原');
        if(notices.length)toast(`骨骼动作已播放；${notices.join('；')}`,true);
        else if(row?.sourceItems?.some(i=>i.sfxPath))toast('动作骨骼已播放；配套特效尚未还原',true);
      }catch(e){if(request===this.playRequest)toast(e.message,true);}
      finally{if(request===this.playRequest)this.$('#motion-play').disabled=false;}
    };
    this.$('#motion-pause').onclick=()=>viewer.pauseMotion();this.$('#motion-stop').onclick=()=>{this.playRequest++;viewer.stopMotion();this.$('#motion-play').disabled=!this.$('#motion-select').value;};this.$('#motion-seek').oninput=e=>viewer.seekMotion(Number(e.target.value));this.$('#motion-speed').onchange=e=>viewer.setMotionSpeed(Number(e.target.value));
    this.$('#bubble-clear').onclick=()=>this.clearBubble();
    viewer.onFrame=s=>{if(document.activeElement!==this.$('#motion-seek'))this.$('#motion-seek').value=s.duration?s.time/s.duration:0;this.$('#motion-time').textContent=`${s.time.toFixed(2)} / ${s.duration.toFixed(2)} s`;this.$('#motion-pause').setAttribute('aria-pressed',String(s.paused));};
    this.index=null;this.loadExpressions();
  }
  clearBubble(){this.bubbleLifetime?.stop();this.gifPlayer?.stop();this.gifPlayer=null;this.bubble.replaceChildren();this.bubble.hidden=true;}
  async modelChanged(desc,item,variant){const token=++this.token;this.playRequest++;this.clearBubble();this.rows=[];this.sequenceItems=[];this.actionItems=[];this.catalogPath='';this.$('#motion-search').value='';this.renderMotions();
    try{if(!this.index){const r=await requestJSON('/data/motion-index.json');if(!r.ok)throw new Error('动作目录未发布');this.index=await r.json();}
      const path=desc.dependencies.find(d=>d.path.endsWith('.animconfig'))?.path,url=this.index[path];if(!url){this.$('#motion-status').textContent='此模型无已解析动作目录';return;}
      const r=await requestJSON(url);if(!r.ok)throw new Error('动作目录载入失败');const data=await r.json();
      if(!this.animationMaps){const maps=await requestJSON('/data/model-animation-maps.json');if(!maps.ok)throw new Error('角色动作替换目录未发布');this.animationMaps=await maps.json();}
      if(!this.actionExtras){const extras=await requestJSON('/data/action-extras.json');if(!extras.ok)throw new Error('动作附件目录未发布');this.actionExtras=await extras.json();}
      if(token!==this.token)return;this.rows=applyAnimationResourceMap(data,this.animationMaps.items[String(item?.itemId)]);this.catalogPath=data.path;this.actionItems=this.catalogPath===sharedPath()?[...new Map(this.rows.flatMap(r=>r.sourceItems||[]).filter(i=>[1,2].includes(i.rule?.anim_type)||(i.type===4&&i.rule?.anim_type===0)).map(i=>[i.id,i])).values()]:[];this.sequenceItems=this.actionItems.filter(i=>i.rule.anim_type===2);this.renderMotions();
      const idle=selectModelIdle(this.catalogPath,this.rows,variant?.showConfig);if(idle){this.$('#motion-select').value=idle.name;this.renderMotionPreview();await this.viewer.playMotion(idle,{rememberIdle:true});if(token===this.token)this.viewer.setMotionSpeed(Number(this.$('#motion-speed').value));}
    }catch(e){if(token===this.token)this.$('#motion-status').textContent=e.message;}
  }
  sequenceAvailable(item){try{resolveSequenceEntries(item,this.rows);return true;}catch{return false;}}
  actionAvailable(item){try{resolveMotionEntries(item,this.rows);return motionExtrasReady(item,this.actionExtras);}catch{return false;}}
  renderMotions(){
    const q=this.$('#motion-search').value.toLowerCase(),label=r=>[...new Set((r.sourceItems||[]).map(i=>itemLabel(i)))].join(' / ');
    const rows=this.rows.filter(r=>r.status==='ready'&&`${r.name} ${label(r)} ${(r.sourceItems||[]).map(i=>i.name).join(' ')}`.toLowerCase().includes(q));
    const selected=this.$('#motion-select').value,rank=r=>r.sourceItems?.some(i=>i.iconUrl&&!unresolvedName(i))?0:r.sourceItems?.some(i=>!unresolvedName(i))?1:r.sourceItems?.length?2:3;rows.sort((a,b)=>rank(a)-rank(b));
    const items=this.actionItems.filter(i=>`${i.id} ${i.name} ${i.animKey} ${i.rule.anim_names.join(' ')}`.toLowerCase().includes(q));
    this.$('#motion-select').innerHTML=items.map(i=>`<option value="item:${i.id}" ${this.actionAvailable(i)?'':'disabled'}>${esc(itemLabel(i))} · ${i.rule.anim_type===2?'两阶段':'动作'}${this.actionAvailable(i)?'':'（未完整还原）'}</option>`).join('')+rows.map(r=>`<option value="${esc(r.name)}">片段 · ${esc(label(r)||r.name)}</option>`).join('');
    if([...this.$('#motion-select').options].some(o=>o.value===selected&&!o.disabled))this.$('#motion-select').value=selected;
    this.$('#motion-play').disabled=!this.$('#motion-select').value;
    this.$('#motion-status').textContent=`${rows.length} / ${this.rows.length} 个片段可播放`+(this.actionItems.length?` · ${this.actionItems.filter(i=>this.actionAvailable(i)).length} / ${this.actionItems.length} 个动作入口`:'');
    this.renderMotionPreview();
  }
  renderMotionPreview(){
    let preview=this.$('#motion-preview');if(!preview){preview=document.createElement('div');preview.id='motion-preview';this.$('#motion-select').after(preview);}
    const value=this.$('#motion-select').value,row=this.rows.find(r=>r.name===value),item=value.startsWith('item:')?this.actionItems.find(i=>String(i.id)===value.slice(5)):row?.sourceItems?.find(i=>i.iconUrl);
    preview.innerHTML=item?.iconUrl?`<img src="${esc(item.iconUrl)}" alt="${esc(itemLabel(item))}"><span>${esc(itemLabel(item))}</span>`:'';this.renderMotionGrid();
  }
  renderMotionGrid(){
    let grid=this.$('#motion-grid');if(!grid){grid=document.createElement('div');grid.id='motion-grid';this.$('#motion-status').after(grid);grid.onclick=e=>{const b=e.target.closest('[data-motion]');if(!b||b.disabled)return;this.$('#motion-select').value=b.dataset.motion;this.$('#motion-select').onchange();this.$('#motion-play').click();};}
    const q=this.$('#motion-search').value.toLowerCase(),seen=new Set(),entries=[];
    for(const row of this.rows){if(row.status!=='ready')continue;for(const item of row.sourceItems||[]){
      const action=this.actionItems.find(i=>i.id===item.id),hay=`${item.id} ${item.name} ${row.name} ${action?.rule.anim_names.join(' ')||''}`;
      if((item.type===4&&!action)||seen.has(item.id)||!hay.toLowerCase().includes(q))continue;seen.add(item.id);
      entries.push({item,value:action?`item:${item.id}`:row.name,available:!action||this.actionAvailable(action)});
    }}
    entries.sort((a,b)=>Number(!a.item.iconUrl)-Number(!b.item.iconUrl)||Number(unresolvedName(a.item))-Number(unresolvedName(b.item)));
    grid.innerHTML=entries.map(({item,value,available})=>`<button class="motion-item" data-motion="${esc(value)}" data-name-resolved="${!unresolvedName(item)}" title="${esc(item.name)}" ${available?'':'disabled'} aria-pressed="${this.$('#motion-select').value===value}">${item.iconUrl?`<img src="${esc(item.iconUrl)}" alt="" loading="lazy">`:'<span class="motion-icon-missing"><i data-lucide="play"></i></span>'}<small>${esc(itemLabel(item))}</small>${available?'':'<small>未完整还原</small>'}</button>`).join('');icons();
  }
  async loadExpressions(){try{const r=await requestJSON('/data/expressions.json');if(!r.ok)throw new Error('表情目录未发布');const data=await r.json();this.$('#expression-count').textContent=`${data.items.length} 个表情`;
    data.items.sort((a,b)=>Number(!a.url)-Number(!b.url)||b.priority-a.priority);this.$('#expression-count').textContent=`${data.items.filter(e=>e.url).length} / ${data.items.length} 个气泡可预览`;
    this.$('#expressions').innerHTML=data.items.map(e=>`<button class="expression-item" data-expression="${e.id}" title="${esc(e.iconPath)}" ${!e.url?'disabled':''}><span>${e.thumbnail||e.url?`<img src="${esc(e.thumbnail||e.url)}" alt="${esc(itemLabel(e,'表情'))}" loading="lazy">`:'<i data-lucide="message-circle"></i>'}</span><small>${esc(itemLabel(e,'表情'))}</small>${!e.url?'<small class="muted">资源未定位</small>':''}</button>`).join('');icons();
    this.$('#expressions').onclick=e=>{const button=e.target.closest('[data-expression]');if(!button)return;const row=data.items.find(i=>i.id===Number(button.dataset.expression));if(!row)return;this.clearBubble();if(row.url){const img=new Image();img.alt=row.name;this.bubble.append(img);this.gifPlayer=new ExpressionGifPlayback(img);if(row.animation)this.gifPlayer.play(row.animation);else img.src=row.url;this.bubble.hidden=false;this.bubbleLifetime.start();}else{this.bubble.textContent=row.name;this.toast('表情图片未定位，当前显示源表情标记',true);this.bubble.hidden=false;}};
  }catch(e){this.$('#expression-count').textContent=e.message;}}
}
