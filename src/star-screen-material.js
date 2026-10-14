import {Vector2,Vector4} from 'three';

const num=(v,d=0)=>v===undefined?d:Number(v);
const flag=(v,d=0)=>typeof v==='string'&&/^(true|false)$/i.test(v)?Number(v.toLowerCase()==='true'):num(v,d);
const vec=(v,d)=>{if(v===undefined)return d;const a=Array.isArray(v)?v:JSON.parse(String(v).trim().startsWith('[')?v:'['+v+']');if(a.length!==d.length||!a.every(Number.isFinite))throw Error('无效源向量');return a;};
const scalar=v=>{if(!Number.isFinite(v))throw Error('无效源标量');return v.toFixed(8);};
const gl=v=>`vec${v.length}(${v.map(scalar).join(',')})`;
const noise=`float stRandom(vec2 x){return fract(sin(dot(x,vec2(12.0,78.0)))*43758.0);}
float stNoise(vec2 x){vec2 i=floor(x),f=fract(x),u=f*f*(3.0-2.0*f);float a=stRandom(i),b=stRandom(i+vec2(1,0)),c=stRandom(i+vec2(0,1)),d=stRandom(i+vec2(1,1));return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}`;

// s28/meteor_shower and s32/hznl_starrysky share the original screen/TBN inputs.
export async function configureStarScreen(m,p,macros,load,warnings,o={},family='meteor'){
 try{
  const meteor=family==='meteor',q=flag(macros.RENDER_QUALITY),low=q===2,normalOn=!low&&flag(macros.NORMAL_MAP_ENABLE,1)!==0;
  const n=(k,d=0)=>num(p[k],d),f=(k,d=0)=>scalar(n(k,d)),v=(k,d)=>vec(p[k],d),c=(k,d=[1,1,1,1])=>gl(v(k,d).slice(0,3));
  if(![0,1,2].includes(q))throw Error('未知质量分支');
  const second=!low&&n(meteor?'MeteorUseUV2':'NoiseUseSecondUV')!==0;
  if(normalOn&&(!o.sourceTangents||flag(macros.LIGHT_ENABLE,1)===0))throw Error('缺少活动原TBN');
  if(second&&!o.sourceSecondUv)throw Error('缺少活动原第二UV');
  if(flag(macros.ENABLE_SOFT_BODY2)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('活动软体未接入');
  const keys=['Tex0',...(!low?(meteor?['Tex1','Tex3','Tex4']:['Tex2','StarMap',...(normalOn?['Tex1']:[])]):[])],maps={};
  for(const k of keys){maps[k]=await load(k,false,k==='Tex0'?o.baseColor:k==='Tex1'?o.normal:undefined);if(!maps[k]||maps[k].isCubeTexture)throw Error('缺少原二维纹理 '+k);}
  const intensity=v('Intensity',[1,1,1,0]),change=flag(macros.CHAR_CHANGE_COLOR,1)!==0;
  const linear=x=>low?`((${x})*(${x}))`:`pow(max(${x},vec3(0.0)),vec3(2.2))`;
  const u={neoTime:{value:0},neoEmissionScale:{value:1},stRTSize:{value:new Vector4()}};
  for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4','StarMap'])u['st'+k]={value:maps[k]||null};
  m.color.set(0xffffff);m.map=maps.Tex0;m.normalMap=null;m.vertexColors=false;m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.defines={...m.defines,...(normalOn?{USE_TANGENT:''}:{}),...(second?{USE_UV1:''}:{})};
  const size=new Vector2();
  if(!low)m.onBeforeRender=r=>{const t=r.getRenderTarget();if(t){const k=2**r.getActiveMipmapLevel();size.set(Math.max(1,Math.floor(t.width/k)),Math.max(1,Math.floor(t.height/k)));}else r.getDrawingBufferSize(size);u.stRTSize.value.set(size.x,size.y,1/size.x,1/size.y);};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 stUv,stUv1;varying vec3 stN,stT,stB,stWorld,stCenter;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nstUv=uv;stUv1=${second?'uv1':'uv'};`)
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 stNormal=transformedNormal;
     #ifdef FLIP_SIDED
     stNormal=-stNormal;
     #endif
     stN=inverseTransformDirection(stNormal,viewMatrix)*vec3(-1,1,1);
     stT=vec3(1,0,0);stB=vec3(0,1,0);
     ${normalOn?'stT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1,1,1);stB=cross(stN,stT)*tangent.w;':''}`)
    .replace('#include <project_vertex>','stWorld=(modelMatrix*vec4(transformed,1)).xyz;stCenter=modelMatrix[3].xyz;\n#include <project_vertex>');
   s.fragmentShader=vary+'uniform sampler2D stTex0,stTex1,stTex2,stTex3,stTex4,stStarMap;uniform vec4 stRTSize;uniform float neoTime,neoEmissionScale;\n'+(!low?noise:'')+'\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 stBase=texture2D(stTex0,stUv);stBase.rgb=${linear('stBase.rgb')};
    vec4 stPacked=${!low&&(meteor||normalOn)?'texture2D(stTex1,stUv)':'vec4(0.0)'};
    vec4 stMix=${!low&&!meteor?'texture2D(stTex2,stUv)':'vec4(1,1,0,0)'};
    vec3 stView=normalize(cameraPosition-stWorld)*vec3(-1,1,1),stNormalW=stN;
    ${normalOn?`vec3 stSampleN=stPacked.xyz*2.0-1.0;stSampleN.xy*=${scalar(intensity[0])};stSampleN.z=sqrt(clamp(1.0-dot(stSampleN.xy,stSampleN.xy),0.0,1.0));stNormalW=mat3(stT,stB,stN)*normalize(stSampleN);`:''}
    vec3 stTangentView=${normalOn?'vec3(dot(stT,stView),dot(stB,stView),dot(stN,stView))':'stView'};
    vec3 stStars=vec3(0);vec4 stMeteor=vec4(0),stMatcap=vec4(0),stSky=vec4(0);float stNoiseValue=0.0,stEdge=0.0;
    vec2 stScreen=vec2(0),stScreenScaled=vec2(0),stSelectedUv=stUv;
    ${!low?`vec2 stAspect=vec2(stRTSize.x/stRTSize.y,1);stScreen=gl_FragCoord.xy*stRTSize.zw;
    float stDistance=${n('StarUVTilingByDistance',1)>0?`length(cameraPosition-stCenter)*.1*${f('StarUVTilingByDistance',1)}`:'1.0'};
    stScreenScaled=(stScreen-.5)*stAspect*stDistance;`:''}
    ${meteor?`
     ${!low?`stStars=texture2D(stTex3,stScreenScaled*.62-stTangentView.xy*.05).a*texture2D(stTex3,stScreenScaled*.73+${gl(v('StarSpeed',[0,.025]))}*neoTime).a*${c('StarColor')}*${f('StarEmis',6)};
     stSelectedUv=mix(stUv,stUv1,${f('MeteorUseUV2')});
     float stWeight=mix(${f('MeteorColWeightOffset')},.5,stPacked.b);
     vec2 stScale=mix(${gl(v('MeteorUVScale',[20,3]))},${gl(v('HairMeteorUVScale',[20,2]))},stPacked.b);
     vec2 stScale2=mix(${gl(v('Meteor2UVScale',[8,2.5]))},${gl(v('HairMeteor2UVScale',[12,1.25]))},stPacked.b);
     float stNoiseA=stNoise(vec2(floor(stSelectedUv.x*20.0*stScale.x)*.1)),stNoiseB=stNoise(vec2(floor(stSelectedUv.x*5.0*stScale2.x)*.1));
     vec2 stMeteorUv=stSelectedUv*stScale+vec2(0,-1)*(neoTime*mix(${f('MeteorSpeed',1)},${f('HairMeteorSpeed',.35)},stPacked.b)+stNoiseA)*mix(.75,.1,stNoiseA);
     vec2 stMeteorUv2=stSelectedUv*stScale2+vec2(0,-1)*(neoTime*mix(${f('Meteor2Speed',1)},${f('HairMeteor2Speed',.2625)},stPacked.b)+stNoiseB)*mix(.75,.1,stNoiseB);
     float stMaskA=texture2D(stTex3,stMeteorUv).r,stMaskB=texture2D(stTex3,stMeteorUv2).r;
     vec3 stColorA=mix(${c('MeteorColor')},${c('MeteorColor1')},clamp(stWeight+abs(fract(stNoiseA*2.5+neoTime*.025)-.5)*2.0,0.0,1.0));
     vec3 stColorB=mix(${c('MeteorColor')},${c('MeteorColor1')},clamp(stWeight+abs(fract(stNoiseB*2.5+neoTime*.025)-.5)*2.0,0.0,1.0));
     stMeteor=vec4((stMaskA*stColorA+stMaskB*stColorB)*${f('MeteorEmis',1)},stMaskA+stMaskB)*stPacked.a;
     stNoiseValue=clamp(stNoise(stUv*100.0+vec2(0,-1)*neoTime),0.0,1.0);stStars*=mix(${c('MeteorColor')},${c('MeteorColor1')},sqrt(stNoiseValue));
     vec3 stNormalV=(mat3(viewMatrix)*(stN*vec3(-1,1,1)))*vec3(1,1,-1);
     vec3 stViewV=(mat3(viewMatrix)*(stView*vec3(-1,1,1)))*vec3(1,1,-1);
     vec3 stTanV=normalize(cross(stViewV,vec3(0,1,0))),stBinV=normalize(cross(stViewV,stTanV));
     stMatcap=texture2D(stTex4,vec2(dot(stNormalV,stTanV),dot(stNormalV,stBinV))*.5+.5);stMatcap.rgb=${linear('stMatcap.rgb')}*mix(1.0,.5,stPacked.b);`:''}
     stBase.rgb=${change?`vec3(dot(stBase.rgb,vec3(.2125,.7154,.0721)))*${linear(c('BaseColor'))}`:'stBase.rgb'}*${f('TintValue',1)};
     vec3 stAlbedo=${low?'stBase.rgb':`mix(stBase.rgb,pow(stBase.rgb,vec3(${f('HairBaseColPow',2)}))*${f('HairBaseColStr',.5)},stPacked.b)`};
    `:`
     ${!low?`float stStarA=texture2D(stStarMap,stScreenScaled*.62+vec2(.01,-.01)*neoTime+stTangentView.xy*.01).a;
     float stStarB=texture2D(stStarMap,stScreenScaled*.73+vec2(${f('StarSpeedX')},${f('StarSpeedY')})*neoTime+stTangentView.xy*.01).a;
     stStars=vec3(stStarA*stStarB);
     stEdge=mix(1.0,clamp(pow(clamp(dot(stNormalW,stView)-.1,0.0,1.0)*2.0,${f('frenelPow')}*1.35),0.0,1.0),${f('frenelEdgeEnable')});
     stSelectedUv=mix(stUv,stUv1,${f('NoiseUseSecondUV')});stNoiseValue=clamp(stNoise(stSelectedUv*20.0*${f('NoiseTiling',1)}+vec2(-2,-1)*neoTime),0.0,1.0);
     vec2 stMainUv=mix((mat3(viewMatrix)*(stWorld-stCenter)).xy,stUv*20.0,${f('MainUVUseFragUV')})*.25*${f('MainUVTiling',1)};
     stMainUv+=vec2(.5+${f('MainUVOffsetX')},.2+${f('MainUVOffsetY')})+vec2(-1,1)*fract(neoTime*${f('MainUVSpeed')})+stNoiseValue*.025*${f('NoiseStr')};
     stSky=texture2D(stStarMap,stMainUv);stSky.rgb=${linear('stSky.rgb')};`:''}
     vec3 stAlbedo=${change?`vec3(dot(stBase.rgb,vec3(.2125,.7154,.0721)))*${c('BaseColor')}*${f('TintValue',1)}`:'stBase.rgb'};
     stAlbedo=mix(stAlbedo,vec3(0),${f('AllBlack')});
    `}
    diffuseColor=vec4(stAlbedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(stNormalW*vec3(-1,1,1)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${meteor?scalar(intensity[1]):low?'.5':`clamp(stMix.g*${scalar(intensity[1])},0.0,1.0)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${meteor?scalar(intensity[2]):low?'0.0':`clamp(stMix.b*${scalar(intensity[2])},0.0,1.0)`};`)
    .replace('#include <aomap_fragment>','')
    .replace('#include <emissivemap_fragment>',`
     float stFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(stNormalW,stView),5.0),0.0,1.0);
     vec3 stEmission=vec3(0);
     ${meteor?`stEmission=stFresnel*${c('RimColor',[0,0,0,0])}*${scalar(intensity[3])};
      ${!low?`vec3 stHair=stBase.rgb*stPacked.b*${f('HairEmissiveStr',1)};
      stEmission+=stHair*mix(vec3(1),stMeteor.rgb*${f('HairMeteorEmis',3)},clamp(stPacked.b*stMeteor.a*3.0,0.0,1.0));
      stEmission+=stMeteor.rgb*(1.0-stPacked.b)+stMatcap.rgb*${f('MatcapStr',1)}*stBase.a+stStars;
      stEmission+=stMatcap.a*${c('MatcapHairRfCol',[0,0,0,0])}*stPacked.b;
      float stHairNoise=pow(clamp(stNoise(stUv*vec2(30,20)+vec2(0,-.75)*neoTime)-.6,0.0,1.0),2.0);
      stEmission+=stHairNoise*${f('HairAddEmisStr')}*${c('HairAddEmisCol',[0,0,0,0])}*stPacked.b*stPacked.a;`:''}`:`
      ${!low?`stEmission=stFresnel*${c('RimColor',[0,0,0,0])}*${scalar(intensity[3])}+stBase.rgb*${c('EmissiveColor')}*${f('EmissiveValue',1)}*stMix.a;
      vec3 stEdgeColor=stEdge*${c('frenelColor')}*${f('frenelEmisStr')}*stPacked.b*stNoiseValue*stNoiseValue;
      stEmission+=(stEdgeColor+stSky.rgb*${f('StarBackGroundEmis')}+stStars*${c('StarColor')}*${f('StarEmis')})*stPacked.a;
      stEmission+=stMix.r*${c('CrackColor')}*stNoiseValue*stNoiseValue*${f('CrackEmis')};
      stEmission*=mix(1.0,stEdge,stPacked.a)*mix(1.0,stSky.r*30.0*stNoiseValue+.5,stPacked.a)*.5;
      float stPowN=${f('fres2Pow')}*1.4427+1.4427;
      float stFres2=clamp(exp2((1.0-clamp(dot(stNormalW,stView)-${f('fres2Scale')},0.0,1.0))*stPowN-stPowN)*2.0,0.0,1.0);
      stEmission+=stFres2*${c('fres2Color')}*${f('fres2EmisStr')}*(1.0-stBase.a);`:''}
      stEmission=mix(stEmission,vec3(0),${f('AllBlack')});`}
     totalEmissiveRadiance=stEmission*neoEmissionScale;
    `);
   if(!meteor)s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
    float stSpecular=${low?'1.0':'1.0-stPacked.a'}*(1.0-${f('AllBlack')});
    material.specularColor=vec3(.08*stSpecular);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);`);
  };
  warnings.push(family+' 已接入原屏幕/星层/质量公式；原场景光照与浮点噪声精度尚非完整等价');return u;
 }catch(e){warnings.push(family+' 未适配：'+e.message);return null;}
}
