// unlit_diffuse_rim.hlsl + SetupFragmentNormal + srgb2linearf3.
// Material output only; source scene fog/exposure remains separate.
export async function configureUnlitRim(m,p,macros,load,warnings){
 const quality=Number(macros.RENDER_QUALITY??0),n=k=>Number(p[k]);
 const vector=(key,size)=>{try{const a=JSON.parse(p[key]);return Array.isArray(a)&&a.length===size&&a.every(Number.isFinite)?a:null;}catch{return null;}};
 const keys=['Lightness','FresnelPow','FresnelScale','FresnelStep','BreathStrength'],c=vector('FresnelCol',4),gaps=[];
 if(![0,1,2].includes(quality)||!keys.every(k=>Number.isFinite(n(k)))||!c)gaps.push('源参数无效');
 // GLSL smoothstep with equal edges is undefined; do not invent its result.
 if(n('FresnelStep')>=1||n('FresnelPow')<0)gaps.push('Fresnel 边界需要原运行时验证');
 if(Number(macros.ENABLE_SOFT_BODY2??1)!==0){
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){
   const a=vector(k,3);if(!a||a.some(x=>x!==0))gaps.push('活动软体输入尚未接入');
  }
 }
 if(['INSTANCE_TYPE','USE_TEXCOORD1','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT'].some(k=>Number(macros[k]??0)!==0))gaps.push('未验证顶点分支');
 if(gaps.length){warnings.push(...gaps.map(x=>'边缘光：'+x));return null;}
 // Explicit HLSL conversion consumes raw RGB, not hardware-decoded sRGB.
 const tex=await load('Tex0',false);
 if(!tex?.isTexture||tex.isCubeTexture){warnings.push('边缘光缺少源二维 Tex0');return null;}
 const f=x=>Number(x).toFixed(8),s=k=>f(n(k));
 const u={neoTime:{value:0},neoEmissionScale:{value:1},neoRimMap:{value:tex}};
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.roughness=1;m.metalness=0;
 // Preserve original Cull/Alpha/Blend/Depth state supplied by sourceMaterial.
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,u);
  const vary='varying vec2 neoRimUv;varying vec3 neoRimNormal,neoRimView;\n';
  shader.vertexShader=vary+shader.vertexShader
   .replace('#include <uv_vertex>','#include <uv_vertex>\nneoRimUv=uv;')
   .replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 sourceNormal=transformedNormal;
    #ifdef FLIP_SIDED
    sourceNormal=-sourceNormal;
    #endif
    neoRimNormal=normalize(sourceNormal);`)
   .replace('#include <project_vertex>','#include <project_vertex>\nneoRimView=-mvPosition.xyz;');
  shader.fragmentShader=vary+`uniform sampler2D neoRimMap;uniform float neoTime,neoEmissionScale;
   vec3 neoRimLinear(vec3 x){return ${quality===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <map_fragment>',`vec4 neoRimTex=texture2D(neoRimMap,neoRimUv);diffuseColor=vec4(vec3(0.0),clamp(neoRimTex.a*opacity,0.0,1.0));`)
   // Source normal is normalized per vertex then interpolated, without a second
   // normalization or a clamp of its view dot product before the Fresnel power.
   .replace('#include <emissivemap_fragment>',`float neoRimNV=dot(neoRimNormal,normalize(neoRimView));
    float neoRimF=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*pow(1.0-neoRimNV,${s('FresnelPow')}),0.0,1.0);
    neoRimF=smoothstep(${s('FresnelStep')},1.0,neoRimF);
    float neoRimBreath=${s('Lightness')}*(1.0-${s('BreathStrength')}+abs(sin(neoTime*5.0))*${s('BreathStrength')});
    totalEmissiveRadiance=neoRimLinear(neoRimTex.rgb)*neoRimBreath+neoRimLinear(vec3(${c.slice(0,3).map(f).join(',')}))*neoRimF;`)
   .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance*neoEmissionScale;\n#include <opaque_fragment>');
 };
 return u;
}
