import {Vector3} from 'three';

// nl.hlsl: the face atlas changes only Tex0 RGB; ORM and normals retain UV0.
export async function configureNl(m,p,macros,load,warnings){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length===d.length&&a.every(Number.isFinite))return a;}catch{}return d;};
  const f=(k,d=0)=>n(k,d).toFixed(8),gl=a=>`vec${a.length}(${a.map(x=>x.toFixed(8)).join(',')})`;
  const low=Number(macros.RENDER_QUALITY)===2,useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const face=n('CharOffset',1)===1,type=n('EmojiTexType',1),faceOffset=n('FaceUVOffset'),
    needsEmoji=face&&faceOffset*4+1>4,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  if(![0,1].includes(n('CharOffset',1))){warnings.push('nl.surf 的 CharOffset 不是源定义的 0/1，保持未适配');return null;}
  if(face&&![1,2].includes(type)){warnings.push('nl.surf 的 EmojiTexType 不是源定义的 1/2，保持未适配');return null;}
  // Preserve the declared Surface builtin for legacy records that omit Tex3,
  // but do not promote an explicitly empty authored binding. The inactive
  // atlas branch never samples either value.
  const al=await load('Tex0'),mix=await load('Tex2'),nm=useNormal?await load('Tex1'):null,
    emoji=needsEmoji||(!needsEmoji&&face&&p.Tex3===undefined)?await load('Tex3'):null;
  const missing=[['Tex0',al],['Tex2',mix],...(useNormal?[['Tex1',nm]]:[]),...(needsEmoji?[['Tex3',emoji]]:[])].filter(([,t])=>!t);
  if(missing.length){warnings.push(`nl.surf 源输入未闭合：${missing.map(([k])=>k).join(', ')}；未使用替代贴图`);return null;}
  const base=v('BaseColor',[1,1,1,1]),i=v('Intensity',[1,1,1,0]),sun=v('SunDirection',[0,0,0]),hasSun=Math.hypot(...sun)>0;
  m.map=al;m.normalMap=useNormal?nm:null;m.normalScale.setScalar(i[0]);m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoNlBase:{value:al},neoNlNormal:{value:nm},neoNlMix:{value:mix},neoNlEmoji:{value:emoji},neoFaceOffset:{value:faceOffset},neoNlSun:{value:new Vector3(...sun)},neoEmissionScale:{value:1}};
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec2 neoNlUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoNlUv=uv;');
    s.fragmentShader=`varying vec2 neoNlUv;uniform sampler2D neoNlBase,neoNlNormal,neoNlMix,neoNlEmoji;
      uniform float neoFaceOffset,neoEmissionScale;uniform vec3 neoNlSun;
      vec3 neoNlLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec2 nlUv=neoNlUv;
      ${face?'if(nlUv.y<.25)nlUv.x+=fract(neoFaceOffset);':''}
      vec4 nlBase=texture2D(neoNlBase,nlUv);
      nlBase.rgb=neoNlLinear(nlBase.rgb);
      vec4 nlMix=texture2D(neoNlMix,neoNlUv);
      float nlEmojiAlpha=nlMix.a;
      ${needsEmoji?`float nlIndex=neoFaceOffset*4.0+1.0;
      if(nlIndex>4.0){
        float nlCell=nlIndex-5.0,nlRow=floor(nlCell/4.0),nlCol=nlCell-nlRow*4.0;
        vec2 nlEmojiUv=${type===2?'vec2(neoNlUv.x,neoNlUv.y*.5)':'neoNlUv'}+vec2(nlCol*.25,nlRow*${type===2?'.125':'.25'});
        vec4 nlEmoji=texture2D(neoNlEmoji,nlEmojiUv);
        float nlFaceMask=step(neoNlUv.x,.25)*step(neoNlUv.y,.25);
        nlBase.rgb=mix(nlBase.rgb,neoNlLinear(nlEmoji.rgb),nlFaceMask);
        nlEmojiAlpha=nlEmoji.a;
      }`:''}
      diffuseColor.rgb=${change?`neoNlLinear(vec3(dot(nlBase.rgb,vec3(.2125,.7154,.0721)))*${gl(base.slice(0,3))})*${f('TintValue',1)}`:'nlBase.rgb'};
      diffuseColor.a=nlBase.a*${base[3].toFixed(8)}*opacity;
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(nlMix.g*${i[1].toFixed(8)},0.0,1.0)`};`);
    s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':'clamp(nlMix.b,0.0,1.0)'};`);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?`
      vec3 nlNormal=texture2D(neoNlNormal,neoNlUv).xyz*2.0-1.0;
      nlNormal.xy*=${i[0].toFixed(8)};
      normal=normalize(tbn*normalize(nlNormal));
    `:'');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      vec3 nlView=normalize(vViewPosition);float nlNV=dot(normal,nlView);
      float nlF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-nlNV,5.0),0.0,1.0);
      vec3 nlExtra=vec3(0.0);
      ${low?'':`
      vec3 nlLight=vec3(0.0);
      ${hasSun?'nlLight=mat3(viewMatrix)*(-neoNlSun*vec3(-1.0,1.0,1.0));':`
      #if NUM_DIR_LIGHTS > 0
      nlLight=directionalLights[0].direction;
      #endif
      `}
      float nlSun=clamp(dot(nlLight,nlView)*1.2,0.0,1.0);
      vec3 nlB=nlBase.rgb*${gl(v('Color0',[1,1,1,1]).slice(0,3))}*(1.0-clamp((nlNV-.1)*1.2,0.0,1.0));
      vec3 nlA=nlBase.rgb*${gl(v('Color1',[1,1,1,1]).slice(0,3))}*(1.0-clamp((nlNV-.5)*1.6,0.0,1.0));
      vec3 nlC=(1.0-clamp((nlNV-.1)*1.3,0.0,1.0))*nlBase.rgb*${f('FrAddIntensity',.4)};
      nlExtra=(mix(nlA,nlB,nlSun)+nlC*nlMix.a)*nlEmojiAlpha;
      `}
      totalEmissiveRadiance=(nlF*${gl(v('RimColor',[0,0,0,0]).slice(0,3))}*${i[3].toFixed(8)}+nlExtra)*neoEmissionScale;
    `);
  };
  if(!low&&!hasSun)warnings.push('nl.surf 未提供源 SunDirection，发光预览使用当前场景首个方向光，非原场景光照还原');
  warnings.push('nl.surf 面部图集与材质通道已转写；源切线、Specular=1/SpecularColor、SmoothDiffuse 和软体仍待还原');
  return uniforms;
}
