import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';

// APK angel_wing_pearl03.hlsl, SHA 1d6a3a21...; recovered bag sun input.
export async function configurePearl03(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','CHAR_CHANGE_COLOR','LIGHT_ENABLE','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||[normal,change].some(v=>![0,1].includes(v))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active shadow/deformation or unknown permutation');
  // Parallax still consumes TBN when low-quality shading uses frag.normal.
  if(normal&&!o.sourceTangents)throw Error('Original tangents required for parallax');
  const I=vector(p.Intensity,[1,1,1,0]),num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d));
  const keys=['Tex0','Tex1','Tex2','Tex3','Tex4',...(q<2?['Tex6']:[])],maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active texture');
  const u={neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['p03'+k]={value:maps[i]});setup(m,normal===1);
  m.userData.sourceSceneLimitations=sourceSceneLightWarning;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader=`uniform sampler2D p03Tex0,p03Tex1,p03Tex2,p03Tex3,p03Tex4,p03Tex6;uniform float neoEmissionScale;
    vec3 p03Linear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 p03Uv=t107Uv;p03Uv.x+=p03Uv.y<.25?${num('FaceUVOffset',0)}*${num('CharOffset',1)}:0.;
    vec4 p03Normal=texture2D(p03Tex1,p03Uv),p03Mix=${q<2?'texture2D(p03Tex6,p03Uv)':'vec4(1.,1.,0.,0.)'};
    mat3 p03Tbn=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 p03Decoded=p03Normal.xyz*2.-1.;p03Decoded.xy*=${f(I[0])};
    vec3 p03N=${q===2?'t107N':'p03Tbn*normalize(p03Decoded)'};
    vec3 p03V=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 p03ViewN=(mat3(viewMatrix)*(p03N*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 p03ViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
    vec3 p03T=normalize(cross(p03ViewV,vec3(0.,1.,0.))),p03B=normalize(cross(p03ViewV,p03T));
    vec2 p03CapUv=vec2(dot(p03ViewN,p03T),dot(p03ViewN,p03B))*.5+.5;p03CapUv.y=1.-p03CapUv.y;
    vec3 p03Cap0=p03Linear(texture2D(p03Tex0,p03CapUv).rgb),p03Cap2=p03Linear(texture2D(p03Tex2,p03CapUv).rgb),p03Diffuse=p03Linear(texture2D(p03Tex3,p03Uv).rgb);
    vec3 p03Final=mix(p03Diffuse,mix(p03Cap0,p03Cap2,${num('Reflection',0)})*p03Diffuse*${num('Lightness',1)},p03Normal.a);
    float p03F=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*pow(1.-dot(p03N,p03V),5.),0.,1.);
    vec3 p03Albedo=${change?`vec3(dot(p03Final,vec3(.2125,.7154,.0721)))*p03Linear(${col('BaseColor')})`:'p03Final'}*mix(1.,${num('TintValue',1)},p03Normal.a)+p03F*${col('RimColor',[0,0,0,0])}*${f(I[3])};
    vec3 p03TangentV=normalize(transpose(p03Tbn)*p03V);
    vec2 p03Offset=p03TangentV.xy/p03TangentV.z;
    vec3 p03Sun=${sourceSceneSunGlsl()},p03Reflect=normalize(reflect(p03Sun,t107N));
    float p03Ref=dot(p03Reflect,p03V)+1.;
    float p03Spark1=p03Ref*texture2D(p03Tex4,p03Uv*${num('SparkleScale1',1)}-p03Offset*(-.08)*${num('SparkleOffset1',0)}).a;
    float p03Spark2=p03Ref*.5*texture2D(p03Tex4,p03Uv*${num('SparkleScale2',1)}-p03Offset*${num('SparkleOffset2',0)}).g;
    vec3 p03Sparkle=pow(p03Spark1*p03Normal.a,4.5)*${col('SparkleColor1')}*${num('SparkleIntensity1',0)}*100.+pow(p03Spark2*p03Normal.a,8.)*${col('SparkleColor2')}*${num('SparkleIntensity2',0)}*100.;
    float p03NoL=dot(t107N,-p03Sun);p03NoL*=p03NoL;p03NoL=p03NoL*p03NoL*p03NoL*p03NoL*p03NoL;
    p03Sparkle=mix(p03Sparkle*.3,p03Sparkle,clamp(p03NoL,0.,1.));
    vec3 p03Emission=p03Mix.a*p03Albedo*${num('EmissionScale',1)}+p03Sparkle;
    diffuseColor=vec4(p03Albedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(p03N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=p03Mix.g*${f(I[1])};`)
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=p03Mix.b;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=p03Emission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','');
  };return u;
 }catch(e){warnings.push('Pearl03 remains unsupported: '+e.message);return null;}
}
