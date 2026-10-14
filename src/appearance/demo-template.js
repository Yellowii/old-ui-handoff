// 分类与对应的 DiceBear 风格映射，所有接口使用透明背景
const categoryApiMap = { // 中文注释：页面逻辑与状态处理
  角色: "https://api.dicebear.com/10.x/voxel-art/svg?backgroundColor=", // 中文注释：页面逻辑与状态处理
  头饰: "https://api.dicebear.com/10.x/slice/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  面饰: "https://api.dicebear.com/10.x/clay/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  腰饰: "https://api.dicebear.com/10.x/planets/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  背包: "https://api.dicebear.com/10.x/stack/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  发型: "https://api.dicebear.com/10.x/thumbs/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  上装: "https://api.dicebear.com/10.x/critters/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  下装: "https://api.dicebear.com/10.x/sprouts/svg?backgroundColor=&seed=", // 中文注释：页面逻辑与状态处理
  动作: "https://api.dicebear.com/10.x/adventurer/svg?backgroundColor=&seed=", // 动作分类资源图
  表情: "https://api.dicebear.com/10.x/fun-emoji/svg?backgroundColor=&seed=", // 表情分类资源图
  玩具: "https://api.dicebear.com/10.x/bottts/svg?backgroundColor=&seed=", // 玩具分类资源图
  载具: "https://api.dicebear.com/10.x/shapes/svg?backgroundColor=&seed=", // 载具分类资源图
  社交组合: "https://api.dicebear.com/10.x/icons/svg?backgroundColor=&seed=", // 社交组合分类资源图
}; // 中文注释：页面逻辑与状态处理

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
const dyePalette = [ // 36 种染色模板颜色
  ["9ec9e8", "12293a", "37718e"], ["d9bd94", "4a3018", "8a6a3c"], ["f4b6c2", "56213d", "c84f7b"], ["b5e8c7", "174d42", "339989"], ["f7d794", "5c3d22", "c58b3f"], ["c7ceea", "28315c", "5967b8"], ["f3e5d0", "4b2d2a", "a85d53"], ["b8d8e8", "1e4057", "357da1"], ["e5c1f2", "3c1d54", "965ac2"], ["f8c8a0", "6d2e1f", "d77745"], ["c9e4a6", "315523", "6c9f45"], ["f0d6b4", "563b2b", "a67b58"], // 中文注释：页面逻辑与状态处理
  ["a7d8de", "173e48", "328a98"], ["f6b1c1", "5e2038", "d65b7e"], ["d8c7a5", "453a26", "9b7f4d"], ["b7c9f0", "243760", "5278c9"], ["f4d58d", "60451f", "c2943f"], ["d0f0e0", "20513c", "54a579"], ["e6b8b8", "542727", "b85c5c"], ["c6d4f5", "27335b", "6079c7"], ["efd2a4", "5b3d1b", "bd8640"], ["b8e0d2", "1e5545", "4caa88"], ["edc4e8", "4c2454", "aa67a9"], ["f5e2c8", "684529", "c28e66"], // 中文注释：页面逻辑与状态处理
  ["abd7eb", "1b415e", "438db8"], ["f3c2ae", "63291e", "c86b4b"], ["d5e8b6", "3f5a20", "82a854"], ["bfc5d9", "2c3147", "68759e"], ["f7c4d6", "5b1d3b", "c45580"], ["ddcfad", "4d3d2b", "aa8d60"], ["b9e2f2", "19465a", "3e93bb"], ["e8c3f1", "452256", "9b5ebc"], ["f6d8aa", "603d1e", "c1884b"], ["c5e6c9", "28533b", "62a278"], ["e9b9b9", "552525", "b65b5b"], ["c3d3f2", "28365e", "627bc2"], // 中文注释：页面逻辑与状态处理
]; // 中文注释：页面逻辑与状态处理
const basicDyePalette = dyePalette.slice(0, 3); // 四至六号资源使用前三种基础模板

const seedIndexMap = {}; // 中文注释：页面逻辑与状态处理
Object.keys(categoryApiMap).forEach((category) => { // 中文注释：页面逻辑与状态处理
  seedIndexMap[category] = 0; // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

const grid = document.querySelector("#resource-grid"); // 中文注释：页面逻辑与状态处理
const scrollBox = document.querySelector("#resource-scroll"); // 中文注释：页面逻辑与状态处理
const emptyState = document.querySelector("#empty-state"); // 中文注释：页面逻辑与状态处理
let isLoadingMore = false; // 中文注释：页面逻辑与状态处理

function generateBatchResources() { // 中文注释：页面逻辑与状态处理
  const currentCategory = state.category; // 中文注释：页面逻辑与状态处理
  const baseUrl = categoryApiMap[currentCategory] || categoryApiMap.角色; // 中文注释：页面逻辑与状态处理
  const startSeed = seedIndexMap[currentCategory] ?? 0; // 中文注释：页面逻辑与状态处理
  const batch = []; // 中文注释：页面逻辑与状态处理

  for (let index = 0; index < state.pageSize; index += 1) { // 中文注释：页面逻辑与状态处理
    const seedNumber = startSeed + index; // 中文注释：页面逻辑与状态处理
    const seed = `${currentCategory}_${seedNumber}`; // 中文注释：页面逻辑与状态处理
    const separator = baseUrl.endsWith("seed=") ? "" : "&seed="; // 中文注释：页面逻辑与状态处理
    const fullUrl = `${baseUrl}${separator}${encodeURIComponent(seed)}`; // 中文注释：页面逻辑与状态处理
    batch.push({ // 中文注释：页面逻辑与状态处理
      name: `${currentCategory}${seedNumber + 1}`, // 中文注释：页面逻辑与状态处理
      type: currentCategory, // 中文注释：页面逻辑与状态处理
      source: fullUrl, // 中文注释：页面逻辑与状态处理
      quality: qualityLevels[seedNumber % qualityLevels.length], // 中文注释：页面逻辑与状态处理
      usage: (seedNumber * 37 + currentCategory.length * 11) % 100, // 中文注释：页面逻辑与状态处理
      dyeGroup: seedNumber < 3 ? "full" : seedNumber < 6 ? "basic" : "none", // 前三种 36 套，四至六种 3 套
    }); // 中文注释：页面逻辑与状态处理
  } // 中文注释：页面逻辑与状态处理

  seedIndexMap[currentCategory] = startSeed + state.pageSize; // 中文注释：页面逻辑与状态处理
  return batch; // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

function renderResourceList(resourceList, replace = false) { // 中文注释：页面逻辑与状态处理
  if (replace) grid.replaceChildren(); // 中文注释：页面逻辑与状态处理

  if (!resourceList.length && !grid.children.length) { // 中文注释：页面逻辑与状态处理
    emptyState.hidden = false; // 中文注释：页面逻辑与状态处理
    return; // 中文注释：页面逻辑与状态处理
  } // 中文注释：页面逻辑与状态处理

  emptyState.hidden = true; // 中文注释：页面逻辑与状态处理
  const fragment = document.createDocumentFragment(); // 中文注释：页面逻辑与状态处理

  resourceList.forEach(({ name, type, source, quality, dyeGroup }) => { // 中文注释：页面逻辑与状态处理
    const card = document.createElement("button"); // 中文注释：页面逻辑与状态处理
    card.type = "button"; // 中文注释：页面逻辑与状态处理
    card.className = "resource-card"; // 中文注释：页面逻辑与状态处理
    card.dataset.quality = quality; // 中文注释：页面逻辑与状态处理
    card.dataset.dyeGroup = dyeGroup; // 记录当前资源对应的染色方案数量
    card.innerHTML = `<img src="${source}" alt="${name}" loading="lazy"><div class="resource-name">${name}</div>`; // 中文注释：页面逻辑与状态处理
    card.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
      document // 中文注释：页面逻辑与状态处理
        .querySelectorAll(".resource-card") // 中文注释：页面逻辑与状态处理
        .forEach((item) => item.classList.remove("is-selected")); // 中文注释：页面逻辑与状态处理
      card.classList.add("is-selected"); // 中文注释：页面逻辑与状态处理
      selectedResourceName = name; // 中文注释：页面逻辑与状态处理
      selectedDyeResource = dyeGroup === "none" ? null : { name, source, dyeGroup }; // 保存当前可染色资源
      selectedDyeIndex = null; // 切换资源时清除旧染色方案选择
      updateDyePanelForResource(); // 更新染色入口状态
      document.querySelector("#selected-name").textContent = name; // 中文注释：页面逻辑与状态处理
      document.querySelector("#favorite-toggle").checked = favoriteResources.has(name); // 中文注释：页面逻辑与状态处理
    }); // 中文注释：页面逻辑与状态处理
    fragment.append(card); // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理

  grid.append(fragment); // 中文注释：页面逻辑与状态处理
  if (!selectedResourceName && resourceList.length) { // 首次加载时默认选中第一张资源卡
    const firstResource = resourceList[0]; // 获取首张资源
    selectedResourceName = firstResource.name; // 同步当前资源名称
    selectedDyeResource = firstResource.dyeGroup === "none" ? null : { name: firstResource.name, source: firstResource.source, dyeGroup: firstResource.dyeGroup }; // 同步染色资源
    selectedDyeIndex = null; // 首次加载时尚未选择染色方案
    updateDyePanelForResource(); // 显示默认染色缩略图
  } // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

function getVisibleBatch() { // 中文注释：页面逻辑与状态处理
  const batch = generateBatchResources(); // 中文注释：页面逻辑与状态处理
  const filtered = batch.filter(({ name, quality }) => { // 中文注释：页面逻辑与状态处理
    const matchesSearch = !state.search || name.includes(state.search); // 中文注释：页面逻辑与状态处理
    const matchesQuality = state.quality === "all" || quality === state.quality; // 中文注释：页面逻辑与状态处理
    return matchesSearch && matchesQuality; // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理

  return filtered.sort((first, second) => { // 中文注释：页面逻辑与状态处理
    if (state.sort === "usage") return second.usage - first.usage; // 中文注释：页面逻辑与状态处理
    if (state.sort === "favorite") { // 中文注释：页面逻辑与状态处理
      return Number(favoriteResources.has(second.name)) - Number(favoriteResources.has(first.name)); // 中文注释：页面逻辑与状态处理
    } // 中文注释：页面逻辑与状态处理
    return qualityRank[second.quality] - qualityRank[first.quality]; // 中文注释：页面逻辑与状态处理
  }); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

function resetResourceList() { // 中文注释：页面逻辑与状态处理
  resetDyeState(); // 重置资源层级时同步清空染色子层级
  selectedResourceName = ""; // 清除旧资源卡片选择
  selectedDyeResource = null; // 清除旧资源染色数据
  selectedDyeIndex = null; // 清除旧染色方案选择
  document.querySelector("#selected-name").textContent = "DongDong"; // 恢复默认资源名称
  document.querySelector("#favorite-toggle").checked = false; // 清除旧资源收藏状态
  seedIndexMap[state.category] = 0; // 中文注释：页面逻辑与状态处理
  state.offset = 0; // 中文注释：页面逻辑与状态处理
  grid.replaceChildren(); // 中文注释：页面逻辑与状态处理
  scrollBox.scrollTop = 0; // 中文注释：页面逻辑与状态处理
  loadMore(); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

async function loadMore() { // 中文注释：页面逻辑与状态处理
  if (isLoadingMore) return; // 中文注释：页面逻辑与状态处理
  isLoadingMore = true; // 中文注释：页面逻辑与状态处理

  await new Promise((resolve) => setTimeout(resolve, 120)); // 中文注释：页面逻辑与状态处理
  renderResourceList(getVisibleBatch()); // 中文注释：页面逻辑与状态处理
  state.offset += state.pageSize; // 中文注释：页面逻辑与状态处理
  isLoadingMore = false; // 中文注释：页面逻辑与状态处理
  await new Promise((resolve) => requestAnimationFrame(resolve)); // 等待新资源卡完成布局后再测量滚动高度
  if (!state.search && scrollBox.scrollHeight <= scrollBox.clientHeight) loadMore(); // 内容不足一屏时继续补载，保证资源区域可以滚动
} // 中文注释：页面逻辑与状态处理

function switchCategory(newCategory) { // 中文注释：页面逻辑与状态处理
  state.category = categoryApiMap[newCategory] ? newCategory : "角色"; // 中文注释：页面逻辑与状态处理
  resetResourceList(); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

const dyeToggle = document.querySelector("#dye-toggle"); // 获取染色入口按钮
const dyePanel = document.querySelector("#dye-panel"); // 获取染色方案面板
const dyeGrid = document.querySelector("#dye-grid"); // 获取染色缩略图网格
const dyeExpand = document.querySelector("#dye-expand"); // 获取展开收起按钮
const dyeScroll = document.querySelector("#dye-scroll"); // 获取染色方案滚动区域
const dyePreview = document.querySelector("#dye-preview"); // 获取初始染色按钮缩略图
const dyeReturn = document.querySelector("#dye-return"); // 获取返回 SVG 所在按钮

function resetDyeState() { // 统一重置资源卡片以下的染色层级
  dyePanel.hidden = true; // 隐藏染色面板
  dyePanel.dataset.level = "compact"; // 恢复一级染色层级
  dyePanel.dataset.count = "0"; // 清除旧染色方案数量
  dyeToggle.hidden = false; // 恢复染色入口显示
  dyeToggle.disabled = true; // 在新资源选中前禁用染色入口
  dyeToggle.setAttribute("aria-expanded", "false"); // 重置入口展开状态
  dyeToggle.setAttribute("aria-label", "当前资源无染色方案"); // 更新入口无障碍提示
  dyePreview.src = ""; // 清除旧资源预览图
  dyeGrid.replaceChildren(); // 清除旧染色按钮
  dyeExpand.hidden = true; // 隐藏旧展开按钮
  dyeExpand.disabled = true; // 禁用旧展开按钮
  dyeExpand.setAttribute("aria-label", "展开全部染色方案"); // 恢复展开按钮提示
  dyeReturn.hidden = true; // 隐藏旧返回按钮
  dyeScroll.scrollTop = 0; // 重置染色滚动位置
} // 中文注释：页面逻辑与状态处理

function buildDyeUrl(source, colors) { // 根据模板颜色构造染色缩略图地址
  const url = new URL(source); // 解析当前资源 URL
  url.searchParams.set("skinColor", colors[0]); // 设置皮肤颜色参数
  url.searchParams.set("hairColor", colors[1]); // 设置头发颜色参数
  url.searchParams.set("shirtColor", colors[2]); // 设置服装颜色参数
  url.searchParams.set("hatColor", colors[1]); // 设置头饰颜色参数
  url.searchParams.set("pantsColor", colors[1]); // 设置裤装颜色参数
  url.searchParams.set("shoesColor", colors[1]); // 设置鞋子颜色参数
  url.searchParams.set("jacketColor", colors[2]); // 设置外套颜色参数
  return url.toString(); // 返回完整缩略图地址
} // 中文注释：页面逻辑与状态处理

function renderDyeSwatches(level) { // 渲染当前层级的染色缩略图
  if (!selectedDyeResource) return; // 没有可染色资源时不渲染
  const palettes = selectedDyeResource.dyeGroup === "full" ? dyePalette : basicDyePalette; // 选择 36 套或 3 套模板
  const visiblePalettes = level === "compact" ? palettes.slice(0, 8) : palettes; // 一级只显示前八套
  dyeGrid.replaceChildren(); // 清空旧缩略图
  visiblePalettes.forEach((colors, index) => { // 遍历当前层级颜色方案
    const swatch = document.createElement("button"); // 创建可点击方案按钮
    swatch.type = "button"; // 设置按钮类型
    swatch.className = "dye-swatch"; // 应用染色缩略图样式
    swatch.dataset.index = String(index); // 记录方案索引
    swatch.classList.toggle("is-selected", selectedDyeIndex === index); // 恢复层级切换前的选中状态
    swatch.title = `染色方案 ${index + 1}`; // 设置方案提示文字
    swatch.innerHTML = `<img src="${buildDyeUrl(selectedDyeResource.source, colors)}" alt="染色方案 ${index + 1}" loading="lazy">`; // 加载模板缩略图
    swatch.addEventListener("click", () => { // 绑定方案选中事件
      dyeGrid.querySelectorAll(".dye-swatch").forEach((item) => item.classList.remove("is-selected")); // 清除旧选中状态
      selectedDyeIndex = index; // 保存当前染色方案索引
      swatch.classList.add("is-selected"); // 标记当前选中方案
    }); // 结束方案点击事件
    dyeGrid.append(swatch); // 添加方案按钮到网格
  }); // 结束方案遍历
  dyePanel.dataset.count = String(visiblePalettes.length); // 写入当前方案数量
} // 中文注释：页面逻辑与状态处理

function updateDyePanelForResource() { // 更新染色入口的可用状态
  const enabled = Boolean(selectedDyeResource); // 判断当前资源是否支持染色
  dyePanel.hidden = true; // 切换资源时先关闭旧染色内容，防止方案层残留
  dyeToggle.hidden = false; // 切换资源后恢复初始染色按钮
  dyeToggle.setAttribute("aria-expanded", "false"); // 重置染色入口展开状态
  dyeToggle.disabled = !enabled; // 仅一至六号资源启用染色入口
  dyePreview.src = enabled ? selectedDyeResource.source : ""; // 初始按钮直接使用资源卡中的默认缩略图
  dyeToggle.setAttribute("aria-label", enabled ? "展开染色方案" : "当前资源无染色方案"); // 更新无障碍提示
  if (!enabled) { // 当前资源不支持染色时关闭面板
    dyeReturn.hidden = true; // 隐藏返回按钮
    return; // 结束不可用资源处理
  } // 中文注释：页面逻辑与状态处理
  dyePanel.dataset.level = "compact"; // 新资源默认回到一级面板
  dyeExpand.hidden = selectedDyeResource.dyeGroup !== "full"; // 3 套基础方案不显示二级展开
  dyeExpand.disabled = selectedDyeResource.dyeGroup !== "full"; // 3 套基础方案禁用展开按钮
  dyeReturn.hidden = selectedDyeResource.dyeGroup !== "full"; // 3 套基础方案不显示返回按钮
  renderDyeSwatches("compact"); // 预渲染一级缩略图
} // 中文注释：页面逻辑与状态处理

dyeToggle.addEventListener("click", () => { // 绑定染色入口展开收起
  const shouldOpen = dyePanel.hidden; // 读取当前面板状态
  dyePanel.hidden = !shouldOpen; // 切换面板显隐
  dyeToggle.setAttribute("aria-expanded", String(shouldOpen)); // 同步无障碍展开状态
  if (shouldOpen && selectedDyeResource?.dyeGroup === "full") dyeToggle.hidden = true; // 8/36 套方案展开后隐藏初始按钮
  if (!shouldOpen) dyeToggle.hidden = false; // 面板收起后恢复初始按钮
}); // 结束染色入口事件

dyeExpand.addEventListener("click", () => { // 绑定一级二级面板切换
  const fullLevel = dyePanel.dataset.level === "full"; // 判断当前是否为二级面板
  dyePanel.dataset.level = fullLevel ? "compact" : "full"; // 切换面板层级
  dyeToggle.hidden = true; // 一级或二级染色面板打开期间都隐藏初始染色按钮
  dyeExpand.setAttribute("aria-label", fullLevel ? "展开全部染色方案" : "收起染色方案"); // 更新按钮提示
  renderDyeSwatches(dyePanel.dataset.level); // 按新层级重新渲染
  dyeScroll.scrollTop = 0; // 切换层级后回到顶部
}); // 结束层级切换事件

document.querySelector("#dye-return").addEventListener("click", () => { // 绑定返回资源列表按钮
  resetDyeState(); // 返回资源列表时清空染色展开层级
  dyeToggle.disabled = !selectedDyeResource; // 保留当前资源的染色可用状态
  dyePreview.src = selectedDyeResource ? selectedDyeResource.source : ""; // 保留当前资源默认缩略图
  if (selectedDyeResource) { // 当前资源仍支持染色时恢复入口配置
    dyeToggle.setAttribute("aria-label", "展开染色方案"); // 恢复入口无障碍提示
    dyePanel.dataset.level = "compact"; // 返回后从一级方案开始
    dyeExpand.hidden = selectedDyeResource.dyeGroup !== "full"; // 仅完整染色资源显示展开按钮
    dyeExpand.disabled = selectedDyeResource.dyeGroup !== "full"; // 基础染色资源禁用展开按钮
    dyeReturn.hidden = selectedDyeResource.dyeGroup !== "full"; // 仅完整染色资源保留返回按钮
    renderDyeSwatches("compact"); // 预渲染当前资源一级方案
  } // 中文注释：页面逻辑与状态处理
}); // 结束返回按钮事件

document.querySelectorAll(".left-menu-button").forEach((button) => // 中文注释：页面逻辑与状态处理
  button.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
    document // 中文注释：页面逻辑与状态处理
      .querySelectorAll(".left-menu-button") // 中文注释：页面逻辑与状态处理
      .forEach((item) => item.classList.toggle("is-active", item === button)); // 中文注释：页面逻辑与状态处理
    const targetMenu = document.querySelector(`[data-menu="${button.dataset.section}"]`); // 查找主分类对应的右侧菜单
    document.querySelectorAll(".right-menu").forEach((menu) => { // 遍历全部右侧菜单
      menu.hidden = menu !== targetMenu; // 只显示当前主分类对应的菜单
    }); // 结束右侧菜单显隐更新
    if (!targetMenu) return; // 没有配置右侧菜单时保留当前资源内容
    const defaultCategory = targetMenu.querySelector("[data-category]"); // 获取右侧菜单的默认分类
    targetMenu.querySelectorAll("[data-category]").forEach((item) => { // 遍历当前菜单分类按钮
      item.classList.toggle("is-active", item === defaultCategory); // 默认选中第一个分类
    }); // 结束默认选中状态更新
    switchCategory(defaultCategory.dataset.category); // 加载默认分类资源
  }), // 中文注释：页面逻辑与状态处理
); // 中文注释：页面逻辑与状态处理

document.querySelector("[data-preview-toggle]").addEventListener("click", (event) => { // 中文注释：页面逻辑与状态处理
  const button = event.currentTarget; // 中文注释：页面逻辑与状态处理
  const nextMode = button.dataset.previewMode === "装扮" ? "单品" : "装扮"; // 中文注释：页面逻辑与状态处理
  button.dataset.previewMode = nextMode; // 中文注释：页面逻辑与状态处理
  button.querySelector("[data-preview-label]").textContent = nextMode; // 中文注释：页面逻辑与状态处理
  button.setAttribute("aria-label", `切换预览模式，当前${nextMode}`); // 中文注释：页面逻辑与状态处理
  document.body.dataset.previewMode = nextMode; // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

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
  if (state.sort === "favorite") resetResourceList(); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

const zoomSlider = document.querySelector("#zoom"); // 中文注释：页面逻辑与状态处理
const zoomValue = document.querySelector("#zoom-label"); // 中文注释：页面逻辑与状态处理
zoomSlider.addEventListener("input", () => { // 中文注释：页面逻辑与状态处理
  const normalizedZoom = (Number(zoomSlider.value) + 1.699) / 4; // 中文注释：页面逻辑与状态处理
  zoomValue.textContent = `${(normalizedZoom * 4.6).toFixed(1)}×`; // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

const playbackDuration = 30000; // 中文注释：页面逻辑与状态处理
const playbackToggle = document.querySelector("#playback-toggle"); // 中文注释：页面逻辑与状态处理
const playbackProgress = document.querySelector("#playback-progress"); // 中文注释：页面逻辑与状态处理
const playbackTime = document.querySelector("#playback-time"); // 中文注释：页面逻辑与状态处理
const playbackSpeed = document.querySelector("#playback-speed"); // 中文注释：页面逻辑与状态处理
const playbackRates = [0.25, 0.5, 1, 2, 4]; // 中文注释：页面逻辑与状态处理
let playbackPosition = 0; // 中文注释：页面逻辑与状态处理
let playbackRate = 1; // 中文注释：页面逻辑与状态处理
let playbackFrame = 0; // 中文注释：页面逻辑与状态处理
let playbackStartedAt = 0; // 中文注释：页面逻辑与状态处理

function formatPlaybackTime(milliseconds) { // 中文注释：页面逻辑与状态处理
  const safeValue = Math.max(0, Math.min(playbackDuration, Math.round(milliseconds))); // 中文注释：页面逻辑与状态处理
  return (safeValue / 1000).toFixed(1); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

function renderPlayback() { // 中文注释：页面逻辑与状态处理
  playbackProgress.value = String(Math.round(playbackPosition)); // 中文注释：页面逻辑与状态处理
  playbackTime.value = `${formatPlaybackTime(playbackPosition)}/${formatPlaybackTime(playbackDuration)}`; // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

function pausePlayback() { // 中文注释：页面逻辑与状态处理
  cancelAnimationFrame(playbackFrame); // 中文注释：页面逻辑与状态处理
  playbackToggle.setAttribute("aria-pressed", "false"); // 中文注释：页面逻辑与状态处理
  playbackToggle.setAttribute("aria-label", "播放"); // 中文注释：页面逻辑与状态处理
  playbackToggle.title = "播放"; // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

function tickPlayback(timestamp) { // 中文注释：页面逻辑与状态处理
  playbackPosition += (timestamp - playbackStartedAt) * playbackRate; // 中文注释：页面逻辑与状态处理
  playbackStartedAt = timestamp; // 中文注释：页面逻辑与状态处理
  if (playbackPosition >= playbackDuration) { // 中文注释：页面逻辑与状态处理
    playbackPosition = playbackDuration; // 中文注释：页面逻辑与状态处理
    renderPlayback(); // 中文注释：页面逻辑与状态处理
    pausePlayback(); // 中文注释：页面逻辑与状态处理
    return; // 中文注释：页面逻辑与状态处理
  } // 中文注释：页面逻辑与状态处理
  renderPlayback(); // 中文注释：页面逻辑与状态处理
  playbackFrame = requestAnimationFrame(tickPlayback); // 中文注释：页面逻辑与状态处理
} // 中文注释：页面逻辑与状态处理

playbackToggle.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
  const isPlaying = playbackToggle.getAttribute("aria-pressed") === "true"; // 中文注释：页面逻辑与状态处理
  if (isPlaying) { // 中文注释：页面逻辑与状态处理
    pausePlayback(); // 中文注释：页面逻辑与状态处理
    return; // 中文注释：页面逻辑与状态处理
  } // 中文注释：页面逻辑与状态处理
  if (playbackPosition >= playbackDuration) playbackPosition = 0; // 中文注释：页面逻辑与状态处理
  playbackToggle.setAttribute("aria-pressed", "true"); // 中文注释：页面逻辑与状态处理
  playbackToggle.setAttribute("aria-label", "暂停"); // 中文注释：页面逻辑与状态处理
  playbackToggle.title = "暂停"; // 中文注释：页面逻辑与状态处理
  playbackStartedAt = performance.now(); // 中文注释：页面逻辑与状态处理
  playbackFrame = requestAnimationFrame(tickPlayback); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

playbackProgress.addEventListener("input", () => { // 中文注释：页面逻辑与状态处理
  playbackPosition = Number(playbackProgress.value); // 中文注释：页面逻辑与状态处理
  playbackStartedAt = performance.now(); // 中文注释：页面逻辑与状态处理
  renderPlayback(); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

playbackSpeed.addEventListener("click", () => { // 中文注释：页面逻辑与状态处理
  const nextIndex = (Number(playbackSpeed.dataset.rateIndex) + 1) % playbackRates.length; // 中文注释：页面逻辑与状态处理
  playbackRate = playbackRates[nextIndex]; // 中文注释：页面逻辑与状态处理
  playbackSpeed.dataset.rateIndex = String(nextIndex); // 中文注释：页面逻辑与状态处理
  playbackSpeed.textContent = `${playbackRate}×`; // 中文注释：页面逻辑与状态处理
  playbackSpeed.setAttribute("aria-label", `播放倍速，当前${playbackRate}倍`); // 中文注释：页面逻辑与状态处理
  playbackStartedAt = performance.now(); // 中文注释：页面逻辑与状态处理
}); // 中文注释：页面逻辑与状态处理

renderPlayback(); // 中文注释：页面逻辑与状态处理

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

loadMore(); // 中文注释：页面逻辑与状态处理
