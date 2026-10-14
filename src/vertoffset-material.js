import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// The source uses gradient Perlin noise, including signed (unnormalized) gradients.
const noise=`vec2 voRandom(vec2 p){return -1.+2.*fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float voNoise(vec2 p){vec2 i=floor(p),v=fract(p),u=v*v*(3.-2.*v);
 return mix(mix(dot(voRandom(i),v),dot(voRandom(i+vec2(1.,0.)),v-vec2(1.,0.)),u.x),
 mix(dot(voRandom(i+vec2(0.,1.)),v-vec2(0.,1.)),dot(voRandom(i+vec2(1.)),v-vec2(1.)),u.x),u.y);}`;

export async function configureVertOffset(m,p,macros,load,warnings,o={},interfaceMode=false){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),light=scalar(macros.LIGHT_ENABLE,1),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1);
  if(![0,1,2].includes(q)||[light,normal,change].some(v=>![0,1].includes(v)))throw Error('Unknown source macro');
  if(!o.sourceVertexColors)throw Error('Missing original COLOR0');
  const tbn=q<2&&light===1&&normal===1;
  if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(scalar(macros.IA_VERTEX_COLOR,1)!==1)throw Error('Unsupported color declaration override');
  for(const key of ['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING','LIGHT_MAP_ENABLE','TEXCOORD1_ENABLE','USE_TEXCOORD1'])if(scalar(macros[key],0)!==0)throw Error('Unsupported active '+key);
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(v=>v!==0))throw Error('Active soft-body unresolved');
  const n=(k,d)=>f(scalar(p[k],d)),base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]),u={neoTime:{value:0}};
  for(const key of (interfaceMode?['Tex0','Tex1','Tex2','Tex3','Tex4','Tex5']:['Tex0','Tex1','Tex2','Tex3','Tex4'])){const texture=await load(key,false);if(!texture?.isTexture||texture.isCubeTexture)throw Error('Missing source '+key);u['vo'+key]={value:texture};}
  setup(m,tbn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn);
   s.vertexShader=`attribute vec3 color;uniform float neoTime;${noise}\n`+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
    vec3 voLocal=transformed*vec3(-1.,1.,1.);
    voLocal.y+=voNoise(voLocal.xz+vec2(neoTime*.5,neoTime))*color.r*color.r*.2;
    transformed=voLocal*vec3(-1.,1.,1.);`);
   s.fragmentShader=`uniform sampler2D voTex0,voTex1,voTex2,voTex3,voTex4${interfaceMode?',voTex5':''};uniform float neoTime;${noise}
    vec3 voLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}\n`+s.fragmentShader;
   const body=`vec2 voUv=t107Uv;voUv.x+=voUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',interfaceMode?1:0)}:0.;
    vec3 voV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec2 voDist=vec2(${n('DistStrength',.02)}*voNoise(voUv*10.*${n('DistScale',2)}+neoTime*${n('DistSpeed',1)}*vec2(0.,1.)));
    vec4 voBase=texture2D(voTex0,voUv),voNormalMap=texture2D(voTex1,voUv),voOrm=texture2D(voTex2,voUv+voDist),voColor=texture2D(voTex4,voUv+neoTime*.01*vec2(0.,1.));
    ${interfaceMode?`voBase=mix(voBase,texture2D(voTex5,voUv),${n('Gradient',0)});`:''}
    float voRawNoise=texture2D(voTex3,voUv*vec2(3.,1.)+neoTime*.01*vec2(0.,-1.)).b;
    vec4 voNoise1=texture2D(voTex3,voUv*${n('SparkleScale',4)}+vec2(.3,neoTime)*${n('SparkleSpeed',.02)});
    vec4 voNoise2=texture2D(voTex3,voUv*${n('SparkleScale',4)}*1.5+vec2(neoTime,.3)*${n('SparkleSpeed',.02)});
    float voSparkle=2.*pow(voNoise1.r*voNoise2.r,${n('SparklePow',4)})+pow(voNoise1.g*voNoise2.g,${n('SparklePow',4)});
    float voRawNoV=dot(t107N,voV),voColorMask=clamp(voRawNoise*voRawNoise*voRawNoise,0.,1.)*clamp(voRawNoV*voRawNoV,0.,1.);
    vec3 voN=normalize(t107N);
    ${tbn?`vec3 voSample=voNormalMap.xyz*2.-1.;voSample.xy*=${f(intensity[0])};voN=normalize(mat3(t107T,t107B,t107N)*normalize(voSample));`:''}
    vec3 voColorLinear=voLinear(voBase.rgb),voBaseEmission=voOrm.a*voColorLinear*${n('EmissiveValue',1)};
    vec3 voAlbedo=${change?`voLinear(vec3(dot(voBase.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)})*${n('TintValue',1)}`:`voColorLinear*${n('TintValue',1)}${q===2&&!interfaceMode?`+voBaseEmission+voColorLinear*voSparkle*40.*${n('SparkleStrength',1)}`:''}`};
    float voAlpha=voBase.a*${f(base[3])};
    float voFresnel=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*pow(1.-dot(voN,voV),${n('FresnelPow',4)}),0.,1.);
    float voMask=pow(1.-voOrm.a,6.)*(1.-voColorMask);
    vec3 voEmission=voColorLinear*(voSparkle*40.*${n('SparkleStrength',1)}+voFresnel*${n('FresnelPowIntensity',0)})*voMask+voLinear(voColor.rgb)*voColorMask*${interfaceMode?'2.':n('ColorMapValue',1)}+voBaseEmission;
    ${change&&!interfaceMode?`voEmission=voLinear(vec3(dot(voEmission,vec3(.2125,.7154,.0721)))*${rgb(base)});`:''}
    float voRoughness=${q===2?'.5':`clamp(voOrm.g*${f(intensity[1])},0.,1.)`},voMetalness=${q===2?'0.':`clamp(voOrm.b*${f(intensity[2])},0.,1.)`},voAo=${q===2?'1.':'voOrm.r'};
    diffuseColor=vec4(voAlbedo,voAlpha*opacity);`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(voN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=voRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=voMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=voEmission;')
    .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=voAo;');
  };
  warnings.push(`standard_char_vertoffset${interfaceMode?'_interface six':' five'}-map channels and COLOR0 displacement; full runtime lighting and cross-GPU noise precision remain distinct.`);return u;
 }catch(e){warnings.push(`standard_char_vertoffset${interfaceMode?'_interface':''} remains unsupported: `+e.message);return null;}
}
