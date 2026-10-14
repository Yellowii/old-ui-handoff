import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
export async function configureAngelBody(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),shadow=scalar(macros.SHADOW_MAP_ENABLE,0);
  if(![0,1,2].includes(q)||[normal,change,shadow].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  if(shadow)throw Error('Active source shadow map unresolved');
  if(normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const k of ['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[k],0)!==0)throw Error('Unsupported active '+k);
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body unresolved');
  const n=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),value=vector(p.Value,[1,-1,1,0]),intensity=vector(p.Intensity,[1,1,1,0]);
  const u={neoTime:{value:0}};
  for(const k of ['Tex0','Tex1','Tex2','Matcap','Tex3']){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+k);u['ab'+k]={value:t};}
  setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader=`uniform sampler2D abTex0,abTex1,abTex2,abMatcap,abTex3;uniform float neoTime;
    vec3 abLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
   `+s.fragmentShader;
   const body=`
    vec3 abV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 abTangentV=normalize(${normal?'vec3(dot(t107T,abV),dot(t107B,abV),dot(t107N,abV))':'abV'});
    vec2 abOffset=abTangentV.xy*${f(value[1])};
    float abNoiseMoving=texture2D(abTex0,t107Uv*${f(value[2])}+neoTime*.1).r;
    float abNoise=texture2D(abTex0,t107Uv*${f(value[2])}+abOffset*abNoiseMoving).r;
    vec2 abSparkUv=t107Uv*${f(value[2])}*3.+abOffset*abNoiseMoving;
    vec3 abSparkA=vec3(texture2D(abTex1,abSparkUv+vec2(.001)).r,texture2D(abTex1,abSparkUv-vec2(.001)).g,texture2D(abTex1,abSparkUv).b);
    vec2 abSparkUv2=t107Uv*${f(value[2])}*3.*1.4;
    vec3 abSparkB=vec3(texture2D(abTex1,abSparkUv2+vec2(.001)).r,texture2D(abTex1,abSparkUv2-vec2(.002)).g,texture2D(abTex1,abSparkUv2).b);
    vec3 abViewV=mat3(viewMatrix)*(abV*vec3(-1.,1.,1.)),abViewN=mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.));
    vec3 abViewT=normalize(cross(abViewV,vec3(0,1,0))),abViewB=normalize(cross(abViewV,abViewT));
    vec2 abMatUv=vec2(dot(abViewN,abViewT),dot(abViewN,abViewB))*.5+.5;
    vec4 abMat=texture2D(abMatcap,abMatUv),abFaceMap=texture2D(abTex2,t107Uv),abBreathMap=texture2D(abTex3,t107Uv);
    vec3 abFinal=abLinear(mix(${col('NoiseColor')},${col('BlendColor')},abNoise))*${f(value[3])}+abSparkA*abSparkB*${f(value[0])};
    vec3 abFace=abLinear(abFaceMap.rgb),abHighlight=abLinear(abMat.aaa),abReflection=abLinear(abMat.ggg)+abLinear(abMat.rrr)*.3;
    float abFresnel=max(0.,pow(min(1.,.5+.8*(1.-dot(abV,t107N))),5.));
    vec3 abFresnelColor=abFresnel*abLinear(${col('NoiseColor')}),abExtra=abLinear(mix(${col('NoiseColor')},${col('BlendColor')},abFresnel));
    vec3 abDiffuse=mix(abFinal,abFace,abFaceMap.a)*${n('TintValue',1)};
    vec3 abRim=abFresnel*abLinear(${col('RimColor',[0,0,0,1])})*${f(intensity[3])};
    vec3 abBreath=(abBreathMap.r*${n('stsSWitch',0)}+abBreathMap.g*${n('dtsSwitch',0)})*${col('MaskEmisColor')}*${n('EmissiveStrength',0)}*clamp(sin(neoTime*${n('EmissiveSpeed',1)})+1.,0.,${n('EmissiveClamp',1)});
    ${change?`abDiffuse+=abFresnelColor+abExtra;float abLuminance=dot(abDiffuse,vec3(.2125,.7154,.0721));abDiffuse=mix(vec3(abLuminance)*abLinear(${col('BaseColor')}),abFace,abFaceMap.a)*${n('TintValue',1)};`:''}
    vec3 abEmission=abDiffuse+abHighlight+abReflection*2.+abRim+abBreath${change?'':'+abFresnelColor+abExtra'};
    diffuseColor=vec4(0.,0.,0.,opacity);
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=0.;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=abEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('天使身体原五图/视差/发光；源默认阴影宏关闭，活动阴影分支未交付；half与完整运行时未等价。');return u;
 }catch(e){warnings.push('angel_body remains unsupported: '+e.message);return null;}
}
