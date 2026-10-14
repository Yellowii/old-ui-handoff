import {mountAdminStatus} from '../admin-status.js';

// Rehost the existing renderer and its handlers. Keep the shared audit module,
// request schema, paging, refresh and search unchanged for the migration page.
export function mountAdminPanel() {
  const trigger=document.createElement('button');
  const audit=mountAdminStatus({trigger});
  const dialog=document.querySelector('#admin-status-dialog');
  const body=dialog.querySelector('.admin-body'),content=body.querySelector('.admin-content');
  const panel=document.createElement('section');panel.id='ui-admin-panel';panel.className='ui-inline-panel ui-admin-panel';panel.hidden=true;
  panel.setAttribute('aria-label','管理功能');
  const tabs=document.createElement('div');tabs.className='ui-admin-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','管理功能');
  let active='overview';
  const groups=new Map([
    ['资源树','resources'],['材质分派覆盖','audit'],['缺口与检验范围','audit'],['审计状态与证据边界','audit'],
    ['快照来源','handoff'],['当前交接','handoff'],['本次基线','handoff'],
  ]);
  function filter() {
    for(const section of content.children){
      const heading=section.querySelector('h3');
      section.hidden=Boolean(heading&&(groups.get(heading.textContent)||'overview')!==active);
    }
  }
  for(const [id,label]of [['overview','概览'],['resources','资源树'],['audit','审计'],['handoff','交接']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.id=`ui-admin-tab-${id}`;button.dataset.adminTab=id;button.setAttribute('role','tab');button.setAttribute('aria-controls','ui-admin-content');
    button.setAttribute('aria-selected',String(id===active));
    button.onclick=()=>{
      active=id;for(const tab of tabs.children)tab.setAttribute('aria-selected',String(tab===button));
      content.setAttribute('aria-labelledby',button.id);body.scrollTop=0;filter();
    };
    tabs.append(button);
  }
  content.id='ui-admin-content';content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby','ui-admin-tab-overview');
  panel.append(tabs,body);document.querySelector('.resource-surface').append(panel);
  new MutationObserver(filter).observe(content,{childList:true});
  return {
    open(){
      document.dispatchEvent(new CustomEvent('appearance:panel-open',{detail:'admin'}));
      panel.hidden=false;document.body.dataset.resourcePanel='admin';
      if(!content.children.length)content.textContent='读取管理员快照…';
      void audit.load();
    },
    close(){panel.hidden=true;if(document.body.dataset.resourcePanel==='admin')delete document.body.dataset.resourcePanel;},
  };
}
