import {scalar,vector,f,rgb} from './t107-frame.js';

// Source: shader/surf/2024_spring_festival/snzq.hlsl. The source only requires
// COLOR0 and the tangent basis; it does not enable or sample a second UV.
export async function configureSnzq(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown SNZQ macro permutation');
  if(o.sourceVertexColors!==true)throw Error('Original vertex color required');
  if(q<2&&normal===1&&o.sourceTangents!==true)throw Error('Original tangent basis required');
  const n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d);
  const intensity=v('Intensity',[1,1,1,0]),color0=v('Color0',[1,1,1,1]),hue=v('RainbowHue',[1,1,1,1]);
  const maps={};for(const key of ['Tex0','Tex1','Tex2','Tex3','Tex4']){maps[key]=await load(key,key==='Tex0');if(!maps[key]?.isTexture||maps[key].isCubeTexture)throw Error('Missing original '+key);}
  const u={snzqTime:{value:0}};for(const key of Object.keys(maps))u['snzq'+key]={value:maps[key]};
  m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.vertexColors=true;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(q<2&&normal===1)m.defines={...m.defines,USE_TANGENT:''};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 snzqUv;varying vec3 snzqLocal,snzqWorld,snzqN,snzqT,snzqB;varying float snzqColorR;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nsnzqUv=uv;').replace('#include <color_vertex>','#include <color_vertex>\n#ifdef USE_COLOR\nsnzqColorR=color.r;\n#else\nsnzqColorR=1.;\n#endif').replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 snzqNormal=transformedNormal;
    #ifdef FLIP_SIDED
    snzqNormal=-snzqNormal;
    #endif
    snzqN=normalize(inverseTransformDirection(snzqNormal,viewMatrix))*vec3(-1.,1.,1.);snzqT=vec3(1.,0.,0.);snzqB=vec3(0.,1.,0.);
    ${q<2&&normal===1?'snzqT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.,1.,1.);snzqB=cross(snzqN,snzqT)*tangent.w;':''}`).replace('#include <project_vertex>','snzqLocal=transformed;snzqWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
   const noise=`float snzqRandom(vec2 st){return fract(sin(dot(st,vec2(12.9898,78.233)))*43758.5453123);}float snzqNoise(vec2 st){vec2 i=floor(st),ff=fract(st);float a=snzqRandom(i),b=snzqRandom(i+vec2(1.,0.)),c=snzqRandom(i+vec2(0.,1.)),d=snzqRandom(i+vec2(1.,1.));vec2 uu=ff*ff*(3.-2.*ff);return mix(a,b,uu.x)+(c-a)*uu.y*(1.-uu.x)+(d-b)*uu.x*uu.y;}`;
   const hueShift=`vec3 snzqHueShift(float key,vec3 col,float tiling){float rotation=(key+snzqTime*${f(n('FlowRainbowSpeed',0.3))})*tiling*6.28318530718;float ss=sin(rotation),cc=cos(rotation),omc=1.-cc;vec3 axis=normalize(vec3(${f(hue[0])},${f(hue[1])},${f(hue[2])}));mat3 rm=mat3(omc*axis.x*axis.x+cc,omc*axis.x*axis.y-axis.z*ss,omc*axis.z*axis.x+axis.y*ss,omc*axis.x*axis.y+axis.z*ss,omc*axis.y*axis.y+cc,omc*axis.y*axis.z-axis.x*ss,omc*axis.z*axis.x-axis.y*ss,omc*axis.y*axis.z+axis.x*ss,omc*axis.z*axis.z+cc);return rm*col;}`;
   s.fragmentShader=vary+`uniform sampler2D snzqTex0,snzqTex1,snzqTex2,snzqTex3,snzqTex4;uniform float snzqTime;${noise}${hueShift}\n`+s.fragmentShader;
   const body=`
    vec4 snzq0=texture2D(snzqTex0,snzqUv),snzq2=texture2D(snzqTex2,snzqUv);vec3 snzqBase=pow(max(snzq0.rgb,vec3(0.)),vec3(2.2));vec3 snzqView=normalize(cameraPosition-snzqWorld),snzqNrm=snzqN;float snzqUvmask=1.;
    ${q<2?`float snzqTimeC=snzqTime*.8,snzqTau=6.28318530718,snzqInten=.005;vec2 snzqP=mod(snzqUv*10.*snzqTau*2.,snzqTau)-250.,snzqI=snzqP;float snzqC=1.;for(int snzqIter=0;snzqIter<3;snzqIter++){float snzqT=snzqTimeC*(1.-3.5/float(snzqIter+1));snzqI=snzqP+vec2(cos(snzqT-snzqI.x)+sin(snzqT+snzqI.y),sin(snzqT-snzqI.y)+cos(snzqT+snzqI.x));snzqC+=1./max(length(vec2(snzqP.x/(sin(snzqI.x+snzqT)/snzqInten),snzqP.y/(cos(snzqI.y+snzqT)/snzqInten))),.0001);}snzqC/=3.;float snzqCaustic=pow(abs(1.17-pow(snzqC,3.)),5.);snzqUvmask=mix(.7,1.,pow(cos(1.-snzqUv.y*9.+snzqTime*2.),1.));`:''}
    ${q<2&&normal===1?`vec4 snzqN0=texture2D(snzqTex1,snzqUv);vec3 snzqSampleB=snzqN0.xyz*2.-1.;snzqSampleB.xy*=${f(intensity[0])};vec4 snzqD=texture2D(snzqTex3,snzqUv*${f(n('DetailNormalUVTiling',5))});vec3 snzqA=snzqD.xyz*2.-1.;snzqA.xy*=${f(n('DetailNormalIntensity',1))};vec3 snzqBaseN=vec3(snzqSampleB.xy*.5,snzqSampleB.z+1.),snzqAddN=vec3(-snzqA.xy,snzqA.z);vec3 snzqBlend=snzqBaseN*dot(snzqBaseN,snzqAddN)-(snzqBaseN.z+1.)*snzqAddN;vec3 snzqNRaw=normalize(mat3(snzqT,snzqB,snzqN)*normalize(snzqSampleB)),snzqNDetail=normalize(mat3(snzqT,snzqB,snzqN)*normalize(snzqBlend)),snzqNAdd=normalize(mat3(snzqT,snzqB,snzqN)*normalize(snzqA));snzqNrm=normalize(mix(snzqNRaw,snzqNAdd,snzqN0.a*snzqUvmask));`:''}
    ${q<2?`float snzqAsdasd=smoothstep(0.,1.,snzq2.b*2.-1.),snzqAsdasdd=clamp(snzq2.b*2.,0.,1.);vec3 snzqHueA=snzqHueShift(snzqLocal.y,vec3(.1,.6,.1),1.)*10.;vec3 snzqMaskHue=snzqAsdasdd*pow(max(snzqHueA,vec3(0.)),vec3(2.2));float snzqHueFr=clamp(pow(max(dot(snzqView,snzqNrm)-.5,0.),.5)*2.,0.,1.);vec3 snzqHuelerp=mix(snzqMaskHue*texture2D(snzqTex2,snzqUv+snzqTime*vec2(-.05)).a,vec3(0.),snzqHueFr);vec3 snzqHue=snzqHueShift(snzqLocal.y,vec3(.1,.6,.1),${f(n('RainbowTiling',.2))})*${f(n('RainbowIntensity',1))};float snzqStFr=clamp(pow(max(dot(snzqView,snzqNrm)-.3,0.),.5)*1.5,0.,1.);vec3 snzqLerpSt=mix(snzqHue,vec3(0.),snzqStFr)*snzq2.r;float snzqColorFr=1.-clamp(pow(max(dot(snzqView,snzqNrm)-.5,0.),.9)*2.,0.,1.);vec3 snzqBaibian=mix(snzqColorFr*snzqHue,vec3(0.),snzq0.a)*${f(n('BaseEmissiveKey',1))};float snzqWhite=1.-clamp(pow(max(dot(snzqView,snzqNrm)-.1,0.),1.)*1.3,0.,1.);vec3 snzqDooi=snzqWhite*vec3(${f(color0[0])},${f(color0[1])},${f(color0[2])})*2.*snzq0.a*snzqAsdasd;float snzqLerpMask=mix(1.,snzqD.a,snzqN0.a);vec3 snzqCapT=normalize(cross(snzqView,vec3(0.,1.,0.))),snzqCapB=normalize(cross(snzqView,snzqCapT));vec2 snzqMatUv=vec2(dot(snzqNrm,snzqCapT),dot(snzqNrm,snzqCapB))*.5+.5;vec3 snzqMat=pow(max(texture2D(snzqTex4,snzqMatUv).rgb,vec3(0.)),vec3(2.2))*(${f(n('MatcapIntensity',1))}*snzqColorR+snzqN0.a*snzqUvmask);snzqBase=snzqBase;diffuseColor=vec4(snzqBase,1.);`:''}
    ${q<2?`float snzqOpacityFr=1.-clamp(pow(max(dot(snzqView,snzqNrm)-.1,0.),1.)*2.,0.,1.);diffuseColor.a=mix(snzqOpacityFr,1.,snzq0.a);`:''}
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(snzqNrm*vec3(-1.,1.,1.)));').replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'0.6':`${f(intensity[1])}*.6`};`).replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;').replace('#include <aomap_fragment>','').replace('#include <emissivemap_fragment>',`${q<2?`vec3 snzqEmission=snzqBase*.9+snzqMat+snzqHuelerp+snzqLerpSt+snzqBaibian+snzqDooi+snzqCaustic*snzq2.g;totalEmissiveRadiance=snzqEmission;`:'totalEmissiveRadiance=snzqBase;'}`);
  };
  warnings.push('SNZQ source Tex0-4、COLOR0、stored tangent、detail normal、caustic、HueShift、MatCap、Fresnel 与 emissive 已接入；SH/half 精度仍存在预览差异');return u;
 }catch(e){warnings.push('SNZQ remains unsupported: '+e.message);return null;}
}
