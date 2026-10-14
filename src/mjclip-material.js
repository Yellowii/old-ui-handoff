// Source: mjclip.hlsl and mjclip.surf. Local Z is unchanged by the viewer's X reflection.
export async function configureMjclip(m,p,macros,load,warnings){
  const n=(k,d)=>p[k]===undefined?d:Number(p[k]);
  const v=(k,d)=>{try{return p[k]===undefined?d:JSON.parse(p[k]);}catch{return null;}};
  const i=v('Intensity',[1,1,1,0]),b=v('BaseColor',[1,1,1,1]),e=v('EmissiveColor',[0,0,0,0]);
  const tint=n('TintValue',1),alpha=n('Alpha',1),threshold=n('AlphaMaskThreshold',0);
  if([i,b,e].some(a=>!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite))||![tint,alpha,threshold].every(Number.isFinite)){
    warnings.push('mjclip: invalid source parameters');return null;
  }
  const quality=Number.isFinite(Number(macros.RENDER_QUALITY))?Number(macros.RENDER_QUALITY):0,low=quality===2;
  const useNormal=!low&&Number(macros.LIGHT_ENABLE)!==0&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const keys=['Tex0','Tex2',...(useNormal?['Tex1']:[])],maps={};
  for(const key of keys)maps[key]=await load(key,false);
  const missing=keys.filter(k=>!maps[k]);
  if(missing.length){warnings.push('mjclip: missing '+missing.join(', '));return null;}
  const f=x=>x.toFixed(8),rgb=a=>'vec3('+a.slice(0,3).map(f).join(',')+')';
  const uniforms={mjBase:{value:maps.Tex0},mjOrm:{value:maps.Tex2},mjNormal:{value:maps.Tex1||null}};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;m.normalScale.setScalar(i[0]);
  m.roughness=i[1];m.metalness=i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 mjUv;varying float mjLocalZ;\n'+s.vertexShader
      .replace('#include <uv_vertex>','#include <uv_vertex>\nmjUv=uv;')
      .replace('#include <project_vertex>','mjLocalZ=transformed.z;\n#include <project_vertex>');
    s.fragmentShader='varying vec2 mjUv;varying float mjLocalZ;uniform sampler2D mjBase,mjOrm,mjNormal;\n'+s.fragmentShader;
    // Below zeroPoint the numerator is positive. A zero denominator saturates +Inf to 1.
    const fade=threshold===-.07?'1.0':'clamp((-0.07-mjLocalZ)/(-0.07-('+f(threshold)+')),0.0,1.0)';
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',[
      'vec4 mjB=texture2D(mjBase,mjUv),mjO=texture2D(mjOrm,mjUv);',
      'vec3 mjColor=mjB.rgb*'+rgb(b)+';',
      'diffuseColor.rgb='+(quality<2?'pow(max(mjColor,vec3(0.0)),vec3(2.2))':'mjColor*mjColor')+'*'+f(tint)+';',
      'diffuseColor.a=(mjLocalZ>=-0.07?0.0:'+f(alpha)+'*'+fade+')*opacity;'
    ].join('\n'));
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+(low?'0.5':'clamp(mjO.g*'+f(i[1])+',0.0,1.0)')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+(low?'0.0':'clamp(mjO.b*'+f(i[2])+',0.0,1.0)')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?'vec3 mjN=texture2D(mjNormal,mjUv).xyz*2.0-1.0;mjN.xy*='+f(i[0])+';normal=normalize(tbn*normalize(mjN));':'');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','totalEmissiveRadiance=mjO.a*'+rgb(e)+'*'+f(i[3])+'*'+f(tint)+';');
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','');
  };
  warnings.push('mjclip: source local-Z, opacity and texture channels implemented; source scene/BRDF not matched; derivative TBN used without authored tangents');
  return uniforms;
}
