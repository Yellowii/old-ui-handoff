import {Matrix4} from 'three';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Current unlit_jelly_obj_gets source. This variant has mask colors and four
// maps; tpl_unlit_jelly_obj_gets has a separate base map and remains separate.
export async function configureJellyFlakes(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),offset=scalar(macros.CHAR_OFFSET,0);
  if(![0,1,2].includes(q)||[normal,offset].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  if(normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','CHAR_OFFSET','ALPHA_TEST_ENABLE','TWO_SIDED']);
  for(const [key,value] of Object.entries(macros))if(!known.has(key)&&scalar(value,0)!==0)throw Error('Unsupported active '+key);
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(x=>x!==0))throw Error('Active source soft-body is not connected');
  if(scalar(p.FlakeDensity,.1)<=0)throw Error('Invalid source FlakeDensity');
  const intensity=vector(p.Intensity,[1,1,1,0]),texture=vector(p.TexturePara,[1,1,0,0]);
  const n=(key,d)=>f(scalar(p[key],d)),v=(key,d)=>rgb(vector(p[key],d));
  const inverseWorld=new Matrix4(),sourceReflection=new Matrix4().makeScale(-1,1,1),u={neoTime:{value:0},jfInverseWorld:{value:inverseWorld}};
  for(const key of ['Tex0','Tex1','Tex2','Tex3']){
   const t=await load(key,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+key);u['jf'+key]={value:t};
  }
  setup(m,normal===1);
  // Original Transform(m,v) = mul(v,m): source world uniforms are row matrices.
  // This shader deliberately calls mul(InverseWorld,view), in the other order.
  m.onBeforeRender=(_r,_s,_c,_g,object)=>inverseWorld.copy(object.matrixWorld).invert().multiply(sourceReflection).transpose();
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader=`uniform sampler2D jfTex0,jfTex1,jfTex2,jfTex3;uniform float neoTime;uniform mat4 jfInverseWorld;
    vec3 jfLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 jfUv=t107Uv;${offset?`if(jfUv.y<.25)jfUv.x+=${n('FaceUVOffset',0)};`:''}
    vec2 jfScale=${n('RepeatScale',1)}*vec2(${f(texture[0])},${f(texture[1])});
    jfUv=(jfUv-.5)*jfScale;
    float jfAngle=${n('RotationAngle',0)}*6.283/360.,jfSin=sin(jfAngle),jfCos=cos(jfAngle);
    jfUv=vec2(jfUv.x*jfCos-jfUv.y*jfSin,jfUv.y*jfCos+jfUv.x*jfSin)+.5*jfScale+vec2(${f(texture[2])},${f(texture[3])});
    vec3 jfSample=texture2D(jfTex1,jfUv).xyz*2.-1.;jfSample.xy*=${f(intensity[0])};
    mat3 jfBasis=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 jfN=jfBasis*normalize(jfSample);
    vec3 jfWebV=inverseTransformDirection(normalize(vViewPosition),viewMatrix),jfV=jfWebV*vec3(-1.,1.,1.);
    vec3 jfViewN=(mat3(viewMatrix)*(jfN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 jfViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
    vec3 jfT=normalize(cross(jfViewV,vec3(0.,1.,0.))),jfB=normalize(cross(jfViewV,jfT));
    vec2 jfCapUv=vec2(dot(jfViewN,jfT),dot(jfViewN,jfB))*.5+.5;
    // Source intentionally multiplies a world TBN by an object-space view.
    vec3 jfObjectV=normalize(mat3(jfInverseWorld)*jfV);
    vec3 jfTangentV=normalize(transpose(jfBasis)*(-jfObjectV));
    vec2 jfNoiseUv=jfUv+jfTangentV.xy*${n('OffsetMult',1)};
    vec4 jfCap=texture2D(jfTex0,jfCapUv);
    float jfSugar=clamp((texture2D(jfTex2,jfUv*${n('UVTiling',1)}).r-1.)/${n('FlakeDensity',.1)}+${n('FlakeNumber',0)},0.,1.);
    float jfNoise=pow(texture2D(jfTex3,jfNoiseUv).r,${n('OffsetPow',1)});
    float jfMix=pow(jfSugar,.1)*jfSugar*${n('SparkleEmisStrength',1)}*jfNoise*${n('flakeSwitch',0)};
    vec3 jfEmission=jfLinear(mix(${v('MaskColor0',[1,1,1,1])},${v('MaskColor1',[1,1,1,1])},jfCap.b));
    jfEmission+=jfLinear(jfCap.aaa)*${n('Lightness',1)}+jfLinear(jfCap.ggg)*${n('Reflection',2)};
    // HLSL lerp deliberately permits extrapolation; do not saturate jfMix.
    jfEmission=mix(jfEmission,${v('MaskColor2',[1,1,1,1])},jfMix);
    float jfX=1.-dot(jfN,jfV),jfX2=jfX*jfX;
    float jfF=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*jfX2*jfX2*jfX,0.,1.);
    jfEmission+=${v('RimColor',[1,1,1,1])}*${n('FresnelOpen',0)}*8.*jfF*(abs(sin(neoTime*${n('FresnelSpeed',1)}))+.5);
    diffuseColor=vec4(0.,0.,0.,opacity);`)
    .replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(jfN*vec3(-1.,1.,1.)));')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=jfEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  return u;
 }catch(e){warnings.push('jelly flakes remains unsupported: '+e.message);return null;}
}
