const hidden=0x2000000n;
const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};
function flags(scene){
  if(typeof scene.flags38!=='bigint'||scene.flags38<0n||scene.flags38>0xffffffffffffffffn)throw new TypeError('Source uint64 scene flags required');
  return scene.flags38;
}
function bit(value){
  if(typeof value!=='boolean'&&(!Number.isInteger(value)||value<0||value>0xffffffff))throw new TypeError('Source visibility bool/uint32 required');
  return Boolean(Number(value)&1);
}
const sfxActor=actor=>required(actor.asSfxActor,'actor virtual20').call(actor);

// Basevirtualf0: no scene returns false; byte3b bit1 is uint64 bit25.
export function sourceSfxGetVisible(node){return Boolean(node.sceneObject&&(flags(node.sceneObject)&hidden)===0n);}

// Visitor2b44e6c via2a0c4a4. The source captures the vector's begin/end once,
// but reads each cell at visit time. Child additions are not in this traversal.
function visitChildren(scene,visible){
  const children=scene.children,count=children.length;
  for(let i=0;i<count;i++){
    const child=children[i];
    if(!child)throw new Error('Invalid source visibility child');
    if(!(child.inheritanceMask&0x800)||!child.actor)continue;
    const target=sfxActor(child.actor);
    if(target)required(target.setVisible,'SFX virtuale8').call(target,visible);
    else visitChildren(child,visible); // A non-SFX actor bridges to children.
  }
}

// Basevirtuale8 always propagates, even when the requested bit is unchanged.
export function sourceSfxSetVisible(node,value){
  if(!node.sceneObject)return;
  const visible=bit(value),scene=node.sceneObject,bits=flags(scene);
  scene.flags38=visible?bits&~hidden:bits|hidden;
  if(scene.spatialRecord)scene.spatialRecord.flags28=scene.flags38; //2a06b38.
  visitChildren(node.sceneObject,visible);
}

// Basevirtual50=2b44740: query parent actor before checking the child's mask.
export function sourceSfxInheritParentVisibility(node,parent){
  if(!parent.actor)return;
  const source=sfxActor(parent.actor);
  if(!source||!node.sceneObject||!(node.sceneObject.inheritanceMask&0x800))return;
  const visible=bit(required(source.getVisible,'parent SFX virtualf0').call(source));
  required(node.setVisible,'child SFX virtuale8').call(node,visible);
}

// Only the shared SFX actor virtuals; this does not supply unknown type scene,
// activation, simulation or render callbacks.
export function bindSourceSfxVisibility(node){
  node.asSfxActor=()=>node;
  node.getVisible=()=>sourceSfxGetVisible(node);
  node.setVisible=value=>sourceSfxSetVisible(node,value);
  return node;
}
