import {scalar,vector,f,rgb} from './t107-frame.js';
import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';

// standard_char_detail source albedo, detail/sparkle normal, emission and direct BRDF.
// Original scene SH/environment/shadow integration remains tracked separately.
export async function configureDetailLighting(m,p,macros,mix,uniforms,load,warnings,o){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),light=scalar(macros.LIGHT_ENABLE,1),sparkle=scalar(p.SimulationSP_Key,0)!==0,uv1=scalar(macros.TEXCOORD1_ENABLE,0)!==0;
  if(![0,1,2].includes(q)||![0,1].includes(light)||['USE_SKIN_LUT','USE_ANISOTROPIC_SPECULAR','LIGHT_MAP_ENABLE'].some(k=>scalar(macros[k],0)!==0))throw Error('Unconnected detail lighting permutation');
  if(q<2&&!mix?.isTexture)throw Error('Original detail Tex2 required');
  const glitter=sparkle&&q<2?await load('Tex5'):null;
  if(sparkle&&q<2&&(!glitter?.isTexture||!m.map?.isTexture))throw Error('Original detail Tex0/Tex5 required for sparkle mask');
  if(sparkle&&q<2&&uv1&&!o.sourceSecondUv)throw Error('Original detail second UV required');
  const I=vector(p.Intensity,[1,1,1,0]),spec=vector(p.SpecularColor,[1,1,1,1]),strength=scalar(p.SpecularIntensity,1);
  const base=vector(p.BaseColor,[1,1,1,1]),frenel=vector(p.FrenelColor,[1,1,1,1]),sfColor=vector(p.SFColor,[1,1,1,1]),baseEmis=vector(p.BaseEmisColor,[1,1,1,1]);
  const change=scalar(macros.CHAR_CHANGE_COLOR,1)!==0,tint=scalar(p.TintValue,1),sfBase=scalar(p.SF_BaseColKey,0);
  const alphaKey=scalar(p.AlphaKey,0),baseEmissive=scalar(p.BaseColEmissive,0),sfEmissive=scalar(p.SF_EmissiveIntensity,1),rim=vector(p.RimColor,[0,0,0,0]),fresnelScale=scalar(p.FresnelScale,0);
  const iso=rgb(spec.map(x=>x*strength*strength*4));
  uniforms.neoDetailSparkle={value:glitter};
  if(sparkle&&q<2&&uv1)m.defines={...m.defines,USE_UV1:''};
  if(q===2){m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;}
  const compile=m.onBeforeCompile;
  m.onBeforeCompile=s=>{
   compile(s);Object.assign(s.uniforms,uniforms);
   s.fragmentShader='uniform sampler2D neoDetailSparkle;\nuniform float neoTime;\n'+s.fragmentShader;
   const sample=sparkle&&q<2?`
    vec2 neoDetailSfUv=(${uv1?'neoDetailUv1':'vMapUv'}+vec2(${f(scalar(p.SFAddX,0))},${f(scalar(p.SFAddY,0))}))*${f(scalar(p.SFTiling,12.7))}+neoTime*vec2(${f(scalar(p.SF_SpeedX,0))},${f(scalar(p.SF_SpeedY,0))});
    float neoDetailSfa=texture2D(neoDetailSparkle,neoDetailSfUv).a*clamp(pow(texture2D(map,vMapUv).a,1.8),0.,1.);
   `:'float neoDetailSfa=0.;';
   if(sparkle&&q<2&&uv1){
    s.vertexShader='varying vec2 neoDetailUv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoDetailUv1=uv1;');
    s.fragmentShader='varying vec2 neoDetailUv1;\n'+s.fragmentShader;
   }
   const raw=`vec4 neoDetailRaw=texture2D(map,vMapUv);\n`;
   const sourceBase=change
    ? `vec3 neoDetailBase=sRGBTransferEOTF(vec4(vec3(dot(neoDetailRaw.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)},1.)).rgb*${f(tint)};`
    : `vec3 neoDetailBase=sRGBTransferEOTF(vec4(neoDetailRaw.rgb*${rgb(base)},1.)).rgb*${f(tint)};`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',raw+sourceBase+`diffuseColor.rgb=neoDetailBase;diffuseColor.a=mix(${f(base[3])},neoDetailRaw.a,${f(alphaKey)})*opacity;`);
   const addNormalExpr=m.normalMap&&uniforms.neoDetail?.value?'neoAddNormal':'normal';
   // Three's vViewPosition points from the fragment toward the camera. Keep
   // the source CameraVector orientation for Fresnel/Mao and sparkle branches;
   // negating it floods front-facing character surfaces with white highlight.
   const detailAlbedo=change?'':`
    float neoDetailFresA=pow(clamp(${f(scalar(p.FA,.8))}-dot(neoDetailAddNormal,normalize(vViewPosition)),0.,1.),${f(scalar(p.FB,.3))});
    float neoDetailMaoFres=clamp(neoDetailFresA,0.,1.);
    vec3 neoDetailAddLerp=sRGBTransferEOTF(vec4(mix(vec3(0.),${rgb(frenel)},neoDetailMaoFres*texture2D(normalMap,vNormalMapUv).a),1.)).rgb;
    float neoDetailMao1=clamp(.3-dot(nonPerturbedNormal,normalize(vViewPosition)),0.,1.);
    vec3 neoDetailAlbedoAdd=neoDetailAddLerp+neoDetailMao1*${f(scalar(p.Mao1Fres,1))}+neoDetailBase;
    ${sparkle&&q<2?`vec3 neoDetailSfb=mix(neoDetailAlbedoAdd,neoDetailSfVertex*3.*${rgb(sfColor)},neoDetailSfa*(1.-(${f(sfBase)})));float neoDetailSfFres=clamp(.6-dot(nonPerturbedNormal,normalize(vViewPosition)),0.,1.);diffuseColor.rgb=mix(neoDetailSfb,neoDetailAlbedoAdd,neoDetailSfFres);`:`diffuseColor.rgb=neoDetailAlbedoAdd;`}
   `;
   const sparkleVars=sparkle&&q<2?`
    vec3 neoDetailSfVertex=clamp(tbn*sRGBTransferEOTF(vec4(normalize(vViewPosition),1.)).xyz,0.,1.);
    vec3 neoDetailSfSample=texture2D(neoDetailSparkle,(${uv1?'neoDetailUv1':'vMapUv'}+vec2(${f(scalar(p.SFAddX,0))},${f(scalar(p.SFAddY,0))}))*${f(scalar(p.SFTiling,12.7))}+neoTime*vec2(${f(scalar(p.SF_SpeedX,0))},${f(scalar(p.SF_SpeedY,0))})).xyz*2.-1.;
    neoDetailSfSample.xy*=3.;
    vec3 neoDetailSfNormal=normalize(tbn*normalize(neoDetailSfSample));
   `:'';
   const sourceEmission=sparkle&&q<2?`
    float neoDetailSfEm=clamp(.1-dot(neoDetailSfNormal,normalize(vViewPosition)),0.,1.);
    totalEmissiveRadiance+=neoDetailSfEm*((neoDetailSfVertex+.5)*neoDetailSfa)*sRGBTransferEOTF(vec4(${rgb(sfColor)},1.)).rgb*600.*${f(sfEmissive)};
   `:'';
   const baseAtLights=raw+sourceBase+`diffuseColor.rgb=neoDetailBase;diffuseColor.a=mix(${f(base[3])},neoDetailRaw.a,${f(alphaKey)})*opacity;`;
   s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',baseAtLights+sparkleVars+`vec3 neoDetailAddNormal=${addNormalExpr};${detailAlbedo}
    ${sparkle&&q<2?'normal=normalize(mix(normal,neoDetailSfNormal,neoDetailSfa));':''}
    float neoDetailFresnel=clamp(${f(fresnelScale)}+(1.-${f(fresnelScale)})*pow(1.-dot(normal,normalize(vViewPosition)),5.),0.,1.);
    totalEmissiveRadiance+=neoDetailFresnel*${rgb(rim)}*${f(I[3])};
    ${q<2?`totalEmissiveRadiance+=neoDetailRaw.rgb*texture2D(neoMix,vAoMapUv).a*${f(baseEmissive)}*${rgb(baseEmis)};`:''}
    ${sourceEmission}
    #include <lights_physical_fragment>`);
   s.fragmentShader=s.fragmentShader
    .replace('#include <roughnessmap_fragment>',`${sample}\nvec4 neoDetailOrm=${q<2?'texture2D(neoMix,vAoMapUv)':'vec4(1.)'};float roughnessFactor=${q===2?'1.':sparkle?`mix(neoDetailOrm.g*${f(I[1])},${f(scalar(p.SF_Roughness,.3))},neoDetailSfa)`:`neoDetailOrm.g*${f(I[1])}`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':sparkle?`mix(clamp(neoDetailOrm.b*${f(I[2])},0.,1.),1.,neoDetailSfa)`:`neoDetailOrm.b*${f(I[2])}`};`)
    .replace('#include <lights_physical_fragment>',sourceSpecular(sparkle&&q<2?'mix(.1,1.,neoDetailSfa)':'.3',sourceGrazing));
   if(q===2)s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','');
   sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1,isoSpecularColor:iso});
  };
  return true;
 }catch(e){warnings.push('Detail source lighting remains unsupported: '+e.message);return false;}
}
