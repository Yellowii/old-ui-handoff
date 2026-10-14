// Texture overrides belong to the model variant that was actually loaded.
// A missing preview model falls back to runtime geometry and runtime textures.
export function modelTextureOverrides(item,variant,modelId){
  if(modelId&&modelId===variant?.preview&&modelId!==variant?.runtime){
    const overrides=item.previewTextureOverrides||{};
    if(Object.values(overrides).some(url=>url===null))throw new Error('高清展示配置所需贴图未定位；此版本暂不可用');
    return overrides;
  }
  const overrides=item.textureOverrides||{};
  if(Object.values(overrides).some(url=>url===null))
    throw new Error('运行模型配置所需贴图未定位；此版本暂不可用');
  return overrides;
}
