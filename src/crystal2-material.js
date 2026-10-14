import {NormalBlending} from 'three';
const num=(v,d=0)=>v===undefined?d:Number(v),flag=(v,d=0)=>typeof v==='string'&&/^(true|false)$/i.test(v)?Number(v.toLowerCase()==='true'):num(v,d);
const vec=(v,d)=>{if(v===undefined)return d;const a=Array.isArray(v)?v:JSON.parse(String(v).trim().startsWith('[')?v:'['+v+']');if(a.length!==d.length||!a.every(Number.isFinite))throw Error('无效向量');return a;};
const lit=v=>{if(!Number.isFinite(v))throw Error('无效标量');return v.toFixed(8);},rgb=v=>`vec3(${v.slice(0,3).map(lit).join(',')})`;

// Both DrawCalls declared by anglel_wing_crystal_2.surf, including its Cube overlay.
export async function configureCrystal2(m,p,macros,load,warnings,o={}){
 try{
  const pass=o.sourcePass===1?1:0,q=flag(macros.RENDER_QUALITY),low=q===2,tbn=flag(macros.NORMAL_MAP_ENABLE,1)!==0;
  const n=(k,d=0)=>num(p[k],d),f=(k,d=0)=>lit(n(k,d)),v=(k,d)=>vec(p[k],d),c=(k,d=[1,1,1,1])=>rgb(v(k,d));
  if(![0,1,2].includes(q))throw Error('未知质量');
  if(tbn&&(!o.sourceTangents||flag(macros.LIGHT_ENABLE,1)===0))throw Error('缺少活动原TBN');
  if(flag(macros.CHAR_OFFSET))throw Error('原FaceUVOffset未定义');
  if(flag(macros.ENABLE_SOFT_BODY2)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('活动软体未接入');
  const maps={};for(const k of ['Tex2',...(pass?['Tex0']:['Tex5','Tex8','Tex9'])]){maps[k]=await load(k,false);if(!maps[k]||(k==='Tex0'?!maps[k].isCubeTexture:maps[k].isCubeTexture))throw Error('缺少原'+k);}
  // Tex6 samples feed no live output in either source pass. Cube is live only in pass 1.
  const intensity=v('Intensity',[1,1,1,0]),change=flag(macros.CHAR_CHANGE_COLOR,1)!==0;
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};for(const [k,t] of Object.entries(maps))u['cw'+k]={value:t};
  m.map=maps.Tex2;m.normalMap=null;m.vertexColors=false;m.color.set(0);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(tbn)m.defines={...m.defines,USE_TANGENT:''};
  if(pass){m.transparent=true;m.blending=NormalBlending;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);const vary='varying vec2 cwUv;varying vec3 cwN,cwT,cwB;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncwUv=uv;')
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 cwNormal=transformedNormal;
     #ifdef FLIP_SIDED
     cwNormal=-cwNormal;
     #endif
     cwN=inverseTransformDirection(cwNormal,viewMatrix)*vec3(-1,1,1);cwT=vec3(1,0,0);cwB=vec3(0,1,0);
     ${tbn?`cwT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1,1,1);
     cwB=cross(cwN,cwT)*tangent.w${flag(macros.IS_CHARACTER)?'':'*-sign(determinant(mat3(modelMatrix)))'};`:''}`);
   s.fragmentShader=vary+`uniform sampler2D cwTex2${pass?'':',cwTex5,cwTex8,cwTex9'};${pass?'uniform samplerCube cwTex0;':''}
    uniform float neoTime,neoEmissionScale;
    vec3 cwLinear(vec3 x){return ${low?'x*x':'pow(max(x,vec3(0)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 cwNormalMap=texture2D(cwTex2,cwUv);vec3 cwView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1,1,1);
    mat3 cwTbn=${tbn?'mat3(cwT,cwB,cwN)':'mat3(1.0)'};
    vec3 cwSampleN=cwNormalMap.xyz*2.0-1.0;cwSampleN.xy*=${lit(intensity[0])};
    vec3 cwSurfaceN=${low?'cwN':'cwTbn*normalize(cwSampleN)'};
    float cwFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-abs(dot(cwSurfaceN,cwView)),5.0),0.0,1.0);
    vec3 cwRim=cwFresnel*${c('RimColor',[0,0,0,1])}*${lit(intensity[3])},cwEmission;
    ${pass?`
     vec3 cwReflect=reflect(-cwView,cwSurfaceN);float cwAngle=neoTime*${f('reflectSpeed')},cwCos=cos(cwAngle),cwSin=sin(cwAngle);
     cwReflect=vec3(cwCos*cwReflect.x+cwSin*cwReflect.z,cwReflect.y,-cwSin*cwReflect.x+cwCos*cwReflect.z);
     vec3 cwColor=cwLinear(textureLod(cwTex0,cwReflect,${f('reflectionMip',1)}).rgb)*clamp(${f('TintValue',1)}+.1,0.0,1.0);
     cwEmission=${change?`vec3(dot(cwColor,vec3(.2125,.7154,.0721)))*cwLinear(${c('BaseColor')})`:'cwColor'}*${f('upLightness',1.5)}+cwRim;
    `:`
     vec3 cwTangentView=transpose(cwTbn)*cwView;vec2 cwOffset=cwTangentView.xy*.01*${f('SparkleOffset',4)};
     float cwA=texture2D(cwTex5,cwUv*${f('SparkleScale',4)}+vec2(.3,neoTime)*${f('SparkleSpeed',.02)}+cwOffset).g;
     float cwBValue=texture2D(cwTex5,cwUv*${f('SparkleScale',4)}*1.5+vec2(neoTime,.3)*${f('SparkleSpeed',.02)}+cwOffset).g;
     float cwSpark=pow(cwA*cwBValue,${f('SparklePow',4)});vec3 cwBase=cwLinear(texture2D(cwTex8,cwUv).rgb);vec4 cwMask=texture2D(cwTex9,cwUv);
     cwEmission=${change?`vec3(dot(cwBase,vec3(.2125,.7154,.0721)))*cwLinear(${c('BaseColor')})+cwRim`:`cwBase*(1.0+${f('DownStrength',1)}*(cwMask.a+cwMask.r*.2)+cwSpark*40.0*${f('SparkleStrength',1)})+cwRim`};
    `}
    diffuseColor=vec4(0,0,0,${pass?`clamp(${f('upOpaticty',.8)},0.0,1.0)`:'1.0'}*opacity);
   `).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cwSurfaceN*vec3(-1,1,1)));')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cwEmission*neoEmissionScale;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('crystal_2 原双遍发光/Cube反射已接入；原后处理尚未完全等价');return u;
 }catch(e){warnings.push('crystal_2 未适配：'+e.message);return null;}
}
