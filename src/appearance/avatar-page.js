import './avatar-page.css';

const face='<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32"/><path d="M26 35h2m24 0h2M35 49h10"/></svg>';
const body='<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M40 9v8m-2-8h4M19 49l-7 10 7 4 6-6m36-8 7 10-7 4-6-6M28 66v7h10v-7m4 0v7h10v-7"/><ellipse cx="40" cy="42" rx="23" ry="27"/><ellipse class="ui-avatar-face" cx="40" cy="39" rx="17" ry="18"/></svg>';

// Layout and navigation only. No placeholder options are applied to the model.
export function mountAvatarPage({onResize}){
 const page=document.createElement('section');page.className='ui-avatar-page';page.hidden=true;page.setAttribute('aria-label','焕新屋');
 page.innerHTML=`<header class="ui-avatar-heading"><button type="button" class="ui-avatar-back" aria-label="返回背包"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m18 8-9 8 9 8M10 16h16"/></svg></button><h1>焕新屋</h1></header>
 <div class="ui-avatar-preview" aria-label="当前形象预览"></div>
 <aside class="ui-avatar-actions" aria-label="动作预览"><button disabled title="预览动作待接入"><span>− −</span>眨眼</button><button disabled title="预览动作待接入"><span>Ⅱ</span>跳跃</button><button disabled title="预览动作待接入"><span>× ×</span>翻滚</button></aside>
 <section class="ui-avatar-card"><div class="ui-avatar-tabs" role="tablist" aria-label="形象编辑"><button id="ui-avatar-face-tab" role="tab" aria-selected="true" aria-controls="ui-avatar-face-panel">面部调整</button><button id="ui-avatar-color-tab" role="tab" aria-selected="false" tabindex="-1" aria-controls="ui-avatar-color-panel">外观换色</button></div>
 <div id="ui-avatar-face-panel" role="tabpanel" aria-labelledby="ui-avatar-face-tab"><div class="ui-avatar-options" aria-label="面部槽位"></div><div class="ui-avatar-colors"><h2>颜色</h2><div></div></div></div>
 <div id="ui-avatar-color-panel" role="tabpanel" aria-labelledby="ui-avatar-color-tab" hidden><div class="ui-avatar-options" aria-label="外观换色槽位"></div></div>
 <p class="ui-avatar-pending" role="status">面部与肤色资源待接入</p><footer class="ui-avatar-footer"><button disabled>还原</button><button disabled>更改</button></footer></section>`;
 for(const [index,panel]of [...page.querySelectorAll('[role=tabpanel]')].entries()){
  for(let slot=0;slot<12;slot++){const button=document.createElement('button');button.className='ui-avatar-option';button.disabled=true;button.title=index?'外观换色资源待接入':'面部资源待接入';button.setAttribute('aria-label',`${index?'外观换色':'面部'}预留槽位 ${slot+1}`);button.innerHTML=(index?body:face)+'<small>待接入</small>';panel.querySelector('.ui-avatar-options').append(button);}
 }
 for(let i=0;i<4;i++){const button=document.createElement('button');button.disabled=true;button.title='颜色配置待接入';button.setAttribute('aria-label',`颜色预留槽位 ${i+1}`);page.querySelector('.ui-avatar-colors>div').append(button);}
 const tabs=[...page.querySelectorAll('[role=tab]')];
 function choose(index){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;page.querySelector('#'+tab.getAttribute('aria-controls')).hidden=i!==index;});}
 tabs.forEach((tab,index)=>{tab.onclick=()=>choose(index);tab.onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-index;choose(next);tabs[next].focus();}};});
 document.body.append(page);let previousFocus;
 function close(){if(page.hidden)return;page.hidden=true;document.body.classList.remove('ui-avatar-open');document.querySelector('.page-layout').inert=false;document.querySelector('.status-bar').inert=false;onResize();if(previousFocus?.isConnected)previousFocus.focus();else document.querySelector('[data-action=avatar]')?.focus();}
 page.querySelector('.ui-avatar-back').onclick=close;
 document.addEventListener('keydown',event=>{if(!page.hidden&&event.key==='Escape'){event.preventDefault();close();}});
 return {get opened(){return !page.hidden;},open(){previousFocus=document.activeElement;page.hidden=false;document.body.classList.add('ui-avatar-open');document.querySelector('.page-layout').inert=true;document.querySelector('.status-bar').inert=true;choose(0);onResize();page.querySelector('.ui-avatar-back').focus();},close};
}
