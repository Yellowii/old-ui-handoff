import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';

// shader/surf/s31/slzs_sha.hlsl.  The source uses six UV0 textures and the
// authored tangent basis when NORMAL_MAP_ENABLE is active.  A derivative TBN
// is used only for source meshes which prove that their tangent stream is
// absent; this keeps the material usable for the three shared bare meshes in
// the current wardrobe while recording the reduced normal precision.
export async function configureSlzsSha(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(change))throw Error('Unknown source macro');
  const derivedTbn=q<2&&normal&&!o.sourceTangents;
  const n=(k,d)=>f(scalar(p[k],d)),v=(k,d)=>vector(p[k],d),c=(k,d=[1,1,1,1])=>rgb(v(k,d));
  const intensity=v('Intensity',[1,.1,1,0]),base=v('BaseColor',[1,1,1,1]);
  const maps=await Promise.all(['Tex0','Tex1','Tex2','Tex3','Tex4','Tex5'].map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex5');
  const u={neoShaTime:{value:0}};maps.forEach((t,i)=>u['neoShaTex'+i]={value:t});
  setup(m,q<2&&normal&&!derivedTbn);
  if(derivedTbn){m.extensions={...m.extensions,derivatives:true};m.userData.slzsShaDerivedTangent=true;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal&&!derivedTbn);
   s.fragmentShader=`uniform sampler2D neoShaTex0,neoShaTex1,neoShaTex2,neoShaTex3,neoShaTex4,neoShaTex5;uniform float neoShaTime;
    float neoShaRandom(vec2 x){return fract(sin(dot(x,vec2(12.0,78.0)))*43758.0);}
    float neoShaNoise(vec2 x){vec2 i=floor(x),g=fract(x),u=g*g*(3.0-2.0*g);float a=neoShaRandom(i),b=neoShaRandom(i+vec2(1.,0.)),cc=neoShaRandom(i+vec2(0.,1.)),d=neoShaRandom(i+vec2(1.,1.));return mix(a,b,u.x)+((cc-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y);}
    float neoShaPowSg(float x,float y){y=y*1.4427+1.4427;return exp2(x*y-y);}
   `+s.fragmentShader;
   const tbn=normal&&q<2?(derivedTbn?`vec3 neoShaDt=normalize(dFdx(vViewPosition)*dFdy(t107Uv).y-dFdy(vViewPosition)*dFdx(t107Uv).y),neoShaDb=normalize(-dFdx(vViewPosition)*dFdy(t107Uv).x+dFdy(vViewPosition)*dFdx(t107Uv).x);if(dot(cross(neoShaDt,neoShaDb),t107N)<0.)neoShaDb=-neoShaDb;mat3 neoShaTbn=mat3(neoShaDt,neoShaDb,t107N);`:'mat3 neoShaTbn=mat3(t107T,t107B,t107N);'):'mat3 neoShaTbn=mat3(1.);';
   const normalCode=q<2?`vec3 neoShaB=texture2D(neoShaTex1,neoShaUv).xyz*2.-1.;neoShaB.z=sqrt(max(0.,1.-dot(neoShaB.xy,neoShaB.xy)));neoShaB.xy*=${f(intensity[0])};neoShaB=normalize(neoShaB);
    vec2 neoShaTest=neoShaUv;float neoShaA=saturate(ceil(neoShaUv.y-.25)+ceil(1.-neoShaUv.x-.75));vec2 neoShaDetailUv=mix(fract(neoShaTest*4.)*${n('DetailNormalUVTiling',3.5)}/4.,neoShaTest*${n('DetailNormalUVTiling',3.5)},neoShaA);
    vec3 neoShaD=texture2D(neoShaTex3,neoShaDetailUv).xyz*2.-1.;neoShaD.xy*=${n('DetailNormalIntensity',.3)};vec3 neoShaBase=vec3(neoShaB.xy*.5,neoShaB.z+1.);vec3 neoShaAdd=vec3(-neoShaD.xy,neoShaD.z);vec3 neoShaBlend=neoShaBase*dot(neoShaBase,neoShaAdd)-(neoShaBase.z+1.)*neoShaAdd;vec3 neoShaN0=neoShaTbn*normalize(neoShaB),neoShaN1=neoShaTbn*normalize(neoShaBlend);vec3 neoShaN=mix(neoShaN0,neoShaN1,texture2D(neoShaTex1,neoShaUv).a);vec3 neoShaAddN=neoShaTbn*normalize(vec3(neoShaD.xy*.5,neoShaD.z));`:'vec3 neoShaN=t107N,neoShaAddN=t107N;';
   const body=`vec2 neoShaUv=t107Uv;neoShaUv.x+=(neoShaUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',0)}:0.);vec4 neoShaBaseTex=texture2D(neoShaTex0,neoShaUv),neoShaMask=texture2D(neoShaTex2,neoShaUv);${tbn}${normalCode}
    vec3 neoShaV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);vec3 neoShaSun=${sourceSceneSunGlsl()};
    float neoShaAniso=0.,neoShaStars=0.,neoShaPoint=0.;vec4 neoShaMat=vec4(0.);
    ${q<2?`vec3 neoShaH=normalize(neoShaSun+neoShaV),neoShaBin=normalize(cross(neoShaN,neoShaTbn[0])),neoShaTan=mix(normalize(neoShaTbn*vec3(0.,1.,0.)),neoShaBin,${n('AnisoNormalEnable',1)});float neoShaTdH=dot(neoShaTan,neoShaH);neoShaAniso=neoShaPowSg(1.-neoShaTdH*neoShaTdH,mix(120.,60.,${n('AnisoNormalEnable',1)})*${n('AnisoPow',3)})*texture2D(neoShaTex1,neoShaUv).b;vec2 neoShaStarUv=neoShaUv*${n('StarTiling',7)};vec2 neoShaDepth1=neoShaStarUv-(neoShaTbn*neoShaV).xy*.15,neoShaDepth2=neoShaStarUv+neoShaTime*vec2(${n('StarSpeedX',.02)},${n('StarSpeedY',.02)});vec4 neoShaS1=texture2D(neoShaTex4,neoShaDepth1),neoShaS2=texture2D(neoShaTex4,neoShaDepth2);neoShaStars=(pow(neoShaS1.b*neoShaS2.b,2.)+neoShaS1.a*neoShaS2.a)*texture2D(neoShaTex1,neoShaUv).b;vec2 neoShaCapUv=(mat3(viewMatrix)*mix(neoShaN,neoShaN1,${n('MatcapUseDetailNormal',0)})).xy*.5+.5;neoShaCapUv.y=1.-neoShaCapUv.y;neoShaMat=texture2D(neoShaTex5,neoShaCapUv);neoShaPoint=smoothstep(.5,1.,neoShaNoise(neoShaUv*100.-(neoShaTbn*neoShaV).xy*5.+neoShaTime*-.8))*neoShaMask.r;`:''}
    ${change?`float neoShaLum=dot(neoShaBaseTex.rgb,vec3(.2125,.7154,.0721));diffuseColor=vec4(pow(max(vec3(neoShaLum)*${c('BaseColor',base)},vec3(0.)),vec3(2.2))*${n('TintValue',1)},neoShaBaseTex.a);`:`diffuseColor=vec4(pow(max(neoShaBaseTex.rgb,vec3(0.)),vec3(2.2))*${n('BaseColorInten',1)},neoShaBaseTex.a);`}
    ${q===2?`diffuseColor.rgb=neoShaBaseTex.rgb*${n('BaseColorFixLow',1)};`:''}
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',q<2&&normal?'normal=normalize(mat3(viewMatrix)*(neoShaN*vec3(-1.,1.,1.)));':'normal=normalize(mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'1.':f(intensity[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':f(intensity[2])};`)
    .replace('#include <emissivemap_fragment>',`float neoShaF=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*pow(1.-dot(${q===2?'t107N':'neoShaN'},neoShaV),5.),0.,1.);vec3 neoShaEm=neoShaF*${c('RimColor',[0,0,0,1])}*${f(intensity[3])};${q<2?`vec3 neoShaBaseEm=neoShaMask.a*pow(max(neoShaBaseTex.rgb,vec3(0.)),vec3(2.2))*${n('EmissiveIntensity',0)}*${c('EmisColor',[0,0,0,1])};float neoShaCo=saturate(pow(saturate(dot(neoShaV,neoShaN)-${n('COA',0)}),${n('COB',1)})*1.5);neoShaEm+=neoShaBaseEm+(${c('ClothFresnelColor',[0,0,0,1])}*${n('ClothFresnelIntensity',0)}*neoShaCo+${q<2?'neoShaAniso*'+c('AnisoColor',[0,0,0,1]):'vec3(0.)'})*texture2D(neoShaTex1,neoShaUv).b+pow(max(neoShaMat.rgb,vec3(0.)),vec3(2.2))*${c('MatcapEmisColor',[0,0,0,1])}*${n('MatcapStr',0)}*neoShaMask.g+neoShaStars*${c('StarColor',[0,0,0,1])}*${n('StarStr',0)}+neoShaPoint*${c('PointColor',[0,0,0,1])}*${n('PointStr',0)}*10.;`:''}totalEmissiveRadiance=neoShaEm;`)
    .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\ndiffuseColor.a=saturate(diffuseColor.a+saturate(neoShaPoint*${n('PointStr',0)}*pow(max(diffuseColor.a,0.),.3)));`)
    .replace('#include <aomap_fragment>','');
  };
  warnings.push(`slzs_sha 源六图、${derivedTbn?'导数':'原始'}TBN、DetailNormal/Aniso/星点/MatCap/布料 Fresnel/点状发光已接入；${sourceSceneLightWarning}`);return u;
 }catch(e){warnings.push('slzs_sha remains unsupported: '+e.message);return null;}
}
