import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// wing_for_tint01.hlsl: authored zero-pattern permutation. No invented UV2.
export async function configureTintWing(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown tint-wing permutation');
  if(!o.sourceVertexColors)throw Error('Original vertex colors required');
  if(q<2&&normal&&!o.sourceTangents)throw Error('Original tangent basis required');
  if(scalar(p.PatternStrength,.5)!==0)throw Error('Nonzero pattern requires original second-UV path');
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented tint-wing macro');
  const colors=Array.from({length:13},(_,i)=>vector(p['Color'+String(i+1).padStart(2,'0')],[0,0,0,1]));
  const intensity=vector(p.Intensity,[1,1,1,0]),emission=vector(p.EmissiveColor,[0,0,0,1]),spec=vector(p.SpecColor,[1,1,1,1]);
  const amount=scalar(p.EmissiveAmount,1),min=scalar(p.EmissiveMin,0),strength=scalar(p.SpecStrength,1);
  const keys=q<2?(normal?['Tex0','Tex1','Tex2','Tex3']:['Tex0','Tex2','Tex3']):['Tex0','Tex3'];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original tint-wing texture');
  const u=Object.fromEntries(keys.map((k,i)=>['tw'+k,{value:textures[i]}]));u.neoTime={value:0};u.neoEmissionScale={value:1};
  setup(m,q<2&&normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal===1);
   // setup disables Three's color multiply; source uses only color.r as a mask.
   s.vertexShader='attribute vec3 color;varying float twSide;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <color_vertex>','twSide=color.r;');
   s.fragmentShader=`varying float twSide;uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D tw'+k+';').join('')}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 tw0=texture2D(twTex0,t107Uv),twMask=texture2D(twTex3,t107Uv);
    vec4 twMix=${q<2?'texture2D(twTex2,t107Uv)':'vec4(1.,1.,0.,0.)'};
    vec3 twN=t107N;
    ${q<2&&normal?`vec3 twDecoded=texture2D(twTex1,t107Uv).xyz*2.-1.;twDecoded.xy*=${f(intensity[0])};twN=mat3(t107T,t107B,t107N)*normalize(twDecoded);`:''}
    vec3 twUp=mix(mix(${rgb(colors[0])},${rgb(colors[1])},twMask.r),mix(${rgb(colors[2])},${rgb(colors[3])},twMask.r),twSide);
    vec3 twMid=mix(mix(${rgb(colors[4])},${rgb(colors[5])},twMask.r),mix(${rgb(colors[6])},${rgb(colors[7])},twMask.r),twSide);
    vec3 twLow=mix(mix(${rgb(colors[8])},${rgb(colors[9])},twMask.r),mix(${rgb(colors[10])},${rgb(colors[11])},twMask.r),twSide);
    vec3 twAlbedo=${q===2?'tw0.rgb*tw0.rgb':'pow(max(tw0.rgb,vec3(0.)),vec3(2.2))'};
    twAlbedo=mix(twAlbedo,twUp,step(.05,twMask.g));
    twAlbedo=mix(twAlbedo,twMid,step(.25,twMask.g));
    twAlbedo=mix(twAlbedo,twLow,step(.45,twMask.g));
    twAlbedo=mix(twAlbedo,${rgb(colors[12])},step(.65,twMask.g));
    vec3 twEmission=twMix.a*${f(amount)}*${rgb(emission)}*((sin(neoTime)*.5+.5)*${f(1-min)}+${f(min)});
    vec3 twSpec=${rgb(spec)}*${f(strength)};
    diffuseColor=vec4(twAlbedo,twMask.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(twN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(twMix.g*${f(intensity[1])},0.,1.);`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(twMix.b*${f(intensity[2])},0.,1.);`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=twEmission*neoEmissionScale;')
    .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=twSpec;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=twMix.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),twMix.r,material.roughness);
     #endif`);
  };
  return u;
 }catch(e){warnings.push('Tint-wing remains unsupported: '+e.message);return null;}
}
