// Repeated geometry groups issue both source DrawCalls on the same skinned mesh.
export function bindMaterialPasses(mesh,passes,warnings=[]){
  if(passes.length===1){mesh.material=passes[0];return;}
  const geometry=mesh.geometry.clone();geometry.clearGroups();
  const count=geometry.index?.count||geometry.attributes.position.count;
  passes.forEach((_,i)=>geometry.addGroup(0,count,i));
  mesh.geometry=geometry;mesh.material=passes;
  if(passes.some(m=>m.userData.requiresSecondUv)&&!geometry.attributes.uv1)warnings.push('双遍材质需要第二 UV，但几何未提供；对应动态分支已停用');
  const previous=mesh.onBeforeRender;
  mesh.onBeforeRender=function(renderer,scene,camera,g,material,...rest){
    previous.call(this,renderer,scene,camera,g,material,...rest);
    const u=material.userData.uniforms?.neoJellyHasUv;
    if(u)u.value=material.userData.requiresSecondUv&&!g.attributes.uv1?0:1;
  };
}
