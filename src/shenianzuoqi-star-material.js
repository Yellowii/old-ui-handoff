import {Vector2,Vector4} from 'three';

const scalar=(value,fallback)=>{const result=value===undefined?fallback:Number(value);if(!Number.isFinite(result))throw Error('invalid source scalar');return result;};
const vector=(value,fallback)=>{const result=value===undefined?fallback:Array.isArray(value)?value:JSON.parse(String(value).trim().startsWith('[')?value:'['+value+']');if(result.length!==fallback.length||!result.every(Number.isFinite))throw Error('invalid source vector');return result;};
const f=value=>scalar(value,0).toFixed(8);
const rgb=value=>`vec3(${value.slice(0,3).map(f).join(',')})`;

// Original 2024_spring_festival/standard_shenianzuoqi_star source channels.
export async function configureShenianzuoqiStar(material,params,macros,load,warnings,overrides={}){
 try{
  const quality=scalar(macros.RENDER_QUALITY,0),low=quality===2,normalOn=scalar(macros.NORMAL_MAP_ENABLE,1)!==0,change=scalar(macros.CHAR_CHANGE_COLOR,1)!==0;
  if(![0,1,2].includes(quality))throw Error('unknown quality branch');
  if(!low&&normalOn&&!overrides.sourceTangents)throw Error('missing original tangent basis');
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(params[key],[0,0,0]).some(value=>value!==0))throw Error('active soft-body offset is not implemented');
  const n=(key,fallback=0)=>scalar(params[key],fallback),v=(key,fallback)=>vector(params[key],fallback);
  const base=v('BaseColor',[1,1,1,1]),intensity=v('Intensity',[1,1,1,0]),rim=v('RimColor',[0,0,0,0]),starColor=v('StarColor',[1,1,1,1]),frenelColor=v('frenelColor',[1,1,1,1]);
  const maps={};for(const key of ['Tex0','Tex1','StarMap','StarMask']){maps[key]=await load(key,key==='Tex0');if(!maps[key]?.isTexture||maps[key].isCubeTexture)throw Error('missing original '+key);}
  const uniforms={neoSyzTex0:{value:maps.Tex0},neoSyzTex1:{value:maps.Tex1},neoSyzStarMap:{value:maps.StarMap},neoSyzStarMask:{value:maps.StarMask},neoSyzTime:{value:0},neoSyzEmissionScale:{value:1},neoSyzRTSize:{value:new Vector4()}};
  material.map=null;material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;material.color.set(0xffffff);material.emissive.set(0xffffff);material.emissiveIntensity=1;material.vertexColors=false;
  if(!low&&normalOn)material.defines={...material.defines,USE_TANGENT:''};
  const size=new Vector2();
  material.onBeforeRender=renderer=>{const target=renderer.getRenderTarget();if(target){const level=2**renderer.getActiveMipmapLevel();size.set(Math.max(1,Math.floor(target.width/level)),Math.max(1,Math.floor(target.height/level)));}else renderer.getDrawingBufferSize(size);uniforms.neoSyzRTSize.value.set(size.x,size.y,1/size.x,1/size.y);};
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   const vary='varying vec2 neoSyzUv;varying vec3 neoSyzN,neoSyzT,neoSyzB,neoSyzWorld,neoSyzLocal,neoSyzCenter;\n';
   shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoSyzUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 neoSyzNormal=transformedNormal;
    #ifdef FLIP_SIDED
    neoSyzNormal=-neoSyzNormal;
    #endif
    neoSyzN=normalize(inverseTransformDirection(neoSyzNormal,viewMatrix))*vec3(-1.,1.,1.);neoSyzT=vec3(1.,0.,0.);neoSyzB=vec3(0.,1.,0.);
    ${!low&&normalOn?'neoSyzT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.,1.,1.);neoSyzB=cross(neoSyzN,neoSyzT)*tangent.w;':''}`).replace('#include <project_vertex>','neoSyzLocal=transformed;neoSyzWorld=(modelMatrix*vec4(transformed,1.)).xyz;neoSyzCenter=modelMatrix[3].xyz;\n#include <project_vertex>');
   shader.fragmentShader=vary+`uniform sampler2D neoSyzTex0,neoSyzTex1,neoSyzStarMap,neoSyzStarMask;uniform float neoSyzTime,neoSyzEmissionScale;uniform vec4 neoSyzRTSize;\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    vec4 neoSyzBase=texture2D(neoSyzTex0,neoSyzUv),neoSyzNormalTex=texture2D(neoSyzTex1,neoSyzUv);vec3 neoSyzView=normalize(cameraPosition-neoSyzWorld)*vec3(-1.,1.,1.),neoSyzNormal=neoSyzN;
    ${!low&&normalOn?`vec3 neoSyzSampleN=neoSyzNormalTex.xyz*2.-1.;neoSyzSampleN.xy*=${f(intensity[0])};neoSyzSampleN.z=sqrt(clamp(1.-dot(neoSyzSampleN.xy,neoSyzSampleN.xy),0.,1.));neoSyzNormal=mat3(neoSyzT,neoSyzB,neoSyzN)*normalize(neoSyzSampleN);`:''}
    float neoSyzFresTemp=dot(neoSyzNormal,neoSyzView),neoSyzFresOp=clamp(pow(clamp(1.-neoSyzFresTemp,0.,1.)*3.,.6),0.,1.);
    float neoSyzCaustic=0.;
    ${quality===0?`float neoSyzTimeC=neoSyzTime*.65+2.,neoSyzTau=6.28318530718,neoSyzInten=.005;vec2 neoSyzCuv=neoSyzUv;neoSyzCuv-=neoSyzTime*vec2(-.05);vec2 neoSyzCu=neoSyzCuv*vec2(.85,.95)+neoSyzTime*vec2(0.,-.2);vec2 neoSyzP=mod(neoSyzCu*neoSyzTau*2.,neoSyzTau)-250.,neoSyzI=neoSyzP;float neoSyzC=1.;for(int neoSyzIter=0;neoSyzIter<3;neoSyzIter++){float neoSyzT=neoSyzTimeC*(1.-3.5/float(neoSyzIter+1));neoSyzI=neoSyzP+vec2(cos(neoSyzT-neoSyzI.x)+sin(neoSyzT+neoSyzI.y),sin(neoSyzT-neoSyzI.y)+cos(neoSyzT+neoSyzI.x));neoSyzC+=1./abs(neoSyzP.y/(cos(neoSyzI.y+neoSyzT)/neoSyzInten));}neoSyzC/=3.;neoSyzCaustic=pow(abs(1.17-pow(neoSyzC,3.)),1.);`:''}
    neoSyzCaustic=mix(1.,neoSyzCaustic,${f(n('UseOriCaustic',1))});
    vec2 neoSyzScreen=gl_FragCoord.xy*neoSyzRTSize.zw*vec2(neoSyzRTSize.x/neoSyzRTSize.y,1.);float neoSyzDistance=${n('StarUVTilingByDistance',1)>0?`length(cameraPosition-neoSyzCenter)*.1*${f(n('StarUVTilingByDistance',1))}`:'1.'};vec2 neoSyzTemp=(neoSyzScreen-vec2(.5)*vec2(neoSyzRTSize.x/neoSyzRTSize.y,1.))*neoSyzDistance;
    vec3 neoSyzTangentView=${!low?`vec3(dot(neoSyzT,neoSyzView),dot(neoSyzB,neoSyzView),dot(neoSyzN,neoSyzView))`:'vec3(0.)'};vec2 neoSyzViewOffset=${!low?`mix(vec2(0.),${f(n('TangentOffsetScale'))}*neoSyzTangentView.rg,${f(n('UseNewTangent'))})`:'vec2(0.)'};float neoSyzStar=0.,neoSyzBaseLerp=0.;
    ${!low?`vec4 neoSyzMask=texture2D(neoSyzStarMask,neoSyzUv);neoSyzBaseLerp=neoSyzMask.g;float neoSyzMaskValue=neoSyzMask.r;vec2 neoSyzStarOffset=neoSyzTangentView.xy*.01;float neoSyzStar1=texture2D(neoSyzStarMap,neoSyzTemp*.42+vec2(${f(n('starSpeed'))},${f(-n('starSpeed2'))})*neoSyzTime+neoSyzStarOffset).a,neoSyzStar2=texture2D(neoSyzStarMap,neoSyzTemp*.63+vec2(${f(n('starSpeed'))},0.)*neoSyzTime+neoSyzStarOffset).a;neoSyzStar=neoSyzStar1*neoSyzStar2*neoSyzMaskValue;`:''}
    vec3 neoSyzPosition=neoSyzLocal*.1;vec4 neoSyzX=texture2D(neoSyzStarMap,neoSyzPosition.zy*${f(n('starMapTiling',1))}+vec2(.9,.25)+neoSyzViewOffset),neoSyzY=texture2D(neoSyzStarMap,neoSyzPosition.xz*${f(n('starMapTiling',1))}+vec2(-.09,.6)+neoSyzViewOffset),neoSyzZ=texture2D(neoSyzStarMap,neoSyzPosition.xy*${f(n('starMapTiling',1))}+vec2(${f(n('starMapUVOffsetX',.9))},${f(n('starMapUVOffsetY',.6))})+neoSyzViewOffset);vec3 neoSyzWeights=pow(abs(neoSyzN),vec3(1.));neoSyzWeights/=neoSyzWeights.x+neoSyzWeights.y+neoSyzWeights.z;vec4 neoSyzPlanar=neoSyzX*neoSyzWeights.x+neoSyzY*neoSyzWeights.y+neoSyzZ*neoSyzWeights.z;
    float neoSyzBackMask=clamp(pow(neoSyzBase.r,10.)*pow(neoSyzNormalTex.b,5.)*clamp(clamp(neoSyzUv.x-.5,0.,1.)*10.,0.,1.)*100.,0.,1.);neoSyzBackMask=mix(0.,neoSyzBackMask,${f(n('UseOriBackMask',1))});neoSyzBase=mix(neoSyzBase,clamp(neoSyzBase*.05,0.,1.),neoSyzBackMask*neoSyzCaustic);
    vec3 neoSyzAlbedo=${change?`pow(max(vec3(dot(neoSyzBase.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)},vec3(0.)),vec3(${low?'2.':'2.2'}))*${f(n('TintValue',1))}`:`pow(max(neoSyzBase.rgb,vec3(0.)),vec3(${low?'2.':'2.2'}))*neoSyzBase.r*pow(neoSyzNormalTex.b,5.)`};diffuseColor=vec4(neoSyzAlbedo,opacity);
   `).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(neoSyzNormal*vec3(-1.,1.,1.)));').replace('#include <roughnessmap_fragment>','float roughnessFactor=.5;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;').replace('#include <aomap_fragment>','').replace('#include <emissivemap_fragment>',`
    float neoSyzFresnel=clamp(${f(n('FresnelScale'))}+(1.-${f(n('FresnelScale'))})*pow(1.-dot(neoSyzNormal,neoSyzView),5.),0.,1.);vec3 neoSyzEmission=neoSyzFresnel*${rgb(rim)}*${f(intensity[3])};neoSyzEmission+=pow(max(neoSyzBase.rgb,vec3(0.)),vec3(${low?'2.':'2.2'}))*.5*pow(neoSyzNormalTex.b,5.)*${f(n('HeadMainEmis',1))};neoSyzEmission+=neoSyzBaseLerp*0.;
    ${!low?`float neoSyzEdge=clamp(pow(clamp(.8-neoSyzFresTemp,0.,1.),${f(n('frenelPow',1))*1.35}),0.,1.);neoSyzEmission+=mix(vec3(0.),neoSyzEdge*${rgb(frenelColor)}*${f(n('frenelEmisStr'))},neoSyzNormalTex.b);neoSyzEmission+=pow(max(pow(max(neoSyzPlanar.rgb,vec3(0.)),vec3(${low?'2.':'2.2'})),vec3(0.)),vec3(2.))*${f(n('StarBackGroundEmis',3))};neoSyzEmission+=neoSyzStar*${rgb(starColor)}*${f(n('StarEmis',6))};`:''}
    neoSyzEmission+=sqrt(max(neoSyzNormalTex.a,0.))*pow(max(neoSyzBase.rgb,vec3(0.)),vec3(${low?'2.':'2.2'}))*${f(n('BaseColEmis',.5))};float neoSyzLerpMask=pow(neoSyzBaseLerp,${f(n('lerpMaskPow',1))}),neoSyzIsLerp=neoSyzLerpMask*${f(n('UseBaseColorLerp'))};neoSyzEmission=mix(neoSyzEmission,${f(n('BaseColorMult'))}*neoSyzBase.rgb,neoSyzIsLerp);totalEmissiveRadiance=neoSyzEmission*neoSyzEmissionScale;
   `);
  };
  warnings.push('shenianzuoqi_star original star planes, screen layers, caustics, TBN, and quality branches are connected; scene lighting parity remains unverified');return uniforms;
 }catch(error){warnings.push('shenianzuoqi_star remains unsupported: '+error.message);return null;}
}
