import {Vector2,Vector4} from 'three';

const number=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const flag=(v,d=0)=>typeof v==='string'&&/^(true|false)$/i.test(v)?v.toLowerCase()==='true'?1:0:number(v,d);
const vector=(v,d)=>{try{const a=JSON.parse(v);if(Array.isArray(a)&&a.length===d.length&&a.every(Number.isFinite))return a;}catch{}return d;};
const scalar=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(scalar).join(',')})`;

// Original 2026_spring_festival/standard_char_flowsand.hlsl.
export async function configureFlowsand(m,p,macros,load,warnings,o={}){
 const n=(k,d=0)=>number(p[k],d),f=(k,d=0)=>scalar(n(k,d)),v=(k,d)=>vector(p[k],d);
 const low=flag(macros.RENDER_QUALITY)===2,useNormal=!low&&flag(macros.NORMAL_MAP_ENABLE,1)!==0,bag=n('BagEnable')>.5;
 const gaps=[];
 if(useNormal&&!o.sourceTangents)gaps.push('flowsand 缺少原切线');
 if(useNormal&&flag(macros.LIGHT_ENABLE,1)===0)gaps.push('flowsand 关闭光照时原TBN退化，尚未适配');
 if(flag(macros.ENABLE_SOFT_BODY2)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))gaps.push('flowsand 非零软体输入尚未接入');
 if(gaps.length){warnings.push(...gaps);return null;}
 const keys=['Tex0',...(!low?['Tex2','Tex3']:[]),...(useNormal?['Tex1']:[]),...(bag?['Tex4']:[])],maps={};
 for(const k of keys)maps[k]=await load(k,false,k==='Tex0'?o.baseColor:k==='Tex1'?o.normal:undefined);
 const missing=keys.filter(k=>!maps[k]||maps[k].isCubeTexture);
 if(missing.length){warnings.push(...missing.map(k=>`flowsand 缺少实际源二维贴图：${k}`));return null;}
 const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]),flow=v('flowUV',[1,0]),back=v('flow1UV',[1,0]),front=v('flow2UV',[1,0]);
 m.color.set(0xffffff);m.map=maps.Tex0;m.normalMap=null;m.vertexColors=false;m.emissive.set(0xffffff);m.emissiveIntensity=1;
 if(useNormal)m.defines={...m.defines,USE_TANGENT:''};
 const u={neoTime:{value:0},neoEmissionScale:{value:1},fsRTSize:{value:new Vector4()}};
 for(let i=0;i<5;i++)u['fsTex'+i]={value:maps['Tex'+i]||null};
 const size=new Vector2();
 if(bag)m.onBeforeRender=renderer=>{
  const target=renderer.getRenderTarget();
  if(target){const scale=2**renderer.getActiveMipmapLevel();size.set(Math.max(1,Math.floor(target.width/scale)),Math.max(1,Math.floor(target.height/scale)));}
  else renderer.getDrawingBufferSize(size);
  u.fsRTSize.value.set(size.x,size.y,1/size.x,1/size.y);
 };
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,u);
  const varying='varying vec2 fsUv;varying vec3 fsWorld,fsLocal,fsVertexNormal,fsTangent,fsBinormal;\n';
  s.vertexShader=varying+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nfsUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
   vec3 fsN=transformedNormal;
   #ifdef FLIP_SIDED
   fsN=-fsN;
   #endif
   fsVertexNormal=inverseTransformDirection(fsN,viewMatrix)*vec3(-1.0,1.0,1.0);
   fsTangent=vec3(1.0,0.0,0.0);fsBinormal=vec3(0.0,1.0,0.0);
   ${useNormal?`fsTangent=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0);fsBinormal=cross(fsVertexNormal,fsTangent)*tangent.w;`:''}
  `).replace('#include <project_vertex>',`// Original local_pos is after skinning and before World (T86).
   fsLocal=transformed;fsWorld=(modelMatrix*vec4(transformed,1.0)).xyz*vec3(-1.0,1.0,1.0);
   #include <project_vertex>`);
  s.fragmentShader=varying+'uniform sampler2D fsTex0,fsTex1,fsTex2,fsTex3,fsTex4;uniform float neoTime,neoEmissionScale;uniform vec4 fsRTSize;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   vec4 fsBase=texture2D(fsTex0,fsUv);
   fsBase.rgb=${low?'fsBase.rgb*fsBase.rgb':'pow(max(fsBase.rgb,vec3(0.0)),vec3(2.2))'};
   vec4 fsNormalMap=${useNormal?'texture2D(fsTex1,fsUv)':'vec4(.5,.5,1.0,1.0)'};
   vec4 fsMix=${low?'vec4(1.0,1.0,0.0,0.0)':'texture2D(fsTex2,fsUv)'};
   vec3 fsDots=vec3(0.0);float fsPulse=0.0,fsFlowOpacity=0.0;
   ${low?'':`fsPulse=clamp(sin(neoTime)+1.0,0.0,1.0);
   vec2 fsDotUvA=fsUv*${scalar(flow[0])}+vec2(0.0,-.2*neoTime*${scalar(flow[1])});
   vec2 fsDotUvB=fsUv*${scalar(flow[0]*1.5)}+vec2(0.0,-.7*neoTime*${scalar(flow[1])});
   fsDots=texture2D(fsTex3,fsDotUvA).r*texture2D(fsTex3,fsDotUvB).r*fsNormalMap.a*${rgb(v('FlowDotColor',[1,1,1,1]))}*${f('FlowDotIntensity')};
   float fsBack=texture2D(fsTex3,fsUv*${scalar(back[0])}+vec2(0.0,neoTime*${scalar(back[1])})).b;
   float fsFront=texture2D(fsTex3,fsUv*${scalar(front[0])}+vec2(0.0,neoTime*${scalar(front[1])})).a;
   fsFlowOpacity=fsBack*fsFront*fsNormalMap.a*fsPulse;
   vec3 fsFlow=(fsBack*${rgb(v('FlowBackColor',[1,1,1,1]))}*${f('FlowBackIntensity')}+fsFront*${rgb(v('FlowFrontColor',[1,1,1,1]))}*${f('FlowFrontIntensity')})*fsPulse;
   fsBase.rgb=mix(fsBase.rgb,fsFlow,fsFlowOpacity);`}
   // Source RawData.basecol is zero-initialized and never assigned.
   fsBase.rgb=${flag(macros.CHAR_CHANGE_COLOR)?'vec3(0.0)':`fsBase.rgb*${f('TintValue',1)}`};
   float fsAlpha=fsBase.a*${scalar(base[3])},fsEdge=0.0,fsDissolve=1.0,fsHeight=1.0;
   vec2 fsScreenUv=vec2(0.0);
   ${bag?`fsHeight=step(.01,fsWorld.y+${f('ABoffset')});
   ${n('ABKey')===n('ContrastValue')?'':'fsHeight=1.0-fsHeight;'}
   fsScreenUv=gl_FragCoord.xy*fsRTSize.zw+neoTime*.3;
   vec4 fsNoise=texture2D(fsTex4,fsScreenUv);
   float fsOffset=(fsNoise.r*fsNoise.g*2.0-1.0)*.8;
   float fsRemap=${f('Bias')}*6.0-3.0,fsDissolveX=.8+fsOffset+fsLocal.x;
   // HLSL smoothstep's saturate/cubic form, including the reversed interval.
   float fsA=clamp((fsDissolveX-fsRemap-.8)/(-.8),0.0,1.0);
   float fsB=clamp((fsDissolveX-fsRemap)/.8,0.0,1.0);
   fsA=fsA*fsA*(3.0-2.0*fsA);fsB=fsB*fsB*(3.0-2.0*fsB);
   float fsMask=mix(fsA,fsB,${f('DissolveChange')});
   fsDissolve=step(.5,fsMask);fsEdge=fsDissolve-step(.7,fsMask);
   fsAlpha=mix(fsAlpha,fsHeight*fsBase.a,${f('OpacKey')});
   fsAlpha*=mix(1.0,fsDissolve,${f('DissolveCharKey')});`:''}
   diffuseColor=vec4(fsBase.rgb,fsAlpha*opacity);
  `).replace('#include <color_fragment>','');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`
   vec3 fsSurfaceNormal=fsVertexNormal;
   ${useNormal?`vec3 fsNormal=fsNormalMap.xyz*2.0-1.0;fsNormal.xy*=${scalar(intensity[0])};fsSurfaceNormal=mat3(fsTangent,fsBinormal,fsVertexNormal)*normalize(fsNormal);`:''}
   normal=normalize(mat3(viewMatrix)*(fsSurfaceNormal*vec3(-1.0,1.0,1.0)));
  `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'1.0':`clamp(fsMix.g*${scalar(intensity[1])},0.0,1.0)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(fsMix.b*${scalar(intensity[2])},0.0,1.0)`};`)
   .replace('#include <emissivemap_fragment>',`
    vec3 fsView=normalize(cameraPosition-(fsWorld*vec3(-1.0,1.0,1.0)))*vec3(-1.0,1.0,1.0);
    float fsFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(fsSurfaceNormal,fsView),5.0),0.0,1.0);
    vec3 fsEmission=mix(vec3(fsMix.a),fsMix.a*fsBase.rgb,${f('BaseEmissiveKey')})*${rgb(v('EmissiveColor',[1,1,1,1]))}*${f('EmissiveValue',1)};
    ${low?'':`fsEmission+=fsFresnel*${rgb(v('RimColor',[0,0,0,0]))}*${scalar(intensity[3])}+fsDots+fsEdge*${rgb(v('EdgeColor',[1,.59,.29,1]))}*20.0*${f('DissolveCharKey')};`}
    totalEmissiveRadiance=fsEmission*neoEmissionScale;
   `).replace('#include <aomap_fragment>',low?'':`reflectedLight.indirectDiffuse*=fsMix.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),fsMix.r,material.roughness);
    #endif`)
   // Original Material starts at zero; this Surface's GetSpecular is empty.
   .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(0.0);material.specularColorBlended=diffuseColor.rgb*metalnessFactor;');
 };
 warnings.push('flowsand 已接入原流沙/屏幕溶解/世界高度遮罩/质量分支；原场景光照和half精度仍未完全等价');
 return u;
}
