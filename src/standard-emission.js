import {scalar,vector,f,rgb} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl} from './source-scene-light.js';

// Authored standard_char terms plus SSS for the explicit default BAG profile.
// Original SH-dependent artist trick is pending; preview lights are not substituted.
export function standardCharacterEmission(p,quality,profile){
 if(profile!=null&&profile!=='authored-bag')throw Error('Unknown source lighting profile');
 const ec=vector(p.EmissiveColor,[1,1,1,1]),rim=vector(p.RimColor,[0,0,0,0]);
 const intensity=vector(p.Intensity,[1,1,1,0])[3],scale=scalar(p.FresnelScale,0),value=scalar(p.EmissiveValue,1),key=scalar(p.BaseEmissiveKey,0);
 const converted=quality<2?`pow(max(vec3(0.),${rgb(ec)}),vec3(2.2))`:`(${rgb(ec)}*${rgb(ec)})`;
 return `float neoCharEmissionMask=${quality<2?'texture2D(neoMix,vAoMapUv).a':'0.'};
 vec3 neoCharBaseEmission=mix(vec3(neoCharEmissionMask),neoCharEmissionMask*diffuseColor.rgb,${f(key)})*${converted}*${f(value)};
 float neoCharRimBase=1.-dot(normal,normalize(vViewPosition));
 float neoCharRimPow=neoCharRimBase*neoCharRimBase;
 neoCharRimPow=neoCharRimPow*neoCharRimPow*neoCharRimBase;
 vec3 neoCharRimEmission=clamp(${f(scale)}+(1.-(${f(scale)}))*neoCharRimPow,0.,1.)*${rgb(rim)}*${f(intensity)};
 vec3 neoCharSssEmission=vec3(0.);
 ${profile==='authored-bag'?`
 vec3 neoCharSssN=inverseTransformDirection(normal,viewMatrix)*vec3(-1.,1.,1.);
 vec3 neoCharSssV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
 vec3 neoCharSssSun=${sourceSceneSunGlsl()};
 float neoCharFrontSss=clamp(dot(neoCharSssV,-(neoCharSssN*.1+neoCharSssSun)),0.,1.);
 float neoCharBackSss=clamp(dot(neoCharSssV,-(neoCharSssN*.3-neoCharSssSun)),0.,1.);
 float neoCharSss=clamp(neoCharFrontSss*.5+neoCharBackSss,0.,1.);
 float neoCharSssPow=neoCharSss*neoCharSss;neoCharSssPow=neoCharSssPow*neoCharSssPow*neoCharSss;
 neoCharSssEmission=mix(diffuseColor.rgb*vec3(.7,.4,.3),${sourceSceneSunColorGlsl()},neoCharSssPow)*neoCharSss*.3*${f(scalar(p.TintValue,1))};`:''}
 totalEmissiveRadiance=(neoCharBaseEmission+neoCharRimEmission+neoCharSssEmission)*neoEmissionScale;`;
}

// standard_common::GetEmissive. Inputs retain their source (linear/raw) domains;
// only ENABLE_EMISSIVE uses srgb2linearf3 from common/function.hlsl.
export function standardCommonEmission(p,macros,quality,alphaTest){
 const border=scalar(macros.ENABLE_BORDER,0),tiling=scalar(macros.ENABLE_TILING,0),emissive=scalar(macros.ENABLE_EMISSIVE,0),alpha=scalar(macros.ALPHA_TEST_ENABLE,alphaTest?1:0);
 if([border,tiling,emissive,alpha].some(v=>![0,1].includes(v)))throw Error('Unknown common emission permutation');
 const ec=vector(p.EmissiveColor,[0,0,0,0]),bc=vector(p.BorderColor,[1,.8,.3,1]),dc=vector(p.DissolveColor,[1,1,1,1]);
 const amount=vector(p.Intensity,[1,1,1,0])[3]*scalar(p.TintValue,1),scale=scalar(p.BorderScale,.03),strength=scalar(p.BorderIntensity,3),ref=scalar(p.AlphaRef,0);
 const rim=border&&!tiling&&(emissive||!alpha)?`
  float neoCommonNoV=clamp(1.-dot(normal,normalize(vViewPosition)),0.,1.);
  float neoCommonFc=neoCommonNoV*neoCommonNoV;
  neoCommonFc=neoCommonFc*neoCommonFc*neoCommonNoV;
  neoCommonBorder=${rgb(bc)}*clamp(${f(scale)}+neoCommonFc*(1.-(${f(scale)})),0.,1.)*${f(strength)};`:'';
 let emission;
 if(tiling)emission=`${rgb(ec)}*(${f(amount)}*neoCommonRaw.b)`;
 else if(emissive){const c=`(neoCommonRaw.rgb*${rgb(ec)})`;emission=`${quality<2?`pow(max(vec3(0.),${c}),vec3(2.2))`:`(${c}*${c})`}*${f(amount)}+neoCommonBorder`;}
 else if(alpha)emission=`${rgb(dc)}*(step(neoCommonRaw.a,${f(ref)}+.02)*${f(amount)})`;
 else emission=`${rgb(ec)}*(texture2D(neoMix,vAoMapUv).a*${f(amount)})+neoCommonBorder`;
 return `vec4 neoCommonRaw=texture2D(map,vMapUv);vec3 neoCommonBorder=vec3(0.);${rim}
 totalEmissiveRadiance=(${emission})*neoEmissionScale;`;
}
