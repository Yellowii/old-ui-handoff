import {ClampToEdgeWrapping,LinearFilter,NoColorSpace} from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl} from './source-scene-light.js';
import {sourcePerlinGlsl} from './source-perlin.js';

// mount_spring_festival.hlsl: all five textures have Bilinear_Clamp samplers.
export async function configureMountFestival(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||[normal,light].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active festival permutation');
  // Even quality 2 uses the TBN for parallax UVs.
  if(normal&&!o.sourceTangents)throw Error('Original tangent basis required');
  const I=vector(p.Intensity,[1,1,1,0]),v=vector(p.Value,[1,-1,1,0]),num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const bias=scalar(p.Fres_Bias,.5),scale=scalar(p.Fres_Scale,.8),power=scalar(p.Fres_Pow,5);
  if(bias<0||scale<0||power<=0)throw Error('Undefined source Fresnel power boundary');
  // Validate authored values before allocating texture clones.
  const c=Object.fromEntries(['NoiseColor','BlendColor','SparkleColor','SparkleColor_in','SpecularColor','PatternColor','EmissiveColor'].map(k=>[k,col(k)]));
  c.Fres_Col=col('Fres_Col',[0,0,0,1]);
  const n=Object.fromEntries(Object.entries({AlbedoMult:1,SelfEmisMult:0,TrickMaskMult:1,InSparkMult:1,Noise_Speed:.1,Blend_colL:.2,Specular_Lightness:.1,Pattern_Lightness:2,Trick_ref:.5,Trick_highL:1,Sparkle_Tiling:10}).map(([k,d])=>[k,num(k,d)]));
  const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const clones=maps.map(t=>{const x=t.clone();x.wrapS=x.wrapT=ClampToEdgeWrapping;x.minFilter=x.magFilter=LinearFilter;x.generateMipmaps=false;x.colorSpace=NoColorSpace;x.needsUpdate=true;return x;});
  m.addEventListener('dispose',()=>clones.forEach(t=>t.dispose()));
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};clones.forEach((t,i)=>u['mfTex'+i]={value:t});setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader=`uniform sampler2D mfTex0,mfTex1,mfTex2,mfTex3,mfTex4;uniform float neoTime,neoEmissionScale;
    vec3 mfLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
    ${q<2?sourcePerlinGlsl:''}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec3 mfV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 mfTv=${normal?'normalize(vec3(dot(t107T,mfV),dot(t107B,mfV),dot(t107N,mfV)))':'mfV'};
    vec2 mfOffset=mfTv.xy*${f(v[1])};
    vec4 mfBase=texture2D(mfTex0,t107Uv),mfNormal=texture2D(mfTex1,t107Uv),mfOrm=texture2D(mfTex2,t107Uv);
    mfBase.rgb=mfLinear(mfBase.rgb);vec3 mfTn=mfNormal.xyz*2.-1.;mfTn.xy*=${f(I[0])};
    vec3 mfN=${q===2?'t107N':`${normal?'mat3(t107T,t107B,t107N)*':''}normalize(mfTn)`};
    vec4 mfNoise=texture2D(mfTex3,t107Uv*${f(v[2])}+neoTime*${n.Noise_Speed});
    vec4 mfParallax=texture2D(mfTex3,t107Uv*${f(v[2])}+mfOffset*mfNoise.r);
    vec4 mfSparkA=texture2D(mfTex3,t107Uv*${f(v[2])}*3.+mfOffset*mfNoise.r);
    vec4 mfSparkB=texture2D(mfTex3,t107Uv*${f(v[2])}*3.*1.4);
    vec3 mfViewN=(mat3(viewMatrix)*(mfN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 mfViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
    vec3 mfT=normalize(cross(mfViewV,vec3(0.,1.,0.))),mfB=normalize(cross(mfViewV,mfT));
    vec2 mfCapUv=vec2(dot(mfViewN,mfT),dot(mfViewN,mfB))*.5+.5;
    vec4 mfCap=texture2D(mfTex4,mfCapUv),mfInnerTex=texture2D(mfTex3,t107Uv*${n.Sparkle_Tiling});
    vec3 mfSun=${sourceSceneSunGlsl()},mfSunColor=${sourceSceneSunColorGlsl()};
    vec3 mfReflect=normalize(reflect(mfSun,mfN));float mfStar=pow((dot(mfReflect,mfV)+1.)*.5,5.);
    // The source assigns a vector to a half scalar, retaining red.
    mfStar=.5*(mfStar+.05)*mfSunColor.r;
    vec3 mfSpark=mfLinear(mfSparkA.a*mfSparkB.a*${f(v[0])}*${c.SparkleColor});
    vec3 mfBlend=mfLinear(mix(${c.BlendColor},${c.NoiseColor}*${f(v[3])},mfParallax.r))*clamp(mfBase.a,0.,1.)*${n.Blend_colL};
    vec3 mfTrick=mix(mfLinear(vec3(mfCap.a))*${n.Trick_highL}+mfLinear(vec3(mfCap.g))*${n.Trick_ref},vec3(0.),mfBase.a*${n.TrickMaskMult});
    float mfFres=max(0.,pow(min(1.,${f(bias)}+${f(scale)}*(1.-dot(mfV,t107N))),${f(power)}));
    float mfNoiseValue=${q<2?'neoPerlinNoise(t107Uv*10.+vec2(0.,-neoTime))':'0.'};
    vec3 mfFlow=${q<2?`clamp(mfNoiseValue*mfOrm.b,0.,1.)*mfLinear(${c.PatternColor})*${n.Pattern_Lightness}`:'vec3(0.)'};
    float mfInner=mfInnerTex.a*mfStar${q<2?'*mfNormal.a':''};
    ${q<2?'mfSpark*=mfNormal.a;':''}
    vec3 mfEmission=mfBlend+mfTrick+mfFres*mfLinear(${c.Fres_Col})+mfFlow+mfSpark
      +${q<2?`mfOrm.a*${f(I[3])}*mfLinear(${c.EmissiveColor})`:'vec3(0.)'}
      +mfBase.rgb*${n.SelfEmisMult}+mfInner*mfLinear(${c.SparkleColor_in})*${n.InSparkMult};
    vec3 mfAlbedo=mfBase.rgb*${n.AlbedoMult};
    float mfRough=${q===2?'.5':`clamp(mfOrm.g*${f(I[1])},0.,1.)`},mfMetal=${q===2?'0.':`clamp(mfOrm.b*${f(I[2])},0.,1.)`},mfAo=${q===2?'1.':'mfOrm.r'};
    diffuseColor=vec4(mfAlbedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(${q<2&&normal&&light?'mfN':'t107N'}*vec3(-1.,1.,1.)));`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=mfRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=mfMetal;')
    .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>\nreflectedLight.directSpecular*=${c.SpecularColor}*${n.Specular_Lightness};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=mfEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=mfAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),mfAo,material.roughness);
     #endif`);
  };return u;
 }catch(e){warnings.push('Festival mount remains unsupported: '+e.message);return null;}
}
