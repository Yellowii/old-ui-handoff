import {Vector2} from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Original u5_vfx_ciyuanzhan material channels. The viewer supplies the current
// preview color buffer; this is not a claim of original scene/pass-order parity.
export async function configureCiyuanzhan(m,p,macros,load,warnings){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),local=scalar(macros.USE_LOCAL_PARAMATER,0);
  const known=new Set(['RENDER_QUALITY','USE_LOCAL_PARAMATER','LIGHT_ENABLE','NORMAL_MAP_ENABLE','IS_CHARACTER','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||![0,1].includes(local)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented ciyuanzhan permutation');
  const base=vector(p.BaseColor,[1,1,1,1]),I=vector(p.Intensity,[1,1,1,0]),ae=vector(p.AlbAndEmisPara,[1,2,1,1]),rim=vector(p.GlassFresnelColor,[1,1,1,1]);
  const tint=scalar(p.TintValue,1),ref=scalar(p.refractMult,.2),alpha=scalar(p.refractAlpha,1),power=scalar(p.polyLinePow,1),mult=scalar(p.polyLineMult,.2),lineRef=scalar(p.polyLineRefract,0),speed=[scalar(p.polyLineSpeed,0),scalar(p.polyLineSpeed2,0)],ss=scalar(p.GlassFresnelSSMax,.25);
  if(ss<=.05||ae[0]<=0||power<=0)throw Error('Undefined source smoothstep/power boundary');
  const cube=await load('TexCube',false),line=await load('Tex2',false);
  if(!cube?.isCubeTexture||!line?.isTexture||line.isCubeTexture)throw Error('Original cube and line texture required');
  const u={cyCube:{value:cube},cyLine:{value:line},neoTime:{value:0},neoEmissionScale:{value:1},ifSceneColor:{value:null},ifScreenSize:{value:new Vector2(1,1)}};
  setup(m,false);m.userData.sceneRefraction=true;m.userData.previewEnvironment={profile:'current-preview-color-buffer',fullOriginalScene:false};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   const vary='varying vec3 cyLocalNormal;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <skinnormal_vertex>','#include <skinnormal_vertex>\ncyLocalNormal=objectNormal*vec3(-1.,1.,1.);');
   s.fragmentShader=vary+'uniform samplerCube cyCube;uniform sampler2D cyLine,ifSceneColor;uniform vec2 ifScreenSize;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec3 cyView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec2 cyOffset=${local?'cyLocalNormal':'t107N'}.xy;
    vec2 cyScreenUv=gl_FragCoord.xy/ifScreenSize+cyOffset*${f(ref)};
    vec3 cyScreen=texture2D(ifSceneColor,cyScreenUv).rgb;
    float cyFresnel=clamp(1.-dot(t107N,cyView),0.,1.);
    cyFresnel=.4+.6*smoothstep(.05,${f(ss)},cyFresnel);
    vec3 cyReflection=reflect(-cyView,t107N);
    vec3 cyReflectColor=pow(textureLod(cyCube,cyReflection,1.).rgb,vec3(${f(ae[0])}));
    vec2 cyLineUv=t107Uv+${f(lineRef)}*(cyOffset+vec2(${f(speed[0])},${f(speed[1])})*neoTime);
    vec3 cyPolyline=pow(texture2D(cyLine,cyLineUv).rgb,vec3(${f(power)}))*${f(mult)};
    vec3 cyAlbedo=(mix(${rgb(base)},cyScreen,${f(alpha)})+cyPolyline)*${rgb(base)}*${f(tint)};
    vec3 cyEmission=${rgb(rim)}*pow(cyFresnel,${f(ae[1])})*${f(ae[2])}+cyReflectColor*${f(ae[3])}+cyPolyline;
    diffuseColor=vec4(cyAlbedo,${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(I[1])};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(I[2])};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cyEmission*neoEmissionScale;');
  };
  warnings.push('ciyuanzhan: source refraction/color/emission channels connected; full original scene lighting and capture order remain uncalibrated');return u;
 }catch(e){warnings.push('ciyuanzhan remains unsupported: '+e.message);return null;}
}
