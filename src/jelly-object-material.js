import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// tpl_unlit_jelly_obj_gets, exact sources in headwear-jelly-t317/source.json.
// Current antler variants use flakeSwitch=0. Active parallax flakes stay gated.
export async function configureJellyObject(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),offset=scalar(macros.CHAR_OFFSET,0);
  if(![0,1,2].includes(q)||[normal,offset].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  if(normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(scalar(p.flakeSwitch,0)!==0)throw Error('Active parallax flakes not implemented');
  if(scalar(p.FlakeDensity,.1)<=0)throw Error('Invalid source FlakeDensity');
  for(const key of ['SHADOW_MAP_ENABLE','INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[key],0)!==0)throw Error('Unsupported active '+key);
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body unresolved');
  const u={neoTime:{value:0}},n=(key,d)=>f(scalar(p[key],d)),intensity=vector(p.Intensity,[1,1,1,0]);
  for(const key of ['Tex0','Tex1','Tex2','Tex3','Tex4']){const t=await load(key,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+key);u['jo'+key]={value:t};}
  setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader=`uniform sampler2D joTex0,joTex1,joTex4;uniform float neoTime;
    vec3 joLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 joUv=t107Uv;${offset?`if(joUv.y<.25)joUv.x+=${n('FaceUVOffset',0)};`:''}
    vec3 joSample=texture2D(joTex1,joUv).xyz*2.-1.;joSample.xy*=${f(intensity[0])};
    vec3 joN=${normal?'mat3(t107T,t107B,t107N)*':''}normalize(joSample);
    vec3 joV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    // Cross products are evaluated in the original left-handed view frame.
    vec3 joViewN=(mat3(viewMatrix)*(joN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 joViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
    vec3 joT=normalize(cross(joViewV,vec3(0.,1.,0.))),joB=normalize(cross(joViewV,joT));
    vec2 joCapUv=vec2(dot(joViewN,joT),dot(joViewN,joB))*.5+.5;
    vec4 joCap=texture2D(joTex0,joCapUv),joBase=texture2D(joTex4,joUv);
    float joX=1.-dot(joN,joV),joX2=joX*joX;
    float joF=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*joX2*joX2*joX,0.,1.);
    vec3 joEmission=joLinear(joBase.rgb)+joLinear(joCap.aaa)*${n('Lightness',1)}+joLinear(joCap.ggg)*${n('Reflection',2)};
    joEmission+=${n('FresnelOpen',0)}*8.*joF*${rgb(vector(p.RimColor,[1,1,1,1]))}*(abs(sin(neoTime*${n('FresnelSpeed',1)}))+.5);
    diffuseColor=vec4(0.,0.,0.,opacity);`)
    .replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(joN*vec3(-1.,1.,1.)));')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=joEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('原果冻物件Matcap/法线/高光；活动糖粒和阴影分支待实现，原版场景未校准。');return u;
 }catch(e){warnings.push('jelly object remains unsupported: '+e.message);return null;}
}
