// unlit_diffuse.hlsl and original material_function_zzy.hlsl::Schlick_Fres.
// Adapts material channels; source scene postprocessing is a separate layer.
export async function configureUnlitDiffuse(m,p,macros,load,warnings){
 const quality=Number(macros.RENDER_QUALITY??0),photoshop=Number(macros.COLOR_SAME_AS_PHOTOSHOP??0),n=k=>Number(p[k]);
 const v=k=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)&&a.length===4&&a.every(Number.isFinite)?a:null;}catch{return null;}};
 const tint=v('TintColor'),border=v('BorderColor'),gaps=[];
 if(![0,1,2].includes(quality)||![0,1].includes(photoshop)||!tint||!border||!['Lightness','BlockSize','Glitch_Key','Glitch_Speed','BorderScale','BorderIntensity','BorderKey'].every(k=>Number.isFinite(n(k))))gaps.push('源参数无效');
 if(['INSTANCE_TYPE','USE_TEXCOORD1','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','ENABLE_SOFT_BODY2'].some(k=>Number(macros[k]??0)!==0))gaps.push('未验证顶点分支');
 if(gaps.length){warnings.push(...gaps.map(x=>'Unlit：'+x));return null;}
 const tex=await load('Tex0',false);if(!tex?.isTexture||tex.isCubeTexture){warnings.push('Unlit 缺少源二维 Tex0');return null;}
 m.userData.sourceBuiltinTextures={Tex0:tex.userData?.neoBuiltin??null};
 const f=x=>Number(x).toFixed(8),s=k=>f(n(k)),rgb=a=>'vec3('+a.slice(0,3).map(f).join(',')+')';
 const u={neoTime:{value:0},neoEmissionScale:{value:1},udMap:{value:tex}};
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.roughness=1;m.metalness=0;
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,u);
  const vary='varying vec2 udUv;varying vec3 udN,udView;\n';
  shader.vertexShader=vary+shader.vertexShader
   .replace('#include <uv_vertex>','#include <uv_vertex>\nudUv=uv;')
   .replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 udSourceNormal=transformedNormal;
    #ifdef FLIP_SIDED
    udSourceNormal=-udSourceNormal;
    #endif
    udN=normalize(udSourceNormal);`)
   .replace('#include <project_vertex>','#include <project_vertex>\nudView=-mvPosition.xyz;');
  shader.fragmentShader=vary+`uniform sampler2D udMap;uniform float neoTime,neoEmissionScale;
   vec3 udLinear(vec3 x){return ${quality<2?'pow(max(x,vec3(0.0)),vec3(2.2))':'x*x'};}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <map_fragment>',`
    vec4 ud0=texture2D(udMap,udUv);
    float udBlock=fract(sin(dot(floor(udUv*${s('BlockSize')})*neoTime*${s('Glitch_Speed')},vec2(12.9898,78.233)))*43758.5453123);
    float udOffset=step(.8,udBlock)*udBlock*.01;
    vec4 ud1=texture2D(udMap,udUv+vec2(udOffset)),ud2=texture2D(udMap,udUv-vec2(0.0,udOffset));
    ud0.rgb=mix(ud0.rgb,vec3(ud1.r,ud2.g,ud0.b),${s('Glitch_Key')});
    diffuseColor=vec4(vec3(0.0),clamp(mix(ud0.a,clamp(ud1.r+ud2.g+ud0.b,0.0,1.0),${s('Glitch_Key')})*opacity,0.0,1.0));`)
   .replace('#include <emissivemap_fragment>',`
    vec3 udColor=${photoshop?'-log(vec3(1.0001)-ud0.rgb)':'ud0.rgb'};
    float udNoV=clamp(1.0-dot(udN,normalize(udView)),0.0,1.0),udFc=udNoV*udNoV;udFc=udFc*udFc*udNoV;
    float udFresnel=clamp(${s('BorderScale')}+udFc*(1.0-${s('BorderScale')}),0.0,1.0);
    totalEmissiveRadiance=udLinear(udColor*${rgb(tint)})*${s('Lightness')}+${rgb(border)}*udFresnel*${s('BorderIntensity')}*${s('BorderKey')};`)
   .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance*neoEmissionScale;\n#include <opaque_fragment>');
 };
 return u;
}
