import {sourceVector as vector,validSourceInputs,sourceMaps,sourceMatcapGlsl} from './source-matcap-inputs.js';

export async function configureJade(m,p,macros,load,warnings,overrides={}){
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1,useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0,lit=Number(macros.LIGHT_ENABLE)!==0;
  const valid=validSourceInputs(p,macros,['Intensity','BaseColor','RimColor','DepthPara','DepthPara2','DepthPara3','MatcapPara','MatcapPara2','iceColor','lerpColor','LerpColor'],['TintValue','FresnelScale','FaceUVOffset','CharOffset','EmissiveValue','IceMask','InStrength','LerpStep','UnlitValue']);
  if(!valid||(!low&&(Number(p.LerpStep)<=0||vector(p.DepthPara)[3]<=0||vector(p.DepthPara3).slice(0,2).some(x=>x<=0)||vector(p.MatcapPara2)[0]<=0))){warnings.push('jade: invalid source input, undefined power/smoothstep endpoint or active softbody');return null;}
  const maps=await sourceMaps(['Tex0','Tex4',...(!low?['Tex2']:[]),...(useNormal?['Tex3']:[]),...(!low&&!change?['Tex5']:[])],p,load,overrides,'Tex3',warnings);
  if(!maps){warnings.push('jade: missing active source textures');return null;}
  const f=x=>Number(x).toFixed(8),rgb=k=>'vec3('+vector(p[k]).slice(0,3).map(f).join(',')+')',i=vector(p.Intensity),d=vector(p.DepthPara),d2=vector(p.DepthPara2),d3=vector(p.DepthPara3),q=vector(p.MatcapPara),q2=vector(p.MatcapPara2),base=vector(p.BaseColor);
  const u={neoFaceOffset:{value:Number(p.FaceUVOffset)},neoEmissionScale:{value:1},neoSourceSpecular:{value:d2[3]}};for(const k of ['Tex0','Tex2','Tex3','Tex4','Tex5'])u['jd'+k]={value:maps[k]||null};
  m.map=maps.Tex0;m.normalMap=useNormal?maps.Tex3:null;m.normalScale.setScalar(i[0]);m.roughness=i[1];m.metalness=i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,u);s.vertexShader='varying vec2 jdUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\njdUv=uv;');
    s.fragmentShader=`varying vec2 jdUv;uniform sampler2D jdTex0,jdTex2,jdTex3,jdTex4,jdTex5;uniform float neoFaceOffset,neoEmissionScale,neoSourceSpecular;
      vec3 jdLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
      ${sourceMatcapGlsl}\n`+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec2 jdMainUv=jdUv;jdMainUv.x+=jdUv.y<0.25?neoFaceOffset*${f(p.CharOffset)}:0.0;
      vec4 jdB=texture2D(jdTex0,jdMainUv),jdO=texture2D(jdTex4,jdMainUv);
      diffuseColor.a=${f(base[3])}*opacity;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+(low?'0.5':`clamp(mix(${f(i[1])},jdO.g,${f(q[2])}),0.0,1.0)` )+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+(low?'0.0':`clamp(mix(${f(i[2])},jdO.b,${f(q[3])}),0.0,1.0)`)+';');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 jdView=normalize(vViewPosition),jdCapNormal=vNormal,jdLayerColor=vec3(0.0);
      ${useNormal?`vec3 jdDecoded=texture2D(jdTex3,jdMainUv).xyz*2.0-1.0;jdCapNormal=tbn*normalize(jdDecoded);${lit?`jdDecoded.xy*=${f(i[0])};normal=normalize(tbn*normalize(jdDecoded));`:''}`:''}
      ${!low?`
      vec3 jdTangentView=${useNormal?'transpose(tbn)*jdView':'(transpose(mat3(viewMatrix))*jdView)*vec3(-1.0,1.0,1.0)'};
      float jdLayer1=texture2D(jdTex2,jdMainUv*${f(d[0])}-${f(d[1])}*jdTangentView.xy).r;
      float jdLayer2=texture2D(jdTex2,jdMainUv*${f(d2[1])}-${f(d[2])}*jdTangentView.xy).g;
      float jdMask=texture2D(jdTex2,jdMainUv).a;
      float jdNdv=1.0-clamp(dot(vNormal,jdView),0.0,1.0);
      float jdLayer=pow(jdLayer1,${f(d3[0])})*${f(d3[3])}+pow(jdLayer2,${f(d3[1])})*${f(d3[2])};
      vec3 jdInner=mix(vec3(jdLayer),${rgb('iceColor')},pow(jdNdv,${f(d[3])}));
      vec3 jdBase=mix(jdB.rgb,${rgb('lerpColor')},jdMask);
      jdLayerColor=jdInner*max(jdB.a,${f(p.IceMask)})+pow(jdBase,vec3(${f(q2[0])}))*${f(q2[1])};
      jdLayerColor*=mix(vec3(${f(p.InStrength)}),${rgb('LerpColor')},smoothstep(0.0,${f(p.LerpStep)},jdNdv-jdLayer2*0.1));
      `:''}
      ${change?`diffuseColor.rgb=jdLinear(vec3(dot(jdLayerColor,vec3(0.2125,0.7154,0.0721)))*${rgb('BaseColor')})*${f(p.TintValue)};`:low?`diffuseColor.rgb=jdLinear(jdB.rgb*${rgb('BaseColor')})*${f(p.TintValue)};`:`
      vec4 jdCap=texture2D(jdTex5,sourceMatcapUV(jdCapNormal,jdView));
      diffuseColor.rgb=jdLinear(jdLayerColor*${rgb('BaseColor')})*(${f(p.TintValue)}-${f(p.UnlitValue)})+jdLinear(jdCap.aaa)*${f(q[1])}+jdLinear(jdCap.ggg)*${f(q[0])};
      `}
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      float jdF=clamp(${f(p.FresnelScale)}+(1.0-${f(p.FresnelScale)})*pow(1.0-dot(normal,jdView),5.0),0.0,1.0);
      totalEmissiveRadiance=(jdF*${rgb('RimColor')}*${f(i[3])}+jdO.a*jdB.rgb*jdB.rgb*${f(p.EmissiveValue)}${low?'':`+jdLayerColor*(${f(d2[2])}+${f(p.UnlitValue)})`})*neoEmissionScale;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',low?'':'reflectedLight.indirectDiffuse*=jdO.r;\n#if defined(USE_ENVMAP) && defined(STANDARD)\nreflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),jdO.r,material.roughness);\n#endif');
    // GetSpecularFromMaterial in the verified source shading_models_common.hlsl.
    s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(neoSourceSpecular*0.08);\nmaterial.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);');
  };
  warnings.push('玉石源主通道与 specular/F0 已转写；降级预览边界：原完整 BRDF、场景光照、缺源切线时的导数 TBN 未等价');return u;
}
