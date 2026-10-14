import {scalar,vector,f,rgb,frame} from './t107-frame.js';
import {sourcePerlinGlsl} from './source-perlin.js';

// standard_char_sand_hat.hlsl. The source has no authored secondary UV or
// scene probe requirement; the adapter keeps all five UV0 texture channels,
// the sand/cloth animation and the local vertex offset in the current viewer.
// When a published mesh has no tangent stream we keep the source geometry
// normal and report that the normal-map TBN cannot be reproduced exactly.
export async function configureSandHat(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(change))throw Error('Unknown sand-hat macro permutation');
  const useNormal=normal===1&&o.sourceTangents===true;
  if(normal===1&&!useNormal)warnings.push('sand-hat 缺少源切线，保留几何法线并关闭 Tex1 法线扰动');
  const maps={};
  for(const k of ['Tex0','Tex1','Tex2','Tex3','Tex4'])maps[k]=await load(k,k==='Tex0');
  if(Object.values(maps).some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original sand-hat Tex0-Tex4 required');
  const n=(k,d=0)=>{const raw=p[k];if(raw===undefined||raw===null)return d;if(typeof raw==='string'&&raw.trim().startsWith('['))return d;const value=Number(raw);return Number.isFinite(value)?value:d;},v=(k,d)=>vector(p[k],d);
  const I=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]);
  const flow=v('FlowParam',[1,1,1,1]),flow2=v('FlowParam2',[0,0,1,1]),depth=v('DepthPara',[0,0,0,0]);
  const dot=v('DotPara',[1,0,0,1]),matcap=v('MatcapPara',[0,0,0,0]),sand=v('SandColor',[1,1,1,1]),dotColor=v('DotColor',[1,1,1,1]);
  const hair=v('HairEmisColor',[1,1,1,1]),cloth=v('ClothEmisColor',[1,1,1,1]),rim=v('RimColor',[0,0,0,0]),emis=v('EmissiveColor',[1,1,1,1]);
  const u={neoTime:{value:0}};
  for(const k of Object.keys(maps))u['sh'+k]={value:maps[k]};
  m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.vertexColors=false;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   frame(m,s,useNormal);
   s.vertexShader=`uniform sampler2D shTex1;uniform float neoTime;${sourcePerlinGlsl}\n`+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #if ${q<2?1:0}
    float shVertexMask=texture2D(shTex1,uv).a;
    float shNoise=neoPerlinNoise(position.xy*2.0+position.z+vec2(neoTime*${f(n('PositionOffsetSpeed',1))}));
    transformed+=transformedNormal*(shNoise*0.1*${f(n('PositionOffsetScale',1))}*shVertexMask);
    #endif`);
   s.fragmentShader=`uniform sampler2D shTex0,shTex1,shTex2,shTex3,shTex4;uniform float neoTime;\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 sh0=texture2D(shTex0,t107Uv),sh2=texture2D(shTex2,t107Uv);
    vec2 shDistUv=t107Uv*3.0+neoTime*vec2(.1,.2);
    float shNoise=texture2D(shTex4,shDistUv).g*.85;
    vec2 shFlow0=-vec2(${f(flow[0])},${f(flow[1])})*2.0+vec2(.05);
    vec2 shFlow1=-vec2(${f(flow2[0])},${f(flow2[1])})*2.0+vec2(.05);
    float shSpeed=neoTime*.275*${f(flow[2])},shSpeed2=neoTime*.275*${f(flow2[2])};
    float shWeight=abs(fract(shSpeed)*2.0-1.0),shWeight2=abs(fract(shSpeed2)*2.0-1.0);
    vec2 shUv1=t107Uv+vec2(1.,-1.)*(shFlow0+vec2(.05)*shNoise)*.08*fract(shSpeed)*sh2.g*${f(n('BaseTexFlowSwitch',1))};
    vec2 shUv2=t107Uv+vec2(1.,-1.)*(shFlow0+vec2(.05)*shNoise)*.08*fract(shSpeed+.5)*sh2.g*${f(n('BaseTexFlowSwitch',1))};
    vec2 shSand1=t107Uv*${f(n('SandTiling',12))}+vec2(1.,-1.)*(shFlow1+vec2(.05)*shNoise)*.24*fract(shSpeed2);
    vec2 shSand2=t107Uv*${f(n('SandTiling',12))}+vec2(1.,-1.)*(shFlow1+vec2(.05)*shNoise)*.24*fract(shSpeed2+.5);
    vec4 shBaseA=texture2D(shTex0,shUv1),shBaseB=texture2D(shTex0,shUv2);
    float shSand=mix(pow(texture2D(shTex4,shSand1).b,2.0),pow(texture2D(shTex4,shSand2).b,2.0),shWeight2)*sh2.b;
    vec3 shMixed=mix(shBaseA.rgb,shBaseB.rgb,shWeight);shMixed=shMixed*.9+shSand*${rgb(sand)}*1.5;
    float shHatMask=mix(1.0,sh2.r,${f(n('HairClothMaskSwitch',1))});
    vec3 shMixEmis=mix(${rgb(cloth)}*${f(n('ClothIntensity'))},${rgb(hair)}*${f(n('HairIntensity'))},shHatMask);
    shMixEmis=mix(shMixEmis,pow(max(sh0.rgb,vec3(0.)),vec3(${f(n('BaseEmissivePow',1))}))*${f(n('EmissiveValue',1))},${f(n('BaseEmissiveKey'))});
    shMixed=mix(shMixed,shMixEmis,sh2.a);
    vec2 shDepth=vec2(0.0);
    vec2 shDot1=t107Uv*vec2(${f(dot[0])},${f(n('DotScaleY',1))})+vec2(-.2,-.5)*neoTime*${f(dot[1])}+shDepth;
    vec2 shDot2=t107Uv*vec2(${f(dot[0]*1.5)},${f(n('DotScaleY',1)*1.5)})+vec2(0.,-.7)*neoTime*${f(dot[1])}+shDepth;
    float shDot=pow(texture2D(shTex3,shDot1).g*texture2D(shTex3,shDot2).g,${f(dot[3])})*pow(max(sh2.b,0.),1.);
    vec3 shView=normalize(-vViewPosition),shN=normalize(t107N);vec3 shT=normalize(cross(shView,vec3(0.,1.,0.))),shB=normalize(cross(shView,shT));
    vec2 shCapUv=vec2(dot(shN,shT),dot(shN,shB))*.5+.5;vec4 shCap=texture2D(shTex3,shCapUv);
    float shMatMask=mix(${f(matcap[0])},${f(matcap[2])},shHatMask);float shMatHi=mix(${f(matcap[1])},${f(matcap[3])},shHatMask);
    shMixed+=shCap.b*shMatMask+shCap.a*shMatHi;
    ${change?`float shLum=dot(shMixed,vec3(.2125,.7154,.0721));shMixed=shLum*${rgb(base)}*${f(n('TintValue',1))};`:`shMixed*=${f(n('TintValue',1))};`}
    diffuseColor=vec4(shMixed,sh0.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',useNormal?`vec3 shNrm=texture2D(shTex1,t107Uv).xyz*2.-1.;shNrm.xy*=${f(I[0])};normal=normalize(mat3(t107T,t107B,t107N)*normalize(shNrm));`:'normal=normalize(t107N);')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(${f(I[1])},0.0,1.0);`)
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.2;')
    .replace('#include <emissivemap_fragment>',`float shNoV=clamp(1.0-dot(normal,shView),0.0,1.0);float shFresnel=clamp(${f(n('FresnelScale'))}+(1.0-${f(n('FresnelScale'))})*pow(shNoV,5.0),0.0,1.0);float shTrail=pow(max(texture2D(shTex4,t107Uv*1.0+neoTime*vec2(.05,.1)).g,0.0),1.5);vec3 shEm=shFresnel*${rgb(rim)}*${f(I[3])}+sh0.rgb*.5+texture2D(shTex3,t107Uv).r*shTrail*${rgb(emis)}*${f(n('Cloth_EmisIntensity'))}+shDot*${rgb(dotColor)}*${f(n('DotPower'))}+shNoV*${f(n('FresnelPower'))}+pow(max(shMixed,vec3(0.)),vec3(3.0))*${f(n('AllEmissiveIntensity'))}*shHatMask;totalEmissiveRadiance=shEm;`)
    .replace('#include <aomap_fragment>','');
  };
  warnings.push(useNormal?'sand-hat 已接入五张源贴图、沙流/布料拖尾、二次沙点、MatCap、Fresnel 与顶点扰动；LightProbeSHV2/SunDirection 使用当前预览光照':'sand-hat 已接入五张源贴图、沙流/布料拖尾、二次沙点、MatCap、Fresnel 与顶点扰动；源切线缺失，法线贴图关闭；LightProbeSHV2/SunDirection 使用当前预览光照');
  return u;
 }catch(e){warnings.push('Sand-hat remains unsupported: '+e.message);return null;}
}
