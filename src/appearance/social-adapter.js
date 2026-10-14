import {requestJSON,getHandoffServices} from '../handoff/services.js';

import {ExpressionGifPlayback,ExpressionBubbleLifetime} from '../social.js';
import {applyAnimationResourceMap,selectModelEntrance,selectModelIdle} from '../animation-resource-map.js';
import {resolveMotionEntries,sourceMotionRepeats} from '../source-motion-sequence.js';
import {LoopOnce,LoopRepeat} from 'three';
import {resolveModel} from './wardrobe.js';
import {modelTextureOverrides} from '../model-textures.js';
import {defaultActorEntry} from './default-actor.js';
import {resolveFashionAssembly} from '../source-fashion-assembly.js';
import {VehiclePartsPanel} from './vehicle-parts.js';
import {SocialRuntimeBridge} from './runtime/social-runtime.js';
const runtimePolicy=()=>getHandoffServices().runtimePolicy||{};
const sharedPath=()=>runtimePolicy().sharedMotionCatalogPath||'';
const json=async url=>{const r=await requestJSON(url);if(!r.ok)throw new Error(`目录未发布：${url} (${r.status})`);return r.json();};
// Only the source-complete cat appearance is released here. Its spring solver
// remains blocked; preview availability never promotes runtimeStatus.
export const vehicleAppearanceReady=(row,variant)=>row.capabilities?.appearancePreview===true&&variant.resourceStatus==='ready'&&Boolean(variant.modelId)&&variant.reasons?.length===1&&variant.reasons[0]==='vehicle-spring-not-integrated';
export const vehicleResource=(row,quality=0,parts={},socketAssemblies={})=>{
  const id=`vehicle:${row.id}`;
  const variants=row.variants.map(variant=>({
    ...variant,isDefault:variant.id===row.defaultVariantId,socketAssembly:socketAssemblies[variant.id],
    runtime:variant.runtimeStatus==='ready'?variant.modelId:null,
    preview:variant.runtimeStatus==='ready'||vehicleAppearanceReady(row,variant)||socketAssemblies[variant.id]?.geometryReady?variant.modelId:null,
    appearanceOnly:variant.runtimeStatus!=='ready'&&vehicleAppearanceReady(row,variant),
  }));
  const appearanceOnly=row.runtimeStatus!=='ready'&&variants.some(v=>v.appearanceOnly);
  const socketPreview=variants.some(v=>v.socketAssembly?.geometryReady),assemblyAvailable=variants.some(v=>parts[v.id]?.dynamicsReady)||socketPreview,icon=parts[row.defaultVariantId]?.icon?.url||'';
  return {id,name:row.name+(appearanceOnly?' · 静态外观预览':socketPreview?' · 装配预览':''),type:'载具',source:icon,kind:'vehicle',dyeGroup:variants.length>1?'basic':'none',
    quality:['基础','高级','稀有','典藏','至臻'][Math.min(Number(quality)||0,4)],
    vehicle:row,item:{...row,id,itemId:row.id,thumbnail:icon||undefined,quality:Number(quality)||0,variants,preserveSourceDefault:socketPreview,appearanceOnly,assemblyAvailable,available:row.runtimeStatus==='ready'||appearanceOnly||assemblyAvailable}};
};
export const vehiclePreviewAnimation=variant=>{
  const sequence=variant.previewPlayback?.sequence||[];
  if(!sequence.length)return null;
  if(sequence.length!==1)throw new Error('此载具的循环动作序列尚未接入');
  const animation=variant.animations?.find(row=>row.name===sequence[0].name&&row.status==='ready');
  if(!animation)throw new Error(`载具展示动作尚未发布：${sequence[0].name}`);
  return animation;
};
export const abilityResource=(row,quality=0,source='')=>({
  id:`ability:${row.id}`,name:row.name,type:'玩具',source,kind:'ability',dyeGroup:'none',
  quality:['基础','高级','稀有','典藏','至臻'][Math.min(Number(quality)||0,4)],
  ability:row,item:{...row,itemId:row.id,quality:Number(quality)||0,variants:[],available:row.runtimeStatus==='ready'},
});
export const actionDelivery=(motion,rows,extra,multiAction)=>{
  if(multiAction?.runtimeStatus==='ready')return {status:'ready',reason:null};
  if(multiAction)return multiAction.runtimeStatus==='pending'?{status:'partial',reason:'multi-person-preview-pending'}:{status:'blocked',reason:'multi-person-preview-blocked'};
  if(!motion)return {status:'blocked',reason:'motion-entry-missing'};
  try{resolveMotionEntries(motion,rows);}catch{return {status:'blocked',reason:'motion-resource-blocked'};}
  if(motion.rule?.extra_model_infos?.length&&extra?.status!=='ready')return {status:'partial',reason:extra?'action-extra-blocked':'action-extra-catalog-missing'};
  return {status:'ready',reason:null};
};
export class AppearanceSocial {
  constructor(viewer,wardrobe,message,source,metadata={},options={}) {
    this.viewer=viewer;this.wardrobe=wardrobe;this.message=message;this.source=source;this.metadata=metadata;this.skipEntrance=options.skipEntrance||(()=>false);this.resources=[];this.playing=false;this.request=0;this.loop=true;this.lastTime=null;this.abilityTimers=new Set();
    // Runtime state is deliberately independent from the playback DOM. The
    // bridge is the future contract boundary for gameplay and digital-human UI.
    this.runtime=new SocialRuntimeBridge({effects:options.runtimeEffects});
    this.runtimeAction=null;this.runtimeClipTime=null;this.runtimeTimer=null;this.runtimeWallClock=null;
    if(typeof window!=='undefined')window.appearanceRuntime=this.runtime;
    this.vehicleParts=new VehiclePartsPanel((resource,variant)=>options.runOperation?options.runOperation(()=>this.playVehicle(resource,variant)):this.playVehicle(resource,variant),message);
    this.bubble=document.createElement('img');this.bubble.className='ui-expression';this.bubble.hidden=true;this.bubble.alt='表情';document.querySelector('.canvas-area').append(this.bubble);
    // Existing playback helpers accept injected timers; bind browser globals here.
    const timers={set:(callback,delay)=>window.setInterval(callback,delay),clear:id=>window.clearInterval(id)};
    this.gif=new ExpressionGifPlayback(this.bubble,timers);this.lifetime=new ExpressionBubbleLifetime(()=>this.clearExpression(),timers);
    const $=s=>document.querySelector(s),header=$('.playback-header');header.hidden=true;header.title='当前动作播放控制';
    const stop=document.createElement('button');stop.id='playback-stop';stop.className='speed-toggle';stop.textContent='停止';stop.onclick=()=>this.stop();$('.playback-row').append(stop);
    this.loopButton=document.createElement('button');this.loopButton.id='playback-loop';this.loopButton.className='speed-toggle';this.loopButton.textContent='循环';this.loopButton.setAttribute('aria-pressed','true');$('.playback-row').append(this.loopButton);
    this.loopButton.onclick=()=>{this.loop=!this.loop;this.loopButton.setAttribute('aria-pressed',String(this.loop));viewer.setMotionLoop(this.loop);this.lastTime=viewer.motionState().time;};
    $('#playback-progress').max=1;$('#playback-progress').step=.001;
    $('#playback-progress').oninput=e=>{
      viewer.seekMotion(Number(e.target.value));
      this.lastTime=viewer.motionState().time;
      this.runtimeClipTime=this.lastTime;
      if(this.runtimeAction){
        try{
          const runtime=this.runtime.snapshot();
          this.runtime.seek(runtime.durationSeconds>0?Number(e.target.value):this.lastTime,{unit:runtime.durationSeconds>0?'fraction':'seconds'});
        }catch{}
      }
    };
    $('#playback-toggle').onclick=()=>{
      viewer.pauseMotion();
      const paused=viewer.motionState().paused, toggle=$('#playback-toggle');
      toggle.setAttribute('aria-pressed',String(!paused));
      toggle.title=paused?'继续':'暂停';
      toggle.setAttribute('aria-label',paused?'继续':'暂停');
      try{if(this.runtimeAction){if(paused)this.runtime.pause();else this.runtime.resume();}}catch{}
    };
    const rates=[.25,.5,1,2,4];let rate=2;
    $('#playback-speed').onclick=()=>{rate=(rate+1)%rates.length;viewer.setMotionSpeed(rates[rate]);try{if(this.runtimeAction)this.runtime.setRate(rates[rate]);}catch{}$('#playback-speed').textContent=`${rates[rate]}×`;$('#playback-speed').setAttribute('aria-label',`播放倍速，当前${rates[rate]}倍`);};
    viewer.onFrame=state=>{
      if(this.#runtimeTimedOut(state)){this.finish();return;}
      header.hidden=!(this.playing&&state.name&&!viewer.playingIdle&&state.name!==this.idle?.name);
      if(this.playing&&!viewer.playingIdle){
        const ended=!state.name || (!this.loop&&this.lastTime!==null&&!state.paused&&state.time<this.lastTime-.001);
        if(ended){
          const runtime=this.runtime.snapshot();
          if(runtime.state==='running'&&runtime.durationSeconds>0&&runtime.elapsed<runtime.durationSeconds-.001)return;
          this.finish();return;
        }
        this.lastTime=state.time;
      }
      if(header.hidden)return;
      $('#playback-time').textContent=`${state.time.toFixed(1)}/${state.duration.toFixed(1)}`;
      if(document.activeElement!==$('#playback-progress'))$('#playback-progress').value=state.duration?state.time/state.duration:0;
      $('#playback-toggle').setAttribute('aria-pressed',String(!state.paused));$('#playback-toggle').title=state.paused?'继续':'暂停';$('#playback-toggle').setAttribute('aria-label',state.paused?'继续':'暂停');
    };
  }
  async load() {
    if(this.loaded)return;
    if(!this.loading)this.loading=this.loadCatalogs().then(()=>{this.loaded=true;}).finally(()=>{this.loading=null;});
    return this.loading;
  }
  async loadCatalogs() {
    const outcomes=await Promise.allSettled([json('/data/motion-index.json'),json('/data/expressions.json'),json('/data/model-animation-maps.json'),json('/data/bag-assets.json'),json('/data/toy-vehicles.json'),json('/data/toy-abilities.json'),json('/data/action-extras.json'),json('/data/multi-person-actions.json'),json('/data/vehicle-parts.json'),json('/data/motion-clip-index.json')]);
    this.index=outcomes[0].status==='fulfilled'?outcomes[0].value:{};
    this.maps=outcomes[2].status==='fulfilled'?outcomes[2].value:{items:{}};
    this.mappingError=outcomes[2].status==='rejected'?outcomes[2].reason.message:'';
    // T624: ready rows of every non-shared animconfig catalog (dwrg family
    // included). Merged after AnimClipMap substitution so source replacement
    // tables keep applying to the shared catalog only.
    this.extraMotionRows=outcomes[9].status==='fulfilled'?outcomes[9].value.items:[];
    const expressions=outcomes[1].status==='fulfilled'?outcomes[1].value.items:[];
    const images=outcomes[3].status==='fulfilled'?outcomes[3].value.images:{};
    const abilities=outcomes[5].status==='fulfilled'?outcomes[5].value.items:[];
    const actionExtras=outcomes[6].status==='fulfilled'?outcomes[6].value.items:{};
    const multiActions=outcomes[7].status==='fulfilled'?{...outcomes[7].value.pendingItems,...outcomes[7].value.items}:{};
    const abilityIds=new Set(abilities.map(row=>row.id));
    if(this.index[sharedPath()])this.catalog=await json(this.index[sharedPath()]);
    const sources=new Map((this.catalog?.items || []).flatMap(row=>row.sourceItems||[]).map(item=>[String(item.id),item]));
    const wrap=(row,type,source,kind,available)=>({id:`social:${row.id}`,name:/^MULTI_/.test(row.name||'')?`${type} ${row.id}（名称待解析）`:row.name,type,source:source||'',kind,dyeGroup:'none',quality:['基础','高级','稀有','典藏','至臻'][Math.min(row.quality||0,4)],item:{...row,itemId:row.id,variants:[],available}});
    this.resources=this.source.filter(row=>!abilityIds.has(row.id)).map(row=>{
      const motion=sources.get(String(row.id)),multiAction=multiActions[String(row.id)];
      const delivery=actionDelivery(motion,this.catalog?.items||[],actionExtras[String(row.id)],multiAction);
      const resource=wrap(row,row.type===4?'玩具':'动作',motion?.iconUrl||images[row.iconPath]?.url,'motion',delivery.status==='ready');
      if(multiAction&&delivery.status!=='ready')resource.item.unavailableLabel=multiAction.runtimeStatus==='pending'?'双人预览待接入':'双人预览未就绪';
      return {...resource,motion,multiAction,delivery};
    });
    this.resources.push(...expressions.map(row=>({...wrap({...row,quality:this.metadata[String(row.id)]?.quality ?? row.quality},'表情',row.thumbnail||row.url,'expression',row.status==='ready'),expression:row})));
    const parts=outcomes[8].status==='fulfilled'?outcomes[8].value:{variants:{}};this.vehicleParts.catalog=parts;
    const socketAssemblies=await json('/data/vehicle-socket-assemblies.json');
    if(outcomes[4].status==='fulfilled')this.resources.push(...outcomes[4].value.items.map(row=>vehicleResource(row,this.metadata[String(row.id)]?.quality,parts.variants,socketAssemblies.variants)));
    this.resources.push(...abilities.map(row=>abilityResource(row,this.metadata[String(row.id)]?.quality,images[row.iconPath]?.url)));
    this.resources.sort((a,b)=>Number(b.item.available)-Number(a.item.available)||Number(Boolean(b.source))-Number(Boolean(a.source)));
  }
  clearExpression(){this.gif.stop();this.lifetime.stop();this.bubble.hidden=true;this.bubble.removeAttribute('src');}
  clearAbility(){for(const timer of this.abilityTimers)window.clearTimeout(timer);this.abilityTimers.clear();this.viewer.clearCompanions?.();}
  scheduleAbility(callback,delay){const timer=window.setTimeout(()=>{this.abilityTimers.delete(timer);callback();},delay);this.abilityTimers.add(timer);return timer;}
  async modelChanged(entry,descriptor) {
    this.vehicleParts.hide();
    const token=++this.request,actor=this.viewer.actor;this.playing=false;this.idle=null;this.clearExpression();
    try{
      await this.load();
      const path=descriptor.dependencies?.find(dep=>dep.path.endsWith('.animconfig'))?.path;
      if(!this.index[path])return;
      const catalog=path===sharedPath()?this.catalog:await json(this.index[path]);
      const rows=applyAnimationResourceMap(catalog,this.maps.items[String(entry.item.itemId)]);
      const idle=selectModelIdle(path,rows,entry.variant?.showConfig),entrance=selectModelEntrance(path,rows);
      if(token!==this.request||actor!==this.viewer.actor)return;
      this.idle=idle;this.idleActor=actor;
      if(entrance&&!this.skipEntrance())await this.viewer.playEntranceThenIdle(entrance,idle);
      else if(idle)await this.viewer.playMotion(idle,{rememberIdle:true});
    }catch(error){if(token===this.request)this.message(`默认待机未就绪：${error.message}`,true);}
  }
  #runtimeTimedOut(state){
    if(!this.runtimeAction)return false;
    const snapshot=this.runtime.snapshot();
    return snapshot.state==='PAUSED'&&snapshot.durationSeconds>0&&snapshot.elapsed>=snapshot.durationSeconds-.001;
  }
  #prepareRuntime(multi,send,receive,layout){
    const action={id:multi.id,...(multi.runtimeContract||{}),send_motion:send.animKey,receive_motion:receive.animKey};
    this.runtime.prepare(action,{senderId:'sender',receiverId:'receiver',senderPosition:layout?.sendPosition,receiverPosition:layout?.receivePosition});this.runtime.start();
    this.runtimeAction=action;this.runtimeClipTime=0;this.runtimeWallClock=performance.now();
    this.runtimeTimer=window.setInterval(()=>{
      if(!this.runtimeAction)return;
      const now=performance.now(),delta=Math.max(0,Math.min(.25,(now-(this.runtimeWallClock??now))/1000));
      this.runtimeWallClock=now;
      try{
        const snapshot=this.runtime.tick(delta);
        if(snapshot.state==='paused'&&snapshot.durationSeconds>0&&snapshot.elapsed>=snapshot.durationSeconds-.001)this.finish();
      }catch{}
    },50);
  }
  #clearRuntime(){
    if(!this.runtimeAction)return;
    if(this.runtimeTimer!==null){window.clearInterval(this.runtimeTimer);this.runtimeTimer=null;}
    try{this.runtime.stop();}catch{}
    this.runtimeAction=null;this.runtimeClipTime=null;this.runtimeWallClock=null;
  }
  finish(){if(!this.playing)return;this.playing=false;this.viewer.stopMotion();this.viewer.clearMultiMotion?.();this.#clearRuntime();const token=this.request;queueMicrotask(()=>{if(token===this.request)this.returnIdle();});}
  async returnIdle(){
    document.querySelector('.playback-header').hidden=true;
    this.viewer.clearMultiMotion?.();
    await this.restoreLinkageActor();
    if(!this.idle||this.idleActor!==this.viewer.actor)return;
    const token=this.request;
    try{await this.viewer.playMotion(this.idle,{rememberIdle:true});}catch(error){if(token===this.request)this.message(`待机恢复失败：${error.message}`,true);}
  }
  async stop(resume=true){this.vehicleParts.hide();this.request++;this.playing=false;this.clearAbility();this.viewer.stopMotion();this.viewer.clearMultiMotion?.();this.#clearRuntime();document.querySelector('.playback-header').hidden=true;if(resume)await this.returnIdle();}
  async playVehicle(resource,variant=resource.item.variants.find(row=>row.isDefault)||resource.item.variants[0]){
    const configurable=Boolean(variant?.extraPartConfig);let assembly=null;
    if(configurable){assembly=await this.vehicleParts.show(resource,variant);if(!assembly)return;}
    else this.vehicleParts.hide();
    if(variant?.socketAssembly){
      if(!variant.socketAssembly.geometryReady){this.message('默认配色资源尚未齐全，请选择已开放的其他配色预览');return;}
      assembly=variant.socketAssembly;
    }
    const appearanceOnly=variant&&variant.runtimeStatus!=='ready'&&vehicleAppearanceReady(resource.vehicle,variant);
    if(!variant||(!configurable&&!assembly&&!appearanceOnly&&variant.runtimeStatus!=='ready')||!variant.modelId)throw new Error('此载具的模型、动作或组合规则尚未完整还原');
    const token=++this.request;this.playing=false;this.idle=null;this.clearExpression();this.clearAbility();
    const result=await this.viewer.show(assembly?.base||variant.modelId,{},assembly?{assembly}:{});
    if(!result||token!==this.request)return;
    this.viewer.applySourceDisplayConfig(variant.showConfig);
    this.wardrobe.mode='external';
    const animation=appearanceOnly?null:vehiclePreviewAnimation(variant);
    if(animation){await this.viewer.playMotion(animation,{rememberIdle:true});if(variant.previewPlayback.sequence[0]?.source==='loop_anim_list')this.viewer.setVehicleLoop(variant.previewPlayback.sequence);this.idle=animation;this.idleActor=this.viewer.actor;}
    if(appearanceOnly)this.message('静态外观预览：可切换配色；载具动作与动态毛发尚未开放');
    if(variant.socketAssembly)this.message('装配预览：车身、玻璃、车轮、待机和轮胎粒子已接入；完整特效待完善');
  }
  async playAbility(resource){
    const row=resource.ability;
    if(row.runtimeStatus!=='ready'||!row.spawn?.modelId||row.spawn.animation?.status!=='ready'||row.actorAnimation?.status!=='ready')throw new Error(`此能力玩具尚未完整还原：${row.reasons?.join('；')||'资源未就绪'}`);
    await this.wardrobe.restore();
    const token=++this.request;this.playing=false;this.clearExpression();this.clearAbility();
    const cast={...row.actorAnimation,properties:{...row.actorAnimation.properties,DefaultLoop:'false'}};
    await this.viewer.playMotion(cast);
    const action=this.viewer.action,mixer=this.viewer.mixer;
    if(action){action.setLoop(LoopOnce,1);action.clampWhenFinished=true;const finished=()=>{mixer.removeEventListener('finished',finished);if(token===this.request&&this.viewer.action===action)this.returnIdle();};mixer.addEventListener('finished',finished);}
    this.scheduleAbility(async()=>{
      if(token!==this.request)return;
      try{await this.viewer.showCompanion(`ability:${row.id}`,row.spawn.modelId,{position:row.spawn.previewPosition,animation:row.spawn.animation});}
      catch(error){if(token===this.request)this.message(`召唤物加载失败：${error.message}`,true);}
    },Math.round(row.channelTime*1000));
    this.scheduleAbility(()=>{if(token===this.request)this.viewer.removeCompanion(`ability:${row.id}`);},Math.round(row.spawn.keepTime*1000));
  }
  withExtraMotionRows(rows){
    return this.extraMotionRows?.length?[...rows,...this.extraMotionRows]:rows;
  }
  // T624 linkage actions: a clip row delivered outside the shared catalog
  // carries the family model that owns its skeleton. Both actors must wear
  // that skeleton's model; null keeps the legacy default-actor behaviour.
  linkageModelOf(role,rows){
    const name=role?.rule?.anim_names?.[0],row=name&&rows.find(entry=>entry.name===name);
    return row?.model||null;
  }
  async restoreLinkageActor(){
    if(!this.linkageRestoreModelId)return;
    this.linkageRestoreModelId=null;
    // Full wardrobe restore, not a bare viewer.show(): the user's entry may
    // carry fashion assemblies and equipped slots that a base-model swap
    // would drop. restore() rebuilds the assembly and re-equips slots.
    try{await this.wardrobe.restore();}catch(error){this.message(`联动角色恢复失败：${error.message}`,true);}
  }
  async playMulti(resource){
    const multi=resource.multiAction;
    if(multi?.runtimeStatus!=='ready'||multi.roles.length!==2)throw new Error('此多人动作的角色资源或编排尚未完整还原');
    this.clearAbility();await this.wardrobe.restore();
    const selected=this.wardrobe.actor;
    const fashion=await this.wardrobe.loadFashionParts(),companion=defaultActorEntry(fashion,selected.role);
    const assembly=resolveFashionAssembly(fashion,companion.role,companion.fashionParts),modelId=assembly.base;
    const overrides=assembly.overrides[modelId];
    const rows=this.withExtraMotionRows(applyAnimationResourceMap(this.catalog,this.maps.items[String(selected.item.itemId)]));
    const send=multi.roles.find(role=>role.role==='send'),receive=multi.roles.find(role=>role.role==='receive');
    if(!send||!receive)throw new Error('多人动作缺少发送或接收角色');
    const sendModel=this.linkageModelOf(send,rows),receiveModel=this.linkageModelOf(receive,rows);
    if(sendModel||receiveModel){
      if(!sendModel||!receiveModel)throw new Error('双人联动动作的角色模型尚未就绪');
      this.linkageRestoreModelId=modelId;
      // Take the wardrobe out of 'outfit' so restore() performs the full
      // entry show + slot re-equip instead of short-circuiting.
      this.wardrobe.mode='linkage';
      await this.viewer.show(sendModel.id);
    }
    const sendItem={id:resource.item.id,animKey:send.animKey,rule:send.rule};
    const receiveItem={id:resource.item.id,animKey:receive.animKey,rule:receive.rule};
    this.request++;this.playing=false;
    const layout=this.viewer.beginMultiLayout(multi);
    try{
      const companionRows=applyAnimationResourceMap(this.catalog,this.maps.items[String(companion.item.itemId)]);
      const idle=selectModelIdle(this.catalog.path,companionRows,companion.variant.showConfig);
      await this.viewer.showMotionCompanion(`multi:${resource.item.id}:receive`,receiveModel?.id||modelId,receiveItem,this.withExtraMotionRows(companionRows),{position:layout.receivePosition,angle:layout.receiveAngle,scale:layout.scale,overrides:receiveModel?{}:overrides,idle,idleTime:0,assembly:receiveModel?null:assembly});
      await this.viewer.playMotionItem(sendItem,rows,this.catalog.path);
      this.viewer.seekMotion(0);
    }catch(error){this.viewer.stopMotion();this.viewer.clearMultiMotion();await this.restoreLinkageActor();throw error;}
    try {
      this.#prepareRuntime(multi,send,receive,layout);
    } catch (error) {
      this.viewer.stopMotion();
      this.viewer.clearMultiMotion?.();
      try { this.runtime.stop(); } catch {}
      await this.returnIdle();
      throw error;
    }
    this.playing=true;this.viewer.setMotionSpeed(Number(document.querySelector('#playback-speed').textContent.replace('×',''))||1);
    this.runtime.setRate(Number(document.querySelector('#playback-speed').textContent.replace('×',''))||1);
    const canLoop=send.rule.anim_type===2||sourceMotionRepeats(send.rule);
    this.loopButton.disabled=!canLoop;this.loopButton.setAttribute('aria-pressed',String(canLoop&&this.loop));this.lastTime=null;
    if(canLoop)this.viewer.setMotionLoop(this.loop);
    if(this.viewer.action){
      const action=this.viewer.action,mixer=this.viewer.mixer;
      const finished=()=>{
        const runtime=this.runtime.snapshot();
        if(runtime.state==='running'&&runtime.durationSeconds>0&&runtime.elapsed<runtime.durationSeconds-.001)return;
        mixer.removeEventListener('finished',finished);
        if(this.viewer.action===action||!this.viewer.motionEntry)this.finish();
      };
      mixer.addEventListener('finished',finished);
    }
  }
  async play(resource) {
    if(resource.kind==='vehicle')return this.playVehicle(resource);
    this.vehicleParts.hide();
    if(resource.kind==='ability')return this.playAbility(resource);
    if(resource.kind==='expression') {
      const row=resource.expression;if(row.status!=='ready'||!row.url)throw new Error('此表情图片尚未发布');
      this.clearExpression();this.bubble.src=row.url;this.bubble.alt=resource.name;this.bubble.hidden=false;
      if(row.animation)this.gif.play(row.animation);this.lifetime.start(row.keepTime??3);return;
    }
    if(resource.multiAction?.runtimeStatus==='ready')return this.playMulti(resource);
    if(resource.multiAction)throw new Error(resource.multiAction.runtimeStatus==='pending'?'此双人动作的配对预览尚未接入':'此双人动作的角色资源或编排尚未就绪');
    if(resource.delivery?.status==='partial')throw new Error('动作所需附件尚未完整发布，已阻止仅播放角色片段');
    if(!resource.motion||resource.delivery?.status==='blocked')throw new Error(resource.type==='玩具'?'玩具条目已接入；此玩具的特效/交互预览尚未由迁移层发布':'动作条目已接入；对应动作片段尚未发布');
    if(this.mappingError)throw new Error(this.mappingError);
    this.clearAbility();this.viewer.clearMultiMotion?.();await this.wardrobe.restore();
    const actor=this.wardrobe.actor,desc=await json(`/data/models/${resolveModel(actor.variant,actor.role)}.json`);
    if(!desc.dependencies?.some(dep=>dep.path===sharedPath()))throw new Error('当前角色不支持通用社交动作，请切换兼容角色');
    const rows=this.withExtraMotionRows(applyAnimationResourceMap(this.catalog,this.maps.items[String(actor.item.itemId)]));
    resolveMotionEntries(resource.motion,rows);
    this.request++;this.playing=false;
    await this.viewer.playMotionItem(resource.motion,rows,this.catalog.path);
    this.playing=true;this.viewer.setMotionSpeed(Number(document.querySelector('#playback-speed').textContent.replace('×',''))||1);
    const canLoop=resource.motion.rule.anim_type===2 || sourceMotionRepeats(resource.motion.rule);
    this.loopButton.disabled=!canLoop;this.loopButton.setAttribute('aria-pressed',String(canLoop&&this.loop));this.lastTime=null;
    if(this.viewer.action){
      if(canLoop&&!this.loop)this.viewer.action.setLoop(LoopOnce,Infinity);
      const action=this.viewer.action,mixer=this.viewer.mixer;
      const finished=()=>{mixer.removeEventListener('finished',finished);if(this.viewer.action===action||!this.viewer.motionEntry)this.finish();};
      mixer.addEventListener('finished',finished);
    }
    // Successful source defaults and atlas wiring are audit information, not errors.
    const warnings=(this.viewer.motionExtraWarnings||[]).filter(w=>
      !w.startsWith('使用源 Surface 内置纹理：')&&
      w!=='源通道已适配；光照、皮下散射与边缘光仍为近似'&&
      w!=='nfx_wing_obj: original cube, vertex-view Fresnel and two source passes connected'&&
      w!=='color-object-vtxoffset: source channels connected; original scene lighting and half precision remain uncalibrated'&&
      w!=='ciyuanzhan: source refraction/color/emission channels connected; full original scene lighting and capture order remain uncalibrated'&&
      w!=='kqbs: original depth normals, dual MatCap masks and opacity connected; original scene lighting remains uncalibrated'&&
      w!=='djhdj02: original parallax, sparkle and material channels connected; original scene lighting remains uncalibrated'&&
      w!=='add-emissive: original color, ORM and border channels connected; original scene lighting remains uncalibrated'&&
      w!=='change-color-mix: original channels connected; full original scene lighting remains uncalibrated'&&
      w!=='standard_change_color_object_vtxoffset: source sequential color, emission and ordinary-model offset connected; foliage instances remain unsupported.'&&
      w!=='prop-metallica: source matcap/color/normal channels connected; custom probe and shadow inputs remain gated'&&
      w!=='prop-metallica: source matcap/color/normal/shadow channels connected; custom reflection probe remains gated'&&
      w!=='prop-metallica: source matcap/color/normal/shadow/custom reflection channels connected'&&
      w!=='crystal-ball: source parallax/detail normal, both Matcap branches, breathing and double-shadow emission connected; original scene lighting remains pending'&&
      w!=='standard_pet_emote 表情图集、野生眼色和发光公式已接入');
    if(warnings.length)this.message(warnings.join('；'),true);
    else if(resource.motion.sfxPath)this.message('动作已播放；关联音效/特效以已发布资源为准');
  }
}
