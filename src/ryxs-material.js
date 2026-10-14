import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_ryxs.hlsl: translucent back accessory with source MatCap and a
// time-varying opacity envelope. Source textures stay in their authored slots;
// the shader performs the same sRGB-to-linear conversion as the source.
export async function configureRyxs(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown source macro');
  if(q<2&&normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const n=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),iv=vector(p.Intensity,[1,1,1,0]);
  const maps=await Promise.all(['Tex0','Tex1','Tex2','MatCap'].map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0/Tex1/Tex2/MatCap');
  const u={neoTime:{value:0}};maps.forEach((t,i)=>u['neoRy'+['Tex0','Tex1','Tex2','MatCap'][i]]={value:t});
  setup(m,q<2&&normal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal);
   s.fragmentShader=`uniform sampler2D neoRyTex0,neoRyTex1,neoRyTex2,neoRyMatCap;uniform float neoTime;
    vec3 neoRyLinear(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}
   `+s.fragmentShader;
   const body=`vec4 neoRyBase=texture2D(neoRyTex0,t107Uv);vec4 neoRyMix=texture2D(neoRyTex2,t107Uv);
    vec3 neoRyView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 neoRyN=t107N;vec3 neoRyMat=vec3(0.);
    ${q<2?`${normal?`vec3 neoRySample=texture2D(neoRyTex1,t107Uv).xyz*2.-1.;neoRySample.xy*=${f(iv[0])};neoRyN=mat3(t107T,t107B,t107N)*normalize(neoRySample);`:''}
     vec2 neoRyCapUv=normalize(neoRyN).xy*.5+.5;neoRyCapUv.y*=-1.;neoRyMat=neoRyLinear(texture2D(neoRyMatCap,neoRyCapUv).rgb);
     float neoRyCapA=texture2D(neoRyMatCap,t107Uv+sin(neoTime)*vec2(1.,0.)).a;
     vec3 neoRyBaseMat=neoRyMat*neoRyLinear(neoRyBase.rgb)*mix(neoRyMix.r,neoRyMix.b,${n('MetalnessMaskEnable',0)});
     float neoRyF=1.-clamp(pow(max(dot(neoRyView,t107N)-${n('FRScale',.8)},0.),${n('FRPow',.5)})*2.,0.,1.);
     vec3 neoRyLerp=mix(vec3(0.),neoRyBaseMat,neoRyF);neoRyMat=neoRyLinear(mix(neoRyBase.rgb*${n('BaseMetalness',1)},vec3(1.),neoRyLerp));`:''}
    float neoRyTemp=clamp(neoRyBase.a,0.,1.001-${n('DisappearAreaStartPoint',.2)})/(1.001-${n('DisappearAreaStartPoint',.2)});
    float neoRyOpacity=pow(neoRyTemp+(.6+.6*sin(neoTime)),6.5);
    diffuseColor=vec4(neoRyMat*${col('BaseColor')}*${n('TintValue',1)} ,neoRyOpacity);
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(neoRyN*vec3(-1.,1.,1.)));`)
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=neoRyMix.g*${f(iv[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=neoRyMix.b*${f(iv[2])};`)
    .replace('#include <emissivemap_fragment>',`float neoRyFres=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*pow(1.-dot(neoRyN,neoRyView),5.),0.,1.);totalEmissiveRadiance=neoRyFres*${col('RimColor')}*${f(iv[3])}+neoRyMat+neoRyLinear(neoRyBase.rgb)*neoRyMix.a*${n('BaseColEmissive',0)}*${col('EmissiveColor')};`)
    .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=1.;');
  };
  warnings.push('standard_ryxs 源 Tex0/Tex1/Tex2/MatCap、动态透明、MatCap金属与边缘发光已接入；完整场景光照仍按现有预览环境');
  return u;
 }catch(e){warnings.push('standard_ryxs remains unsupported: '+e.message);return null;}
}
