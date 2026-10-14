import {Box3,Matrix4,Vector3} from 'three';

// Bound each bone's influenced vertices in bone space once. A normalized,
// nonnegative skin blend lies inside the union of its transformed bone boxes.
// This follows the current pose without skinning every vertex on every frame.
const skinCache=new WeakMap(),geometryVersions=new WeakMap();
const vertex=new Vector3(),matrix=new Matrix4(),box=new Box3();
const components=['getX','getY','getZ','getW'];

function boneBounds(mesh){
  const geometry=mesh.geometry,skeleton=mesh.skeleton;
  const {position,skinIndex,skinWeight}=geometry.attributes;
  if(!skinIndex||!skinWeight||geometry.morphAttributes.position?.length)return null;
  const cached=skinCache.get(mesh);
  if(cached?.geometry===geometry&&cached.skeleton===skeleton&&cached.positionVersion===position.version&&
      cached.indexVersion===skinIndex.version&&cached.weightVersion===skinWeight.version&&cached.bind.equals(mesh.bindMatrix))return cached.boxes;
  let boxes=skeleton.bones.map(()=>new Box3());
  for(let i=0;i<position.count;i++){
    let total=0;
    for(const component of components){
      const weight=skinWeight[component](i),index=skinIndex[component](i);
      if(!Number.isFinite(weight)||weight<0||(weight>0&&!boxes[index])){boxes=null;break;}
      total+=weight;
      if(weight>0){
        vertex.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(skeleton.boneInverses[index]);
        boxes[index].expandByPoint(vertex);
      }
    }
    if(!boxes||Math.abs(total-1)>1e-5){boxes=null;break;}
  }
  skinCache.set(mesh,{geometry,skeleton,positionVersion:position.version,indexVersion:skinIndex.version,
    weightVersion:skinWeight.version,bind:mesh.bindMatrix.clone(),boxes});
  return boxes;
}

export function expandPosedBounds(root,target){
  root.traverseVisible(mesh=>{
    if(!mesh.isMesh||!mesh.geometry.attributes.position)return;
    const geometry=mesh.geometry,boxes=mesh.isSkinnedMesh?boneBounds(mesh):null;
    if(boxes){
      for(let i=0;i<boxes.length;i++){
        if(boxes[i].isEmpty())continue;
        matrix.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse).multiply(mesh.skeleton.bones[i].matrixWorld);
        target.union(box.copy(boxes[i]).applyMatrix4(matrix));
      }
    }else if(mesh.isSkinnedMesh||geometry.morphAttributes.position?.length){
      // Morphs or non-normalized skin weights require the actual vertex blend.
      for(let i=0;i<geometry.attributes.position.count;i++)target.expandByPoint(mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld));
    }else{
      if(!geometry.boundingBox||geometryVersions.get(geometry)!==geometry.attributes.position.version){
        geometry.computeBoundingBox();geometryVersions.set(geometry,geometry.attributes.position.version);
      }
      target.union(box.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
    }
  });
  return target;
}
