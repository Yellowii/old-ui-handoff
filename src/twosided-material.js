import {DoubleSide} from 'three';

export async function configureTwosided(m,p,macros,load,warnings,o={}){
 const flag=(key,fallback)=>{const value=macros[key]===undefined?fallback:Number(macros[key]);if(!Number.isFinite(value))throw Error(`无效宏 ${key}`);return value;};
 let quality,normal,ia,uv1,lightMap;
 try{
  quality=flag('RENDER_QUALITY',0);normal=flag('NORMAL_MAP_ENABLE',1);ia=flag('IA_VERTEX_COLOR',1);uv1=flag('TEXCOORD1_ENABLE',0);lightMap=flag('LIGHT_MAP_ENABLE',0);
  if(![0,1,2].includes(quality)||![0,1].includes(normal)||![0,1].includes(ia)||![0,1].includes(uv1)||![0,1].includes(lightMap))throw Error('宏超出原始已知取值');
 }catch(error){warnings.push(`standard_char_twosided ${error.message}，保持未适配`);return null;}
 const low=quality===2,useNormal=!low&&normal===1,n=k=>Number.isFinite(Number(p[k]))?Number(p[k]):0;
 const vec=(k,d)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)&&a.length>=3?a:d;}catch{return d;}};
 const f=k=>n(k).toFixed(8),rgb=k=>`vec3(${vec(k,[1,1,1]).slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
 const activeOffset=!low&&n('VertexOff')!==0;
 if(activeOffset&&lightMap){warnings.push('standard_char_twosided 活动位移需要未交付的 LIGHT_MAP UV 变换，保持未适配');return null;}
 if(activeOffset&&uv1&&!o.sourceSecondUv){warnings.push('standard_char_twosided 活动位移缺少已验证源第二 UV，保持未适配');return null;}
 if(activeOffset&&ia&&!o.sourceVertexColors){warnings.push('standard_char_twosided 活动位移缺少已验证源 COLOR0，保持未适配');return null;}
 if(useNormal&&o.sourceTangents!==true){warnings.push('standard_char_twosided 缺少已验证源切线');return null;}
 const keys=low?['Tex0']:['Tex0','Tex2','Tex3','Tex4',...(useNormal?['Tex1']:[])],maps={};
 // The source converts Tex0 explicitly; prevent an additional sRGB texture decode.
 for(const k of keys)maps[k]=await load(k,false);
 if(keys.some(k=>!maps[k]||maps[k].isCubeTexture)){warnings.push('standard_char_twosided 缺少源二维贴图');return null;}
 const i=vec('Intensity',[1,1,1,0]),base=vec('BaseColor',[1,1,1,1]);
 if(useNormal)m.defines={...m.defines,USE_TANGENT:''};
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.side=DoubleSide;m.vertexColors=false;
 // Transparent DoubleSide otherwise renders as two culled passes, reversing
 // front-face winding for BackSide and losing the source SV_IsFrontFace sign.
 m.forceSinglePass=true;
 const u={twTex0:{value:maps.Tex0},twTex1:{value:maps.Tex1||null},twTex2:{value:maps.Tex2||null},twTex3:{value:maps.Tex3||null},twTex4:{value:maps.Tex4||null},twTime:{value:0}};
 // The viewer advances neoTime; both names must refer to the same clock.
 u.neoTime=u.twTime;
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);
  const offsetNoise=`float twRandom(vec2 st){return fract(sin(dot(st,vec2(12.9898,78.233)))*43758.5453123);}
float twNoise(vec2 st){vec2 i=floor(st),v=fract(st),u=v*v*(3.-2.*v);float a=twRandom(i),b=twRandom(i+vec2(1.,0.)),c=twRandom(i+vec2(0.,1.)),d=twRandom(i+vec2(1.));return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}`;
  const offsetDecl=activeOffset?`${uv1?'attribute vec2 uv1;':''}${ia?'attribute vec3 color;':''}uniform float twTime;${offsetNoise}`:'';
  const offsetCode=activeOffset?`vec2 twOffsetUv1=${uv1?'uv1':'vec2(0.)'};float twNoiseA=clamp(twNoise(twOffsetUv1*10.+twTime*6.),0.,1.)*.1;vec3 twMaskA=vec3(sin(uv.x*3.+twTime*3.)*.008,0.,0.);vec3 twRotation=vec3(.03*sin(twTime*5.),0.,.05*cos(twTime*5.));twVertexOffset=(twRotation+twMaskA+vec3(twNoiseA))*uv.y*uv.y*${f('VertexOff')}*${ia?'color.r':'1.'};transformed+=twVertexOffset;`:'';
  s.vertexShader=`varying vec2 twUv;varying vec3 twWorldN,twWorld,twT,twB,twVertexOffset;${offsetDecl}\n`+s.vertexShader
   .replace('#include <begin_vertex>','#include <begin_vertex>\ntwVertexOffset=vec3(0.);')
   .replace('#include <uv_vertex>','#include <uv_vertex>\ntwUv=uv;')
   .replace('#include <normal_vertex>','#include <normal_vertex>\ntwWorldN=normalize(inverseTransformDirection(transformedNormal,viewMatrix))*vec3(-1.0,1.0,1.0);'+(useNormal?'twT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.0,1.0,1.0);twB=cross(twWorldN,twT)*tangent.w;':'twT=vec3(0.0);twB=vec3(0.0);'))
   .replace('#include <skinning_vertex>',`#include <skinning_vertex>\n${offsetCode}`)
   .replace('#include <project_vertex>','#include <project_vertex>\ntwWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader='varying vec2 twUv;varying vec3 twWorldN,twWorld,twT,twB,twVertexOffset;uniform sampler2D twTex0,twTex1,twTex2,twTex3,twTex4;uniform float twTime;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec4 tw0=texture2D(twTex0,twUv);vec4 tw2=vec4(1.0,1.0,0.0,0.0),tw3=vec4(0.0),tw4=vec4(0.0),twFlow2=vec4(0.0);${low?'':`tw2=texture2D(twTex2,twUv);tw3=texture2D(twTex3,twUv*vec2(${f('FlowUVScale1')},${f('FlowUVScale2')})+twTime*vec2(.2,${f('FlowUVSpeedY1')}));twFlow2=texture2D(twTex3,twUv*vec2(${f('FlowUVScale3')},${f('FlowUVScale4')})+twTime*vec2(-.2,${f('FlowUVSpeedY2')})+tw3.r*.2);tw4=texture2D(twTex4,twUv);`}float twFacing=gl_FrontFacing?1.0:-1.0;float twBack=1.0-step(0.0,twFacing);vec3 twFront=${low?'tw0.rgb*tw0.rgb':'pow(max(tw0.rgb,vec3(0.0)),vec3(2.2))'};vec3 twBase=(${Number(macros.CHAR_CHANGE_COLOR??1)!==0?'vec3(dot(twFront,vec3(.2125,.7154,.0721)))*'+rgb('BaseColor'):'twFront'})*${f('TintValue')};diffuseColor=vec4(mix(mix(twBase,${rgb('FlowColor')},${low?'0.0':'tw3.b*tw2.a'}),mix(${rgb('BackColor')},${rgb('BackColor2')},${low?'0.0':'tw4.r'}),twBack),clamp(tw0.a*${Number(base[3]).toFixed(8)}*${low?'1.0':`clamp(${useNormal?'texture2D(twTex1,twUv).a':'1.0'}+twFlow2.g-tw3.g*.8,0.0,1.0)`},0.0,1.0));`)
   .replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>',`vec3 twSurfaceNormal=twWorldN;${useNormal?`vec3 twN=texture2D(twTex1,twUv).xyz*2.0-1.0;twN.xy*=${Number(i[0]).toFixed(8)};if(twFacing>0.0)twSurfaceNormal=mat3(twT,twB,twWorldN)*normalize(twN);`:''}normal=normalize(mat3(viewMatrix)*(twSurfaceNormal*vec3(-1.0,1.0,1.0)));`)
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(tw2.g*${Number(i[1]).toFixed(8)},0.0,1.0);`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(tw2.b*${Number(i[2]).toFixed(8)},0.0,1.0)`};`)
   .replace('#include <emissivemap_fragment>',`float twFlow=${low?'0.0':'tw3.b*tw2.a'};vec3 twView=normalize(cameraPosition-twWorld)*vec3(-1.0,1.0,1.0);float twF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(twSurfaceNormal,twView),5.0),0.0,1.0);totalEmissiveRadiance=mix(twFlow*${rgb('FlowColor')}*${f('EmissiveValue')}+${rgb('RimColor')}*${Number(i[3]).toFixed(8)}*twF,mix(${rgb('BackColor')},${rgb('BackColor2')},${low?'0.0':'tw4.r'}),twBack);`)
   .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=tw2.r;');
 };
 warnings.push(`standard_char_twosided：已接入双面/流动/背面渐变/质量分支${activeOffset?'及 post-skin 局部顶点位移':'；当前分支无活动局部顶点位移'}`);return u;
}
