import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_pet and standard_pet02 share normal mixing, but have different color spaces.
export async function configurePet(m,p,macros,load,warnings,o={},pet02=false){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),detail=scalar(macros.ENABLE_DETAIL_N,0),soft=scalar(macros.ENABLE_SOFT_BODY2,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','ENABLE_DETAIL_N','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||[normal,detail,soft].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active pet permutation');
  if(soft&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>vector(p[k],[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body deformation');
  const on=q<2&&normal===1;if(on&&!o.sourceTangents)throw Error('Original tangent basis required');
  const I=vector(p.Intensity,[1,1,1,0]),tiling=vector(p.DNormalTiling,[1,1]),noiseTiling=vector(p.NoiseTiling,[1,1,0,0]),mutation=scalar(p.MutationKey,0);
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,0,0,1])=>rgb(vector(p[k],d));
  const colors=Array.from({length:4},(_,i)=>col('Color0'+(i+1+(!pet02&&mutation!==0?4:0)),[[1,0,0,1],[0,1,0,1],[0,0,1,1],[0,1,1,1]][i]));
  const rim=col('RimColor'),border=col('BorderColor'),emissive=col('EmissiveColor',[0,0,0,1]),noise=col('NoiseColor',[0,0,0,1]);
  const n=Object.fromEntries(Object.entries({DNormalAmount:1,EmissiveAmount:1,RimScale:.01,RimIntensity:0,BorderScale:.01,BorderIntensity:0,EmiBreathKey:0,NoiseAmount:0}).map(([k,d])=>[k,num(k,d)]));
  const keys=['Tex0','Tex3','Tex4',...(q<2?['Tex2']:[]),...(on?['Tex1',...(detail?['Tex5']:[])]:[]),...(!pet02?['Tex6','Tex7']:[])];
  const maps=await Promise.all(keys.map(k=>load(k,false)));if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['pet'+k]={value:maps[i]});setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   s.fragmentShader=`uniform sampler2D petTex0,petTex1,petTex2,petTex3,petTex4,petTex5,petTex6,petTex7;uniform float neoTime,neoEmissionScale;
    vec3 petLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
    float petFres(float noV,float scale,float intensity){float x=clamp(1.-noV,0.,1.);float fc=x*x;fc=fc*fc*x;return clamp(scale+fc*(1.-scale),0.,1.)*intensity;}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 petBase=texture2D(petTex0,t107Uv),petMask=texture2D(petTex3,t107Uv),petEmitTex=texture2D(petTex4,t107Uv);
    petBase.rgb=petLinear(petBase.rgb);petEmitTex.rgb=petLinear(petEmitTex.rgb);
    vec4 petOrm=${q<2?'texture2D(petTex2,t107Uv)':'vec4(1.,1.,0.,1.)'};
    vec3 petN=t107N;
    ${on?`vec4 petNormal=texture2D(petTex1,t107Uv),petDetail=${detail?`texture2D(petTex5,t107Uv*vec2(${tiling.map(f).join(',')}))`:'vec4(.5,.5,1.,1.)'};
    vec3 petTn=petNormal.xyz*2.-1.,petDn=petDetail.xyz*2.-1.;petTn.xy*=${f(I[0])};petDn.xy*=${n.DNormalAmount}*petNormal.a;
    petTn=normalize(vec3(petTn.xy+petDn.xy,petTn.z*petDn.z));petN=mat3(t107T,t107B,t107N)*normalize(petTn);`:''}
    vec3 petAlbedo=petBase.rgb;
    ${colors.map((c,i)=>`petAlbedo=mix(petAlbedo,${pet02?c:`petLinear(${c})`},petMask[${i}]);`).join('\n')}
    ${pet02?'':`vec4 petPattern=texture2D(petTex6,t107Uv);petAlbedo=mix(petAlbedo,petLinear(petPattern.rgb),petPattern.a);`}
    vec3 petV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float petNoV=dot(petN,petV),petRim=petFres(petNoV,${n.RimScale},${n.RimIntensity});
    vec3 petEmission=petEmitTex.rgb*${n.EmissiveAmount}*${pet02?emissive:`petLinear(${emissive})`}+petRim*${pet02?rim:`petLinear(${rim})`};
    ${pet02?'':`float petBreath=mix(1.,abs(fract(neoTime*.5)-.5)*6.,${n.EmiBreathKey});
    vec3 petNoise=texture2D(petTex7,t107Uv*vec2(${noiseTiling.slice(0,2).map(f).join(',')})+neoTime*vec2(${noiseTiling.slice(2).map(f).join(',')})).rgb;
    petEmission=petEmitTex.rgb*${n.EmissiveAmount}*petBreath*petLinear(${emissive})+petRim*petLinear(${rim})
      +petFres(petNoV,${n.BorderScale},${n.BorderIntensity})*petLinear(${border})+petNoise*petEmitTex.r*${noise}*${n.NoiseAmount};`}
    float petRough=clamp(petOrm.g*${f(I[1])},0.,1.),petMetal=clamp(petOrm.b*${f(I[2])},0.,1.),petAo=petOrm.r;
    diffuseColor=vec4(petAlbedo,petBase.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(petN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=petRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=petMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=petEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=petAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),petAo,material.roughness);
     #endif`);
  };return u;
 }catch(e){warnings.push('Pet material remains unsupported: '+e.message);return null;}
}
