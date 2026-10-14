import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourcePerlinGlsl} from './source-perlin.js';

// s31/standard_common_bubble.hlsl: source RNM, Matcap, opacity and local offset.
export async function configureBathBubble(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unknown bubble permutation');
  if(q<2&&normal&&!o.sourceTangents)throw Error('Original bubble tangent basis required');
  const intensity=vector(p.Intensity,[1,1,1,0]),color=rgb(vector(p.BubbleColor,[1,1,1,1]));
  const scale=f(scalar(p.BubbleScale,1)),offset=f(scalar(p.BubbleOffset,0)),fresnel=f(scalar(p.BubbleFresnel,0));
  const keys=q<2?['Matcap','Tex1','DetailNormal']:['DetailNormal'],maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing source bubble texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['bb'+k]={value:maps[i]});setup(m,q<2&&normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal===1);
   s.vertexShader=`uniform float neoTime;varying float bbOffset;${q<2?sourcePerlinGlsl:''}\n`+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    bbOffset=${q<2?`neoPerlinNoise(position.xz*.5+vec2(neoTime*.4))*.2+${offset}`:'0.'};
    transformed.y+=bbOffset;`);
   s.fragmentShader=`varying float bbOffset;uniform float neoEmissionScale;${keys.map(k=>'uniform sampler2D bb'+k+';').join('')}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 bbDetail=texture2D(bbDetailNormal,t107Uv*${scale});
    vec3 bbN=${q<2?'t107N':'normalize(t107N)'},bbEmission=vec3(0.);
    float bbOpacity=bbDetail.a*bbDetail.a*.5+.5;
    ${q<2?`
     vec3 bbT=texture2D(bbTex1,t107Uv).xyz*2.+vec3(-1.,-1.,0.);
     vec3 bbU=bbDetail.xyz*vec3(-2.,-2.,2.)+vec3(1.,1.,-1.);
     vec3 bbBlend=bbT*dot(bbT,bbU)-bbU*bbT.z;bbBlend.xy*=${f(intensity[0])};
     mat3 bbTbn=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
     bbN=bbTbn*normalize(bbBlend);vec3 bbBase=bbTbn*normalize(bbT);
     vec3 bbV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
     vec3 bbViewN=mat3(viewMatrix)*(bbN*vec3(-1.,1.,1.)),bbViewV=normalize(vViewPosition);
     vec3 bbViewT=normalize(cross(bbViewV,vec3(0.,1.,0.))),bbViewB=normalize(cross(bbViewV,bbViewT));
     vec2 bbCapUv=vec2(dot(bbViewN,bbViewT),dot(bbViewN,bbViewB))*.5+.5;
     float bbBaseNoV=clamp(dot(bbBase,bbV),0.,1.);
     float bbRim=1.-bbBaseNoV;bbRim=bbRim*bbRim;bbRim=bbRim*bbRim;
     bbEmission=pow(max(texture2D(bbMatcap,bbCapUv).rgb,vec3(0.)),vec3(2.2))*(1.-bbDetail.a)+bbRim*${fresnel};
     float bbOpA=clamp((bbBaseNoV-.05)*2.,0.,1.),bbOpFr=clamp(pow(max(bbBaseNoV-.25,0.),.2)*2.,0.,1.);
     bbOpacity*=(mix(bbDetail.a,1.,bbOpFr)*bbOpA*.6+.4);
    `:''}
    vec3 bbAlbedo=${color},bbSpecularTint=bbAlbedo*bbEmission;
    diffuseColor=vec4(bbAlbedo,bbOpacity*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(bbN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=mix(.1,.5,bbDetail.a);')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=bbEmission*neoEmissionScale;')
    .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=bbSpecularTint;')
    .replace('#include <aomap_fragment>','');
  };
  return u;
 }catch(e){warnings.push('Bubble remains unsupported: '+e.message);return null;}
}
