import {modelTextureOverrides} from '../model-textures.js';
import {requestJSON} from '../handoff/services.js';
import {resolveFragmentAssembly} from '../source-fragment-assembly.js';
import {resolveFashionAssembly} from '../source-fashion-assembly.js';
import {exactModelForRole} from './model-role.js';

export const categories = [
  ['skin', '角色', 'char.svg'], ['headwear', '头饰', 'headwear.svg'],
  ['facewear', '面饰', 'facedec.svg'], ['waistwear', '腰饰', 'belt.svg'],
  ['backwear', '背饰', 'backpack.svg'], ['hair', '发型', 'cap.svg'],
  ['upper', '上装', 'shirt.svg'], ['lower', '下装', 'pants.svg'], ['yoyo', '呦呦', 'Toy.svg'],
];
export const statusNames = {ready: '引用文件齐备', partial: '贴图引用待补全', 'missing-model': '模型待解析', 'missing-geometry': '几何待解析', 'missing-source': '源文件未定位', 'parse-failed': '源文件解析失败'};
export const categoryName = item => categories.find(([id]) => id === item?.businessCategoryId)?.[1] || '外观';
export const defaultVariant = item => (item?.preserveSourceDefault&&item.variants.find(v=>v.isDefault)) || item?.variants.find(v => v.isDefault && (v.runtime || v.preview)) || item?.variants.find(v => v.runtime || v.preview) || item?.variants[0];
export const resolveModel = (variant, role) => role === 'preview' ? variant?.preview || variant?.runtime : variant?.runtime || variant?.preview;
// Back accessories live behind the actor. Keep the first usable inspection
// frame on the rear so a successful socket load is visible immediately.
export const isRearAccessory = item => item?.businessCategoryId === 'backwear' || item?.equipSlot === 'back';
export function wearBlock(item) {
  if (!item) return '请选择外观';
  if (item.renderBlock) return item.renderBlock;
  if (['hair', 'upper', 'lower'].includes(item.equipSlot)) return item.partAssemblyRoles?.length ? '' : '此部件组合尚待适配 · 当前仅单品预览';
  if (item.businessCategoryId !== 'skin' && !['face', 'head', 'waist', 'back'].includes(item.equipSlot)) return '此分类暂未接入穿戴';
  return '';
}

// UI session only; resource and rendering rules remain in the shared viewer.
// Selected/previewed items never silently replace the saved outfit.
export class AppearanceWardrobe {
  constructor(viewer) {
    this.viewer = viewer;
    this.actor = null;
    this.outfit = new Map();
    this.mode = 'single';
    this.shown = null;
    this.warnings = [];
  }
  async loadFragments() {
    if(!this.fragmentLoading)this.fragmentLoading=requestJSON('/data/fragment-wardrobe.json').then(async response=>{
      if(!response.ok)throw new Error('角色衣橱目录未发布');this.fragmentCatalog=await response.json();return this.fragmentCatalog;
    }).catch(error=>{this.fragmentLoading=null;throw error;});
    return this.fragmentLoading;
  }
  async loadFashionParts() {
    if(!this.fashionLoading)this.fashionLoading=requestJSON('/data/fashion-parts.json').then(async r=>{if(!r.ok)throw new Error('分部服装目录未发布');this.fashionCatalog=await r.json();return this.fashionCatalog;}).catch(error=>{this.fashionLoading=null;throw error;});
    return this.fashionLoading;
  }
  async changeFashionParts(selected,role=this.actor?.role) {
    if(!this.actor)throw new Error('请先载入角色');
    await this.loadFashionParts();
    const next={...this.actor,role,fashionParts:{...selected},fragmentParts:undefined};
    await this.show(next);this.actor=next;this.mode='outfit';
    for(const [slot,saved] of this.outfit){await this.viewer.equip(slot,saved.item,saved.variant);this.collectWarnings(slot,saved);}
  }
  fragmentConfig(entry=this.actor) {
    return this.fragmentCatalog?.characters[String(entry?.item.itemId)]?.variants[String(entry?.variant.id)]?.[entry?.role];
  }
  async changeFragments(selected) {
    if(!this.actor||!this.fragmentConfig())throw new Error('请先选择具有衣橱的角色');
    const next={...this.actor,fragmentParts:{...selected},fashionParts:undefined};
    await this.show(next);this.actor=next;this.mode='outfit';
    for(const [slot,saved] of this.outfit){await this.viewer.equip(slot,saved.item,saved.variant);this.collectWarnings(slot,saved);}
  }
  async show(entry) {
    if(entry.item.renderBlock||entry.variant.renderBlock)throw new Error(entry.item.renderBlock||entry.variant.renderBlock);
    // Character skin roles are user-visible quality choices. Keep the legacy
    // fallback for accessories and social assets, but never make a missing
    // skin role look available by rendering the opposite model.
    let id = entry.item.businessCategoryId === 'skin'
      ? exactModelForRole(entry.variant, entry.role)
      : resolveModel(entry.variant, entry.role);
    if (!id) throw new Error('当前变体模型未就绪');
    let assembly=null,animationDescriptor=null,singleOverrides=null,singlePoseOffsets=null;
    if(entry.fashionParts){
      await this.loadFashionParts();assembly=resolveFashionAssembly(this.fashionCatalog,entry.role,entry.fashionParts);id=assembly.base;
    }else if(entry.item.partAssemblyRoles?.includes(entry.role)){
      await this.loadFashionParts();const plan=resolveFashionAssembly(this.fashionCatalog,entry.role,{[entry.item.equipSlot]:entry.item.itemId});singleOverrides=plan.overrides[id];singlePoseOffsets=plan.poseOffsets;
    }else if(entry.item.businessCategoryId==='skin'){
      await this.loadFragments();
      if(this.fragmentConfig(entry)){
        assembly=resolveFragmentAssembly(this.fragmentCatalog,entry.item.itemId,entry.variant.id,entry.role,entry.fragmentParts||{});
        if(assembly.base!==id){const response=await requestJSON(`/data/models/${id}.json`);if(!response.ok)throw new Error('角色动作描述缺失');animationDescriptor=await response.json();}
        id=assembly.base;
      }
    }
    const result = await this.viewer.show(id, singleOverrides||assembly?.overrides?.[id]||modelTextureOverrides(entry.item, entry.variant, id), {defaultFace: entry.item.businessCategoryId === 'skin',assembly,poseOffsets:singlePoseOffsets});
    if (!result) throw new Error('预览已被更新，请重试');
    this.shown = entry;
    this.warnings = result.warnings.map(message => `${entry.item.name}：${message}`);
    await this.onShow?.(entry.fashionParts?{...entry,item:{...entry.item,itemId:0}}:entry,animationDescriptor||result.desc);
    return result;
  }
  async preview(entry) {
    await this.show(entry);
    if (isRearAccessory(entry.item)) this.viewer.frameVisible(180);
    this.mode = 'single';
  }
  async restore() {
    if (!this.actor) throw new Error('请先穿戴一个角色');
    if (this.mode === 'outfit') return;
    await this.show(this.actor);
    this.mode = 'outfit';
    const failures = [];
    for (const [slot, entry] of this.outfit) {
      try {
        await this.viewer.equip(slot, entry.item, entry.variant);
        this.collectWarnings(slot, entry);
      } catch (error) {
        failures.push(`${entry.item.name}：${error.message}`);
      }
    }
    if (failures.length) throw new Error(`搭配恢复不完整，已保留选择：${failures.join('；')}`);
  }
  collectWarnings(slot, entry) {
    this.warnings.push(...(this.viewer.equipped.get(slot)?.warnings || []).map(message => `${entry.item.name}：${message}`));
  }
  async wear(entry) {
    if(entry.item.renderBlock||entry.variant.renderBlock)throw new Error(entry.item.renderBlock||entry.variant.renderBlock);
    const reason = wearBlock(entry.item);
    if (reason) throw new Error(reason);
    if(['hair','upper','lower'].includes(entry.item.equipSlot)){
      if(!entry.item.partAssemblyRoles.includes(entry.role))throw new Error('此版本的分部组合尚未支持');
      await this.changeFashionParts({...this.actor?.fashionParts,[entry.item.equipSlot]:entry.item.itemId},entry.role);return;
    }
    if (entry.item.businessCategoryId === 'skin') {
      if(entry.fragmentParts===undefined&&this.actor?.item.id===entry.item.id&&this.actor?.variant.id===entry.variant.id)entry={...entry,fragmentParts:this.actor.fragmentParts};
      await this.show(entry);
      this.actor = entry;
      this.mode = 'outfit';
      const failures=[];
      for(const [slot,saved] of this.outfit) {
        try{await this.viewer.equip(slot,saved.item,saved.variant);this.collectWarnings(slot,saved);}
        catch(error){failures.push(`${saved.item.name}：${error.message}`);}
      }
      if(failures.length)throw new Error(`角色已更新；部分配饰无法显示，选择已保留：${failures.join('；')}`);
    } else {
      await this.restore();
      await this.viewer.equip(entry.item.equipSlot, entry.item, entry.variant);
      this.outfit.set(entry.item.equipSlot, entry);
      if (isRearAccessory(entry.item)) this.viewer.frameVisible(180);
      this.refreshWarnings();
    }
  }
  refreshWarnings() {
    // Preserve base-model warnings; refresh equipped warnings after replacement/removal.
    this.warnings = this.warnings.filter(message => message.startsWith(`${this.shown?.item.name}：`));
    if (this.mode === 'outfit') for (const [slot, entry] of this.outfit) this.collectWarnings(slot, entry);
  }
  async remove(slot) {
    if(['hair','upper','lower'].includes(slot)&&this.actor?.fashionParts){const selected={...this.actor.fashionParts};delete selected[slot];await this.changeFashionParts(selected);return;}
    this.outfit.delete(slot);
    if (this.mode === 'outfit') this.viewer.removeSlot(slot);
    this.refreshWarnings();
  }
  clear() {
    if (this.mode === 'outfit') this.viewer.clearEquipped();
    this.outfit.clear();
    this.refreshWarnings();
  }
}
