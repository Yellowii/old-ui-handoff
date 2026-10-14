import {sourceVector as vector,validSourceInputs,sourceMaps,sourceMatcapGlsl} from './source-matcap-inputs.js';

export async function configureBlend2Mc(m,p,macros,load,warnings,overrides={}){
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0,lit=Number(macros.LIGHT_ENABLE)!==0;
  if(!validSourceInputs(p,macros,['Intensity','BaseColor','RimColor','MetalColor','MetalColor2','Para1'],['TintValue','FresnelScale','FaceUVOffset','CharOffset','EmissiveValue','emisColorPow','baseMult'])||Number(p.emisColorPow)<=0){
    warnings.push('blend2mc: invalid source input, undefined power endpoint or active softbody');return null;
  }
  const blackBinding=overrides.textureBindings?.Tex4;
  // Source Para1.b disables the only Tex4 alpha consumer. Do not assign builtin alpha.
  const blackRgbOnly=p.Tex4==='black'&&!blackBinding?.url&&!blackBinding?.path&&vector(p.Para1)[2]===0;
  const maps=await sourceMaps(['Tex0','Tex2',...(!low?['Tex1']:[]),...(!low&&!change?['Tex3',...(!blackRgbOnly?['Tex4']:[])]:[])],p,load,overrides,'Tex1',warnings);
  if(!maps){warnings.push('blend2mc: missing active source textures');return null;}
  const f=x=>Number(x).toFixed(8),rgb=k=>'vec3('+vector(p[k]).slice(0,3).map(f).join(',')+')',i=vector(p.Intensity),q=vector(p.Para1),base=vector(p.BaseColor);
  const u={neoFaceOffset:{value:Number(p.FaceUVOffset)},neoEmissionScale:{value:1}};for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4'])u['bm'+k]={value:maps[k]||null};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex1:null;m.normalScale.setScalar(i[0]);m.roughness=i[1];m.metalness=0;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,u);s.vertexShader='varying vec2 bmUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nbmUv=uv;');
    s.fragmentShader=`varying vec2 bmUv;uniform sampler2D bmTex0,bmTex1,bmTex2,bmTex3,bmTex4;uniform float neoFaceOffset,neoEmissionScale;
    vec3 bmLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    ${sourceMatcapGlsl}\n`+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec2 bmMainUv=bmUv;bmMainUv.x+=bmUv.y<0.25?neoFaceOffset*${f(p.CharOffset)}:0.0;
      vec4 bmB=texture2D(bmTex0,bmMainUv),bmO=texture2D(bmTex2,bmMainUv),bmN=${low?'vec4(0.0)':'texture2D(bmTex1,bmMainUv)'};
      diffuseColor.a=bmB.a*${f(base[3])}*opacity;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+(low?'0.5':`clamp(mix(${f(i[1])},bmO.g,bmN.a),0.0,1.0)` )+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+(low?'0.0':'clamp(bmO.b,0.0,1.0)')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 bmView=normalize(vViewPosition),bmCapNormal=vNormal;
      ${useNormal?`vec3 bmDecoded=bmN.xyz*2.0-1.0;bmCapNormal=tbn*normalize(bmDecoded);${lit?`bmDecoded.xy*=${f(i[0])};normal=normalize(tbn*normalize(bmDecoded));`:''}`:''}
      ${!low&&!change?`
      vec2 bmCapUv=sourceMatcapUV(bmCapNormal,bmView);
      vec4 bmA=texture2D(bmTex3,bmCapUv)${blackRgbOnly?'':',bmC=texture2D(bmTex4,bmCapUv)'};
      float bmMask=texture2D(bmTex3,bmMainUv).a,bmMetalMask=${blackRgbOnly?'0.0':'texture2D(bmTex4,bmMainUv).r'};
      vec3 bmMetal=mix(${rgb('MetalColor')},${rgb('MetalColor2')},bmMetalMask);
      vec3 bmTemp=mix(bmA.rgb,bmB.rgb,${f(q[0])})*bmMetal*mix(1.0,${f(q[1])},bmMask);
      vec3 bmFinal=mix(bmTemp,bmB.rgb,bmN.a);
      diffuseColor.rgb=bmLinear(bmFinal*${rgb('BaseColor')})*mix(${f(p.TintValue)},1.0,bmN.a)*${f(p.baseMult)}${blackRgbOnly?'':`+bmLinear(bmC.aaa)*${f(q[2])}+bmLinear(bmC.ggg)*${f(q[3])}`};
      `:`diffuseColor.rgb=bmLinear(${change?'vec3(dot(bmB.rgb,vec3(0.2125,0.7154,0.0721)))':'bmB.rgb'}*${rgb('BaseColor')})*${f(p.TintValue)};`}
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      float bmF=clamp(${f(p.FresnelScale)}+(1.0-${f(p.FresnelScale)})*pow(1.0-dot(normal,bmView),5.0),0.0,1.0);
      totalEmissiveRadiance=(bmF*${rgb('RimColor')}*${f(i[3])}+bmO.a*pow(bmB.rgb,vec3(${f(p.emisColorPow)}))*${f(p.EmissiveValue)})*neoEmissionScale;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',low?'':'reflectedLight.indirectDiffuse*=bmO.r;\n#if defined(USE_ENVMAP) && defined(STANDARD)\nreflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),bmO.r,material.roughness);\n#endif');
  };
  warnings.push('双 MatCap 源主通道已转写；降级预览边界：原 BRDF/场景光照、缺源切线时的导数 TBN 未等价');return u;
}
