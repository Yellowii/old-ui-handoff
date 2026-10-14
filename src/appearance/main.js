// Data/render adapter for the independent appearance UI. UI layout and control handlers live in demo.js.
import './style.css';
import {SessionViewer} from './session-viewer.js';
import {hasDongdongSlots,renderDongdongSlots} from './dongdong-slots.js';
import {FragmentThumbnails} from './fragment-thumbnails.js';
import {mountAvatarPage} from './avatar-page.js';
import {writePlayOutfit,readPlayOutfit,resolvePlayOutfit} from '../play/outfit.js';
import {ModelThumbnails} from '../thumbnails.js';
import {mountAdminPanel} from './admin-panel.js';
import {AppearanceWardrobe, defaultVariant, resolveModel, wearBlock} from './wardrobe.js';
import {exactModelForRole, roleAvailability} from './model-role.js';
import {defaultActorEntry} from './default-actor.js';
import {requestJSON, getHandoffServices} from '../handoff/services.js';
const catalogExtras = getHandoffServices().catalogExtras;
import {AppearanceSocial} from './social-adapter.js';
import {PreviewScenes} from './scenes.js';
import {ResourceVoices} from './resource-voices.js';
import {renderLookCard} from './look-cards.js';
import {mountControls} from './controls.js';
import {fitThumbnail} from './thumbnail-fit.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const categoryIds = {角色:'skin', 头饰:'headwear', 面饰:'facewear', 腰饰:'waistwear', 背包:'backwear', 发型:'hair', 上装:'upper', 下装:'lower'};
// These are Demo display buckets, not proof of the client's quality naming.
const qualityNames = ['基础','高级','稀有','典藏','至臻'];
document.body.dataset.uiSection='skin';
const stored = (key, fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const save = (key, value) => {try{localStorage.setItem(key, JSON.stringify(value));}catch{/* Session still works without storage. */}};
const favorites = stored('neox23.demo.favorites', []);
const usage = stored('neox23.demo.usage', {});

// The Demo remains the entry; resource details and avatar editing use separate UI surfaces.
const host = document.createElement('div'); host.className = 'ui-viewport'; host.id = 'appearance-viewport';
document.body.prepend(host);
const notice = document.createElement('button'); notice.id = 'ui-notice'; notice.type = 'button'; notice.hidden = true; notice.setAttribute('role','status');
document.body.append(notice);
const details = document.createElement('dialog'); details.className = 'ui-details'; details.id = 'ui-details';
details.innerHTML = '<div class="ui-dialog-head"><h2></h2><button data-close>关闭</button></div><div class="ui-dialog-body"></div>';
document.body.append(details);
details.querySelector('[data-close]').onclick = () => details.close();
function openDetails(title, html) {
  details.querySelector('h2').textContent = title;
  details.querySelector('.ui-dialog-body').innerHTML = html;
  if (!details.open) details.showModal();
}
let noticeTimer, noticeVersion = 0;
function message(text, error = false) {
  noticeVersion++;
  clearTimeout(noticeTimer); notice.textContent = text; notice.hidden = false;
  notice.classList.toggle('is-error', error); notice.title = text;
  if (!error) noticeTimer = setTimeout(() => {notice.hidden = true;}, 5000);
}
notice.onclick = () => openResourceInfo();
const originalIcons = new Map([...document.querySelectorAll('.right-menu-button')].map(button => [button, button.querySelector('img')?.getAttribute('src')]));
let viewer, wardrobe, thumbnails, variantThumbnails, initialEntry, selectedVariant, role = 'preview';
let busy = false, items = [], selected = null, loaded = false, lastError = '';
let sequence = 0;
let activeCategory='角色',social,scenes,voices,controls;
let categoryVersion=0,restorePreviewPending=false;
const selections=new Map();
const savedLooks=stored('neox23.demo.looks',[]);
let currentLookId=stored('neox23.demo.current-look',null);
if(!savedLooks.some(look=>look.id===currentLookId))currentLookId=savedLooks[0]?.id || null;
const savedSocial=stored('neox23.demo.social-combinations',[]);
const info=$('.canvas-info');
const infoHeading=document.createElement('div');infoHeading.className='ui-info-heading';infoHeading.append(...info.childNodes);info.append(infoHeading);
for(const id of ['description','tags']){const line=document.createElement('div');line.id=`ui-${id}`;info.append(line);}
const thumbnailsById = new Map();
const fragmentThumbnails=new FragmentThumbnails(()=>busy);
const avatarPage=mountAvatarPage({onResize:()=>frameCamera()});
function frameCamera() {
  if (!viewer) return;
  const width = host.clientWidth, height = host.clientHeight;
  const area = (avatarPage.opened?$('.ui-avatar-preview'):$('.canvas-area')).getBoundingClientRect();
  // Shift the projection, not the actor or the UI. Orbit/zoom remain centered on the actor.
  const scale=avatarPage.opened?Math.min(1,area.height/(height*.8),area.width/(height*.65)):1;
  viewer.camera.setViewOffset(width,height,width/2-(area.left+area.width/2)/scale,height/2-(area.top+area.height/2)/scale,width/scale,height/scale);
}
class DemoThumbnails extends ModelThumbnails {
  async apply(target, url) {
    url=await fitThumbnail(url);
    const matching=[target,...document.querySelectorAll('.item')].filter(node=>node.dataset.id===target.dataset.id);
    for(const node of new Set(matching)){super.apply(node,url);node.querySelector('.ui-thumbnail-state')?.remove();}
    thumbnailsById.set(target.dataset.id, url);
    for(const {resource} of selections.values())if(resource.id===target.dataset.id)resource.source=url;
    updateMenuThumbnail();
    if (selected?.id === target.dataset.id) {
      selected.source = url;
      document.dispatchEvent(new Event('appearance:thumbnail'));
    }
    if(target.dataset.menuThumbnail)target.remove();
  }
}
try {
  viewer = new SessionViewer(host, stats => {
    $('#zoom').value = Math.log10(stats.distance);
    $('#zoom-label').textContent = `${stats.distance.toFixed(1)}×`;
  });
  // Full-screen 3D replaces the temporary baked-character JPEG only.
  viewer.scene.background.set('#31556f');
  viewer.grid.visible = false;
  wardrobe = new AppearanceWardrobe(viewer);
  thumbnails = new DemoThumbnails(() => busy, {transparentBackground:true});
  variantThumbnails = new DemoThumbnails(() => busy, {transparentBackground:true});
  new ResizeObserver(frameCamera).observe($('.canvas-area'));
  window.addEventListener('resize', frameCamera);
  frameCamera();
} catch (error) {message(`三维预览不可用：${error.message}`, true);}
function updateMenuThumbnail() {
  for (const [button, source] of originalIcons) {
    const resource=button.dataset.category==='搭配'?null:selections.get(button.dataset.category)?.resource;
    const active = Boolean(resource);
    const image = button.querySelector('img');
    button.classList.toggle('has-asset', active);
    button.dataset.selectedAsset = resource?.id || '';
    button.querySelector('.ui-menu-missing')?.remove();
    if (image) {image.src = resource?.source || source; image.alt = resource?.name || button.dataset.category;}
    if (active && !resource.source) {
      const state = document.createElement('span'); state.className = 'ui-menu-missing'; state.textContent = resource.item.available ? '载入' : '待补'; button.append(state);
    }
  }
}
function entry() {return {item:selected.item, variant:selectedVariant, role};}
function updateInfo(customName) {
  const resource=selected,item=resource?.item || wardrobe?.actor?.item,meta=catalogExtras.metadata[String(item?.itemId)] || {};
  $('#selected-name').textContent=customName || resource?.name || wardrobe?.actor?.item.name || '初始角色';
  const description=meta.description || '';
  $('#ui-description').textContent=description && !description.startsWith('MULTI_') ? description : description?'描述：译文待接入':'描述：暂无';
  $('#ui-description').title=description;
  const tags=[resource?.type || '角色',...(meta.tags||[]).map(tag=>`标签 ${tag}`),...(meta.subTags||[]).map(tag=>`分类 ${tag}`)];
  $('#ui-tags').textContent=`标签：${tags.join(' · ')}`;$('#ui-tags').title=tags.join(' · ');
}
const menuThumbnailTargets=new Map();
function ensureMenuThumbnails() {
  if(!thumbnails)return;
  for(const {resource} of selections.values()) {
    if((resource.kind&&resource.kind!=='vehicle')||resource.source||!resource.item.available||thumbnails.failed.has(resource.id))continue;
    let target=menuThumbnailTargets.get(resource.id);
    if(!target?.isConnected){target=document.createElement('div');target.hidden=true;target.dataset.id=resource.id;target.dataset.menuThumbnail='true';target.setAttribute('aria-label',resource.name);target.innerHTML='<span class="item-image"></span>';document.body.append(target);menuThumbnailTargets.set(resource.id,target);}
    const cached=thumbnails.cache.get(resource.id);
    if(cached)thumbnails.apply(target,cached);
    else thumbnails.pending.set(resource.id,{item:resource.item,target});
  }
  thumbnails.pump();
}
function notifySelection(){updateMenuThumbnail();updateInfo();ensureMenuThumbnails();document.dispatchEvent(new Event('appearance:selection'));}
async function operation(action, success) {
  if (busy || !wardrobe) return false;
  busy = true; document.body.dataset.modelBusy = 'true';
  const token = ++sequence;
  const previousNotice = noticeVersion;
  try {
    await action(); lastError = '';
    frameCamera();
    if (success) message(success);
    else if (noticeVersion === previousNotice) {clearTimeout(noticeTimer);notice.hidden=true;}
    return true;
  } catch (error) {lastError = error.message; message(error.message, true); return false;}
  finally {
    if (token === sequence) {
      busy = false; document.body.dataset.modelBusy = 'false';
      controls?.render();
      // A tab can change while a single-item model is loading. Restore only
      // after that operation finishes so its late result cannot replace the outfit.
      if(restorePreviewPending)void operation(restoreCategoryPreview);
    }
  }
}
async function restoreCategoryPreview() {
  restorePreviewPending=false;
  await wardrobe.restore();
  voices?.modelChanged(wardrobe.actor.item);
}
function makeResource(item) {
  const type = Object.keys(categoryIds).find(key => categoryIds[key] === item.businessCategoryId);
  return {id:item.id, name:item.name, item, type, source:item.thumbnail || thumbnailsById.get(item.id) || '',
    quality:qualityNames[Math.min(Number(item.quality) || 0, 4)],
    // Basic color buttons use the published variants. DongDong's larger cards
    // are clothing slots, not an expanded variant list; their mapping is pending.
    dyeGroup:hasDongdongSlots(item)?'wardrobe':item.variants.length>1 && item.variants.length<=4?'basic':'none'};
}
async function showCurrent(resource=selected,variant=selectedVariant) {
  const current={item:resource.item,variant,role};
  const single=document.body.dataset.previewMode==='单品' && resource.item.businessCategoryId!=='skin';
  if (single || wearBlock(resource.item)) {
    await wardrobe.preview(current);
    if (wearBlock(resource.item)) message(wearBlock(resource.item), true);
  } else {
    await wardrobe.wear(current);
    if(resource.item.businessCategoryId==='skin')for(const category of ['发型','上装','下装'])selections.delete(category);
    else if(resource.item.partAssemblyRoles?.length)selections.delete('角色');
  }
}
async function reset() {
  const ok = await operation(async () => {
    social?.stop(false);social?.clearExpression();wardrobe.clear();
    await wardrobe.wear(initialEntry);for(const [category]of selections)if(category!=='场景')selections.delete(category);selected = null; selectedVariant = null;
    document.body.dataset.previewMode = '装扮';
    voices?.modelChanged(initialEntry.item);notifySelection();
  }, '已清空外观，恢复初始角色');
  return ok;
}
async function deselect(resource) {
  return operation(async()=>{
    if(resource.kind==='scene')scenes.reset();
    else if(resource.kind==='expression')social.clearExpression();
    else if(resource.kind==='motion'||resource.kind==='ability'||resource.kind==='combination')await social.stop();
    else if(resource.kind==='vehicle'){await social.stop(false);await wardrobe.restore();}
    else if(resource.kind==='look'){
      let restoreActor=false;
      for(const [key,saved]of selections)if(saved.owner===resource.id){
        if(saved.resource.item.businessCategoryId==='skin')restoreActor=true;else await wardrobe.remove(saved.resource.item.equipSlot);
        selections.delete(key);
      }
      if(restoreActor){await wardrobe.wear(initialEntry);voices.modelChanged(initialEntry.item);}else await wardrobe.restore();
    }
    else if(resource.item.businessCategoryId==='skin'){social.stop(false);await wardrobe.wear(initialEntry);voices.modelChanged(initialEntry.item);}
    else {await wardrobe.remove(resource.item.equipSlot);if(wardrobe.mode==='single')await wardrobe.restore();}
    selections.delete(resource.type);selected=null;selectedVariant=null;notifySelection();
  });
}

const admin=mountAdminPanel();
function showOutfit() {
  const parts=Object.entries(wardrobe?.actor?.fashionParts||{}).map(([slot,id])=>`<button data-remove="${slot}">${esc(wardrobe.fashionCatalog?.parts[id]?.name||id)} · 卸下</button>`).join('');
  openDetails('当前形象', `<p>${wardrobe?.actor?.fashionParts?'分部服装':esc(wardrobe?.actor?.item.name || '尚未载入角色')}</p><div class="ui-outfit">${parts}${[...(wardrobe?.outfit || [])].map(([slot, e]) => `<button data-remove="${slot}">${esc(e.item.name)} · 卸下</button>`).join('') || (!parts?'<p>尚未穿戴配饰</p>':'')}</div><button data-reset>恢复初始角色</button>`);
}
let infoGeneration = 0;
async function openResourceInfo() {
  const token = ++infoGeneration;
  openDetails('资源信息', '<p>读取资源描述…</p>');
  const current = selected ? entry() : wardrobe?.actor || initialEntry;
  let descriptor = null, error = '';
  try {
    const id = current?.item?.businessCategoryId === 'skin'
      ? exactModelForRole(current.variant, current.role)
      : resolveModel(current?.variant, current?.role);
    if (id) {const r = await requestJSON(`/data/models/${encodeURIComponent(id)}.json`); if (!r.ok) throw new Error(`描述请求失败 ${r.status}`); descriptor = await r.json();}
  } catch (e) {error = e.message;}
  if (token !== infoGeneration || !details.open) return;
  const warnings = wardrobe?.warnings || [];
  const availability = current?.item?.businessCategoryId === 'skin' ? roleAvailability(current.variant) : {preview:true,runtime:true};
  details.querySelector('.ui-dialog-body').innerHTML = `<p>${esc(current?.item.name || '未选中资源')} · ${items.length} 件目录资源</p>
    <div class="ui-info-actions"><button data-outfit>当前穿戴</button><label>模型版本 <select id="ui-model-role" ${selected?.item.appearanceOnly?'disabled title="当前仅提供静态外观预览"':''}><option value="preview" ${role==='preview'?'selected':''} ${availability.preview?'':'disabled'}>高清展示${availability.preview?'':'（未发布）'}</option><option value="runtime" ${role==='runtime'?'selected':''} ${availability.runtime?'':'disabled'}>运行模型${availability.runtime?'':'（未发布）'}</option></select></label></div>
    <p>${esc(lastError || error)}</p>${warnings.length ? `<details open><summary>画面提示（${warnings.length}）</summary><ul>${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
    <details><summary>物品和模型依赖</summary><pre>${esc(JSON.stringify({item:current?.item, modelRole:role, descriptor}, null, 2))}</pre></details>
    <p class="ui-note">本地迁移资源目录，不代表账户持有；引用齐备不代表原版视觉验收。部分服装组合、账户与盲盒数据仍待接入。</p>`;
  $('#ui-model-role').onchange = async event => {
    const nextRole = event.target.value;
    const oldRole = role;
    role = nextRole;
    const ok = await operation(async () => {
      if (selected) await showCurrent(); else await wardrobe.wear({...initialEntry, role});
    }, '模型版本已更新');
    if (!ok) role = oldRole;
    await openResourceInfo();
  };
}
details.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-outfit')) showOutfit();
  if (button.hasAttribute('data-reset')) {if(await reset()) details.close();}
  if (button.dataset.remove && !busy) {
    if(!await operation(()=>wardrobe.remove(button.dataset.remove)))return;
    for(const [category,saved] of selections)if(saved.resource.item.equipSlot===button.dataset.remove)selections.delete(category);
    if(selected?.item.equipSlot===button.dataset.remove){selected=null;selectedVariant=null;}
    notifySelection();
    showOutfit();
  }
});
$('#fit').addEventListener('click', () => {viewer?.resetCamera();frameCamera();});
$('.brand-logo-link').addEventListener('click',event=>{
  event.preventDefault();if(busy||!wardrobe?.actor){message('请等待角色加载完成');return;}
  try{writePlayOutfit(wardrobe);location.assign('/play.html');}catch(error){message(`无法进入游玩：${error.message}`,true);}
});
$('#rotate').addEventListener('click', () => {if(viewer) {viewer.autoRotate = !viewer.autoRotate;$('#rotate').setAttribute('aria-pressed',String(viewer.autoRotate));}});
$('#screenshot').addEventListener('click', () => {if(viewer) {const link=document.createElement('a');link.download=`NeoX23-${selected?.item.itemId || initialEntry?.item.itemId}.png`;link.href=viewer.screenshot();link.click();}});
function saveLook() {
  if(busy || !wardrobe.actor)return;
  const entries=[wardrobe.actor,...wardrobe.outfit.values()].map(e=>({id:e.item.id,variantId:e.variant.id,role:e.role,...(e.fragmentParts?{fragmentParts:e.fragmentParts}:{}),...(e.fashionParts?{fashionParts:e.fashionParts}:{})}));
  const look={id:`look:${Date.now()}`,name:`${wardrobe.actor.item.name} · 搭配 ${savedLooks.length+1}`,entries,source:selections.get('角色')?.resource.source || ''};
  savedLooks.unshift(look);savedLooks.splice(20);save('neox23.demo.looks',savedLooks);setCurrentLook(look);
  // Saving a new draft must not leave an older look highlighted as its active card.
  selections.delete('搭配');if(activeCategory==='搭配'){selected=null;selectedVariant=null;}notifySelection();
  message('搭配已保存到本地');document.dispatchEvent(new Event('appearance:resources'));
}
function setCurrentLook(look){currentLookId=look.id;save('neox23.demo.current-look',currentLookId);}
const lookResource=look=>({...look,type:'搭配',kind:'look',quality:'基础',dyeGroup:'none',item:{itemId:look.id,available:true,variants:[]}});
function isCustomResource(resource){
  return (resource.kind==='look'&&savedLooks.some(row=>row.id===resource.id))
    ||(resource.kind==='combination'&&savedSocial.some(row=>row.id===resource.id))
    ||(resource.kind==='scene'&&scenes.saved.some(row=>row.id===resource.id));
}
async function deleteCustomResource(resource){
  if(!isCustomResource(resource))return;
  return operation(async()=>{
    if(resource.kind==='scene')await scenes.remove(resource.id);
    else {
      const records=resource.kind==='look'?savedLooks:savedSocial;
      const remaining=records.filter(row=>row.id!==resource.id);
      // Do not remove the visible card if writing the local cache fails.
      localStorage.setItem(resource.kind==='look'?'neox23.demo.looks':'neox23.demo.social-combinations',JSON.stringify(remaining));
      records.splice(0,records.length,...remaining);
      if(resource.kind==='look'&&currentLookId===resource.id){
        currentLookId=savedLooks[0]?.id||null;save('neox23.demo.current-look',currentLookId);
      }
    }
    // Deleting a saved recipe does not unequip its currently previewed contents.
    if(selections.get(resource.type)?.resource.id===resource.id)selections.delete(resource.type);
    for(const saved of selections.values())if(saved.owner===resource.id)delete saved.owner;
    if(selected?.id===resource.id){selected=null;selectedVariant=null;}
    notifySelection();document.dispatchEvent(new Event('appearance:resources'));
  },'已删除本地配置');
}
async function applyLook(look) {
  // Resolve all saved references before replacing the current draft. Never
  // substitute a different dye when the saved variant is no longer published.
  const entries=look.entries.map(saved=>{
    const item=saved.id===initialEntry.item.id?initialEntry.item:items.find(item=>item.id===saved.id),variant=item?.variants.find(v=>v.id===saved.variantId);
    const savedModel = item?.businessCategoryId === 'skin'
      ? exactModelForRole(variant, saved.role)
      : resolveModel(variant, saved.role);
    if(!item || !variant || !savedModel)throw new Error(`搭配资源已不可用：${saved.id} / ${saved.variantId}`);
    if(wearBlock(item))throw new Error(wearBlock(item));
    return {item,variant,role:saved.role,fragmentParts:saved.fragmentParts,fashionParts:saved.fashionParts};
  });
  if(entries[0]?.item.businessCategoryId!=='skin')throw new Error('搭配缺少角色配置');
  social.stop(false);social.clearExpression();wardrobe.clear();
  for(const [key]of selections)if(key!=='场景')selections.delete(key);
  document.body.dataset.previewMode='装扮';
  try {
    for(const entry of entries){await wardrobe.wear(entry);const resource=makeResource(entry.item);selections.set(resource.type,{resource,variant:entry.variant,owner:look.id});}
    selections.set('搭配',{resource:lookResource(look)});setCurrentLook(look);
  } finally {
    const saved=selections.get(activeCategory);selected=saved?.resource || null;selectedVariant=saved?.variant || null;
    voices.modelChanged(wardrobe.actor.item);notifySelection();
  }
}
async function restoreLook() {
  const look=savedLooks.find(look=>look.id===currentLookId);
  if(!look){message('暂无保存的搭配，请先保存当前穿搭');return false;}
  return operation(()=>applyLook(look),'已恢复当前保存的搭配');
}
function editOffset() {
  const obj=viewer.equipped.get(selected?.item.equipSlot);
  if(!obj){message('请在装扮模式下选择已穿戴的配饰',true);return;}
  obj.root.userData.uiOriginalPosition ||= obj.root.position.clone();
  const base=obj.root.userData.uiOriginalPosition;
  openDetails('配饰偏移',`<p>${esc(selected.name)} · 仅调整本次预览</p>${['x','y','z'].map(axis=>`<label class="ui-offset-row">${axis.toUpperCase()} <input data-offset="${axis}" type="range" min="-1" max="1" step="0.01" value="${obj.root.position[axis]-base[axis]}"><output>${(obj.root.position[axis]-base[axis]).toFixed(2)}</output></label>`).join('')}<button data-offset-reset>恢复偏移</button>`);
  details.querySelectorAll('[data-offset]').forEach(input=>input.oninput=()=>{obj.root.position[input.dataset.offset]=base[input.dataset.offset]+Number(input.value);input.nextElementSibling.textContent=Number(input.value).toFixed(2);});
  details.querySelector('[data-offset-reset]').onclick=()=>{obj.root.position.copy(base);details.querySelectorAll('[data-offset]').forEach(input=>{input.value=0;input.nextElementSibling.textContent='0.00';});};
}
if(viewer){
  const skipAnimation=$('#ui-skip-animation');
  social=new AppearanceSocial(viewer,wardrobe,message,catalogExtras.social,catalogExtras.metadata,{skipEntrance:()=>skipAnimation.checked,runOperation:operation});
  skipAnimation.onchange=()=>{if(skipAnimation.checked&&viewer.motionState().name==='appear_shop')void social.returnIdle();};
  scenes=new PreviewScenes(viewer,message,resource=>{selections.set('场景',{resource});if(activeCategory==='场景'){selected=resource;selectedVariant=null;}notifySelection();});
  wardrobe.onShow=async(entry,descriptor)=>{await social.modelChanged(entry,descriptor);scenes.fitGround();};
  voices=new ResourceVoices(message,catalogExtras.voiceCatalogs,()=>controls?.render());
  controls=mountControls({
    clear:reset,restore:restoreLook,resources:openResourceInfo,avatar:async()=>{if(await operation(()=>wardrobe.restore()))avatarPage.open();},save:saveLook,offset:editOffset,
    mode:async()=>{await appearance.mode(document.body.dataset.previewMode==='装扮'?'单品':'装扮');},
    voice:async()=>{if(voices.opened)voices.close();else await voices.open();},
  });
  document.addEventListener('appearance:panel-open',event=>{if(event.detail!=='scene')scenes.close();if(event.detail!=='voice'&&voices.opened)voices.close();if(event.detail!=='admin')admin.close();});
}
const socialSave=document.createElement('button');socialSave.className='ui-social-save';socialSave.textContent='保存动作 + 表情组合';socialSave.hidden=true;
$('.resource-surface').append(socialSave);
socialSave.onclick=()=>{
  const action=selections.get('动作')?.resource,expression=selections.get('表情')?.resource;
  if(!action||!expression){message('请先分别选择一个动作和一个表情',true);return;}
  if(!action.item.available||!expression.item.available){message('请选择已发布的动作和表情',true);return;}
  savedSocial.unshift({id:`combination:${Date.now()}`,name:`${action.name} + ${expression.name}`,entries:[action.id,expression.id],source:expression.source});savedSocial.splice(20);save('neox23.demo.social-combinations',savedSocial);document.dispatchEvent(new Event('appearance:resources'));message('社交组合已保存到本地');
};

export const appearance = {
  async resetDongdong(){
    if(busy||!wardrobe?.fragmentConfig())return false;
    const ok=await operation(async()=>{
      await wardrobe.changeFragments({});wardrobe.clear();
      for(const [category]of selections)if(['头饰','面饰','腰饰','背包','发型','上装','下装','搭配'].includes(category))selections.delete(category);
    });
    notifySelection();return ok;
  },
  observeDongdongDefault(target){
    if(!wardrobe?.fragmentConfig())return;
    fragmentThumbnails.observe(target,{catalog:wardrobe.fragmentCatalog,entry:wardrobe.actor,suitId:wardrobe.fragmentConfig().default_fragment_suit_id});
  },
  renderDongdongSlots(grid,expanded=false){
    const matches=selected?.item.id===wardrobe?.actor?.item.id;
    renderDongdongSlots(grid,{
      config:matches?wardrobe?.fragmentConfig():null,selection:wardrobe?.actor?.fragmentParts||{},
      effectiveParts:viewer?.actor?.userData.fragmentAssembly?.parts||[],expanded,busy,
      onThumbnail:(target,ids)=>fragmentThumbnails.observe(target,{catalog:wardrobe.fragmentCatalog,entry:wardrobe.actor,...ids}),
      onSelect:async parts=>{
        if(busy)return;
        grid.querySelectorAll('button').forEach(button=>button.disabled=true);
        await operation(()=>wardrobe.changeFragments(parts));notifySelection();
      },
    });
  },
  get loaded(){return loaded;}, get selected(){return selected;},
  get selectedVariant(){return selectedVariant;},
  get initialName(){return initialEntry?.item.name || '初始角色';},
  get displayName(){return selected?.name || wardrobe?.shown?.item.name || this.initialName;},
  favorites:Array.isArray(favorites)?favorites:[],
  ready:null,
  resources(category, query, quality, sort, favoriteNames) {
    const id = categoryIds[category];
    let results = id?items.filter(item => item.businessCategoryId === id).map(makeResource):
      category==='场景'?scenes?.resources || []:
      category==='搭配'?savedLooks.map(lookResource):
      category==='社交组合'?savedSocial.map(combo=>({...combo,type:'社交组合',kind:'combination',quality:'基础',dyeGroup:'none',item:{itemId:combo.id,available:true,variants:[]}})):
      (social?.resources || []).filter(resource=>resource.type===category);
    const search = query.toLowerCase();
    results = results.filter(r => r.kind==='scene-add' || ((!search || `${r.name} ${r.item.itemId}`.toLowerCase().includes(search)) && (quality === 'all' || (id||category==='搭配'?r.quality===quality:String(r.item.quality??0)===quality))));
    return results.sort((a,b) => a.kind==='scene-add'?1:b.kind==='scene-add'?-1:sort === 'usage' ? (usage[b.id]||0)-(usage[a.id]||0) : sort === 'favorite' ? Number(favoriteNames.has(b.name))-Number(favoriteNames.has(a.name)) : (b.item.quality||0)-(a.item.quality||0));
  },
  emptyMessage(category) {return category==='载具'?'载具目录尚未由迁移层发布':category==='社交组合'?'先选择动作和表情，再保存为本地社交组合':category==='搭配'?'点击“保存”保留当前搭配':category==='其他'?'此分类目录待接入':'没有找到资源';},
  category(value){
    voices?.close();scenes?.close();admin.close();
    if(value!==activeCategory){
      categoryVersion++;
      if(document.body.dataset.previewMode==='单品'){
        document.body.dataset.previewMode='装扮';restorePreviewPending=true;
        if(!busy)void operation(restoreCategoryPreview);
      }
    }
    activeCategory=value;const saved=selections.get(value);selected=saved?.resource || null;selectedVariant=saved?.variant || null;
    controls?.category(value);socialSave.hidden=value!=='社交组合';document.body.dataset.uiCategory=value;
    document.body.dataset.uiSection=categoryIds[value]||value==='搭配'?'skin':value==='场景'?'scene':value==='管理'?'admin':value==='其他'?'other':'social';
    if(value==='管理')admin.open();notifySelection();
  },
  qualityOptions(category){return categoryIds[category]||category==='搭配'?qualityNames.map(name=>({value:name,label:name})):[...new Set((social?.resources||[]).filter(r=>r.type===category).map(r=>Number(r.item.quality)||0))].sort((a,b)=>a-b).map(id=>({value:String(id),label:`品质 ${id}`}));},
  decorateCard(card,resource){
    if(resource.item.renderBlock){card.disabled=true;card.querySelector('.item-image').textContent='特效待接入';}
    card.dataset.qualityId=String(resource.item.quality??0);
    // Combinations share the social thumbnail/title card, never the outfit slot layout.
    if(['动作','表情','玩具','载具','社交组合'].includes(resource.type))card.classList.add('ui-social-card');
    if(resource.kind==='look')card._lookItems=renderLookCard(card,resource,items,id=>thumbnailsById.get(id)||thumbnails?.cache.get(id));
    if(resource.kind==='scene-add'){card.classList.add('ui-add-scene');card.querySelector('.item-image').textContent='＋';}
    if(resource.kind!=='scene-add'){
      card.dataset.resourceName=resource.name;
      const badge=document.createElement('span');badge.className='ui-favorite-badge';badge.hidden=!this.favorites.includes(resource.name);badge.title='已收藏';badge.setAttribute('aria-label','已收藏');
      badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.4-9 12-9 12Z"/></svg>';card.append(badge);
    }
    if(isCustomResource(resource)){
      // Sibling buttons keep delete independently focusable without nesting buttons.
      const container=document.createElement('div');container.className='ui-custom-card';
      const remove=document.createElement('button');remove.type='button';remove.className='ui-card-delete';
      remove.title=`删除${resource.name}`;remove.setAttribute('aria-label',remove.title);
      remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
      remove.onclick=async()=>{remove.disabled=true;try{await deleteCustomResource(resource);}finally{remove.disabled=false;}};
      container.append(card,remove);return container;
    }
    return card;
  },
  observe(container) {
    const lookItems=[...container.querySelectorAll('.ui-look-card')].flatMap(card=>card._lookItems||[]);
    const vehicleItems=(social?.resources||[]).filter(resource=>resource.kind==='vehicle').map(resource=>resource.item);
    thumbnails?.observe(container, [...items.filter(item=>!item.renderBlock),...vehicleItems,...lookItems]);
    ensureMenuThumbnails();
    for(const img of container.querySelectorAll('.resource-card .item-image img[src]'))if(!img.dataset.fitted){img.dataset.fitted='true';const source=img.src;fitThumbnail(source).then(url=>{if(img.isConnected&&img.src===source)img.src=url;const id=img.closest('.item')?.dataset.id;thumbnailsById.set(id,url);for(const {resource}of selections.values())if(resource.id===id)resource.source=url;updateMenuThumbnail();});}
  },
  async select(resource) {
    if (busy) return false;
    if(resource.kind==='scene-add'){scenes.open();return true;}
    const stoppedPlayback=resource.kind==='motion'&&!social.playing;
    if (selections.get(resource.type)?.resource.id === resource.id&&!stoppedPlayback) return deselect(resource);
    resource.source ||= thumbnailsById.get(resource.id) || thumbnails?.cache.get(resource.id) || '';
    selected = resource; selectedVariant = defaultVariant(resource.item);
    selections.set(resource.type,{resource,variant:selectedVariant});notifySelection();
    usage[resource.id] = (usage[resource.id] || 0) + 1; save('neox23.demo.usage', usage);
    if(resource.kind){
      await operation(async()=>{
        if(resource.kind==='scene')await scenes.select(resource);
        else if(resource.kind==='look')await applyLook(resource);
        else if(resource.kind==='combination'){
          for(const id of resource.entries){const r=social.resources.find(r=>r.id===id);if(!r)throw new Error('组合引用的社交资源未发布');await social.play(r);selections.set(r.type,{resource:r});}
        }else await social.play(resource);
        notifySelection();
      });return true;
    }
    const selectedModel = selected?.item?.businessCategoryId === 'skin'
      ? exactModelForRole(selectedVariant, role)
      : resolveModel(selectedVariant, role);
    if (!selectedModel) {lastError='当前角色版本未发布，已保留当前形象；资源信息中可查看依赖';message(lastError,true);return true;}
    await operation(async () => {
      await showCurrent();
      if(resource.item.businessCategoryId==='skin')voices?.modelChanged(wardrobe.actor.item);
      resource.source ||= thumbnailsById.get(resource.id) || thumbnails?.cache.get(resource.id) || '';
      updateMenuThumbnail();
    });
    return true;
  },
  async mode(value) {
    if(busy)return;
    const version=categoryVersion;
    document.body.dataset.previewMode=value;
    const ok = await operation(async () => {
      if (value === '单品' && selected && !selected.kind) await wardrobe.preview(entry());
      else if (selected && !selected.kind) await showCurrent();
      else await wardrobe.restore();
    });
    if (!ok && version===categoryVersion) {
      const actual = wardrobe?.mode === 'single' ? '单品' : '装扮';
      document.body.dataset.previewMode = actual;
    }
  },
  async variant(value) {
    if (busy || !selected) return false;
    if(value.socketAssembly&&!value.socketAssembly.geometryReady){message('此配色的原资源尚未齐全，保留当前预览');return false;}
    const resource=selected,old = selectedVariant; selectedVariant = value;
    const ok = await operation(()=>resource.kind==='vehicle'?social.playVehicle(resource,value):showCurrent(resource,value)); if (!ok&&selected===resource) selectedVariant = old;
    if(ok){const saved=selections.get(resource.type);if(saved?.resource===resource)saved.variant=value;}
    return ok;
  },
  variantThumbnail(item, variant) {return variantThumbnails?.cache.get(`${item.id}@${variant.id}`);},
  defaultVariant(item){return defaultVariant(item);},
  observeVariant(target, item, variant) {
    target.classList.add('item'); target.dataset.id = `${item.id}@${variant.id}`;
    target.setAttribute('aria-label', variant.name || String(variant.id));
    const span = document.createElement('span'); span.className='item-image';
    span.append(...target.childNodes);target.append(span);
    const virtual = {...item, id:target.dataset.id, thumbnail:null, variants:[{...variant,isDefault:true}]};
    target._variantItem = virtual;
    // The Demo appends after this call; batch once after the swatch loop.
    queueMicrotask(() => {
      const panel = $('#dye-grid');
      const targets=[...panel.children,$('.ui-default-dye-thumb')].filter(Boolean);
      variantThumbnails?.observe($('.canvas-area'),targets.map(node=>node._variantItem).filter(Boolean));
    });
  },
  favorite(name, value) {if(!name)return;const set=new Set(this.favorites);value?set.add(name):set.delete(name);this.favorites=[...set];save('neox23.demo.favorites',this.favorites);for(const card of document.querySelectorAll('.resource-card')){const badge=card.querySelector('.ui-favorite-badge');if(badge)badge.hidden=!set.has(card.dataset.resourceName);}},
  zoom(value) {viewer?.setUserZoom(10**value);},
};
appearance.ready = (async () => {
  try {
    const r=await requestJSON('/data/wardrobe.json');if(!r.ok)throw new Error(`目录请求失败 ${r.status}`);
    const catalog=await r.json();if(!Array.isArray(catalog.items))throw new Error('资源目录格式错误');
    items=catalog.items;loaded=true;
    const {fixtureMode}=getHandoffServices();
    if(!fixtureMode){
      initialEntry=defaultActorEntry(await wardrobe.loadFashionParts(),role);
      await operation(()=>wardrobe.wear(initialEntry));voices?.modelChanged(initialEntry.item);updateInfo();
    }else message('无游戏资源演示：3D Runtime 与资产适配尚未连接，仅验证目录与交互层',true);
    if(!fixtureMode&&new URLSearchParams(location.search).get('from')==='play'){
      const snapshot=readPlayOutfit();
      if(snapshot)await operation(async()=>{
        for(const entry of resolvePlayOutfit(items,snapshot,'preview',initialEntry)){await wardrobe.wear(entry);if(entry.item.id===initialEntry.item.id)continue;const resource=makeResource(entry.item);selections.set(resource.type,{resource,variant:entry.variant});}
        const saved=selections.get(activeCategory);selected=saved?.resource||null;selectedVariant=saved?.variant||null;voices?.modelChanged(wardrobe.actor.item);notifySelection();
      });
    }
    if(!fixtureMode){
      try{await social?.load();await scenes?.load();}catch(error){message(`目录读取不完整：${error.message}`,true);}
    }
  }catch(error){message(`${error.message}；请检查资源服务`,true);}
})();
window.appearanceDiagnostics = () => ({wheelEffects:viewer?.wheelEffects()||[],vehicleSockets:viewer?.vehicleSocketState()||[],selected:selected?.id,variant:selectedVariant?.id,busy,actor:wardrobe?.actor?.item.id,mode:wardrobe?.mode,modelId:viewer?.actor?.userData.modelId,runtime:social?.runtime?.snapshot?.()||null,hoofModelEffects:viewer?.actor?.userData.sourceHoofModelEffects?{partial:viewer.actor.userData.sourceHoofModelEffects.partial,models:viewer.actor.userData.sourceHoofModelEffects.active.length,sprites:viewer.actor.userData.sourceHoofModelEffects.sprites.length,particles:viewer.actor.userData.sourceHoofModelEffects.particles.length,particleLive:viewer.actor.userData.sourceHoofModelEffects.particles.map(p=>p.node.liveCount),particleBirths:viewer.actor.userData.sourceHoofModelEffects.particles.map(p=>p.node.totalBirths),particleFinite:viewer.actor.userData.sourceHoofModelEffects.particles.every(p=>p.mesh.geometry.attributes.position.array.every(Number.isFinite)),trails:viewer.actor.userData.sourceHoofModelEffects.trails.length,trailRows:viewer.actor.userData.sourceHoofModelEffects.trails.map(t=>t.rows),trailFinite:viewer.actor.userData.sourceHoofModelEffects.trails.every(t=>t.mesh.geometry.attributes.position.array.every(Number.isFinite)),ignored:viewer.actor.userData.sourceHoofModelEffects.ignored,pending:viewer.actor.userData.sourceHoofModelEffects.pending,profile:viewer.actor.userData.sourceHoofModelEffects.profile,controllers:viewer.actor.userData.sourceHoofModelEffects.controllers,frames:viewer.actor.userData.sourceHoofModelEffects.frames,nodes:viewer.actor.userData.sourceHoofModelEffects.active.map(i=>({socket:i.socket,matrix:i.node.matrix.toArray(),parameters:i.node.userData.sourceHoofParameters}))}:null,fragmentAssembly:viewer?.actor?.userData.fragmentAssembly||null,fragmentParts:wardrobe?.actor?.fragmentParts||{},fashionParts:wardrobe?.actor?.fashionParts||null,companionCount:viewer?.companions?.size||0,motionExtraCount:viewer?.motionExtras?.length||0,refraction:viewer?.refraction?.target?{width:viewer.refraction.target.width,height:viewer.refraction.target.height,frames:viewer.refraction.frames}:null,multiMotion:viewer?.multiMotionState(),catalogCount:items.length,renderedSlots:[...(viewer?.equipped.keys()||[])],leafSprings:viewer?.leafSpringState()||[],nstb:viewer?.nstbState()||[],chainSprings:viewer?.chainSpringState()||[],spriteEffects:viewer?.spriteEffects()||[],headwearEffects:viewer?.headwearEffects()||[],headwearSpriteEffects:viewer?.headwearSpriteEffects()||[],headwearParticleEffects:viewer?.headwearParticleEffects()||[],fashionEffects:viewer?.fashionEffects()||[],outfit:[...(wardrobe?.outfit||[])].map(([slot,e])=>({slot,id:e.item.id})),error:lastError,cameraView:viewer?.camera.view,cameraZoom:viewer?.zoomFactor(),sessionZoom:viewer?.sessionZoom,cameraAzimuth:viewer?.controls.getAzimuthalAngle(),cameraPolar:viewer?.controls.getPolarAngle(),clearAlpha:viewer?.renderer.getClearAlpha(),thumbnailClearAlpha:thumbnails?.viewer?.renderer.getClearAlpha(),selections:[...selections].map(([category,s])=>({category,id:s.resource.id})),socialCount:social?.resources.length,motion:viewer?.motionState(),playingIdle:viewer?.playingIdle,idleName:viewer?.idleEntry?.name,sceneCount:scenes?.resources.length,groundVisible:Boolean(scenes?.ground.visible||scenes?.mirror?.visible),groundMirror:scenes?.mirror?{strength:scenes.mirror.material.uniforms.strength.value,blur:scenes.mirror.material.uniforms.blur.value,resolution:scenes.mirror.getRenderTarget().width,height:scenes.mirror.position.y}:null,cameraClip:{near:viewer?.camera.near,far:viewer?.camera.far},voiceOpen:voices?.opened,background:viewer?.scene.background?.isTexture?'texture':viewer?.scene.background?.getHexString()});
window.appearanceMotionExtraDiagnostics = () => viewer?.motionExtraState?.() || [];

