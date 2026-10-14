const up=new URL('./assets/向上展开.svg',import.meta.url).href;
const down=new URL('./assets/向下展开.svg',import.meta.url).href;
export function mountControls(actions) {
  document.querySelector('[data-preview-toggle]')?.remove();
  document.querySelectorAll('.canvas-action').forEach(button=>button.remove());
  const rail=document.createElement('div');rail.className='ui-action-rail';document.querySelector('.canvas-area').append(rail);
  let expanded=false,category='角色';
  rail.setAttribute('aria-label','皮肤控件');
  const labels={restore:'恢复',clear:'清空',resources:'信息',mode:'装扮',avatar:'形象',save:'保存',voice:'语音',offset:'偏移'};
  const hints={restore:'恢复当前保存的搭配',clear:'重置为默认角色并卸下所有穿搭',resources:'资源信息',mode:'切换装扮 / 单品预览',avatar:'打开焕新屋',save:'保存当前搭配到本地',voice:'打开 / 关闭角色语音',offset:'调整当前配饰的预览偏移'};
  function render() {
    rail.replaceChildren();
    const accessory=['头饰','面饰','腰饰','背包'].includes(category);
    rail.hidden=!['角色','发型','上装','下装','搭配','头饰','面饰','腰饰','背包'].includes(category);
    const list=accessory?['restore','clear','resources','mode','avatar','save','voice','offset']:['restore','clear','resources','avatar','save','voice'];
    const expand=document.createElement('button');expand.className='canvas-action ui-action-expand';expand.title=expanded?'收起':'展开';expand.setAttribute('aria-label',expand.title);expand.setAttribute('aria-expanded',String(expanded));
    const image=new Image();image.src=expanded?down:up;image.alt='';expand.append(image);expand.onclick=()=>{expanded=!expanded;render();};rail.append(expand);
    list.forEach((key,index)=>{
      const button=document.createElement('button');button.className='canvas-action';button.dataset.action=key;button.textContent=labels[key];button.title=hints[key];button.hidden=!expanded&&index<list.length-3;
      if(key==='resources')button.setAttribute('aria-label','资源信息');
      if(key==='mode'){
        const outfit=document.body.dataset.previewMode!=='单品';
        button.textContent=outfit?'装扮':'单品';button.setAttribute('aria-pressed',String(outfit));
        button.title=`当前：${button.textContent} · 切换为${outfit?'单品':'装扮'}`;
      }
      if(key==='voice')button.setAttribute('aria-pressed',String(document.body.dataset.resourcePanel==='voice'));
      button.onclick=async()=>{await actions[key]?.();render();};rail.append(button);
    });
  }
  const panel=document.querySelector('#dye-panel');
  const syncDye=()=>rail.classList.toggle('ui-dye-obscured',!panel.hidden&&panel.dataset.level==='full');
  new MutationObserver(syncDye).observe(panel,{attributes:true,attributeFilter:['hidden','data-level']});
  const expandResources=document.createElement('button');expandResources.id='ui-resource-expand';expandResources.className='canvas-action';expandResources.title='向左展开资源';expandResources.setAttribute('aria-label',expandResources.title);expandResources.setAttribute('aria-expanded','false');
  const image=new Image();image.src=up;image.alt='';expandResources.append(image);document.querySelector('.resource-surface').prepend(expandResources);
  const layout=document.querySelector('.page-layout'),scroll=document.querySelector('#resource-scroll'),grid=document.querySelector('#resource-grid');
  function measureCards() {
    // Measure the fixed collapsed layout; viewport size only changes expanded column count.
    // Restore synchronously before paint; this also works while an inline panel hides the list.
    const expanded=layout.classList.contains('ui-resources-expanded'),style=scroll.getAttribute('style');
    const probe=document.createElement('div');probe.className='resource-grid';
    try {
      layout.classList.remove('ui-resources-expanded');scroll.style.setProperty('display','block','important');
      probe.style.cssText=`position:fixed;visibility:hidden;pointer-events:none;width:${grid.getBoundingClientRect().width}px`;
      document.body.append(probe);
      const computed=getComputedStyle(probe),width=parseFloat(computed.gridTemplateColumns);
      if(width>0){
        const padding=parseFloat(computed.paddingLeft)+parseFloat(computed.paddingRight),lookWidth=probe.getBoundingClientRect().width-padding;
        layout.style.setProperty('--ui-card-width',`${width}px`);layout.style.setProperty('--ui-look-width',`${lookWidth}px`);
        // Use complete columns below the expansion limit; no empty trailing track.
        const look=category==='搭配',cardWidth=look?lookWidth:width,gap=look?18:parseFloat(computed.columnGap);
        const surfaceStyle=getComputedStyle(document.querySelector('.resource-surface'));
        const inset=padding+parseFloat(surfaceStyle.paddingLeft)+parseFloat(surfaceStyle.paddingRight);
        const collapsedWidth=document.querySelector('.resource-surface').getBoundingClientRect().width;
        const limit=Math.min(Math.max(collapsedWidth,window.innerWidth*.75),layout.clientWidth-50);
        const columns=Math.max(1,Math.floor((limit-inset+gap)/(cardWidth+gap)));
        layout.style.setProperty('--ui-expanded-columns',String(columns));
        layout.style.setProperty('--ui-expanded-width',`${columns*(cardWidth+gap)-gap+inset}px`);
      }
    } finally {
      probe.remove();if(style===null)scroll.removeAttribute('style');else scroll.setAttribute('style',style);
      layout.classList.toggle('ui-resources-expanded',expanded);
    }
  }
  expandResources.onclick=()=>{measureCards();const expanded=layout.classList.toggle('ui-resources-expanded');expandResources.setAttribute('aria-expanded',String(expanded));expandResources.title=expanded?'收起资源':'向左展开资源';expandResources.setAttribute('aria-label',expandResources.title);document.dispatchEvent(new Event('appearance:resize'));};
  window.addEventListener('resize',()=>{if(layout.classList.contains('ui-resources-expanded'))measureCards();});
  document.querySelectorAll('[data-category]').forEach(button=>{button.title=button.dataset.category;button.setAttribute('aria-label',button.dataset.category);});
  render();syncDye();
  return {category(value){category=value;expanded=false;render();syncDye();if(layout.classList.contains('ui-resources-expanded'))measureCards();},render};
}
