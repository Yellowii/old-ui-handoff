import {sourceSpecular} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {scalar,f,frame,setup} from './t107-frame.js';

// 2026_horse_wing.hlsl: authored UV1 sky, moving mask and wrap-sampled matcap.
export async function configureHorseWing(m,p,macros,load,o,warnings){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),high=q<2,normalOn=high&&normal===1;
  const light=scalar(macros.LIGHT_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(light))throw Error('Unknown horse-wing permutation');
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','TEXCOORD1_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented horse-wing macro');
  if(normalOn&&!o.sourceTangents)throw Error('Original tangent basis required');
  if(high&&!o.sourceSecondUv)throw Error('Original second UV required');
  const keys=high?['Tex0',...(normalOn?['Tex1']:[]),'Tex2','Tex3','Tex4']:['Tex0'];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original horse-wing texture');
  const u=Object.fromEntries(keys.map((k,i)=>['hw'+k,{value:textures[i]}]));u.neoTime={value:0};u.neoEmissionScale={value:1};
  const strength=f(scalar(p.tex0st,1));setup(m,normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   if(high){s.vertexShader='attribute vec2 uv1;varying vec2 hwUv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nhwUv1=uv1;');s.fragmentShader='varying vec2 hwUv1;\n'+s.fragmentShader;}
   s.fragmentShader=`uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D hw'+k+';').join('')}
    vec3 hwLinear(vec3 c){return ${high?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 hw0=texture2D(hwTex0,t107Uv);hw0.rgb=hwLinear(hw0.rgb)*${strength};
    vec3 hwN=t107N,hwEmission=hw0.rgb;
    ${normalOn?'vec3 hwDecoded=texture2D(hwTex1,t107Uv).xyz*2.-1.;hwDecoded.xy*=2.;hwN=mat3(t107T,t107B,t107N)*normalize(hwDecoded);':''}
    ${high?`
     vec4 hw2=texture2D(hwTex2,t107Uv);
     float hwNoise=texture2D(hwTex2,hwUv1*2.+neoTime*vec2(-.08,.08)).g*.06;
     float hwStarMask=texture2D(hwTex2,t107Uv*.2+neoTime*vec2(.01,-.01)).b;
     vec2 hwSkyUv=hwUv1*1.5+vec2(hwNoise);
     vec3 hwSky=hwLinear(texture2D(hwTex3,hwSkyUv).rgb)*10.*(1.-hw0.a);
     vec2 hwCapUv=(mat3(viewMatrix)*(hwN*vec3(-1.,1.,1.))).xy*.5+.5;hwCapUv.y*=-1.;
     vec3 hwCap=texture2D(hwTex4,hwCapUv).rgb;hwCap=hwCap*hwCap*hwCap*hwCap*hwCap;
     float hwEdge=hw2.a*hwStarMask*100.+hw2.a;
     hwEmission+=hwCap*.8+vec3(hwEdge)+hwSky;
    `:''}
    diffuseColor=vec4(0.,0.,0.,hw0.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(hwN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=hwEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','')
    .replace('#include <lights_physical_fragment>',sourceSpecular('0.','0.'));
   sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1,standardMaterial:true});
  };return u;
 }catch(e){warnings.push('Horse wing remains unsupported: '+e.message);return null;}
}
