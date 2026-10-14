import {DataTexture,RGBAFormat,FloatType} from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const fileDefaults=runtimeContract("rainbow-default-textures.json");

// Source SURF builtins, not replacements for missing authored payloads.
const builtin=Object.fromEntries(Object.entries({normal:[.5,.5,1,1],green:[0,1,0,1]}).map(([k,a])=>{
  const t=new DataTexture(new Float32Array(a),1,1,RGBAFormat,FloatType);t.needsUpdate=true;return [k,t];
}));
export async function configureRainbow(m,p,macros,load,warnings,overrides={}){
  const n=k=>Number(p[k]),f=k=>n(k).toFixed(8);
  const v=k=>{try{return JSON.parse(p[k]);}catch{return null;}};
  const scalars=['TintValue','FaceUVOffset','CharOffset','fresnelKye','MatcapNoiseIntensity','MatcapIntensity','Dissolve_key','Dissolve_Localkey','DissolveTurn','DissolveEnableX','DissolveTurnX','DissolveEnableZ','DissolveTurnZ','DissolveOffset','DissolvePow','RainbowToBaseColorKey','Rainbow_Key','COA','COB','OPA','OPB','OPLerpA','OPLerpB','NoiseNormalIntensity','RainbowNoiseTiling','RainbowTiling','BaseRainbowIntensity','EmissiveRainbowTiling','RainbowEmissiveIntensity','Rainbow_Emissive_Key','FlowRainbowSpeed','EmissiveIntensity','FresnelScale','SpecularIntensity'];
  const vectors=['Intensity','BaseColor','RainbowColor','RainbowHue','EmissiveColor','RimColor','SpecularColor'];
  if(scalars.some(k=>p[k]===undefined||!Number.isFinite(n(k)))||vectors.some(k=>!Array.isArray(v(k))||v(k).length!==4||!v(k).every(Number.isFinite))){
    warnings.push('rainbow_film: invalid or unverified source parameters');return null;
  }
  const quality=Number.isFinite(Number(macros.RENDER_QUALITY))?Number(macros.RENDER_QUALITY):0,low=quality===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const rainbow=n('Rainbow_Key')!==0,emission=n('Rainbow_Emissive_Key')!==0,albedoRainbow=rainbow&&!change;
  const useTbn=Number(macros.NORMAL_MAP_ENABLE)!==0,normalNeeded=!low||emission;
  if((rainbow&&n('OPB')<=0)||(albedoRainbow&&n('COB')<=0)||((albedoRainbow||emission)&&v('RainbowHue').slice(0,3).every(x=>x===0))){
    warnings.push('rainbow_film: undefined power endpoint or zero hue axis requires source runtime verification');return null;
  }
  if(Number(macros.ENABLE_SOFT_BODY2)!==0){
    const names=['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'];
    if(names.some((k,j)=>!Array.isArray(v(k))||!v(k).every(Number.isFinite)||v(k)[j%3]!==0)){
      warnings.push('rainbow_film: active source soft-body displacement is not implemented');return null;
    }
  }
  const keys=['Tex0','Tex2',...(normalNeeded?['Tex1']:[]),...(!low&&albedoRainbow?['Tex3']:[]),...(albedoRainbow?['Tex4']:[])],maps={};
  for(const k of keys){
    const override=k==='Tex0'?overrides.baseColor:k==='Tex1'?overrides.normal:null;
    const binding=overrides.textureBindings?.[k],path=String(p[k]||'').replaceAll('\\','/').toLowerCase();
    if(override||binding?.url||binding?.path)maps[k]=await load(k,false,override);
    else if(builtin[path])maps[k]=builtin[path];
    else if(fileDefaults[path])maps[k]=await load(k,false,fileDefaults[path].url);
    else maps[k]=await load(k,false);
  }
  const missing=keys.filter(k=>!maps[k]);
  if(missing.length){warnings.push('rainbow_film: missing '+missing.join(', '));return null;}
  const rgb=k=>'vec3('+v(k).slice(0,3).map(x=>x.toFixed(8)).join(',')+')',i=v('Intensity');
  const uniforms={neoTime:{value:0},neoFaceOffset:{value:n('FaceUVOffset')},neoEmissionScale:{value:1}};
  for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4'])uniforms['rb'+k]={value:maps[k]||null};
  m.map=maps.Tex0;m.normalMap=useTbn&&!low?maps.Tex1:null;m.normalScale.setScalar(i[0]);
  m.roughness=i[1];m.metalness=i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 rbUv;varying vec3 rbLocal,rbWorld;\n'+s.vertexShader
      .replace('#include <uv_vertex>','#include <uv_vertex>\nrbUv=uv;')
      .replace('#include <project_vertex>','rbLocal=transformed;rbWorld=(modelMatrix*vec4(transformed,1.0)).xyz;rbWorld.x=-rbWorld.x;\n#include <project_vertex>');
    s.fragmentShader=`
      varying vec2 rbUv;varying vec3 rbLocal,rbWorld;
      uniform sampler2D rbTex0,rbTex1,rbTex2,rbTex3,rbTex4;
      uniform float neoTime,neoFaceOffset,neoEmissionScale;
      vec3 rbLinear(vec3 c){return ${quality<2?'pow(max(c,vec3(0.0)),vec3(2.2))':'c*c'};}
      // HLSL pow(negative, y) -> NaN, saturate(NaN) -> 0. Exponent is strictly positive.
      float rbPowerMask(float x,float e,float gain){return x<=0.0?0.0:clamp(pow(x,e)*gain,0.0,1.0);}
      vec3 rbHue(float key,vec3 c,float tiling){
        float angle=(key+neoTime*${f('FlowRainbowSpeed')})*tiling*6.283185308;
        vec3 axis=normalize(${rgb('RainbowHue')});
        return c*cos(angle)+cross(axis,c)*sin(angle)+axis*dot(axis,c)*(1.0-cos(angle));
      }
    `+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec2 rbMainUv=rbUv;rbMainUv.x+=rbUv.y<0.25?neoFaceOffset*${f('CharOffset')}:0.0;
      vec4 rbB=texture2D(rbTex0,rbMainUv),rbM=texture2D(rbTex2,rbMainUv);
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor='+(low?'1.0':'clamp(rbM.g*'+i[1].toFixed(8)+',0.0,1.0)')+';');
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor='+(low?'0.0':'clamp(rbM.b*'+i[2].toFixed(8)+',0.0,1.0)')+';');
    // Source raw-data uses normals for opacity; run discard only after the normal-dependent calculation.
    s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','').replace('#include <alphahash_fragment>','');
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 rbGeo=vNormal,rbView=normalize(vViewPosition);
      vec4 rbN=${normalNeeded?'texture2D(rbTex1,rbMainUv)':'vec4(0.5,0.5,1.0,1.0)'};
      vec3 rbBaseNormal=rbGeo,rbNoiseNormal=rbGeo,rbCapNormal=rbGeo;
      ${!low?`
      mat3 rbFrame=${useTbn?'tbn':'mat3(viewMatrix)*mat3(-1.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,1.0)'};
      vec3 rbDecodedN=rbN.xyz*2.0-1.0;rbDecodedN.xy*=${i[0].toFixed(8)};
      rbBaseNormal=rbFrame*normalize(rbDecodedN);
      normal=normalize(rbBaseNormal);
      ${albedoRainbow?`
      vec4 rbNoise=texture2D(rbTex3,rbMainUv*${f('RainbowNoiseTiling')});
      vec3 rbDecodedNoise=rbNoise.xyz*2.0-1.0;rbDecodedNoise.xy*=${f('NoiseNormalIntensity')};
      rbNoiseNormal=rbFrame*normalize(rbDecodedNoise);
      rbCapNormal=rbFrame*normalize(vec3(rbNoise.xy*${f('MatcapNoiseIntensity')},rbNoise.z));
      `:''}
      `:''}
      diffuseColor.rgb=${change?'rbLinear(vec3(dot(rbB.rgb,vec3(0.2125,0.7154,0.0721)))*'+rgb('BaseColor')+')*'+f('TintValue'):'rbLinear(rbB.rgb)'};
      ${albedoRainbow?`
      vec2 rbCapUv=rbCapNormal.xy*0.5+0.5;rbCapUv.y=-rbCapUv.y;
      float rbCo=rbPowerMask(dot(rbView,rbBaseNormal)-${f('COA')},${f('COB')},2.0);
      vec3 rbSwitch=mix(${rgb('RainbowColor')},rbB.rgb,${f('RainbowToBaseColorKey')});
      diffuseColor.rgb=mix(rbHue(dot(rbView,${low?'rbGeo':'rbBaseNormal+rbNoiseNormal'}),vec3(0.8,1.0,0.8),${f('RainbowTiling')})*${f('BaseRainbowIntensity')},rbLinear(rbSwitch),rbCo);
      diffuseColor.rgb+=rbLinear(texture2D(rbTex4,rbCapUv).rgb*${f('MatcapIntensity')});
      `:''}
      float rbAlpha=rbB.a;
      ${rainbow?'rbAlpha=mix('+f('OPLerpA')+','+f('OPLerpB')+',rbB.a*rbPowerMask(dot(rbView,rbGeo)-'+f('OPA')+','+f('OPB')+',2.0));':''}
      ${n('Dissolve_key')!==0?`
      vec3 rbDis=mix(rbWorld,rbLocal,${f('Dissolve_Localkey')});
      float rbReversal=mix(rbDis.y,1.0-rbDis.y,${f('DissolveTurn')});
      rbReversal=mix(rbReversal,mix(rbDis.x,1.0-rbDis.x,${f('DissolveTurnX')}),${f('DissolveEnableX')});
      rbReversal=mix(rbReversal,mix(rbDis.z,1.0-rbDis.z,${f('DissolveTurnZ')}),${f('DissolveEnableZ')});
      rbAlpha*=clamp(rbReversal*${f('DissolvePow')}-${f('DissolveOffset')},0.0,1.0);
      `:''}
      diffuseColor.a=rbAlpha*opacity;
      #include <alphatest_fragment>
      #include <alphahash_fragment>
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      float rbRimF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(rbBaseNormal,rbView),5.0),0.0,1.0);
      vec3 rbRim=rbRimF*${rgb('RimColor')}*${i[3].toFixed(8)};
      vec3 rbBaseEmis=rbLinear(clamp(pow(rbB.rgb,vec3(4.0)),0.0,1.0)*${rgb('EmissiveColor')}*${f('EmissiveIntensity')})*rbM.a+rbRim;
      vec3 rbEmis=rbBaseEmis;
      ${emission?`
      vec3 rbHueEmis=rbLinear(rbHue(rbMainUv.x,vec3(0.4,0.6,0.8),${f('EmissiveRainbowTiling')}))*${f('RainbowEmissiveIntensity')};
      rbEmis=mix(rbHueEmis*clamp(cos(rbMainUv.x+neoTime)+1.0,0.0,1.0)*rbM.a+rbRim,rbBaseEmis,rbN.a);
      `:''}
      float rbBy=rbPowerMask(dot(rbView,rbGeo)-0.3,0.1,1.5);
      totalEmissiveRadiance=(mix(rbEmis,vec3(0.4*(1.0-rbBy)),clamp(${f('fresnelKye')},0.0,1.0))+rbRim)*neoEmissionScale;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',low?'':'reflectedLight.indirectDiffuse*=rbM.r;\n#if defined(USE_ENVMAP) && defined(STANDARD)\nreflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),rbM.r,material.roughness);\n#endif');
    // Source specular=1 gives dielectric F0=0.08; iso_spec_color only tints direct specular.
    s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(0.08);\nmaterial.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);');
    s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*='+rgb('SpecularColor')+'*'+f('SpecularIntensity')+';');
  };
  warnings.push('rainbow_film: source channels and clock restored; scene/BRDF, derivative TBN without authored tangents and Android power edge semantics need native parity validation');
  return uniforms;
}
