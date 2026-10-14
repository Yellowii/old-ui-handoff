// Source: standard_common_mffxbb.hlsl and its SURF defaults.
export async function configureMffxbb(m,p,macros,load,warnings){
  const v=(k,d)=>{try{return p[k]===undefined?d:JSON.parse(p[k]);}catch{return null;}};
  const n=(k,d)=>p[k]===undefined?d:Number(p[k]);
  const i=v('Intensity',[1,1,1,0]),b=v('BaseColor',[1,1,1,1]),fu=v('FlakeUV',[1,1,1,1]),f2=v('Flake2UV',[1,1,1,1]),ei=v('EmisIntensity',[1,1,1,1]);
  const colors=Object.fromEntries(['EmissiveColor','EdgeColor','FlakeColor01','FlakeColor02','wingColor'].map(k=>[k,v(k,k==='EmissiveColor'?[0,0,0,0]:[1,1,1,1])]));
  const tint=n('TintValue',1),wing=n('WingEmisIntensity',1);
  if([i,b,fu,f2,ei,...Object.values(colors)].some(a=>!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite))||![tint,wing].every(Number.isFinite)){
    warnings.push('mffxbb: invalid source parameters');return null;
  }
  const quality=Number.isFinite(Number(macros.RENDER_QUALITY))?Number(macros.RENDER_QUALITY):0,low=quality===2;
  const useNormal=!low&&Number(macros.LIGHT_ENABLE)!==0&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const keys=['Tex0','Tex2','Tex3','Tex4',...(useNormal?['Tex1']:[])],maps={};
  for(const key of keys)maps[key]=await load(key,false);
  const missing=keys.filter(k=>!maps[k]);
  if(missing.length){warnings.push('mffxbb: missing '+missing.join(', '));return null;}
  const f=x=>x.toFixed(8),rgb=a=>'vec3('+a.slice(0,3).map(f).join(',')+')';
  const uniforms={mfBase:{value:maps.Tex0},mfNormal:{value:maps.Tex1||null},mfOrm:{value:maps.Tex2},mfMask:{value:maps.Tex3},mfFlake:{value:maps.Tex4}};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;m.normalScale.setScalar(i[0]);
  m.roughness=i[1];m.metalness=i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 mfUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nmfUv=uv;');
    s.fragmentShader='varying vec2 mfUv;uniform sampler2D mfBase,mfNormal,mfOrm,mfMask,mfFlake;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',[
      'vec4 mfB=texture2D(mfBase,mfUv),mfO=texture2D(mfOrm,mfUv),mfX=texture2D(mfMask,mfUv);',
      'vec3 mfColor='+(Number(macros.CHAR_CHANGE_COLOR)===1?'vec3(dot(mfB.rgb,vec3(0.2125,0.7154,0.0721)))':'mfB.rgb')+'*'+rgb(b)+';',
      'diffuseColor.rgb='+(quality<2?'pow(max(mfColor,vec3(0.0)),vec3(2.2))':'mfColor*mfColor')+'*'+f(tint)+';',
      'diffuseColor.a=mfB.a*'+f(b[3])+'*opacity;'
    ].join('\n'));
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+(low?'0.5':'clamp(mfO.g*'+f(i[1])+',0.0,1.0)')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+(low?'0.0':'clamp(mfO.b*'+f(i[2])+',0.0,1.0)')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?'vec3 mfN=texture2D(mfNormal,mfUv).xyz*2.0-1.0;mfN.xy*='+f(i[0])+';normal=normalize(tbn*normalize(mfN));':'');
    const sample=(a,j)=>'texture2D(mfFlake,mfUv*'+f(a[j])+'+vec2('+f(a[j+2])+')).r';
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',[
      'float mfF='+sample(fu,0)+'*'+sample(fu,1)+';',
      'float mfG='+sample(f2,0)+'*'+sample(f2,1)+';',
      'totalEmissiveRadiance=mfB.rgb*'+rgb(colors.EmissiveColor)+'*'+f(ei[0])+'*mfX.r',
      '+step(0.01,mfO.a)*'+rgb(colors.EdgeColor)+'*'+f(ei[1]),
      '+mfF*'+rgb(colors.FlakeColor01)+'*(mfX.r-mfX.a)*'+f(ei[2]),
      '+pow(mfG,3.0)*'+rgb(colors.FlakeColor02)+'*mfX.a*'+f(ei[3]),
      '+mfF*'+rgb(colors.FlakeColor02)+'*mfX.a*0.8',
      '+mfX.g*'+rgb(colors.wingColor)+'*'+f(wing)+';'
    ].join('\n'));
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',low?'':'reflectedLight.indirectDiffuse*=mfO.r;\n#if defined(USE_ENVMAP) && defined(STANDARD)\nreflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),mfO.r,material.roughness);\n#endif');
  };
  warnings.push('mffxbb: source flake/colour/ORM channels implemented; source scene/BRDF not matched; derivative TBN used without authored tangents');
  return uniforms;
}
