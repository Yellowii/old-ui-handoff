// Generated from the independent appearance template.
﻿import {appearance} from './main.js';
const categoryApiMap = Object.fromEntries(['角色','头饰','面饰','腰饰','背包','发型','上装','下装','动作','表情','玩具','载具','社交组合','搭配','场景','其他','管理'].map(name => [name, true]));

const state = { // 中文注释：页面逻辑与状态处理
  category: "角色", // 中文注释：页面逻辑与状态处理
  search: "", // 中文注释：页面逻辑与状态处理
  quality: "all", // 中文注释：页面逻辑与状态处理
  sort: "quality", // 中文注释：页面逻辑与状态处理
  offset: 0, // 中文注释：页面逻辑与状态处理
  pageSize: 18, // 每批加载十八张资源卡，保证三列布局首屏即可滚动
}; // 中文注释：页面逻辑与状态处理

const qualityLevels = ["基础", "高级", "稀有", "典藏", "至臻"]; // 中文注释：页面逻辑与状态处理
const qualityRank = Object.fromEntries( // 中文注释：页面逻辑与状态处理
  qualityLevels.map((quality, index) => [quality, index]), // 中文注释：页面逻辑与状态处理
); // 中文注释：页面逻辑与状态处理
const favoriteResources = new Set(); // 中文注释：页面逻辑与状态处理
let selectedResourceName = ""; // 中文注释：页面逻辑与状态处理
let selectedDyeResource = null; // 当前选中的可染色资源
let selectedDyeIndex = null; // 保存当前染色方案，展开或收起时保持选中状态
// 染色来自选中资产的真实 variants，不生成随机染色。

const seedIndexMap = {}; // 中文注释：页面逻辑与状态处理
Object.keys(categoryApiMap).forEach((category) => { // 中文注释：页面逻辑与状态处理
  seedIndexMap[category] = 0; // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

const grid = document.querySelector("#resource-grid"); // 中文注释：页面逻辑与状态处理
const scrollBox = document.querySelector("#resource-scroll"); // 中文注释：页面逻辑与状态处理
const emptyState = document.querySelector("#empty-state"); // 中文注释：页面逻辑与状态处理
let isLoadingMore = false; // 中文注释：页面逻辑与状态处理

function generateBatchResources() {
  return appearance.resources(state.category, state.search, state.quality, state.sort, favoriteResources);
}

function renderResourceList(resourceList, replace = false) {
  if (replace) grid.replaceChildren();
  emptyState.hidden = Boolean(resourceList.length || grid.children.length);
  emptyState.textContent = appearance.emptyMessage(state.category);
  for (const resource of resourceList) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'resource-card item';
    card.dataset.id = resource.id; card.dataset.quality = resource.quality;
    card.dataset.dyeGroup = resource.dyeGroup;
    const runtimeRow = resource.multiAction;
    const reasonCodes = runtimeRow?.reasons || (resource.delivery?.reason ? [resource.delivery.reason] : []);
    if (runtimeRow?.runtimeStatus) card.dataset.runtimeStatus = runtimeRow.runtimeStatus;
    if (resource.delivery?.status) card.dataset.deliveryStatus = resource.delivery.status;
    if (reasonCodes.length) card.dataset.runtimeReasons = reasonCodes.join('|');
    card.setAttribute('aria-label', resource.name);
    const imageHost = document.createElement('span'); imageHost.className = 'item-image';
    if (resource.source) {const image = new Image(); image.src = resource.source; image.alt = resource.name; image.loading = 'lazy'; imageHost.append(image);}
    if (!resource.source || !resource.item.available) {const placeholder = document.createElement('span'); placeholder.className = 'ui-thumbnail-state'; placeholder.textContent = resource.item.available ? '载入缩略图' : (resource.item.unavailableLabel || '资源待补'); imageHost.append(placeholder);}
    const name = document.createElement('div'); name.className = 'resource-name'; name.textContent = resource.name;
    card.append(imageHost, name);
    const container=appearance.decorateCard(card,resource);
    card.title = resource.name + ' · ' + resource.item.itemId + (reasonCodes.length ? ' · ' + reasonCodes.join('、') : '');
    card.classList.toggle('is-selected', appearance.selected?.id === resource.id);
    card.setAttribute('aria-pressed', String(appearance.selected?.id === resource.id));
    card.addEventListener('click', async () => {
      if (!await appearance.select(resource)) return;
      syncSelection();
    });
    grid.append(container);
  }
  appearance.observe(grid);
}

function getVisibleBatch() {
  return generateBatchResources().slice(state.offset, state.offset + state.pageSize);
}

function resetResourceList() {
  state.offset=0;grid.replaceChildren();scrollBox.scrollTop=0;loadMore();syncSelection();
}

async function loadMore() {
  if (isLoadingMore || !appearance.loaded) return;
  if (state.offset >= generateBatchResources().length) {
    if (!grid.children.length) renderResourceList([]);
    return;
  }
  isLoadingMore = true;
  renderResourceList(getVisibleBatch());
  state.offset += state.pageSize;
  isLoadingMore = false;
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (scrollBox.scrollHeight <= scrollBox.clientHeight) loadMore();
}

function switchCategory(newCategory) { // 中文注释：页面逻辑与状态处理
  state.category = categoryApiMap[newCategory] ? newCategory : "角色";
  appearance.category(state.category);
  state.quality="all";syncQualityOptions(); // 中文注释：页面逻辑与状态处理
  resetResourceList(); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

const dyeToggle = document.querySelector("#dye-toggle"); // 获取染色入口按钮
const dyePanel = document.querySelector("#dye-panel"); // 获取染色方案面板
const dyeGrid = document.querySelector("#dye-grid"); // 获取染色缩略图网格
const dyeExpand = document.querySelector("#dye-expand"); // 获取展开收起按钮
const dyeScroll = document.querySelector("#dye-scroll"); // 获取染色方案滚动区域
// Default-slot thumbnails are rendered from the actual default variant. // 获取初始染色按钮缩略图
const dyeReturn = document.querySelector("#dye-return"); // 获取返回 SVG 所在按钮

function resetDyeState(){
  dyePanel.hidden=true;dyePanel.dataset.level='compact';dyePanel.classList.remove('ui-basic-dyes','ui-dongdong-slots');
  dyeToggle.hidden=true;dyeToggle.disabled=true;dyeToggle.classList.remove('is-selected');
  dyeToggle.removeAttribute('aria-expanded');dyeToggle.setAttribute('aria-pressed','false');
  dyeGrid.replaceChildren();dyeExpand.hidden=true;dyeReturn.hidden=true;
  const changeFashion=document.querySelector('#ui-change-fashion');if(changeFashion)changeFashion.hidden=true;delete dyePanel.dataset.wardrobeClosed;
}

function renderDyeSwatches(level) {
  if (!selectedDyeResource) return;
  const item=selectedDyeResource.item,variants=item.variants,base=appearance.defaultVariant(item);
  const visible=variants.filter(variant=>variant.id!==base?.id);
  dyeGrid.replaceChildren();
  const thumb=document.createElement('span');thumb.className='ui-default-dye-thumb';
  const defaultImage=new Image();defaultImage.alt='默认染色';
  const defaultSource=appearance.variantThumbnail(item,base)||selectedDyeResource.source;
  if(defaultSource)defaultImage.src=defaultSource;else defaultImage.hidden=true;
  thumb.append(defaultImage);dyeToggle.replaceChildren(thumb);appearance.observeVariant(thumb,item,base);
  dyeToggle.dataset.variantId=String(base.id);
  visible.forEach(variant => {
    const index=variants.indexOf(variant);
    const swatch = document.createElement('button'); swatch.type = 'button'; swatch.className = 'dye-swatch';
    swatch.dataset.index = String(index);swatch.dataset.variantId=String(variant.id);swatch.title = variant.name || String(variant.id);
    const image = new Image(); image.alt = variant.name || String(variant.id);
    const source=appearance.variantThumbnail(selectedDyeResource.item, variant) || selectedDyeResource.source;
    if(source)image.src=source;else image.hidden=true;
    swatch.append(image); appearance.observeVariant(swatch, selectedDyeResource.item, variant);
    swatch.addEventListener('click', async () => {
      const resource=selectedDyeResource;
      if (!await appearance.variant(variant)) return;
      if(selectedDyeResource!==resource)return;
      selectedDyeIndex = index;
      syncDyeSelection();
    });
    dyeGrid.append(swatch);
  });
  dyePanel.dataset.count=String(visible.length);
  dyePanel.classList.toggle('ui-basic-dyes',variants.length<=4);
  syncDyeSelection();
}
function syncDyeSelection(){
  for(const button of [dyeToggle,...dyeGrid.querySelectorAll('.dye-swatch')]){
    const active=Boolean(selectedDyeResource)&&button.dataset.variantId===String(appearance.selectedVariant?.id);
    button.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));
  }
}

function updateDyePanelForResource() {
  let changeFashion=document.querySelector('#ui-change-fashion');
  if(!changeFashion){
    changeFashion=document.createElement('button');changeFashion.id='ui-change-fashion';changeFashion.className='dye-swatch';changeFashion.type='button';changeFashion.title='换时装';changeFashion.setAttribute('aria-label','换时装');
    changeFashion.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m11 5-7 5 4 6 3-2v13h14V14l3 2 3-6-7-5c-1 5-9 5-10 0Z"/><path class="ui-fashion-arrow" d="M4 22h10l-3-3m3 8H4l3 3"/></svg>';
    dyeToggle.before(changeFashion);
  }
  changeFashion.hidden=true;dyeToggle.classList.remove('ui-dongdong-default');delete dyeToggle.dataset.fragmentThumbnail;delete dyeToggle.dataset.thumbnailState;

  const wardrobe=selectedDyeResource?.dyeGroup==='wardrobe';
  const sameWardrobe=wardrobe&&dyePanel.dataset.wardrobeId===selectedDyeResource.id;
  const expanded=sameWardrobe&&dyePanel.dataset.level==='full';
  if(!sameWardrobe)delete dyePanel.dataset.wardrobeClosed;
  dyePanel.dataset.wardrobeId=wardrobe?selectedDyeResource.id:'';
  dyePanel.classList.toggle('ui-dongdong-slots',wardrobe);
  dyePanel.setAttribute('aria-label',wardrobe?'DongDong服饰槽位':'染色方案');
  if(wardrobe){
    dyePanel.hidden=false;dyePanel.dataset.level=expanded?'full':'compact';dyePanel.dataset.count='4';dyePanel.classList.remove('ui-basic-dyes');
    dyeToggle.hidden=true;dyeToggle.disabled=true;dyeExpand.hidden=false;dyeExpand.disabled=false;dyeReturn.hidden=false;
    dyeReturn.title='返回并卸下所有穿戴';dyeReturn.setAttribute('aria-label',dyeReturn.title);
    dyeReturn.onclick=async()=>{if(await appearance.resetDongdong()){dyePanel.dataset.wardrobeClosed='true';updateDyePanelForResource();}};
    dyeExpand.title=expanded?'收起服饰':'展开服饰';dyeExpand.setAttribute('aria-label',dyeExpand.title);dyeExpand.setAttribute('aria-expanded',String(expanded));
    const scrollTop=expanded?dyeScroll.scrollTop:0;
    if(dyePanel.dataset.wardrobeClosed==='true'){
      dyePanel.hidden=true;dyeToggle.hidden=false;dyeToggle.disabled=true;dyeToggle.classList.add('ui-dongdong-default','is-selected');
      dyeToggle.title='当前角色默认外观';dyeToggle.setAttribute('aria-label',dyeToggle.title);dyeToggle.removeAttribute('aria-pressed');
      const image=new Image();image.alt='当前角色默认外观';if(selectedDyeResource.source)image.src=selectedDyeResource.source;
      dyeToggle.replaceChildren(image);appearance.observeDongdongDefault(dyeToggle);changeFashion.hidden=false;
      changeFashion.onclick=()=>{delete dyePanel.dataset.wardrobeClosed;dyePanel.dataset.level='compact';updateDyePanelForResource();};
      dyeGrid.replaceChildren();return;
    }
    appearance.renderDongdongSlots(dyeGrid,expanded);dyeScroll.scrollTop=scrollTop;
    dyeExpand.onclick=()=>{dyePanel.dataset.level=expanded?'compact':'full';updateDyePanelForResource();};return;
  }
  const enabled=Boolean(selectedDyeResource),basic=selectedDyeResource?.dyeGroup==='basic';
  dyePanel.hidden=!basic;dyePanel.dataset.level='compact';
  dyeToggle.hidden=!enabled;dyeToggle.disabled=!enabled;
  dyeToggle.removeAttribute('aria-expanded');dyeToggle.removeAttribute('aria-controls');
  dyeToggle.setAttribute('aria-label','默认染色');dyeToggle.title='默认染色';
  dyeExpand.hidden=true;dyeExpand.disabled=true;dyeReturn.hidden=true;
  if(enabled)renderDyeSwatches('compact');else {dyeGrid.replaceChildren();syncDyeSelection();}
}

dyeToggle.addEventListener('click',async()=>{
  const resource=selectedDyeResource;if(!resource||resource.dyeGroup==='wardrobe')return;
  const base=appearance.defaultVariant(resource.item);
  if(!await appearance.variant(base)||selectedDyeResource!==resource)return;
  selectedDyeIndex=resource.item.variants.indexOf(base);syncDyeSelection();
});

document.querySelectorAll(".left-menu-button").forEach((button) => // 中文注释：页面逻辑与状态处理
  button.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
    document // 中文注释：页面逻辑与状态处理
      .querySelectorAll(".left-menu-button") // 中文注释：页面逻辑与状态处理
      .forEach((item) => item.classList.toggle("is-active", item === button)); // 中文注释：页面逻辑与状态处理
    const targetMenu = document.querySelector(`[data-menu="${button.dataset.section}"]`); // 查找主分类对应的右侧菜单
    document.querySelectorAll(".right-menu").forEach((menu) => { // 遍历全部右侧菜单
      menu.hidden = menu !== targetMenu; // 只显示当前主分类对应的菜单
    }); // 结束右侧菜单显隐更新
    if (!targetMenu) {switchCategory(button.dataset.section === "scene" ? "场景" : button.dataset.section === "admin" ? "管理" : "其他");return;} // 没有配置右侧菜单时保留当前资源内容
    const defaultCategory = targetMenu.querySelector("[data-category]"); // 获取右侧菜单的默认分类
    targetMenu.querySelectorAll("[data-category]").forEach((item) => { // 遍历当前菜单分类按钮
      item.classList.toggle("is-active", item === defaultCategory); // 默认选中第一个分类
    }); // 结束默认选中状态更新
    switchCategory(defaultCategory.dataset.category); // 加载默认分类资源
  }), // 中文注释：页面逻辑与状态处理
); // 中文注释：页面逻辑与状态处理

// Preview mode lives in the requested accessory action rail.

document.querySelectorAll("[data-category]").forEach((button) => // 中文注释：页面逻辑与状态处理
  button.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
    document // 中文注释：页面逻辑与状态处理
      .querySelectorAll("[data-category]") // 中文注释：页面逻辑与状态处理
      .forEach((item) => item.classList.toggle("is-active", item === button)); // 中文注释：页面逻辑与状态处理
    switchCategory(button.dataset.category); // 中文注释：页面逻辑与状态处理
  }), // 中文注释：页面逻辑与状态处理
); // 中文注释：页面逻辑与状态处理

document // 中文注释：页面逻辑与状态处理
  .querySelector("#resource-search") // 中文注释：页面逻辑与状态处理
  .addEventListener("input", (event) => { // 中文注释：页面逻辑与状态处理
    state.search = event.target.value.trim(); // 中文注释：页面逻辑与状态处理
    resetResourceList(); // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理

function closeDropdown(control) { // 中文注释：页面逻辑与状态处理
  control.classList.remove("is-open"); // 中文注释：页面逻辑与状态处理
  control.querySelector(".dropdown-trigger").setAttribute("aria-expanded", "false"); // 中文注释：页面逻辑与状态处理
  control.querySelector(".dropdown-menu").hidden = true; // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

document.querySelectorAll(".dropdown-control").forEach((control) => { // 中文注释：页面逻辑与状态处理
  const trigger = control.querySelector(".dropdown-trigger"); // 中文注释：页面逻辑与状态处理
  const menu = control.querySelector(".dropdown-menu"); // 中文注释：页面逻辑与状态处理

  trigger.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
    const shouldOpen = !control.classList.contains("is-open"); // 中文注释：页面逻辑与状态处理
    document.querySelectorAll(".dropdown-control").forEach(closeDropdown); // 中文注释：页面逻辑与状态处理
    if (!shouldOpen) return; // 中文注释：页面逻辑与状态处理
    control.classList.add("is-open"); // 中文注释：页面逻辑与状态处理
    trigger.setAttribute("aria-expanded", "true"); // 中文注释：页面逻辑与状态处理
    menu.hidden = false; // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理

  menu.querySelectorAll("[data-value]").forEach((option) => { // 中文注释：页面逻辑与状态处理
    option.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
      menu.querySelectorAll("[data-value]").forEach((item) => { // 中文注释：页面逻辑与状态处理
        const isSelected = item === option; // 中文注释：页面逻辑与状态处理
        item.classList.toggle("is-selected", isSelected); // 中文注释：页面逻辑与状态处理
        item.setAttribute("aria-selected", String(isSelected)); // 中文注释：页面逻辑与状态处理
      }); // 中文注释：页面逻辑与状态处理
      control.querySelector("[data-dropdown-label]").textContent = // 中文注释：页面逻辑与状态处理
        option.dataset.label || option.textContent; // 中文注释：页面逻辑与状态处理
      if (control.dataset.dropdown === "filter") state.quality = option.dataset.value; // 中文注释：页面逻辑与状态处理
      if (control.dataset.dropdown === "sort") state.sort = option.dataset.value; // 中文注释：页面逻辑与状态处理
      closeDropdown(control); // 中文注释：页面逻辑与状态处理
      resetResourceList(); // 中文注释：页面逻辑与状态处理
    }); // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

document.addEventListener("click", (event) => { // 中文注释：页面逻辑与状态处理
  document.querySelectorAll(".dropdown-control.is-open").forEach((control) => { // 中文注释：页面逻辑与状态处理
    if (!control.contains(event.target)) closeDropdown(control); // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

document.addEventListener("keydown", (event) => { // 中文注释：页面逻辑与状态处理
  if (event.key === "Escape") { // 中文注释：页面逻辑与状态处理
    document.querySelectorAll(".dropdown-control.is-open").forEach(closeDropdown); // 中文注释：页面逻辑与状态处理
  } // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

document.querySelector("#favorite-toggle").addEventListener("change", (event) => { // 中文注释：页面逻辑与状态处理
  event.currentTarget.setAttribute("aria-checked", event.currentTarget.checked); // 中文注释：页面逻辑与状态处理
  if (!selectedResourceName) return; // 中文注释：页面逻辑与状态处理
  if (event.currentTarget.checked) favoriteResources.add(selectedResourceName); // 中文注释：页面逻辑与状态处理
  else favoriteResources.delete(selectedResourceName); // 中文注释：页面逻辑与状态处理
  appearance.favorite(selectedResourceName, event.currentTarget.checked);
  if (state.sort === "favorite") resetResourceList(); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

const zoomSlider = document.querySelector("#zoom"); // 中文注释：页面逻辑与状态处理
const zoomValue = document.querySelector("#zoom-label"); // 中文注释：页面逻辑与状态处理
zoomSlider.addEventListener("input", () => { // 中文注释：页面逻辑与状态处理
  appearance.zoom(Number(zoomSlider.value));
  const normalizedZoom = (Number(zoomSlider.value) + 1.699) / 4; // 中文注释：页面逻辑与状态处理
  zoomValue.textContent = `${(10 ** Number(zoomSlider.value)).toFixed(1)}×`; // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

// Playback is bound to the shared viewer in social-adapter.js.

function loadWhenNearBottom() { // 中文注释：页面逻辑与状态处理
  const remainingDistance = // 中文注释：页面逻辑与状态处理
    scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight; // 中文注释：页面逻辑与状态处理
  if (remainingDistance <= 120) loadMore(); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

scrollBox.addEventListener("scroll", loadWhenNearBottom); // 中文注释：页面逻辑与状态处理
const observer = new IntersectionObserver( // 中文注释：页面逻辑与状态处理
  ([entry]) => { // 中文注释：页面逻辑与状态处理
    if (entry.isIntersecting) loadMore(); // 中文注释：页面逻辑与状态处理
  }, // 中文注释：页面逻辑与状态处理
  { root: scrollBox, rootMargin: "180px 0px" }, // 中文注释：页面逻辑与状态处理
); // 中文注释：页面逻辑与状态处理
observer.observe(document.querySelector("#scroll-sentinel")); // 中文注释：页面逻辑与状态处理

function updateDynamicContainerShape(svg) { // 根据容器实际尺寸更新指定外框路径
  const container = svg.parentElement; // 获取外框所属的染色面板或资源容器
  const width = Math.max(60, container.clientWidth); // 读取容器宽度并保证固定缺口能够容纳
  const height = Math.max(76, container.clientHeight); // 读取容器高度并保证上下圆角能够容纳
  const rightCurveStart = width - 18; // 计算右侧固定十八像素圆角的起点
  const bottomCurveStart = height - 18; // 计算底部固定十八像素圆角的起点
  svg.setAttribute("viewBox", `-20 0 ${width + 20} ${height}`); // 扩大视口显示左侧负坐标，避免突出区域被 SVG 裁切
  const path = svg.querySelector("path"); // 获取需要更新的内联路径
  path.setAttribute("d", `M 40,0 H ${rightCurveStart} Q ${width},0 ${width},18 V ${bottomCurveStart} Q ${width},${height} ${rightCurveStart},${height} H 18 Q 0,${height} 0,${bottomCurveStart} V 58 Q 0,40 -20,40 A 20,20 0 0 1 -20,0 H 40`); // 仅改变水平和垂直直线终点，固定保留原始曲线参数
} // 结束单个动态外框更新

const dynamicContainerShapes = document.querySelectorAll(".dynamic-container-shape"); // 获取全部动态容器外框
const dynamicContainerObserver = new ResizeObserver((entries) => { // 监听容器宽高变化
  entries.forEach((entry) => updateDynamicContainerShape(entry.target.querySelector(":scope > .dynamic-container-shape"))); // 尺寸变化时重算对应路径
}); // 结束容器尺寸监听器
dynamicContainerShapes.forEach((svg) => { // 初始化每一个动态容器外框
  updateDynamicContainerShape(svg); // 首次绘制当前容器路径
  dynamicContainerObserver.observe(svg.parentElement); // 监听外框所属容器的尺寸
}); // 结束动态外框初始化

await appearance.ready;
for (const name of appearance.favorites) favoriteResources.add(name);
document.querySelector('#selected-name').textContent = appearance.initialName;
loadMore();
function syncSelection() {
  selectedResourceName=appearance.selected?.name || '';
  selectedDyeResource=appearance.selected?.dyeGroup !== 'none' ? appearance.selected : null;
  selectedDyeIndex=selectedDyeResource?.item.variants.findIndex(v=>v.id===appearance.selectedVariant?.id) ?? null;
  grid.querySelectorAll('.resource-card').forEach(card=>{const selected=card.dataset.id===appearance.selected?.id;card.classList.toggle('is-selected',selected);card.setAttribute('aria-pressed',String(selected));});
  updateDyePanelForResource();
  document.querySelector('#favorite-toggle').checked=favoriteResources.has(selectedResourceName);
}
function syncQualityOptions(){
  const control=document.querySelector('[data-dropdown="filter"]'),menu=control.querySelector('.dropdown-menu');
  menu.replaceChildren();control.querySelector('[data-dropdown-label]').textContent='筛选';
  for(const option of [{value:'all',label:'全部'},...appearance.qualityOptions(state.category)]){
    const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.textContent=option.label;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===state.quality));
    button.onclick=()=>{state.quality=option.value;control.querySelector('[data-dropdown-label]').textContent=option.label;menu.querySelectorAll('button').forEach(row=>{row.setAttribute('aria-selected',String(row===button));row.classList.toggle('is-selected',row===button);});closeDropdown(control);resetResourceList();};menu.append(button);
  }
}
syncSelection();
document.addEventListener('appearance:selection',syncSelection);
document.addEventListener('appearance:resources',resetResourceList);
document.addEventListener('appearance:resize',()=>requestAnimationFrame(loadWhenNearBottom));
