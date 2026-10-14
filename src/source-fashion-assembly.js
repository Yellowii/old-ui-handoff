// ModelSfxCache + CharTextureLoader's source conventional-parts branch.
export function resolveFashionAssembly(catalog, role, selected = {}) {
  const ids = {...catalog.defaults, ...selected};
  const together=catalog.parts[String(ids.upper)]?.specialType===1;
  if(together){
    if(catalog.specialPartContract?.togetherType!==1)throw new Error('连体服装组合规则尚未发布');
    ids.lower=catalog.specialPartContract.emptyLower;
  }
  const parts = {};
  for (const slot of ['upper', 'lower', 'hair']) {
    const part = catalog.parts[String(ids[slot])];
    if (!part || part.slot !== slot || !part.roles[role]) throw new Error(`此${slot}部件的组合尚未支持`);
    parts[slot] = part.roles[role];
  }
  if (new Set(Object.values(parts).map(p => p.skeletonUrl)).size !== 1) throw new Error('服装部件骨架不一致');
  const overrides = Object.fromEntries(Object.values(parts).map(p => [p.modelId, {...p.overrides}]));
  if (role === 'runtime' && Object.values(parts).some(p => !p.nativeMaterials)) {
    const composed = {};
    for (const channel of ['baseColor', 'normal', 'mask']) {
      const blocks = Object.entries(parts).filter(([,part]) => !part.nativeMaterials).map(([slot, part]) => {
        const [x,y,w,h] = together&&slot==='upper'?catalog.specialPartContract.runtimeUpperBlock:catalog.runtimeBlocks[slot];
        if (!part.overrides[channel] || part.sizes[channel]?.[0] < w || part.sizes[channel]?.[1] < h) throw new Error('部件图块尺寸与源规则不符');
        return {image:part.rawTextures[channel], source:[0,0,w,h], target:[x,y,w,h]};
      });
      if (channel === 'baseColor') blocks.push(...catalog.rawFaces.map((image,i) => ({image,source:[0,0,128,128],target:[128*i,0,128,128]})));
      else blocks.push({image:catalog.rawFaceAux[channel],source:[0,0,512,128],target:[0,0,512,128]});
      composed[channel] = {kind:'source-block-copy',size:catalog.runtimeSize,blocks};
    }
    for (const part of Object.values(parts)) if (!part.nativeMaterials) overrides[part.modelId] = {...composed};
  }
  // Original separate-material path gives the empty lower the upper's maps.
  if(together)overrides[parts.lower.modelId]={...overrides[parts.upper.modelId]};
  // Source _face submesh takes frame textures independently, never body maps.
  overrides[parts.upper.modelId].materials = Object.fromEntries(parts.upper.faceSlots.map(index => [index,{baseColor:catalog.faces[role][0],faceFrames:catalog.faces[role],isolated:true}]));
  let poseOffsets=null;
  const selectedPoses=Object.fromEntries(Object.entries(parts).filter(([,p])=>p.poseOffset).map(([slot,p])=>[slot,p.poseOffset.name]));
  if(Object.keys(selectedPoses).length){
    const contract=catalog.poseOffsetContract;
    if(contract?.multiAddPoseType!==1)throw new Error('分部姿势图分支尚未支持');
    const clips=Object.fromEntries([contract.reference,contract.fallback,...Object.values(parts).map(p=>p.poseOffset).filter(Boolean)].map(row=>[row.name,row]));
    poseOffsets={selected:selectedPoses,clips,roots:contract.roots};
  }
  const specialEffects=Object.values(parts).flatMap(p=>p.specialEffects||[]);
  return {kind:'fashion-parts',base:parts.upper.modelId,additions:[parts.lower.modelId,parts.hair.modelId],overrides,parts:ids,selected:{...selected},role,poseOffsets,specialEffects};
}

export async function composeSourceBlocks(spec, loadBytes) {
  if(spec.kind !== 'source-block-copy' || spec.size?.length !== 2) throw new Error('无效合成纹理');
  const [width,height]=spec.size,data=new Uint8Array(width*height*4);
  // Keep RGB even when alpha is zero. Canvas/ImageBitmap premultiplication
  // destroys the source ORM channels, so this is a byte copy like the client.
  for(const block of spec.blocks){
    const image=block.image,bytes=await loadBytes(image.url), [sx,sy,w,h]=block.source, [x,y,tw,th]=block.target;
    if(bytes.length!==image.width*image.height*4||w!==tw||h!==th||sx<0||sy<0||sx+w>image.width||sy+h>image.height||x<0||y<0||x+w>width||y+h>height)throw new Error('合成纹理图块超出源范围');
    for(let row=0;row<h;row++){const start=((sy+row)*image.width+sx)*4;data.set(bytes.subarray(start,start+w*4),((y+row)*width+x)*4);}
  }
  return {data,width,height};
}
