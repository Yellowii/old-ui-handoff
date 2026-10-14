import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl} from './source-scene-light.js';

// obj_carbody.hlsl: authored detail-normal blend, raw cube reflection and pearl.
export async function configureCarbody(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||[normal,light].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active carbody permutation');
  const on=q<2&&normal===1;
  if(on&&!o.sourceTangents)throw Error('Original tangent basis required');
  const I=vector(p.Intensity,[1,1,1,0]),num=(k,d)=>f(scalar(p[k],d)),col=k=>rgb(vector(p[k],[1,1,1,1]));
  const keys=['Tex0','Tex1','Tex2',...(q<2?['Tex3']:[])],maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const cube=q<2?await load('ReflectionProbeCustom',false):null;
  if(q<2&&!cube?.isCubeTexture)throw Error('Original reflection cube required');
  const u={neoEmissionScale:{value:1},cbCube:{value:cube}};keys.forEach((k,i)=>u['cb'+k]={value:maps[i]});setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   s.fragmentShader=`uniform sampler2D cbTex0,cbTex1,cbTex2,cbTex3;uniform samplerCube cbCube;uniform float neoEmissionScale;
    vec3 cbLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 cbBase=texture2D(cbTex0,t107Uv),cbDetail=texture2D(cbTex1,t107Uv*${num('DetailTiling',1)}),cbOrm=texture2D(cbTex2,t107Uv);
    cbBase.rgb=cbLinear(cbBase.rgb);vec3 cbN=t107N,cbReflection=vec3(0.);vec4 cbNormal=vec4(.5,.5,1.,0.);
    vec3 cbV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${q<2?`cbNormal=texture2D(cbTex3,t107Uv);vec3 cbTn=mix(cbNormal.xyz,(cbDetail.xyz+cbNormal.xyz)*.5,cbBase.a)*2.-1.;cbTn.xy*=${f(I[0])};
    cbN=${on?'mat3(t107T,t107B,t107N)*':''}normalize(cbTn);
    cbReflection=textureLod(cbCube,reflect(-cbV,cbN),0.).rgb*cbBase.a;`:''}
    vec3 cbSun=${sourceSceneSunGlsl()},cbSunColor=${sourceSceneSunColorGlsl()};
    vec3 cbAlbedo=cbBase.rgb*${col('BaseColor')}+max(dot(cbN,normalize(-cbSun)),0.)*cbSunColor*${col('DiffuseColor')}*cbBase.a;
    vec3 cbReflect=normalize(reflect(-cbSun,cbN));float cbStar=pow(max(dot(-cbReflect,cbV),0.),4.),cbSpec=pow(cbStar,6.);
    // HLSL assigns a float3 to float: the first component is retained.
    cbStar=.5*cbStar*cbSunColor.r*cbDetail.a*cbNormal.a*cbBase.a*2.;
    cbSpec=.5*cbSpec*cbSunColor.r*cbBase.a*cbBase.a;
    vec3 cbEmission=(cbSpec+cbStar)*${col('SpecalurColor')}*cbAlbedo+cbReflection*${num('RefectIntensity',.5)}+cbAlbedo*cbOrm.a*${f(I[3])};
    float cbRough=${q===2?'.5':`cbOrm.g*${f(I[1])}`},cbMetal=${q===2?'0.':`cbOrm.b*${f(I[2])}`},cbAo=${q===2?'1.':'cbOrm.r'};
    diffuseColor=vec4(cbAlbedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(${on&&light?'cbN':'t107N'}*vec3(-1.,1.,1.)));`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=cbRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=cbMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cbEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cbAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cbAo,material.roughness);
     #endif`);
  };return u;
 }catch(e){warnings.push('Carbody remains unsupported: '+e.message);return null;}
}
