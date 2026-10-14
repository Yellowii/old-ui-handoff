// Effective goldfish_wing.hlsl, forward_shading and DefaultVF. Character coordinates.
export async function configureGoldfish(m,p,macros,load,warnings,o={}){
 const n=(k,d=0)=>p[k]===undefined?d:Number(p[k]);
 const v=(k,d)=>{try{return p[k]===undefined?d:JSON.parse(p[k]);}catch{return null;}};
 const quality=macros.RENDER_QUALITY===undefined?0:Number(macros.RENDER_QUALITY),low=quality===2,hasTbn=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
 const keys=['ShuimoUseUV2','SecondUVKey','ShuimoPow','ShuimoTiling','ShuimoNoiseStr','LightnessOffset','LightnessMaxClamp','BaseColorNoiseStr','BaseColorEmis','BaseColorEmisLow','MatcapStr','CullEnableOthers','CullEnableGold','SelectGold','SelectOthers','PlaneCullOffset','PlaneCullStart','PlaneCullEnd','FlowStr','FlowTilingX','FlowTilingY','FlowLSpeed','EmissiveValue','StarUVTiling','StarStr','StarSpeed','FresnelPow','FresnelStr','FresnelScale'];
 const values=Object.fromEntries(keys.map(k=>[k,n(k)]));
 const i=v('Intensity',[1,1,0,0]),offset=v('ShuimoUVOffset',[0,0]);
 const colors=Object.fromEntries(['FresnelColor','EmissiveColor','FlowColor','StarColor','RimColor'].map(k=>[k,v(k,k==='RimColor'?[0,0,0,0]:[1,1,1,1])]));
 const gaps=[];
 if(![0,1,2].includes(quality)||!Object.values(values).every(Number.isFinite)||![i,...Object.values(colors)].every(a=>Array.isArray(a)&&a.length===4&&a.every(Number.isFinite))||!Array.isArray(offset)||offset.length!==2||!offset.every(Number.isFinite))gaps.push('参数无效');
 if(hasTbn&&(!o.sourceTangents||Number(macros.LIGHT_ENABLE)===0))gaps.push('需要已验证源切线与非退化 TBN');
 const second=!low&&(n('ShuimoUseUV2')!==0||n('SecondUVKey')!==0);
 if(second&&!o.sourceSecondUv)gaps.push('当前子网格缺少原第二 UV');
 if(n('ShuimoPow')<0||n('FresnelPow')<0)gaps.push('负指数零输入语义未验证');
 for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){const a=v(key,[0,0,0]);if(!Array.isArray(a)||a.some(x=>x!==0))gaps.push('活动软体输入未接入');}
 if(['INSTANCE_TYPE','USE_TEXCOORD1','LIGHT_MAP_ENABLE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_WATER_BLOCK','ENABLE_VAT'].some(k=>Number(macros[k]??0)!==0)||Number(macros.IS_CHARACTER)===0||n('PositionOffsetScale')!==0)gaps.push('活动实例/非角色/顶点位移/主UV改写分支未验证');
 if(gaps.length){warnings.push(...gaps.map(x=>'goldfish_wing：'+x));m.map=await load('Tex0',true);return null;}
 const maps={};for(const k of low?['Tex0']:['Tex0','Tex1','Tex2','Tex3','Tex4','Tex5'])maps[k]=await load(k,false);
 const missing=Object.entries(maps).filter(([,t])=>!t||t.isCubeTexture).map(([k])=>k);
 if(missing.length){warnings.push('goldfish_wing 缺少源二维贴图：'+missing.join(', '));return null;}
 const f=x=>Number(x).toFixed(8),s=k=>f(values[k]),rgb=k=>'vec3('+colors[k].slice(0,3).map(f).join(',')+')';
 const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},...Object.fromEntries(Array.from({length:6},(_,k)=>['gfTex'+k,{value:maps['Tex'+k]||null}]))};
 m.map=maps.Tex0;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
 m.defines={...m.defines,...(hasTbn?{USE_TANGENT:''}:{}),...(second?{USE_UV1:''}:{})};
 m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const vary='varying vec2 gfUv,gfUv2;varying vec3 gfN,gfT,gfB;varying float gfZ;\n';
  shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\ngfUv=uv;gfUv2=${second?'uv1':'vec2(0.0)'};`)
   .replace('#include <project_vertex>','gfZ=transformed.z;\n#include <project_vertex>')
   .replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 gfSourceN=transformedNormal;
    #ifdef FLIP_SIDED
    gfSourceN=-gfSourceN;
    #endif
    gfN=inverseTransformDirection(gfSourceN,viewMatrix)*vec3(-1.0,1.0,1.0);
    gfT=vec3(1.0,0.0,0.0);gfB=vec3(0.0,1.0,0.0);
    ${hasTbn?'gfT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0);gfB=cross(gfN,gfT)*tangent.w;':''}
   `);
  shader.fragmentShader=vary+`uniform sampler2D gfTex0,gfTex1,gfTex2,gfTex3,gfTex4,gfTex5;uniform float neoTime,neoEmissionScale;
   float gfRandom(vec2 st){return fract(sin(dot(st,vec2(12.0,78.0)))*43758.0);}
   float gfNoise(vec2 st){vec2 i=floor(st),f=fract(st),u=f*f*(3.0-2.0*f);float a=gfRandom(i),b=gfRandom(i+vec2(1,0)),c=gfRandom(i+vec2(0,1)),d=gfRandom(i+vec2(1,1));return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
   float gfSmooth(float a,float b,float x){float t=clamp((x-a)/max(b-a,0.001),0.0,1.0);return t*(2.0-t);}
   vec3 gfLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec3 gfView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
   mat3 gfTbn=${hasTbn?'mat3(gfT,gfB,gfN)':'mat3(1.0)'};
   vec4 gfMix=vec4(1,1,0,0),gfNSample=vec4(0.0),gfFlow=vec4(0.0),gfMC=vec4(0.0);vec2 gfOffset=vec2(0.0);
   vec3 gfNormal=gfN;float gfStars=0.0,gfFres=0.0;vec2 gfBaseUv=gfUv;
   ${low?'':`
   gfNSample=texture2D(gfTex1,gfUv);vec3 gfRawN=gfNSample.xyz*2.0-1.0;gfRawN.xy*=${f(i[0])};gfRawN.z=sqrt(max(1.0-dot(gfRawN.xy,gfRawN.xy),1e-6));gfNormal=gfTbn*normalize(gfRawN);
   gfMix=texture2D(gfTex2,gfUv);float gfRnd=gfNoise(gfUv*35.0+neoTime*vec2(-1.125,0.0));gfOffset=vec2(gfRnd-.5)*gfMix.b*${s('BaseColorNoiseStr')};gfBaseUv+=gfOffset*.009;
   `}
   vec4 gfBase=texture2D(gfTex0,gfBaseUv);gfBase.rgb=gfLinear(gfBase.rgb);
   ${low?'':`
   vec3 gfTV=transpose(gfTbn)*gfView;vec2 gfInkBase=mix(gfUv,gfUv2,${s('ShuimoUseUV2')});
   vec4 gfNoiseSample=texture2D(gfTex5,gfInkBase*2.0+neoTime*vec2(-.2,0.0));
   vec2 gfInkUv=gfInkBase*${s('ShuimoTiling')}+neoTime*vec2(-.06,0.0)-gfTV.xy*.1*gfMix.b+gfNoiseSample.rr*.1*${s('ShuimoNoiseStr')}+vec2(${offset.map(f).join(',')});
   float gfInk=texture2D(gfTex5,gfInkUv).a;
   vec3 gfInkColor=gfBase.rgb*clamp(${s('LightnessOffset')}+pow(gfInk,${s('ShuimoPow')}),0.0,${s('LightnessMaxClamp')});gfBase.rgb=mix(gfInkColor,gfBase.rgb,clamp(gfMix.a+gfNSample.b,0.0,1.0));
   vec2 gfStarBase=mix(gfUv,gfUv2,${s('SecondUVKey')});
   vec2 gfStarUv=gfStarBase*${s('StarUVTiling')}+neoTime*vec2(.5*${s('StarSpeed')},0.0)+gfOffset*.09;
   vec2 gfFlowUv=gfStarBase*vec2(3.5*${s('FlowTilingX')},3.5*${s('FlowTilingY')})+neoTime*vec2(.5*${s('FlowLSpeed')},0.0);
   gfFlow=texture2D(gfTex3,gfNSample.b>0.0?gfFlowUv:gfStarUv);
   vec3 gfSN=gfFlow.xyz*2.0-1.0;gfSN.z=sqrt(clamp(1.0-dot(gfSN.xy,gfSN.xy),0.0,1.0));gfSN=gfTbn*normalize(vec3(gfSN.xy*9.0,gfSN.z));
   float gfM=clamp(gfNoise(gfUv*8.0+neoTime*vec2(-1.125,0.0)),0.0,1.0);gfM=gfM*gfM*gfM*5.0;
   gfStars=clamp(-dot(gfSN,gfView),0.0,1.0)*gfNSample.a;gfFres=pow(1.0-clamp(dot(gfN,gfView),0.0,1.0),${s('FresnelPow')})*gfM;
   gfFlow.b=gfFlow.b*gfFlow.b*gfNSample.b;
   vec2 gfMatcapUv=(mat3(viewMatrix)*(gfNormal*vec3(-1.0,1.0,1.0))).xy*.5+.5;gfMatcapUv.y*=-1.0;
   gfMC=texture2D(gfTex4,gfMatcapUv);gfMC.rgb=gfLinear(gfMC.rgb);
   vec3 gfTempN=normalize(gfNormal+vec3(gfNoiseSample.g*.5,gfNoiseSample.g*.4,0.0));float gfNDV=gfSmooth(.2,1.0,clamp(dot(gfTempN,gfView),0.0,1.0));gfMC.rgb*=gfNDV*gfNDV*gfNDV;
   `}
   float gfCull=gfSmooth(${s('PlaneCullStart')},${s('PlaneCullEnd')},clamp(-gfZ+${s('PlaneCullOffset')},0.0,1.0));
   float gfAlpha=mix(1.0,gfCull,max(${s('CullEnableOthers')}*${s('SelectOthers')},${s('CullEnableGold')}*${s('SelectGold')}));
   diffuseColor=vec4(gfBase.rgb,gfAlpha*gfBase.a*opacity);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(gfNormal*vec3(-1.0,1.0,1.0)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(gfMix.g*${f(i[1])},0.0,1.0);`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(i[2])};`)
   .replace('#include <aomap_fragment>','')
   .replace('#include <emissivemap_fragment>',`
    float gfEdge=1.0-dot(gfNormal,gfView);float gfRim=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*gfEdge*gfEdge*gfEdge*gfEdge*gfEdge,0.0,1.0);
    totalEmissiveRadiance=gfRim*${rgb('RimColor')}*${f(i[3])}+pow(max(gfBase.rgb,vec3(0.0)),vec3(1.2))*${rgb('EmissiveColor')}*${s('EmissiveValue')}*gfMix.a;
    ${low?`totalEmissiveRadiance+=gfBase.rgb*${s('BaseColorEmis')}*${s('BaseColorEmisLow')};`:`totalEmissiveRadiance+=gfBase.rgb*${s('BaseColorEmis')}+gfFres*${rgb('FresnelColor')}*${s('FresnelStr')}+gfStars*${rgb('StarColor')}*${s('StarStr')}+gfFlow.b*${rgb('FlowColor')}*${s('FlowStr')}+gfMC.rgb*${s('MatcapStr')}*gfMix.r;`}
    totalEmissiveRadiance*=neoEmissionScale;
   `);
 };
 warnings.push('金鱼独立六图、水墨/流光、源TBN、局部裁剪及画质分支已接入；原场景光照/BRDF与活动软体仍未完整还原');
 return uniforms;
}
