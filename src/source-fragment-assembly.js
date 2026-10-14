// ModelDataGenerator.get_combine_model_data; const_bag's business positions
// come from the published source table, independently of model slot_idx.
export function resolveFragmentAssembly(catalog, itemId, variantId, role, selected = {}) {
  const config = catalog.characters[String(itemId)]?.variants[String(variantId)]?.[role];
  if (!config) throw new Error('此角色版本没有已发布衣橱配置');
  const parts = config.fragment_parts_data;
  const selectedParts = Object.entries(selected).sort(([a], [b]) => Number(a) - Number(b)).map(([, id]) => String(id));
  const occupied = new Set(), filled = new Set(), all = [...selectedParts];
  for (const id of selectedParts) {
    const part = parts[id];
    if (!part || part.resourceStatus !== 'ready') throw new Error(`服饰 ${id} 尚未完整支持：${part?.reasons?.join('、') || '配置缺失'}`);
    if (part.modelPos) occupied.add(part.modelPos);
    for (const pos of part.conflictPositions) occupied.add(pos);
    if (part.slot_idx != null) filled.add(part.slot_idx);
  }
  for (const id of config.fragment_suit_data[String(config.default_fragment_suit_id)].part_ids) {
    const part = parts[String(id)];
    if (part?.slot_idx != null && !filled.has(part.slot_idx) && !occupied.has(part.slot_idx)) all.push(String(id));
  }
  const choices = new Map();
  for (const id of all) for (const [slot, choice] of parts[id]?.affect_slot_idx_list || []) {
    if (choices.has(slot) && choices.get(slot) !== choice) throw new Error('多个服饰对同一部位的覆盖顺序尚未确定');
    choices.set(slot, choice);
  }
  let base = null;
  const additions = [], subModels=[];
  for (const id of all) {
    const part = parts[id];
    if (!part) continue;
    if (part.resourceStatus !== 'ready') throw new Error(`默认服饰 ${id} 尚未完整支持`);
    subModels.push(...(part.subModels||[]));
    const path = part.model_path_dict?.[String(choices.get(part.slot_idx) || 0)] || part.model_path || '';
    if (!path) continue;
    const model = catalog.models[path];
    if (model?.status !== 'ready') throw new Error(`服饰模型未就绪：${path}`);
    if (part.slot_idx === 1) {
      if (base) throw new Error('多个基础模型的覆盖规则未确定');
      base = model.id;
    } else if (!occupied.has(part.slot_idx) || filled.has(part.slot_idx)) additions.push(model.id);
  }
  if (!base) throw new Error('衣橱组合缺少基础模型');
  return {base, additions, subModels, parts: all, selected: {...selected}, role, defaultSuit: config.default_fragment_suit_id};
}

export function fragmentSuitSelection(config, suitId) {
  const suit = config.fragment_suit_data[String(suitId)];
  if (!suit || suit.resourceStatus !== 'ready') throw new Error('此套装的部件或运行依赖尚未完整支持');
  if (Number(suitId) === config.default_fragment_suit_id) return {};
  return Object.fromEntries(suit.part_ids.map(id => [config.fragment_parts_data[String(id)].modelPos, id]));
}

// Source add_mesh uses the base rig. Preserve each mesh's own inverse bind
// matrices. Reject mismatched rigs instead of attaching an independent body.
export function attachAssemblyMeshes(THREE, base, additional, descriptor, baseDescriptor) {
  if (!descriptor.skeletonUrl || descriptor.skeletonUrl !== baseDescriptor.skeletonUrl)
    throw new Error('服饰与基础模型的源骨架不同，尚未支持此组合');
  const bones = new Map();
  base.traverse(node => { if (node.isBone) bones.set(node.userData.sourceBone || node.name, node); });
  const meshes = [], oldSkeletons = new Set();
  additional.updateMatrixWorld(true);
  additional.traverse(node => { if (node.isMesh) meshes.push(node); });
  for (const mesh of meshes) if (mesh.isSkinnedMesh && mesh.skeleton.bones.some(bone => !bones.has(bone.userData.sourceBone || bone.name)))
    throw new Error('服饰引用了基础骨架中不存在的骨骼');
  // GLTF delivery meshes are siblings of the skeleton. Nonidentity ancestry
  // needs an explicit conversion rule, so fail rather than losing transforms.
  for (const mesh of meshes) {
    let parent = mesh.parent;
    while (parent && parent !== additional) {
      if (parent.isBone || !parent.matrix.equals(new THREE.Matrix4())) throw new Error('服饰网格父级变换尚未支持');
      parent = parent.parent;
    }
  }
  for (const mesh of meshes) {
    if (mesh.isSkinnedMesh) {
      oldSkeletons.add(mesh.skeleton);
      const skeleton = new THREE.Skeleton(mesh.skeleton.bones.map(b => bones.get(b.userData.sourceBone || b.name)), mesh.skeleton.boneInverses.map(m => m.clone()));
      mesh.bind(skeleton, mesh.bindMatrix.clone());
    }
    mesh.name = `fragment_${descriptor.id}_${mesh.name}`;
    base.add(mesh);
  }
  for (const skeleton of oldSkeletons) skeleton.dispose();
  return meshes.length;
}
