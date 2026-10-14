import {requestJSON,resolveAsset} from '../handoff/services.js';

import {voiceRows} from '../skin-voices.js';
import {chooseVoiceClip} from '../voice-random.js';
const labels=new Intl.DisplayNames(['zh-CN'],{type:'language'});
export class ResourceVoices {
  constructor(message,catalogs,onToggle){
    this.message=message;this.catalogs=catalogs;this.onToggle=onToggle;this.cache=new Map();this.recent=new Map();this.objectId=0;this.token=0;this.active=null;this.opened=false;
    this.audio=new Audio();this.audio.preload='none';this.audio.id='ui-voice-audio';this.audio.hidden=true;document.body.append(this.audio);
    this.panel=document.createElement('section');this.panel.id='ui-voice-panel';this.panel.className='ui-inline-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','角色语音');
    this.panel.innerHTML='<div class="ui-inline-heading"><button type="button" data-voice-back>返回</button><strong>角色语音</strong><select id="ui-voice-language" aria-label="语音语言"></select></div><div class="ui-inline-content ui-voice-list"></div>';
    document.querySelector('.resource-surface').append(this.panel);this.list=this.panel.querySelector('.ui-voice-list');this.language=this.panel.querySelector('select');
    for(const row of catalogs){const option=document.createElement('option');option.value=row.url;option.textContent=labels.of(row.language)||row.language;this.language.append(option);}
    this.language.onchange=()=>{this.stop();this.loadRows();};this.panel.querySelector('[data-voice-back]').onclick=()=>this.close();
    for(const event of ['play','pause','ended','timeupdate','loadedmetadata','durationchange'])this.audio.addEventListener(event,()=>this.update());
    this.audio.addEventListener('error',()=>{if(this.audio.hasAttribute('src'))this.message('语音资源播放失败',true);this.update();});
    this.list.onclick=event=>{const button=event.target.closest('[data-voice-id]');if(button&&!button.disabled)this.play(button.dataset.voiceId);};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
  }
  modelChanged(item){this.stop();this.objectId++;this.skin=item?.businessCategoryId==='skin'?item:null;if(this.opened)this.loadRows();}
  async open(){
    if(!this.skin){this.message('请先选择角色',true);return;}
    document.dispatchEvent(new CustomEvent('appearance:panel-open',{detail:'voice'}));this.opened=true;this.panel.hidden=false;document.body.dataset.resourcePanel='voice';this.onToggle();await this.loadRows();
  }
  close(){this.opened=false;this.panel.hidden=true;this.stop();if(document.body.dataset.resourcePanel==='voice')delete document.body.dataset.resourcePanel;this.onToggle();}
  async loadRows(){
    const token=++this.token,skin=this.skin,url=this.language.value;this.list.textContent='读取语音…';
    try{
      if(!url)throw new Error('尚未发布语音目录');
      if(!this.cache.has(url))this.cache.set(url,requestJSON(url).then(async response=>{if(!response.ok)throw new Error('当前语言语音目录未发布');return response.json();}));
      const data=await this.cache.get(url);if(token!==this.token||skin!==this.skin||!this.opened)return;
      this.data=data;this.list.replaceChildren();
      for(const row of voiceRows(data,skin.itemId)){
        const button=document.createElement('button');button.className='ui-voice-pill';button.type='button';button.dataset.voiceId=String(row.id);button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',row.label);
        button.disabled=!['ready','ready-random'].includes(row.status);
        button.innerHTML='<span class="ui-voice-play"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="voice-ring-base" cx="20" cy="20" r="17"/><circle class="voice-ring-progress" cx="20" cy="20" r="17" pathLength="100"/><path class="voice-play-icon" d="M16 12 L29 20 L16 28 Z"/><path class="voice-pause-icon" d="M16 12 V28 M24 12 V28"/></svg></span><span class="ui-voice-label"></span><small></small>';
        button.querySelector('.ui-voice-label').textContent=row.label;button.querySelector('small').textContent=button.disabled?'资源待补':row.status==='ready-random'?`${row.clips.length}段`: `${row.duration.toFixed(1)}s`;
        button.title=row.text || row.label;this.list.append(button);
      }
      if(!this.list.children.length)this.list.textContent='当前角色没有此语言的已配置语音';
    }catch(error){if(token===this.token){this.cache.delete(url);this.list.textContent=error.message;}}
  }
  async play(id){
    const row=this.data?.voices[id];if(!['ready','ready-random'].includes(row?.status))return;
    const token=++this.token;
    if(this.active===id&&!this.audio.paused){this.audio.pause();return;}
    if(this.active!==id||this.audio.ended){
      this.audio.pause();this.active=id;let clip=row;
      if(row.status==='ready-random'){
        const key=this.language.value+':'+row.random.key+(row.random.scope==='global'?'':`:${this.objectId}`);
        const choice=chooseVoiceClip(row,this.recent.get(key)||[]);this.recent.set(key,choice.recent);clip=choice.clip;
      }
      this.audio.src=await resolveAsset(clip.url,{kind:'audio'})??clip.url;
    }
    try{await this.audio.play();}catch(error){if(token===this.token&&error.name!=='AbortError')this.message(`语音播放失败：${error.message}`,true);}
  }
  update(){
    for(const button of this.list.querySelectorAll('[data-voice-id]')){
      const active=button.dataset.voiceId===this.active,playing=active&&!this.audio.paused&&!this.audio.ended;
      button.setAttribute('aria-pressed',String(playing));
      const progress=active&&Number.isFinite(this.audio.duration)&&this.audio.duration>0?Math.min(1,this.audio.currentTime/this.audio.duration):0;
      button.style.setProperty('--voice-progress',String(progress*100));
    }
  }
  stop(){this.token++;this.active=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.update();}
}
