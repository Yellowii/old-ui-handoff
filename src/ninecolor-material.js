import {scalar,vector,f,rgb} from './t107-frame.js';

// Recovered from candidates-t381/pecial_ninecolor.hlsl. The active primitive
// samples the original second UV and stored tangent basis; no COLOR0 input is
// used by this Surface.
export async function configureNinecolor(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown source permutation');
  if(o.sourceSecondUv!==true)throw Error('Original second UV required');
  if(q<2&&normal===1&&o.sourceTangents!==true)throw Error('Original tangent basis required');
  const n=(key,d=0)=>scalar(p[key],d),v=(key,d)=>vector(p[key],d);
  const rainbow=v('RainbowHue',[1,1,1,1]),matcapColor=v('MatcapColor',[1,1,1,1]),maoColor=v('MaoColor',[1,1,1,1]);
  const keys=['Tex0','Tex2','Tex3','Tex6'],maps={};
  for(const key of keys){maps[key]=await load(key,key==='Tex0');if(!maps[key]?.isTexture||maps[key].isCubeTexture)throw Error('Original '+key+' texture required');}
  const u={nineTime:{value:0}};for(const key of keys)u['nine'+key]={value:maps[key]};
  m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(q<2&&normal===1)m.defines={...m.defines,USE_TANGENT:''};m.defines={...m.defines,USE_UV1:''};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 nineUv,nineUv1;varying vec3 nineN,nineT,nineB,nineWorld;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nnineUv=uv;nineUv1=uv1;').replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 nineNormal=transformedNormal;
    #ifdef FLIP_SIDED
    nineNormal=-nineNormal;
    #endif
    nineN=normalize(inverseTransformDirection(nineNormal,viewMatrix))*vec3(-1.,1.,1.);nineT=vec3(1.,0.,0.);nineB=vec3(0.,1.,0.);
    ${q<2&&normal===1?'nineT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.,1.,1.);nineB=cross(nineN,nineT)*tangent.w;':''}`).replace('#include <project_vertex>','nineWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
   s.fragmentShader=vary+`uniform sampler2D nineTex0,nineTex2,nineTex3,nineTex6;uniform float nineTime;
    vec3 nineHue(float key){float r=key*6.28318530718,sn=sin(r),cs=cos(r),o=1.-cs;vec3 a=normalize(vec3(${f(rainbow[0])},${f(rainbow[1])},${f(rainbow[2])}));mat3 m=mat3(o*a.x*a.x+cs,o*a.x*a.y-a.z*sn,o*a.z*a.x+a.y*sn,o*a.x*a.y+a.z*sn,o*a.y*a.y+cs,o*a.y*a.z-a.x*sn,o*a.z*a.x-a.y*sn,o*a.y*a.z+a.x*sn,o*a.z*a.z+cs);return m*vec3(1.);}
    float nineNoise(vec2 x){return fract(sin(dot(x,vec2(12.9898,78.233)))*43758.5453);}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 nineBase=texture2D(nineTex0,nineUv),nineMask=texture2D(nineTex2,nineUv),nineDetail=texture2D(nineTex3,nineUv*${f(n('DetailNormalUVTiling',1))});
    nineBase.rgb=pow(max(nineBase.rgb,vec3(0.)),vec3(2.2));
    vec3 nineView=normalize(cameraPosition-nineWorld),nineNormal=nineN;
    ${q<2&&normal===1?`vec3 nineLocal=nineDetail.xyz*2.-1.;nineLocal.xy*=${f(n('DetailNormalIntensity',1))};nineNormal=mat3(nineT,nineB,nineN)*normalize(nineLocal);`:''}
    float nineHueA=dot(nineView,nineNormal)*3.+nineTime;float nineHueB=dot(nineView,normalize(vec3(nineUv1,0.)))*3.-nineTime*.5;
    vec3 nineHueColor=pow(max(nineHue(nineHueA/6.2831853),vec3(0.)),vec3(2.2))*10.;vec3 nineHueColorB=nineHue(nineHueB/6.2831853);
    float nineCaustic=0.;
    ${q===0?`vec2 nineP=(nineUv1*vec2(.6,1.)-nineTime*.1)*12.56637;for(int nineI=0;nineI<3;nineI++){float nineT=nineTime*.3*(1.-3.5/float(nineI+1));nineP+=vec2(cos(nineT-nineP.x)+sin(nineT+nineP.y),sin(nineT-nineP.y)+cos(nineT+nineP.x))*.02;}nineCaustic=pow(abs(1.17-nineNoise(nineP*vec2(1.3,.7))),5.)*${f(n('CausticIntensity',0))};`:''}
    vec2 nineCapUv=(mat3(viewMatrix)*(nineNormal*vec3(-1.,1.,1.))).xy*.5+.5;nineCapUv.y*=-1.;vec4 nineCap=texture2D(nineTex6,nineCapUv);float nineStar=texture2D(nineTex6,nineUv*8.+nineTime*.01).b*100.;float nineSpark=texture2D(nineTex6,nineUv*10.+fract(nineTime)*.08).b*texture2D(nineTex6,nineUv*8.-fract(nineTime)*.08).b;
    vec3 nineBaseEm=nineBase.rgb*${f(n('BaseEM',0))},nineMaskEm=nineBase.rgb*${f(n('MaskEM',0))};vec3 nineEmission=mix(nineBaseEm,nineMaskEm,nineMask.a);
    nineEmission+=nineHueColorB*nineCaustic*nineMask.r+nineHueColor*nineMask.g+nineCap.rgb*${rgb(matcapColor)}*${f(n('MatcapIntensity',0))}*nineMask.b+nineHueColorB*${f(n('MaoIntensity',0))}*${rgb(maoColor)}*nineBase.a+nineSpark*vec3(1.,.6,.1)*${f(n('StarIntensity',0))}*nineStar;
    diffuseColor=vec4(nineBase.rgb,nineBase.a*opacity);
   `).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(nineNormal*vec3(-1.,1.,1.)));').replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;').replace('#include <aomap_fragment>','').replace('#include <emissivemap_fragment>','totalEmissiveRadiance=nineEmission;');
  };
  warnings.push('pecial_ninecolor 源 Tex0/Tex2/Tex3/Tex6、UV1、stored tangent、流光/caustic、detail normal 与 MatCap 已接入；源场景光照仍未完整还原');return u;
 }catch(e){warnings.push('pecial_ninecolor remains unsupported: '+e.message);return null;}
}
