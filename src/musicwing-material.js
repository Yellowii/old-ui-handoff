// Source: standard_common_musicwing.hlsl. Scene BRDF remains Three's preview.
export async function configureMusicwing(m,p,macros,load,warnings){
  const n=(k,d)=>p[k]===undefined?d:Number(p[k]);
  const v=(k,d)=>{try{return p[k]===undefined?d:JSON.parse(p[k]);}catch{return null;}};
  const i=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]);
  const colors=Object.fromEntries(['Color1','Color2','Color3','Color4','Color5','EmissiveColor','BorderColor'].map(k=>[k,v(k,k==='EmissiveColor'?[0,0,0,0]:k==='BorderColor'?[1,.8,.3,1]:[1,1,1,1])]));
  const values={TintValue:n('TintValue',1),UGCKey_R:n('UGCKey_R',1),UGCKey_M:n('UGCKey_M',1),BorderScale:n('BorderScale',.03),BorderIntensity:n('BorderIntensity',3)};
  for(let j=1;j<=4;j++)values['emisStrength'+j]=n('emisStrength'+j,0);
  if([i,base,...Object.values(colors)].some(a=>!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite))||!Object.values(values).every(Number.isFinite)){
    warnings.push('musicwing: invalid source parameters');return null;
  }
  const low=Number(macros.RENDER_QUALITY)===2;
  const useNormal=!low&&Number(macros.LIGHT_ENABLE)!==0&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const keys=['Tex0','Tex2','Tex3',...(useNormal?['Tex1']:[])],maps={};
  for(const key of keys)maps[key]=await load(key,false);
  const missing=keys.filter(k=>!maps[k]);
  if(missing.length){warnings.push('musicwing: missing '+missing.join(', '));return null;}
  const f=k=>values[k].toFixed(8),rgb=k=>'vec3('+colors[k].slice(0,3).map(x=>x.toFixed(8)).join(',')+')';
  const uniforms={mwBase:{value:maps.Tex0},mwOrm:{value:maps.Tex2},mwMask:{value:maps.Tex3},mwNormal:{value:maps.Tex1||null}};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;m.normalScale.setScalar(i[0]);
  m.roughness=i[1];m.metalness=i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 mwUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nmwUv=uv;');
    s.fragmentShader='varying vec2 mwUv;uniform sampler2D mwBase,mwOrm,mwMask,mwNormal;\nvec3 mwLinear(vec3 c){return '+(low?'c*c':'pow(c,vec3(2.2))')+';}\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',[
      'vec4 mwB=texture2D(mwBase,mwUv),mwO=texture2D(mwOrm,mwUv),mwX=texture2D(mwMask,mwUv);',
      'vec3 mwBg=mix('+rgb('Color1')+','+rgb('Color2')+',mwX.g)*'+f('emisStrength1')+';',
      'vec3 mwLog=mwX.b*'+rgb('Color5')+'*'+f('emisStrength2')+'+mwX.r*'+rgb('Color4')+'*'+f('emisStrength3')+';',
      'vec3 mwWing=mix(mwBg*mwX.a,mwLog,mwX.b+mwX.r)+(1.0-pow(mwX.a,0.3))*'+rgb('Color3')+'*'+f('emisStrength4')+';',
      'diffuseColor.rgb=mwLinear(mwB.rgb*vec3('+base.slice(0,3).map(x=>x.toFixed(8)).join(',')+'))*'+f('TintValue')+(low?'+mwWing':'')+';',
      'diffuseColor.a=mwB.a*'+base[3].toFixed(8)+'*opacity;'
    ].join('\n'));
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+(low?'0.5':'mix('+i[1].toFixed(8)+',mwO.g*'+i[1].toFixed(8)+','+f('UGCKey_R')+')')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+(low?'0.0':'mix('+i[2].toFixed(8)+',clamp(mwO.b*'+i[2].toFixed(8)+',0.0,1.0),'+f('UGCKey_M')+')')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?'vec3 mwN=texture2D(mwNormal,mwUv).xyz*2.0-1.0;mwN.xy*='+i[0].toFixed(8)+';normal=normalize(tbn*normalize(mwN));':'');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',
      'totalEmissiveRadiance='+rgb('EmissiveColor')+'*mwO.a*'+i[3].toFixed(8)+'*'+f('TintValue')+'+mwWing;\n'+
      (Number(macros.ENABLE_BORDER)===1?'float mwNoV=clamp(1.0-dot(normal,normalize(vViewPosition)),0.0,1.0);\ntotalEmissiveRadiance+='+rgb('BorderColor')+'*clamp('+f('BorderScale')+'+pow(mwNoV,5.0)*(1.0-'+f('BorderScale')+'),0.0,1.0)*'+f('BorderIntensity')+';':''));
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',low?'':'reflectedLight.indirectDiffuse*=mwO.r;\n#if defined(USE_ENVMAP) && defined(STANDARD)\nreflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),mwO.r,material.roughness);\n#endif');
  };
  warnings.push('musicwing: source texture channels implemented; source BRDF/scene lighting not matched; derivative TBN used if authored tangents are absent');
  return uniforms;
}
