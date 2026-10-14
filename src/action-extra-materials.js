import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Original standard_change_color_new / standard_common_frenel HLSL, T169.
// Only permutations with established source inputs enter these adapters.
export async function configureActionExtra(m,p,macros,load,warnings,o={},family){
 try{
  const change=family==='change-color-new',q=scalar(macros.RENDER_QUALITY,0);
  const normalFlag=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),border=scalar(macros.ENABLE_BORDER,0);
  if(![0,1,2].includes(q)||[normalFlag,light,border].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_BORDER','IS_CHARACTER','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active source permutation is not implemented');
  const backN=scalar(p.BackN_Invert,0);
  const twoSided=scalar(macros.TWO_SIDED,m.side===2?1:0);
  if(change&&(![0,1].includes(backN)||![0,1].includes(twoSided)))throw Error('Unknown back-normal permutation');
  // Source forward pass carries SV_IsFrontFace. Preserve it for transparent
  // DoubleSide too, rather than Three's two culled passes with reversed winding.
  if(change&&twoSided)m.forceSinglePass=true;
  if(change&&['UVSampleKey','Milky_way','DetailNormalKey'].some(k=>scalar(p[k],0)!==0))throw Error('Active procedural or detail branch is not implemented');
  if(change&&border&&scalar(p.BorderColorful,0)!==0)throw Error('World-position animated border is not implemented');
  const changeRimPow=scalar(p.FresnelPow,1),changeRimIntensity=scalar(p.FresnelIntensity,0),changeBorderScale=scalar(p.BorderScale,0);
  if(change&&border&&changeRimPow<=0)throw Error('Undefined Fresnel power boundary');
  const normalOn=q<2&&normalFlag===1&&(change||light===1);
  if(normalOn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const intensity=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]),emission=vector(p.EmissiveColor,[0,0,0,0]);
  const colors=[0,1,2,3].map(i=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]][i]));
  const emis=vector(p.EmissiveIntensity,[0,0,0,0]),rough4=vector(p.UGCRoughness,[1,1,1,1]),metal4=vector(p.UGCMetalness,[0,0,0,0]);
  const tint=scalar(p.TintValue,1),fix=scalar(p.ColorFixKey,0),texturePara=vector(p.TexturePara,[1,1,0,0]);
  const repeat=scalar(p.RepeatScale,1),angle=scalar(p.RotationAngle,0)*6.283/360,uvChange=scalar(p.EnableUVChange,1);
  const keyR=scalar(p.UGCKey_R,1),keyM=scalar(p.UGCKey_M,1),keyR4=scalar(p.UGCKey_R4,0),keyM4=scalar(p.UGCKey_M4,0);
  const rim=vector(p.BorderColor,[1,.8,.3,1]),dissolve=vector(p.DissolveColor,[1,1,1,1]);
  const rimPow=scalar(p.FrenelPow,1),threshold=scalar(p.BorderThreshold,1),rimBase=scalar(p.FrenelBase,0),rimAlpha=scalar(p.FrenelOpacity,0);
  const rimStrength=scalar(p.BorderIntensity,3),maskStrength=scalar(p.MaskEmisStrength,0);
  if(!change&&(rimPow<=0||threshold<=0))throw Error('Undefined Fresnel power/threshold boundary');
  const maps=await Promise.all((change?['Tex0','Tex1','Tex2']:['Tex0','Tex1','Tex2','Tex3']).map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original 2D texture');
  const u={neoEmissionScale:{value:1}};maps.forEach((t,i)=>u['axTex'+i]={value:t});setup(m,normalOn);
  const mix4=(a)=>`mix(mix(mix(${a[0]},${a[1]},axMask.r),${a[2]},axMask.g),${a[3]},axMask.b)`;
  const linear=x=>`axLinear(${x})`,alphaTest=m.alphaTest>0||scalar(macros.ALPHA_TEST_ENABLE,0)!==0;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   s.fragmentShader=`uniform sampler2D axTex0,axTex1,axTex2,axTex3;uniform float neoEmissionScale;
    vec3 axLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 axUv=t107Uv;
    ${change?`vec2 axScale=vec2(${f(repeat*texturePara[0])},${f(repeat*texturePara[1])});axUv=(axUv-.5)*axScale;
    axUv=vec2(axUv.x*${f(Math.cos(angle))}-axUv.y*${f(Math.sin(angle))},axUv.y*${f(Math.cos(angle))}+axUv.x*${f(Math.sin(angle))});
    axUv=mix(t107Uv,axUv+.5*axScale+vec2(${f(texturePara[2])},${f(texturePara[3])}),${f(uvChange)});`:''}
    vec4 axMask=texture2D(axTex0,axUv),axNormalSample=texture2D(axTex1,axUv),axOrm=texture2D(axTex2,axUv);
    vec3 axN=normalize(t107N);
    ${normalOn?`vec3 axSample=axNormalSample.xyz*2.-1.;axSample.xy*=${f(intensity[0])};axN=mat3(t107T,t107B,t107N)*normalize(axSample);`:''}
    ${change&&twoSided?`axN*=gl_FrontFacing?1.:${backN===1&&light===1&&normalFlag===1?'1.':'-1.'};`:''}
    vec3 axView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 axAlbedo,axEmission;float axAlpha;
    ${change?`${fix<.5?`axAlbedo=${linear(mix4(colors.map(rgb)))};axEmission=${mix4(colors.map((c,i)=>`${rgb(c)}*${f(emis[i])}`))};`:`axMask.rgb=axLinear(axMask.rgb);axAlbedo=${mix4(colors.map(c=>linear(rgb(c))))};axEmission=axAlbedo*${mix4(emis.map(f))};`}
    axAlpha=axNormalSample.a;
    axEmission=axOrm.a*axEmission+${rgb(emission)}*${f(intensity[3])};
    ${border?`float axNoV=clamp(1.-dot(axN,axView),0.,1.);
    axEmission+=axOrm.a*pow(axNoV,${f(changeRimPow)})*${f(changeRimIntensity)}*axAlbedo;
    float axSchlick=clamp(${f(changeBorderScale)}+(1.-${f(changeBorderScale)})*pow(axNoV,5.),0.,1.);
    axEmission+=${rgb(rim)}*axSchlick*${f(rimStrength)};`:''}`:`
    axAlbedo=axLinear(axMask.rgb*${rgb(base)})*${f(tint)};
    axAlpha=mix(axMask.a*${f(base[3])},clamp(${f(rimBase)}+pow(1.-dot(axN,axView),8.),0.,1.),${f(rimAlpha)});
    float axRim=pow(clamp(1.-dot(axN,axView),0.,1.),${f(rimPow)});axRim=clamp(clamp(axRim/${f(threshold)},0.,1.)+${f(rimBase)},0.,1.);
    axEmission=${alphaTest?`step(axMask.a,${f(m.alphaTest+.02)})*${rgb(dissolve)}*${f(intensity[3]*tint)}`:`axOrm.a*${rgb(emission)}*${f(intensity[3]*tint)}${border?`+axRim*${rgb(rim)}*${f(rimStrength)}+texture2D(axTex3,axUv).rgb*texture2D(axTex3,axUv).a*${f(maskStrength)}`:''}`};`}
    float axRoughness=${q===2?'.5':`mix(${f(intensity[1])},clamp(axOrm.g*${f(intensity[1])},0.,1.),${f(keyR)})`};
    float axMetalness=${q===2?'0.':`mix(${f(intensity[2])},clamp(axOrm.b*${f(intensity[2])},0.,1.),${f(keyM)})`};
    ${change&&q<2?`axRoughness=mix(axRoughness,${mix4(rough4.map(f))},${f(keyR4)});axMetalness=mix(axMetalness,${mix4(metal4.map(f))},${f(keyM4)});`:''}
    float axAo=${q===2?'1.':'axOrm.r'};diffuseColor=vec4(axAlbedo,axAlpha*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(axN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=axRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=axMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=axEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=axAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),axAo,material.roughness);
     #endif`);
  };
  warnings.push(`${family}: source channels connected; original scene lighting and half precision remain uncalibrated`);
  return u;
 }catch(e){warnings.push(`${family} remains unsupported: ${e.message}`);return null;}
}
