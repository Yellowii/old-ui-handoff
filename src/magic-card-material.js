// Source: magic_card.hlsl; WardrobeViewer maps NeoX world X to Three world -X.
export async function configureMagicCard(m,p,macros,load,warnings){
  let intensity;
  try{intensity=p.Intensity===undefined?[1,1,1,0]:JSON.parse(p.Intensity);}catch{intensity=null;}
  if(!Array.isArray(intensity)||intensity.length!==4||!intensity.every(Number.isFinite)){
    warnings.push('magic_card: invalid Intensity');return null;
  }
  const maps={};
  for(const key of ['Tex0','Tex1','Tex2'])maps[key]=await load(key,false);
  const missing=Object.keys(maps).filter(k=>!maps[k]);
  if(missing.length){warnings.push('magic_card: missing '+missing.join(', '));return null;}
  const quality=Number.isFinite(Number(macros.RENDER_QUALITY))?Number(macros.RENDER_QUALITY):0;
  const uniforms={mcBase:{value:maps.Tex0},mcOne:{value:maps.Tex1},mcTwo:{value:maps.Tex2}};
  m.map=maps.Tex0;m.normalMap=null;m.roughness=intensity[1];m.metalness=intensity[2];
  m.color.set(0xffffff);m.emissive.set(0);m.emissiveIntensity=0;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    const varying='varying vec2 mcUv;varying vec3 mcLocalNormal,mcWorldNormal,mcCameraLocal,mcView;\n';
    s.vertexShader=varying+s.vertexShader
      .replace('#include <uv_vertex>','#include <uv_vertex>\nmcUv=uv;')
      .replace('#include <defaultnormal_vertex>',[
        '#include <defaultnormal_vertex>',
        'mat4 mcInverseWorld=inverse(modelMatrix);',
        'mcLocalNormal=objectNormal;',
        'mcWorldNormal=normalize(transpose(mat3(mcInverseWorld))*objectNormal);',
        'mcCameraLocal=(mcInverseWorld*vec4(cameraPosition,1.0)).xyz;',
        'mcView=normalize(cameraPosition-modelMatrix[3].xyz);',
        // C*(v + sourceX*bias) = C*v - threeX*bias for C=diag(-1,1,1).
        'mcView.x-=0.2*(mcCameraLocal.x>0.0?-1.0:1.0);',
        'mcView=normalize(mcView);'
      ].join('\n'));
    s.fragmentShader=varying+'uniform sampler2D mcBase,mcOne,mcTwo;\nvec3 mcLinear(vec3 c){return '+(quality<2?'pow(max(c,vec3(0.0)),vec3(2.2))':'c*c')+';}\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',[
      'vec4 mcB=texture2D(mcBase,mcUv);',
      'vec3 mcN=abs(mcLocalNormal);float mcMax=max(max(mcN.x,mcN.y),mcN.z);',
      'float mcBlend;',
      'if(mcMax==mcN.x)mcBlend=mcCameraLocal.y+mcCameraLocal.z;',
      'else if(mcMax==mcN.y)mcBlend=mcCameraLocal.x+mcCameraLocal.z;',
      'else mcBlend=mcCameraLocal.x+mcCameraLocal.y;',
      'mcBlend=clamp(mcBlend,0.0,1.0);',
      'float mcNoV=pow(clamp(dot(mcWorldNormal,mcView),0.0,1.0),4.0);',
      'vec3 mcSide=mix(mcLinear(texture2D(mcOne,mcUv).rgb),mcLinear(texture2D(mcTwo,mcUv).rgb),mcBlend);',
      'diffuseColor.rgb=mix(mcSide,mcLinear(mcB.rgb),mcNoV);',
      'diffuseColor.a=mcB.a*opacity;'
    ].join('\n'));
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+intensity[1].toFixed(8)+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+intensity[2].toFixed(8)+';');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','totalEmissiveRadiance=vec3(0.0);');
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','');
  };
  warnings.push('magic_card: source view mixing implemented in viewer X-reflected world; source scene/BRDF and native deformation parity remain unverified');
  return uniforms;
}
