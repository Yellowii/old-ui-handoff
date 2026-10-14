import {ShaderChunk} from 'three';

// Source: Android unlit_jelly_char{,_gradient} and unlit_jelly_inner{,01}.
export async function configureJelly(m,p,macros,load,gradient,warnings,overrides={},pass=null){
  const inner=pass!==null,front=pass===1;
  const n=(key,fallback=0)=>Number.isFinite(Number(p[key]))?Number(p[key]):fallback;
  const f=(key,fallback=0)=>n(key,fallback).toFixed(8);
  const v=(key,fallback=[1,1,1,1])=>{let a;try{a=JSON.parse(p[key]);}catch{}return Array.isArray(a)&&a.length===4&&a.every(Number.isFinite)?a:fallback;};
  const rgb=key=>`vec3(${v(key).slice(0,3).map(x=>x.toFixed(8)).join(',')})`;
  const vec2=(key,fallback=[0,0])=>{let a;try{a=JSON.parse(p[key]);}catch{}return `vec2(${(Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)?a:fallback).map(x=>x.toFixed(8)).join(',')})`;};
  const low=Number(macros.RENDER_QUALITY)===2;
  const change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const intensity=v('Intensity',[1,1,1,0]);
  const diffuse=await load('Tex0',false,overrides.baseColor),normalMap=await load('Tex1',false,overrides.normal),cap=await load('Tex2');
  const cap2=inner?await load('Tex3'):null,light=front?await load('Tex4'):null,colorMap=front?await load('Tex5'):null;
  const secondUV=front&&Number(macros.TEXCOORD1_ENABLE)===1;
  if(secondUV)m.defines={...m.defines,USE_UV1:''};
  const builtin={black:'vec4(0.0,0.0,0.0,1.0)',white:'vec4(1.0)',green:'vec4(0.0,1.0,0.0,1.0)',normal:'vec4(.5,.5,1.0,1.0)'};
  const sample=(key,texture,uniform,uv,fallback)=>{
    if(texture)return `texture2D(${uniform},${uv})`;
    const name=p[key]||fallback;
    if(!builtin[name])warnings.push(`果冻材质贴图未绑定：${key} (${name})`);
    return builtin[name]||builtin[fallback];
  };
  const diffuseSample=sample('Tex0',diffuse,'neoJellyDiffuse','neoFaceUv(neoJellyUv)','green');
  const normalSample=sample('Tex1',normalMap,'neoJellyNormal','neoFaceUv(neoJellyUv)','normal');
  const capSample=sample('Tex2',cap,'neoJellyCap','neoJellyCapUv',inner?'green':'white');
  m.map=diffuse;m.normalMap=low?null:normalMap;m.normalScale.setScalar(intensity[0]);
  m.color.set(0xffffff);m.emissive.set(0);m.emissiveIntensity=0;m.roughness=intensity[1];m.metalness=intensity[2];
  const uniforms={neoJellyDiffuse:{value:diffuse},neoJellyNormal:{value:normalMap},neoJellyCap:{value:cap}};
  if(inner)Object.assign(uniforms,{neoJellyCap2:{value:cap2},neoTime:{value:0},neoEmissionScale:{value:1}});
  if(front)Object.assign(uniforms,{neoJellyLight:{value:light},neoJellyColorMap:{value:colorMap},neoJellyHasUv:{value:1}});
  const cap2Sample=inner?sample('Tex3',cap2,'neoJellyCap2','neoJellyCapUv','green'):'';
  const opacityMask=front?sample('Tex2',cap,'neoJellyCap','neoFaceUv(neoJellyUv)','green'):'';
  const main1=v('MainTexPara',[1,1,0,0]),main2=v('MainTexPara2',[1,1,0,0]);
  const uvTransform=a=>`neoDynUv*vec2(${a.slice(0,2).join(',')})+neoTime*vec2(${a.slice(2).join(',')})`;
  const dynamic=front&&!low?`
      vec2 neoDynUv=${secondUV?'neoJellySecondUv':'neoFaceUv(neoJellyUv)'};
      vec2 neoLightUv=neoDynUv*${vec2('dynlightUVTiling',[1,1])}+neoTime*${vec2('dynlightSpeed')};
      vec4 neoLight=${sample('Tex4',light,'neoJellyLight','neoLightUv','black')};
      float neoNoise=${sample('Tex5',colorMap,'neoJellyColorMap',uvTransform(main1),'black')}.a;
      vec4 neoDynamicColor=${sample('Tex5',colorMap,'neoJellyColorMap',`(${uvTransform(main2)})+neoNoise*.3`,'black')};
      float neoLightMask=${sample('Tex4',light,'neoJellyLight','neoDynUv','black')}.g;
      float neoTexMask=${sample('Tex4',light,'neoJellyLight','neoFaceUv(neoJellyUv)','black')}.a;
      float neoBreath=mix(1.0,clamp(sin(neoTime*${f('dynLBreathSpeed',1)})+1.0,0.0,${f('dynLBreathClmap',1)}),${f('dynLBreathSwitch')});
      neoInnerEmission+=neoDynamicColor.rgb*pow(neoLight.r,.8)*${f('dynlightIntensity')}*pow(neoLightMask,${f('dynlightMPow',1)})*neoBreath*neoJellyHasUv;
      neoInnerEmission+=neoTexMask*pow(neoJellyD.rgb,vec3(${f('TexEmisPow',1)}))*${f('TexEmisIntensity')};
  `:'';
  const innerColor=inner?`
      vec4 neoCap2=${cap2Sample};
      float neoAlphaMask=neoJellyLinear(neoJellyD.aaa).r;
      vec3 neoBelow=mix(neoJellyLinear(neoCap2.rgb),neoJellyLinear(neoJellyD.rgb),neoAlphaMask);
      vec3 neoHighlight=neoJellyLinear(neoJellyC.aaa)*(1.0-neoAlphaMask);
      ${front?`vec3 neoAdapt=${opacityMask}.rgb;`:''}
      vec3 neoIcing=neoJellyLinear(neoJellyN.aaa)*${front?'neoAdapt.r':'pow(clamp(neoJellyLocalNormal.y,0.0,1.0),4.0)'};
      vec3 neoInnerEmission=${front?`neoJellyN.aaa*${f('EmissiveAmount')}*${f('EmissiveKey')}*neoJellyLinear(${rgb('EmissiveColor')})`:'vec3(0.0)'};
      ${dynamic}
      vec3 neoBase=${change?`vec3(dot(neoBelow,vec3(.2125,.7154,.0721)))*neoJellyLinear(${rgb('BaseColor')})`:'neoBelow'}*${f('TintValue',1)};
      neoJellyColor=neoBase*${front?f('BaseLight',1):'1.0'}+neoHighlight*${f('Lightness',1)}+neoJellyLinear(neoJellyC.ggg)*${f('Reflection',2)}+neoIcing*${f('IcingAmount')}+neoInnerEmission*neoEmissionScale+neoJellyF*${rgb('RimColor')}*${intensity[3].toFixed(8)};
      ${front?`
      float neoEmissiveMask=neoJellyN.a*${f('EmissiveKey')};
      float neoKeep=neoJellyLinear(neoJellyC.aaa).r;
      ${Number(macros.RENDER_QUALITY||0)<=0?`float neoOpacity=clamp(mix(${f('Opacity',.7)},1.0,neoAlphaMask)+neoKeep+neoEmissiveMask,0.0,1.0);`:`
      float neoOpacityF=max(0.0,pow(min(1.0,.4+5.0*(1.0-dot(normal,normalize(vViewPosition)))),5.0));
      float neoOpacity=clamp(mix((${f('Opacity',.7)}-${f('O_adapt')}*neoAdapt.b)*clamp(neoOpacityF+.5,0.0,1.0)*${f('F_amount',1)},1.0,neoAlphaMask),0.0,1.0)+neoKeep+neoEmissiveMask;`}
      diffuseColor.a=neoOpacity*max(neoEmissiveMask,neoCap2.a)*opacity;
      `:'diffuseColor.a=opacity;'}
  `:'';
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 neoJellyUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoJellyUv=uv;');
    if(inner){
      shader.vertexShader='varying vec3 neoJellyLocalNormal;\n'+shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nneoJellyLocalNormal=objectNormal;');
      // Culling a front face does not negate the source vertex normal.
      shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',ShaderChunk.defaultnormal_vertex.replace(/#ifdef FLIP_SIDED[\s\S]*?#endif/,''));
      shader.fragmentShader='varying vec3 neoJellyLocalNormal;\nuniform float neoTime;uniform float neoEmissionScale;uniform sampler2D neoJellyCap2;\n'+shader.fragmentShader;
      if(front)shader.fragmentShader='uniform sampler2D neoJellyLight;uniform sampler2D neoJellyColorMap;uniform float neoJellyHasUv;\n'+shader.fragmentShader;
      if(secondUV){shader.vertexShader='varying vec2 neoJellySecondUv;\n'+shader.vertexShader.replace('neoJellyUv=uv;','neoJellyUv=uv;neoJellySecondUv=uv1;');shader.fragmentShader='varying vec2 neoJellySecondUv;\n'+shader.fragmentShader;}
    }
    shader.fragmentShader=`varying vec2 neoJellyUv;
      uniform sampler2D neoJellyDiffuse;uniform sampler2D neoJellyNormal;uniform sampler2D neoJellyCap;
      vec3 neoJellyLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 neoJellyD=${diffuseSample};
      vec4 neoJellyN=${low&&!gradient&&!inner?'vec4(.5,.5,.5,1.0)':normalSample};
      diffuseColor.a=opacity*${gradient?'1.0':`mix(1.0,neoJellyN.a,${f('OPM_Key')})`};
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      // Source evaluates its two cross products in left-handed view space.
      vec3 neoJellyView=normalize(vViewPosition)*vec3(1.0,1.0,-1.0);
      vec3 neoJellyVNormal=normal*vec3(1.0,1.0,-1.0);
      vec3 neoJellyT=normalize(cross(neoJellyView,vec3(0.0,1.0,0.0)));
      vec3 neoJellyB=normalize(cross(neoJellyView,neoJellyT));
      vec2 neoJellyCapUv=vec2(dot(neoJellyVNormal,neoJellyT),dot(neoJellyVNormal,neoJellyB))*.5+.5;
      vec4 neoJellyC=${capSample};
      vec3 neoJellyBelow=neoJellyLinear(mix(${rgb('Color01')},${rgb('Color02')},neoJellyC.b));
      ${gradient?`neoJellyBelow=mix(neoJellyBelow,neoJellyLinear(${rgb('ColorUp')}),pow(neoJellyN.a,1.4));`:''}
      neoJellyBelow=mix(neoJellyBelow,neoJellyLinear(neoJellyD.rgb),neoJellyD.a)${gradient?'':'*'+f('BaseLightness',1)};
      float neoJellyF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-abs(dot(normal,normalize(vViewPosition))),5.0),0.0,1.0);
      vec3 neoJellyBase=${change?`vec3(dot(neoJellyBelow,vec3(.2125,.7154,.0721)))*neoJellyLinear(${rgb('BaseColor')})`:'neoJellyBelow'}*${f('TintValue',1)};
      vec3 neoJellyColor=neoJellyBase+neoJellyLinear(neoJellyC.aaa)*${f('Lightness',1)}+neoJellyLinear(neoJellyC.ggg)*${f('Reflection',2)}+neoJellyLinear(neoJellyC.rrr)*${f('IcingAmount')}+neoJellyF*${rgb('RimColor')}*${intensity[3].toFixed(8)};
      ${innerColor}
    `);
    if(inner){shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','');shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','#include <alphatest_fragment>\n#include <opaque_fragment>');}
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=neoJellyColor;\n#include <opaque_fragment>');
  };
  warnings.push(inner?'果冻双遍、Matcap、透明及动态发光已接入；软体、原阴影和场景色彩输出尚未还原':'果冻 Matcap 通道、渐变和透明按源公式接入；软体、原阴影和场景色彩输出尚未还原');
  return uniforms;
}
