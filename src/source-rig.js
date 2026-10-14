import * as THREE from 'three';

// NeoX row-major row-vector matrices have the same storage as Three column matrices.
export function addSourceSockets(root,source){
  const nodes=new Map();root.traverse(n=>{if(n.isBone)nodes.set(n.userData.sourceBone||n.name,n);});
  // Raw animation tracks are local to the full source hierarchy, not the
  // reduced mesh palette. Reuse palette bones and restore omitted parents.
  for(const b of source.bones){if(!nodes.has(b.name)){const n=new THREE.Bone();n.name=b.name;n.userData.sourceBone=b.name;nodes.set(b.name,n);}}
  for(const b of source.bones){const n=nodes.get(b.name);n.position.fromArray(b.translation);n.quaternion.fromArray(b.rotation_xyzw);n.scale.fromArray(b.scale);(b.parent<0?root:nodes.get(source.bones[b.parent].name)).add(n);}
  const added=[],skipped=[];
  const ensureBone=index=>{
    const b=source.bones[index];if(!b)return null;
    if(nodes.has(b.name))return nodes.get(b.name);
    const parent=b.parent<0?root:ensureBone(b.parent);if(!parent)return null;
    const node=new THREE.Bone();node.name=b.name;node.userData.sourceBone=b.name;
    node.position.fromArray(b.translation);node.quaternion.fromArray(b.rotation_xyzw);node.scale.fromArray(b.scale);
    parent.add(node);nodes.set(b.name,node);return node;
  };
  for(const a of source.auxiliary_nodes){
    const rootSocket=a.parent===-2&&a.raw_flag===2;
    // Only the source's explicit -2/flag-2 socket form belongs to the model root.
    if((a.parent<0&&!rootSocket)||a.raw_flag!==2||root.getObjectByName(a.name)){skipped.push(a.name);continue;}
    const parent=rootSocket?root:ensureBone(a.parent);if(!parent){skipped.push(a.name);continue;}
    const node=new THREE.Object3D();node.name=a.name;
    node.userData={sourceSocket:true,sourceParent:rootSocket?null:source.bones[a.parent].name,sourceFlag:a.raw_flag,sourceRoot:rootSocket};
    node.position.fromArray(a.raw_trs,0);node.quaternion.fromArray(a.raw_trs,3);node.scale.fromArray(a.raw_trs,7);
    parent.add(node);added.push(a.name);
  }
  return {added,skipped};
}
