import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// T172: three distinct source masks; an RGBA weighted sum is not sequential RGB lerp.
export async function configureColorVariant(m,p,macros,load,warnings,o={},family){
 try{
  const vtxOffset=family==='color-object-vtxoffset',object=family==='color-object'||vtxOffset,pattern=family==='color-pattern',emissive=family==='color-emissive';
  if(!object&&!pattern&&!emissive)throw Error('Unknown color variant');
  const q=scalar(macros.RENDER_QUALITY,0),normalFlag=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),border=scalar(macros.ENABLE_BORDER,0);
  const tiling=scalar(macros.ENABLE_TILING,0),patternUvKey=scalar(p.PatternUVKey,0);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_BORDER','IS_CHARACTER','USE_LOCAL_PARAMATER','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(pattern)known.add('ENABLE_TILING');
  if(![0,1].includes(tiling))throw Error('Unknown source tiling permutation');
  if(![0,1,2].includes(q)||[normalFlag,light,border].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active source permutation');
  // Scale9, object lighting and emissive UV1 still need separate source inputs.
  const normalOn=normalFlag===1&&(emissive||q<2&&(pattern||light===1));
  if(normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const I=vector(p.Intensity,[1,1,1,0]),E=vector(p.EmissiveColor,[0,0,0,0]),EI=vector(p.EmissiveIntensity,[0,0,0,0]);
  const C=[0,1,2,3].map(i=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]][i]));
  const R=vector(p.UGCRoughness,[1,1,1,1]),M=vector(p.UGCMetalness,[0,0,0,0]),add=vector(p.AddtionColor,[1,1,1,1]);
  const kr=scalar(p.UGCKey_R,1),km=scalar(p.UGCKey_M,1),kr4=scalar(p.UGCKey_R4,0),km4=scalar(p.UGCKey_M4,0),srgb=scalar(p.srgbKey,0);
  const tex=vector(p.TexturePara,[1,1,0,0]),repeat=scalar(p.RepeatScale,1),angle=scalar(p.RotationAngle,0)*(pattern?3.1415/180:6.283/360);
  const procedural=scalar(p.UVSampleKey,0),uv=vector(p.UVPara,[1,1,0,0]),speed=[scalar(p.Speed_U,0),scalar(p.Speed_V,0)],enableUv=scalar(p.EnableUVChange,1);
  const pp=vector(p.PatternPara,[1,1,0,0]),pi=vector(p.PatternIntensity,[1,.5,0,0]),design=vector(p.DesignColor,[1,1,1,1]);
  const patternAngle=scalar(p.PatternRotationAngle,0)*3.1415/180,depth=scalar(p.PatternDeapthOffset,0),patternKey=scalar(p.PatternColorKey,1);
  const rim=vector(p.BorderColor,[0,0,0,1]),rimScale=scalar(p.BorderScale,.03),rimIntensity=scalar(p.BorderIntensity,3),rimPow=scalar(p.FresnelPow,4),rimExtra=scalar(p.FresnelIntensity,0);
  if(border&&rimPow<=0)throw Error('Undefined Fresnel power boundary');
  const keys=pattern?['Tex0','Tex1','Tex2','PatternTex']:['Tex0','Tex1','Tex2'];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['cvTex'+i]={value:t});setup(m,normalOn);
  const sum=(a)=>a.map((x,i)=>`cvMask.${'rgba'[i]}*(${x})`).join('+');
  const mix4=(a)=>`mix(mix(mix(${a[0]},${a[1]},cvMask.r),${a[2]},cvMask.g),${a[3]},cvMask.b)`;
  const rotate=(name,a)=>`${name}=vec2(${name}.x*${f(Math.cos(a))}-${name}.y*${f(Math.sin(a))},${name}.y*${f(Math.cos(a))}+${name}.x*${f(Math.sin(a))});`;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   if(pattern&&tiling){
    // Original forward vertex stage: local input after skinning, world column
    // lengths before projection. Viewer camera framing does not rescale meshes.
    const vary='varying vec3 cvLocalPos,cvLocalNormal,cvUvScale;\n';
    s.vertexShader=vary+s.vertexShader
     .replace('#include <skinnormal_vertex>','#include <skinnormal_vertex>\ncvLocalNormal=objectNormal;')
     .replace('#include <skinning_vertex>','#include <skinning_vertex>\ncvLocalPos=transformed;cvUvScale=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),length(modelMatrix[2].xyz));');
    s.fragmentShader=vary+s.fragmentShader;
   }
   s.fragmentShader=`uniform sampler2D cvTex0,cvTex1,cvTex2,cvTex3;uniform float neoTime,neoEmissionScale;
    vec3 cvLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 cvUv=t107Uv${vtxOffset?'*'+f(repeat):''};
    ${pattern&&tiling?`vec3 cvAxis=abs(cvLocalNormal),cvPosition=cvUvScale*cvLocalPos/2.64;float cvDominant=max(max(cvAxis.x,cvAxis.y),cvAxis.z);
    cvUv=cvDominant==cvAxis.x?cvPosition.yz:cvDominant==cvAxis.y?cvPosition.xz:cvPosition.yx;`:''}
    vec2 cvPatternUv=cvUv*vec2(${f(pp[0])},${f(pp[1])});
    ${pattern?`cvUv=mix(cvUv,t107Uv,${f(patternUvKey)});`:''}
    ${!object?`${emissive?'cvUv-=.5;':''}vec2 cvScale=vec2(${f(repeat*tex[0])},${f(repeat*tex[1])});cvUv*=cvScale;${rotate('cvUv',angle)}${emissive?'cvUv+=.5*cvScale;':''}
    cvUv+=vec2(${f(tex[2])},${f(tex[3])});
    ${procedural?`cvUv=t107Uv*vec2(${f(uv[0])},${f(uv[1])})+vec2(${f(uv[2])},${f(uv[3])})+neoTime*vec2(${f(speed[0])},${f(speed[1])});`:''}
    ${pattern?`cvUv=mix(t107Uv,cvUv,${f(enableUv)});`:''}`:''}
    vec4 cvMask=texture2D(cvTex0,cvUv),cvNS=${pattern&&q===2?'vec4(.5,.5,1.,1.)':'texture2D(cvTex1,cvUv)'},cvOrm=${pattern&&q===2?'vec4(1.,.5,0.,0.)':'texture2D(cvTex2,cvUv)'};
    vec3 cvView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    mat3 cvTbn=${normalOn?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 cvN=${emissive?'normalize(t107N)':'t107N'};
    vec3 cvAlbedo,cvEmission;float cvAlpha=cvNS.a,cvR4=0.,cvM4=0.;vec4 cvPattern=vec4(0.);
    ${pattern?`
    ${q<2?`vec3 cvTv=normalize(vec3(dot(cvTbn[0],cvView),dot(cvTbn[1],cvView),dot(cvTbn[2],cvView)));cvPatternUv-=cvTv.xy/cvTv.z*${f(depth)};`:''}
    ${rotate('cvPatternUv',patternAngle)}cvPatternUv-=vec2(${f(pp[2])},${f(pp[3])});cvPattern=texture2D(cvTex3,cvPatternUv);
    ${q<2?`vec3 cvT=cvNS.xyz*vec3(2.)+vec3(-1.,-1.,0.),cvU=cvPattern.xyz*vec3(-2.,-2.,2.)+vec3(1.,1.,-1.);
    cvT.xy*=${f(I[0])};cvU.xy*=${f(pi[0])}*cvNS.a;cvN=cvTbn*normalize(cvT*dot(cvT,cvU)-cvU*cvT.z);`:'cvN=normalize(t107N);'}
    cvPattern.a*=cvNS.a;float cvPm=cvPattern.a*${f(patternKey)};cvAlpha=cvMask.a;
    cvMask.rgb=cvLinear(cvMask.rgb);cvAlbedo=mix(${mix4(C.map(c=>'cvLinear('+rgb(c)+')'))},cvLinear(${rgb(design)}),cvPm);
    cvEmission=${q<2?`cvOrm.a*cvAlbedo*mix(${mix4(EI.map(f))},${f(pi[3])},cvPm)`:'vec3(0.)'}+${rgb(E)}*${f(I[3])};
    cvR4=${mix4(R.map(f))};cvM4=${mix4(M.map(f))};
    `:`
    ${normalOn?`vec3 cvSample=cvNS.xyz*2.-1.;cvSample.xy*=${f(I[0])};cvN=cvTbn*normalize(cvSample);`:''}
    vec3 cvWeighted=${sum(C.map(rgb))};
    ${object? vtxOffset?`cvEmission=cvOrm.a*${mix4(C.map((c,i)=>rgb(c)+'*'+f(EI[i])))}+cvLinear(cvOrm.a*${rgb(E)}*${f(I[3])});cvAlbedo=cvLinear(${mix4(C.map(rgb))});`:`cvEmission=cvLinear(cvOrm.a*${rgb(E)}*${f(I[3])});cvAlbedo=cvLinear(cvWeighted)${q===2?'+cvEmission':''};`:`
    cvWeighted=clamp(cvWeighted,0.,1.);cvAlbedo=mix(cvWeighted,cvLinear(cvWeighted),${f(srgb)})${q===2?'*'+rgb(add):''};
    cvEmission=cvOrm.a*(${sum(C.map((c,i)=>rgb(c)+'*'+f(EI[i])))})+${rgb(E)}*${f(I[3])};
    cvR4=clamp(${sum(R.map(f))},0.,1.);cvM4=clamp(${sum(M.map(f))},0.,1.);`}`}
    float cvRoughness=${q===2?'.5':`mix(${f(I[1])},clamp(cvOrm.g*${f(I[1])},0.,1.),${f(kr)})`};
    float cvMetalness=${q===2?'0.':`mix(${f(I[2])},clamp(cvOrm.b*${f(I[2])},0.,1.),${f(km)})`};
    ${!object&&q<2?`cvRoughness=mix(cvRoughness,cvR4,${f(kr4)});cvMetalness=mix(cvMetalness,cvM4,${f(km4)});`:''}
    ${pattern&&q<2?`cvRoughness=mix(cvRoughness,${f(pi[1])},cvPattern.a);cvMetalness=mix(cvMetalness,${f(pi[2])},cvPattern.a);`:''}
    ${border?`float cvNoV=${object?'1.-dot(cvN,cvView)':'clamp(1.-dot(cvN,cvView),0.,1.)'};
    cvEmission+=${rgb(rim)}*clamp(${f(rimScale)}+(1.-${f(rimScale)})*pow(cvNoV,5.),0.,1.)*${f(rimIntensity)};
    ${object?'':`cvEmission+=cvOrm.a*pow(cvNoV,${f(rimPow)})*${f(rimExtra)}*cvAlbedo;`}`:''}
    float cvAo=${q===2?'1.':'cvOrm.r'};diffuseColor=vec4(cvAlbedo,cvAlpha*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cvN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=cvRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=cvMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cvEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cvAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cvAo,material.roughness);
     #endif`);
  };
  warnings.push(`${family}: source channels connected; original scene lighting and half precision remain uncalibrated`);
  return u;
 }catch(e){warnings.push(`${family} remains unsupported: ${e.message}`);return null;}
}
