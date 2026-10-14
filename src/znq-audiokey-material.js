import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

export async function configureZnqAudiokey(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(light))throw Error('Unknown source macro');
  if(o.sourceSecondUv!==true)throw Error('Missing original second UV');
  const tbn=q<2&&normal===1&&light===1;if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const key of ['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING','LIGHT_MAP_ENABLE','TEXCOORD1_ENABLE'])if(scalar(macros[key],0)!==0)throw Error('Unsupported active '+key);
  const tex={};for(const key of ['Tex0','Tex1','Tex2','Tex3']){tex[key]=await load(key,false);if(!tex[key]?.isTexture||tex[key].isCubeTexture)throw Error('Missing source '+key);}
  const base=vector(p.TintColor,[1,1,1,1]),spec=vector(p.SpecColor,[1,1,1,1]),tiling=vector(p.DiscoTiling,[24,12]),intensity=vector(p.Intensity,[1,1,1,0]),bounds=o.sourceSlotBounds||o.sourceBounds;
  const center=vector(bounds?.center,[0,0,0]),half=vector(bounds?.half,[1,1,1]);
  const n=(k,d)=>f(scalar(p[k],d)),u={zaTex0:{value:tex.Tex0},zaTex1:{value:tex.Tex1},zaTex2:{value:tex.Tex2},zaTex3:{value:tex.Tex3},zaTime:{value:0}};
  setup(m,tbn);m.emissive.set(0);m.emissiveIntensity=0;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn);
   s.vertexShader=`attribute vec2 uv1;varying vec2 zaUv1;uniform float zaTime;\n`+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nzaUv1=uv1;');
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    if(${n('Offset',0)}>0.0){vec3 zaMin=vec3(${rgb(center)});zaMin-=vec3(${rgb(half)});float zaY=abs((transformed.y-zaMin.y)/max(${n('BoundHalfY',half[1])}*2.0,0.000001));vec3 zaDir=mix(vec3(1.0),vec3(zaY),${n('LeprYKey',1.0)})*normalize(transformed-vec3(0.0,${n('YOffset',0)},0.0));transformed+=zaDir*${n('Audio',0)}*${n('Offset',0)};}`);
   s.fragmentShader=`varying vec2 zaUv1;uniform sampler2D zaTex0,zaTex1,zaTex2,zaTex3;uniform float zaTime;\nvec3 zaLinear(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}\n`+s.fragmentShader;
   const change=n('ChangeColorKey',0)!==0;
   const body=`vec4 za0=texture2D(zaTex0,t107Uv),za1=texture2D(zaTex1,t107Uv),za2=texture2D(zaTex2,t107Uv),za3=texture2D(zaTex3,t107Uv);vec3 zaBase=zaLinear(za0.rgb)*${rgb(base)}*${n('Lightness',1)};${change?`zaBase=mix(zaBase,zaBase*${rgb(vector(p.MaskColor0,[1,0,0,1]))},clamp(za0.r,0.,1.));`:''}float zaOpacity=clamp(za0.a,0.,1.)*${n('Opacity',1)};float zaR=${q===2?'.5':`clamp(za2.g*${f(intensity[1])},0.,1.)`};float zaM=${q===2?'0.':`clamp(za2.b*${f(intensity[2])},0.,1.)`};float zaAo=${q===2?'1.':'za2.r'};vec2 zaDiscoUv=ceil(zaUv1*vec2(${f(tiling[0])},${f(tiling[1])}))/vec2(${f(tiling[0])},${f(tiling[1])})+ceil(zaTime*8.);vec3 zaDisco=pow(max(texture2D(zaTex0,zaDiscoUv).rgb,vec3(0.)),vec3(${n('DiscoColPow',1)}))*texture2D(zaTex2,zaDiscoUv).a*${rgb(spec)}*${n('SpecIntensity',0)};vec3 zaFres=pow(clamp(1.-dot(normalize(t107N),normalize(vViewPosition)),0.,1.),5.)*zaLinear(za3.rgb)*texture2D(zaTex2,zaDiscoUv).a*${n('FresnelIntensity',0)};diffuseColor=vec4(zaBase,zaOpacity*opacity);`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>',tbn?`vec3 zaN=texture2D(zaTex1,t107Uv).xyz*2.-1.;normal=normalize(mat3(t107T,t107B,t107N)*normalize(zaN));`:'normal=normalize(t107N);').replace('#include <roughnessmap_fragment>','float roughnessFactor=zaR;').replace('#include <metalnessmap_fragment>','float metalnessFactor=zaM;').replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=zaAo;').replace('#include <emissivemap_fragment>','totalEmissiveRadiance=zaDisco+zaFres;');
  };
  warnings.push('znq_pop_audiokey source four-map, second-UV disco emission, tangent normal and exact source geometry attributes; scene audio/time remains preview-driven.');return u;
 }catch(e){warnings.push('znq_pop_audiokey remains unsupported: '+e.message);return null;}
}
