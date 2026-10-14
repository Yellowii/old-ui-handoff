import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Original standard_back_glass.hlsl, including its view-dependent Matcap UV.
export async function configureBackGlass(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown back-glass source permutation');
  const allowed=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!allowed.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented back-glass source macro');
  if(q<2&&normal&&!o.sourceTangents)throw Error('Missing original back-glass tangent basis');
  const i=vector(p.Intensity,[1,1,1,0]),rim=vector(p.RimColor,[0,0,0,0]),emission=vector(p.EmissiveColor,[1,1,1,1]);
  const n=(key,d=0)=>scalar(p[key],d),min=n('b_frenelSSMin'),max=n('b_frenelSSMax',1),power=n('b_alphaPow',1);
  if(min===max||power<=0)throw Error('Undefined back-glass alpha boundary');
  const textures=await Promise.all(['Tex0','Tex1','Tex2'].map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original back-glass 2D texture');
  const u={bgTex0:{value:textures[0]},bgTex1:{value:textures[1]},bgTex2:{value:textures[2]},neoEmissionScale:{value:1}};
  setup(m,q<2&&normal===1);
  const offset=n('PositionOffset'),tint=n('TintValue',1),alpha=n('backAlpha',1),alphaAdd=n('b_frenelSSBaseAdd');
  const fresnel=n('FresnelScale'),emissive=n('EmissiveValue',1),baseEmission=n('BaseColEmissive');
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal===1);
   // Source CommonVertex is already deformed when this material runs.
   if(q<2)s.vertexShader=s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>\ntransformed+=objectNormal*${f(offset)};`);
   s.fragmentShader=`uniform sampler2D bgTex0,bgTex1,bgTex2;uniform float neoEmissionScale;
    vec3 bgLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 bg0=texture2D(bgTex0,t107Uv),bg1=texture2D(bgTex1,t107Uv);
    vec3 bgDecoded=bg0.xyz*2.-1.;bgDecoded.xy*=${f(i[0])};
    vec3 bgN=${q===2?'t107N':normal?'mat3(t107T,t107B,t107N)*normalize(bgDecoded)':'normalize(bgDecoded)'};
    vec3 bgViewN=(mat3(viewMatrix)*(bgN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 bgViewV=vViewPosition*vec3(1.,1.,-1.);
    vec3 bgT=normalize(cross(bgViewV,vec3(0.,1.,0.))),bgB=normalize(cross(bgViewV,bgT));
    vec2 bgUv=vec2(dot(bgViewN,bgT),dot(bgViewN,bgB))*.5+.5;
    vec4 bg2=texture2D(bgTex2,bgUv);
    // Explicit HLSL normalized/clamped Hermite polynomial also handles the
    // actual descending .8,0 edges, undefined by GLSL smoothstep itself.
    float bgX=clamp((pow(bg2.a,${f(power)})-${f(min)})/${f(max-min)},0.,1.);
    float bgAlpha=${f(alpha)}*clamp(bgX*bgX*(3.-2.*bgX)+${f(alphaAdd)},0.,1.);
    vec3 bgAlbedo=bgLinear(bg2.rgb)*${f(tint)};
    vec3 bgV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float bgFr=1.-dot(bgN,bgV);bgFr=bgFr*bgFr*bgFr*bgFr*bgFr;
    bgFr=clamp(${f(fresnel)}+(1.-${f(fresnel)})*bgFr,0.,1.);
    vec3 bgEmission=bgFr*${rgb(rim)}*${f(i[3])}+bg1.a*${rgb(emission)}*${f(emissive)}+bgLinear(bg2.rgb)*${f(baseEmission)};
    diffuseColor=vec4(bgAlbedo,bgAlpha*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(bgN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':`clamp(bg1.g*${f(i[1])},0.,1.)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`clamp(bg1.b*${f(i[2])},0.,1.)`};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=bgEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=${q===2?'1.':'bg1.r'};
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),${q===2?'1.':'bg1.r'},material.roughness);
     #endif`);
  };
  return u;
 }catch(e){warnings.push('Back-glass remains unsupported: '+e.message);return null;}
}
