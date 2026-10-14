import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

export async function configureJellyChar01(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),tbn=q<2&&normal===1;
  if(![0,1,2].includes(q)||[normal,change].some(v=>![0,1].includes(v)))throw Error('Unknown source macro');
  if(scalar(macros.SHADOW_MAP_ENABLE,0)!==0)throw Error('Active source shadow unresolved');
  if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const key of ['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[key],0)!==0)throw Error('Unsupported active '+key);
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(v=>v!==0))throw Error('Active soft-body unresolved');
  const u={},n=(k,d)=>f(scalar(p[k],d)),col=(k,d)=>rgb(vector(p[k],d)),intensity=vector(p.Intensity,[1,1,1,0]);
  for(const key of ['Tex0','Tex1','Tex2']){const t=await load(key,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+key);u['jc'+key]={value:t};}
  setup(m,tbn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn);
   s.fragmentShader=`uniform sampler2D jcTex0,jcTex1,jcTex2;vec3 jcLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 jcUv=t107Uv;jcUv.x+=jcUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',1)}:0.;
    vec3 jcN=t107N,jcV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${q<2?`vec3 jcSample=texture2D(jcTex1,jcUv).xyz*2.-1.;jcSample.xy*=${f(intensity[0])};jcN=${tbn?'mat3(t107T,t107B,t107N)*':''}normalize(jcSample);`:''}
    vec3 jcViewN=mat3(viewMatrix)*(jcN*vec3(-1.,1.,1.)),jcViewV=mat3(viewMatrix)*(jcV*vec3(-1.,1.,1.));
    vec3 jcT=normalize(cross(jcViewV,vec3(0.,1.,0.))),jcB=normalize(cross(jcViewV,jcT));
    vec2 jcCapUv=vec2(dot(jcViewN,jcT),dot(jcViewN,jcB))*.5+.5;
    vec4 jcCap=texture2D(jcTex2,jcCapUv),jcBase=texture2D(jcTex0,jcUv);
    vec3 jcBelow=jcLinear(mix(jcCap.rgb*${n('FaceLightness',1)},${col('Color01',[1,1,1,1])},jcCap.a));
    jcBelow=mix(jcBelow,jcLinear(jcBase.rgb),jcBase.a)*${n('BaseLightness',1)};
    float jcX=1.-abs(dot(jcN,jcV)),jcX2=jcX*jcX,jcF=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*jcX2*jcX2*jcX,0.,1.);
    vec3 jcEmission=${change?`vec3(dot(jcBelow,vec3(.2125,.7154,.0721)))*jcLinear(${col('BaseColor',[1,1,1,1])})`:'jcBelow'}*${n('TintValue',1)}+jcF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])};
    diffuseColor=vec4(0.,0.,0.,opacity);`)
    .replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(jcN*vec3(-1.,1.,1.)));')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=jcEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('jelly_char_01原Matcap/Color01混合及法线通道；活动shadow拒绝，完整原版视觉未等价。');return u;
 }catch(e){warnings.push('jelly_char_01 remains unsupported: '+e.message);return null;}
}
