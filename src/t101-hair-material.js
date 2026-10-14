import {Vector2,Vector4} from 'three';
const scalar=(value,fallback=0)=>{
 const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n))throw Error('无效原标量');return n;
};
const vector=(value,fallback)=>{
 const a=value===undefined?fallback:Array.isArray(value)?value:JSON.parse(String(value).trim().startsWith('[')?value:`[${value}]`);
 if(!Array.isArray(a)||a.length!==fallback.length||!a.every(Number.isFinite))throw Error(`无效原 float${fallback.length}`);return a;
};
const f=value=>{if(!Number.isFinite(value))throw Error('无效原常量');return value.toFixed(8);};
const rgb=value=>`vec3(${value.slice(0,3).map(f).join(',')})`;
const enabled=(value,fallback=0)=>typeof value==='string'&&/^(true|false)$/i.test(value)?Number(value.toLowerCase()==='true'):scalar(value,fallback);

// char_spacehair and standard_lb_hair from the source HLSL, including quality gates.
export async function configureT101Hair(m,p,macros,load,warnings,o={},family){
 try{
  const q=enabled(macros.RENDER_QUALITY,0),low=q===2,normal=enabled(macros.NORMAL_MAP_ENABLE,1)!==0;
  if(![0,1,2].includes(q))throw Error('未知质量分支');
  if(normal&&(!low||family==='space')&&(!o.sourceTangents||enabled(macros.LIGHT_ENABLE,1)===0))throw Error('缺少活动原TBN');
  if(enabled(macros.ENABLE_SOFT_BODY2,0)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>vector(p[k],[0,0,0]).some(v=>v!==0)))throw Error('活动软体未接入');
  const get=async(key,srgb=false,required=true)=>{const t=await load(key,srgb);if(required&&(!t||t.isCubeTexture))throw Error(`缺少原 ${key} 二维贴图`);return t;};
  const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]);
  if(family==='space'){
   if(!normal)throw Error('Spacehair原GetRawData要求NORMAL_MAP_ENABLE');
   const maps=await Promise.all([get('Tex0'),get('Tex1'),get('Tex2')]);
   const dot=scalar(p.DotScale,2.5),tile=scalar(p.NormalTiling,1),depth=scalar(p.Depth,.5),tint=scalar(p.TintValue,1),fresnel=scalar(p.FresnelScale,0),rim=vector(p.RimColor,[0,0,0,0]);
   const u={neoTime:{value:0},neoEmissionScale:{value:1},t101Tex0:{value:maps[0]},t101Tex1:{value:maps[1]},t101Tex2:{value:maps[2]}};
   m.map=null;m.normalMap=null;m.vertexColors=false;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.defines={...m.defines,...(!low&&normal?{USE_TANGENT:''}:{})};
   m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,u);const vary='varying vec2 t101Uv;varying vec3 t101N,t101T,t101B;\n';
    s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nt101Uv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
      vec3 t101Normal=transformedNormal;\n#ifdef FLIP_SIDED\nt101Normal=-t101Normal;\n#endif
      t101N=normalize(inverseTransformDirection(t101Normal,viewMatrix))*vec3(-1.,1.,1.);t101T=vec3(1.,0.,0.);t101B=vec3(0.,1.,0.);
      ${!low&&normal?'t101T=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.,1.,1.);t101B=cross(t101N,t101T)*tangent.w;':''}`);
    s.fragmentShader=vary+'uniform sampler2D t101Tex0,t101Tex1,t101Tex2;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec4 t101D=texture2D(t101Tex0,t101Uv),t101NMap=texture2D(t101Tex1,t101Uv*${f(tile)});vec3 t101V=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.),t101Surface=t101N;
      ${!low&&normal?`vec3 t101Sample=t101NMap.xyz*2.-1.;t101Sample.xy*=${f(intensity[0])};t101Surface=mat3(t101T,t101B,t101N)*normalize(t101Sample);`:''}
      vec2 t101Uv2=t101Uv*${f(dot)}+t101V.xy/5.,t101Uv3=t101Uv*${f(dot)}+neoTime*.003;vec4 t101S0=texture2D(t101Tex2,t101Uv2),t101S1=texture2D(t101Tex2,t101Uv3);
      vec3 t101Diffuse=pow(max(t101D.rgb,vec3(0.)),vec3(${low?'2.0':'2.2'}));t101Diffuse+=t101S0.rgb*t101S1.a*t101S0.a*3500.*t101D.a;
      ${enabled(macros.CHAR_CHANGE_COLOR,0)?`float t101Lum=dot(t101Diffuse,vec3(.2125,.7154,.0721));t101Diffuse=${low?'pow(max(vec3(t101Lum)*'+rgb(base)+',vec3(0.)),vec3(2.0))':'pow(max(mix(t101Diffuse,vec3(t101Lum)*'+rgb(base)+',t101NMap.a),vec3(0.)),vec3(2.2))'};`:''}
      diffuseColor=vec4(t101Diffuse*${f(tint)},t101D.a*${f(base[3])}*opacity);`).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(t101Surface*vec3(-1.,1.,1.)));`).replace('#include <roughnessmap_fragment>','float roughnessFactor=.5;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;').replace('#include <aomap_fragment>','').replace('#include <emissivemap_fragment>',`
      float t101F=clamp(${f(fresnel)}+(1.-${f(fresnel)})*pow(1.-dot(normal,normalize(vViewPosition)),5.),0.,1.);float t101F1=clamp(.001+.25*pow(1.-dot(normal,normalize(vViewPosition)),3.),0.,50.);
      totalEmissiveRadiance=(t101F1*pow(max(${enabled(macros.CHAR_CHANGE_COLOR,0)?'vec3(t101D.r)':'t101D.rgb'}*3.,vec3(0.)),vec3(${low?'2.0':'2.2'}))*15.*t101D.a${enabled(macros.CHAR_CHANGE_COLOR,0)?'*'+rgb(base):''}+t101F*${rgb(rim)}*${f(intensity[3])})*${f(tint)}*neoEmissionScale;`);
   };
   warnings.push('spacehair 原星点双流、TBN、换色与质量发光分支已接入；原场景光照仍待标定');return u;
  }
  const tex0=await get('Tex0'),tex1=await get('Tex1'),tex2=await get('Tex2',false,false),tex3=await get('Tex3'),tex4=await get('Tex4'),tex5=await get('Tex5',false,false);
  const flake=vector(p.Flake,[1,1,1,1]),dot1=vector(p.DotPara2,[1,1]),dot2=vector(p.Dot2Para2,[1,0,0,0]),fres=vector(p.FresnelPara,[1,1,.3,1]),outline=vector(p.GoldOutlinePara,[0,1,.3,0]),outlineUv=vector(p.OutlineUV,[15,0,0,1]),emis=vector(p.EmisPara,[0,0]),line=vector(p.LineColor,[1,1,1,1]),outlineColor=vector(p.OutlineColor,[1,1,1,1]),pot=vector(p.Pot2Color,[1,1,1,1]),edge=vector(p.EdgeColor,[1,.59,.29,1]);
  const bag=scalar(p.BagEnable,0),needsLight=!low&&outline[3]===0,needsBag=bag>.5;if(needsLight&&!tex2)throw Error('轻 LB 分支缺少原 Tex2/default black');if(needsBag&&!tex5)throw Error('活动溶解分支缺少原 Tex5/default white');
  const u={neoTime:{value:0},neoEmissionScale:{value:1},t101Tex0:{value:tex0},t101Tex1:{value:tex1},t101Tex2:{value:tex2},t101Tex3:{value:tex3},t101Tex4:{value:tex4},t101Tex5:{value:tex5},t101RTSize:{value:new Vector4()}};
  const size=new Vector2();if(needsBag)m.onBeforeRender=r=>{const target=r.getRenderTarget();if(target){const k=2**r.getActiveMipmapLevel();size.set(Math.max(1,Math.floor(target.width/k)),Math.max(1,Math.floor(target.height/k)));}else r.getDrawingBufferSize(size);u.t101RTSize.value.set(size.x,size.y,1/size.x,1/size.y);};
  m.map=null;m.normalMap=null;m.vertexColors=false;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.defines={...m.defines,...(!low&&normal?{USE_TANGENT:''}:{})};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);const vary='varying vec2 t101Uv;varying vec3 t101N,t101T,t101B,t101Local,t101World,t101Center;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nt101Uv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 t101Normal=transformedNormal;\n#ifdef FLIP_SIDED\nt101Normal=-t101Normal;\n#endif\nt101N=normalize(inverseTransformDirection(t101Normal,viewMatrix))*vec3(-1.,1.,1.);t101T=vec3(1.,0.,0.);t101B=vec3(0.,1.,0.);${!low&&normal ? 't101T=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.,1.,1.);t101B=cross(t101N,t101T)*tangent.w;' : ''}`).replace('#include <project_vertex>','t101Local=transformed*vec3(-1,1,1);t101World=(modelMatrix*vec4(transformed,1)).xyz;t101Center=modelMatrix[3].xyz;\n#include <project_vertex>');
   s.fragmentShader=vary+'uniform sampler2D t101Tex0,t101Tex1,t101Tex2,t101Tex3,t101Tex4,t101Tex5;uniform vec4 t101RTSize;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 t101D=texture2D(t101Tex0,t101Uv),t101NMap=texture2D(t101Tex1,t101Uv);vec3 t101V=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.),t101Surface=t101N;float t101Flake=0.,t101Point=0.;vec3 t101TangentView=${normal?'vec3(dot(t101T,t101V),dot(t101B,t101V),dot(t101N,t101V))':'t101V'};vec2 t101TV=t101TangentView.xy;
    ${!low&&normal?`vec3 t101Sample=t101NMap.xyz*2.-1.;t101Sample.xy*=${f(intensity[0])};t101Surface=mat3(t101T,t101B,t101N)*normalize(t101Sample);t101Flake=step(.5,t101NMap.a);t101Point=clamp((t101NMap.a-step(.6,t101NMap.a))*2.,0.,1.);vec3 t101FNormal=texture2D(t101Tex3,t101Uv*${f(flake[2])}+neoTime*vec2(0.,-.2)).xyz*2.-1.;t101FNormal.xy*=${f(flake[3])};t101Surface=mix(t101Surface,mat3(t101T,t101B,t101N)*normalize(t101FNormal),t101Flake);`:''}
    vec3 t101Linear=pow(max(t101D.rgb,vec3(0.)),vec3(${low?'2.0':'2.2'}));vec3 t101Albedo=t101Linear;vec3 t101Extra=vec3(0.);float t101Opacity=1.,t101Edge=0.;
    ${low?`t101Albedo=t101Linear+mix(vec3(0.),t101D.a*${rgb(line)},${f(outline[3])});`:`float t101Fres=smoothstep(${f(fres[2])},${f(fres[3])},clamp(1.-dot(t101V,t101N),0.,1.))*${f(fres[1])};float t101Fres2=smoothstep(0.,.8,clamp(1.-dot(t101V,t101N),0.,1.));vec3 t101Upper=vec3(1.);${outline[3]!==0?`vec4 t101Noise=texture2D(t101Tex4,t101Uv+neoTime*vec2(.1,.2));t101D=texture2D(t101Tex0,t101Uv+t101Noise.r*.01);t101Linear=pow(max(t101D.rgb,vec3(0.)),vec3(2.2));float t101OM=texture2D(t101Tex4,t101Uv*${f(outlineUv[0])}+neoTime*vec2(${f(outlineUv[1])},${f(outlineUv[2])})).g;t101Upper=vec3(mix(${f(outline[2])},1.,clamp(t101OM,0.,1.)));`:`vec4 t101Effect=texture2D(t101Tex2,(mat3(viewMatrix)*(t101World-t101Center)).xy+normalize(t101TangentView).xy*-.15*(1.-smoothstep(0.,.8,clamp(1.-dot(t101V,t101N),0.,1.))));t101Albedo=t101Linear+t101Effect.rgb;`}t101Albedo=mix(t101Linear${outline[3]===0?'+t101Effect.rgb':''},${rgb(line)},step(.4,t101NMap.a));float t101Dot=texture2D(t101Tex4,t101Uv*${f(dot1[0])}).b;float t101Dot2=texture2D(t101Tex4,t101Uv*${f(dot2[0])}+${f(dot2[3])}*t101TV+neoTime*vec2(${f(dot2[1])},${f(dot2[2])})).b;t101Extra=t101Fres*${f(outlineUv[3])}*t101Upper*${rgb(outlineColor)}+(max(t101Dot*t101Dot2,0.)*${f(dot1[1])}*${rgb(pot)}+mix(vec3(0.),vec3(t101Fres2*2.),${f(scalar(p.Fres2Enable,0))}))*t101Point;`}
    ${needsBag?`float t101Mask=step(.01,t101World.y+${f(scalar(p.ABoffset,0))});t101Mask=${f(scalar(p.ABKey,1))}==${f(scalar(p.ContrastValue,0))}?t101Mask:1.-t101Mask;vec2 t101Screen=gl_FragCoord.xy*t101RTSize.zw+neoTime*.3;vec4 t101Diss=texture2D(t101Tex5,t101Screen);float t101Offset=(t101Diss.r*t101Diss.g*2.-1.)*.8,t101Remap=${f(scalar(p.Bias,0))}*4.-2.;float t101A=smoothstep(t101Remap+.8,t101Remap,.8+t101Offset+t101Local.x),t101Bv=smoothstep(t101Remap,t101Remap+.8,.8+t101Offset+t101Local.x),t101M=mix(t101A,t101Bv,${f(scalar(p.DissolveChange,0))});t101Edge=step(.5,t101M)-step(.7,t101M);t101M=step(.5,t101M);t101Opacity=mix(1.,t101Mask,${f(scalar(p.OpacKey,0))})*mix(1.,t101M,${f(scalar(p.DissolveCharKey,0))});`:''}
    ${enabled(macros.CHAR_CHANGE_COLOR,1)?`float t101Lum=dot(t101Linear,vec3(.2125,.7154,.0721));t101Albedo=vec3(t101Lum)*${rgb(base)}*${f(scalar(p.TintValue,1))};`:`t101Albedo*=${f(scalar(p.TintValue,1))};`} diffuseColor=vec4(t101Albedo,t101Opacity*opacity);`).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t101Surface*vec3(-1.,1.,1.)));').replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'1.':`mix(1.,${f(flake[0])},t101Flake)`};`).replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.':`mix(0.,${f(flake[1])},t101Flake)`};`).replace('#include <aomap_fragment>','').replace('#include <emissivemap_fragment>',`
     vec3 t101BaseEmis=mix(t101Linear*t101D.a,t101Linear,${f(emis[0])})*${rgb(vector(p.EmissiveColor,[1,1,1,1]))}*${f(scalar(p.EmissiveValue,1))}*${f(emis[1])};totalEmissiveRadiance=(${low?'t101BaseEmis':`pow(1.-dot(normal,normalize(vViewPosition)),5.)*${rgb(vector(p.RimColor,[0,0,0,0]))}*${f(intensity[3])}+t101BaseEmis+t101Extra+t101Edge*${rgb(edge)}*20.*${f(scalar(p.DissolveCharKey,0))}`})*neoEmissionScale;`);
  };
  warnings.push('LB hair 原 flake、深浅轮廓、双点发光、溶解和质量分支已接入；原场景光照仍待标定');return u;
 }catch(error){warnings.push(`${family==='space'?'spacehair':'LB hair'} 未适配：${error.message}`);return null;}
}
