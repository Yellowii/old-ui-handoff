import {scalar, vector, f, rgb, frame, setup} from './t107-frame.js';
import {sourceSpecular, sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {previewShadowUniforms,bindPreviewShadow} from './scene-material-shadow.js';

// Source: inventory/shader/surf/s24/standard_crystal_ball.{surf,hlsl}.
// ReflectionProbeCustom is declared but never sampled by this source program.
export async function configureStandardCrystalBall(m,p,macros,load,warnings,o={}) {
 try {
  const q=scalar(macros.RENDER_QUALITY,0),normalEnabled=scalar(macros.NORMAL_MAP_ENABLE,1);
  const env=scalar(macros.ENV_CUSTOM,0),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','ENV_CUSTOM','LIGHT_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||[normalEnabled,env,light].some(v=>![0,1].includes(v))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active crystal-ball permutation');
  const high=q<2,useTangent=high&&normalEnabled===1;
  if(useTangent&&o.sourceTangents!==true)throw Error('Missing original tangent basis');
  const I=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]);
  const fresnel=vector(p.FresnelColor,[0,0,0,1]),emissive=vector(p.EmissiveColor,[0,0,0,0]),detail=vector(p.DetailPara,[1,1,1,0]);
  const tint=scalar(p.TintValue,1),fresnelIntensity=scalar(p.FresnelIntensity,3),body=scalar(p.BodyIntensity,.8);
  const breathe=scalar(p.BreatheIntensity,1),speed=scalar(p.BreatheSpeed,1);
  const keys=high?['Tex0','Tex1','Tex2','Tex3','Matcap']:['Tex0'];
  const u={neoTime:{value:0},neoEmissionScale:{value:1},...previewShadowUniforms()};
  for(const key of keys){
   const t=await load(key,false);
   if(!t?.isTexture||t.isCubeTexture)throw Error('Original active 2D texture required: '+key);
   u['cb'+key]={value:t};
  }
  setup(m,useTangent);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,useTangent);bindPreviewShadow(s);
   // frag.position_world - World[3]: use the fully skinned vertex, relative
   // to the mesh's model origin, then rotate as a source view-space vector.
   if(high&&env){
    s.vertexShader='varying vec3 cbCenterView;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     cbCenterView=(viewMatrix*vec4((modelMatrix*vec4(transformed,1.)).xyz-modelMatrix[3].xyz,0.)).xyz*vec3(1.,1.,-1.);`);
    s.fragmentShader='varying vec3 cbCenterView;\n'+s.fragmentShader;
   }
   s.fragmentShader=`uniform sampler2D cbTex0,cbTex1,cbTex2,cbTex3,cbMatcap;
    uniform float neoTime,neoEmissionScale;
    vec3 cbLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
   .replace('#include <map_fragment>',`
    vec4 cb0=texture2D(cbTex0,t107Uv);cb0.rgb=cbLinear(cb0.rgb);
    vec4 cb1=vec4(.5,.5,1.,1.),cb2=vec4(1.,.5,0.,0.);
    vec3 cbN=t107N,cbCap=vec3(0.);
    vec3 cbV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${high?`
    mat3 cbTbn=${useTangent?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 cbTV=normalize(vec3(dot(cbTbn[0],cbV),dot(cbTbn[1],cbV),dot(cbTbn[2],cbV)));
    // Preserve signed source z; do not clamp grazing or back-facing parallax.
    vec2 cbOffset=cbTV.xy/cbTV.z;
    cb1=texture2D(cbTex1,t107Uv);
    vec3 cbDetail=texture2D(cbTex3,t107Uv*vec2(${f(detail[0])},${f(detail[1])})-cbOffset*${f(detail[3])}).xyz;
    cbDetail=mix(vec3(0.,0.,1.),cbDetail*2.-1.,cb0.a);
    vec3 cbLocal=cb1.xyz*2.-1.;
    cbLocal=normalize(vec3(cbLocal.xy+cbDetail.xy*${f(detail[2])},cbLocal.z*cbDetail.z));
    cbLocal.xy*=${f(I[0])};cbN=cbTbn*normalize(cbLocal);
    cb2=texture2D(cbTex2,t107Uv);
    ${env?`
    float cbCenter=texture2D(cbMatcap,cbCenterView.xy*.5-cbDetail.xy).r;
    cb0.rgb*=cbCenter*.5+.5;
    cbCap=cb0.rgb*cbCenter*(.5+cb1.a*abs(sin(neoTime*${f(speed)}))*${f(breathe)});
    `:`
    vec3 cbViewN=(mat3(viewMatrix)*(cbN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 cbViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
    vec3 cbT=normalize(cross(cbViewV,vec3(0.,1.,0.))),cbB=normalize(cross(cbViewV,cbT));
    vec2 cbCapUv=vec2(dot(cbViewN,cbT),dot(cbViewN,cbB))*.5+.5;
    cbCap=cbLinear(texture2D(cbMatcap,cbCapUv).rgb)*cb2.b;
    cb0.rgb=mix(cb0.rgb,vec3(0.),cb2.b);
    `}`:''}
    diffuseColor=vec4(cb0.rgb*${rgb(base)}*${f(tint)},cb0.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cbN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${high?`clamp(cb2.g*${f(I[1])},0.,1.)`:'.5'};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${high?`clamp(cb2.b*${f(I[2])},0.,1.)`:'0.'};`)
   .replace('#include <emissivemap_fragment>',`
    float cbNoV=clamp(1.-dot(t107N,cbV),0.,1.);
    vec3 cbBorder=${rgb(fresnel)}*${f(fresnelIntensity)}*smoothstep(-.05,.8,clamp(cbNoV*cbNoV*cbNoV,0.,1.))*.6;
    vec3 cbBody=diffuseColor.rgb*max(cb2.a,pow(1.-cbNoV,3.))*${f(body)};
    float cbShadow=neoPreviewShadow()*.25+.75;
    vec3 cbEmission=${rgb(emissive)}*cb2.a*${f(I[3])}*cbShadow;
    totalEmissiveRadiance=((cbBorder+cbBody)*cb0.a+cbCap*cbShadow+cbEmission*cbShadow)*neoEmissionScale;
   `)
   .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cb2.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cb2.r,material.roughness);
    #endif`)
   .replace('#include <lights_physical_fragment>',sourceSpecular('.5',sourceGrazing));
   sourceIsotropy(s,{quality:q,smoothDiffuse:false,light:light===1,standardMaterial:true});
  };
  warnings.push('crystal-ball: source parallax/detail normal, both Matcap branches, breathing and double-shadow emission connected; original scene lighting remains pending');
  return u;
 }catch(e){warnings.push('crystal-ball remains unsupported: '+e.message);return null;}
}
