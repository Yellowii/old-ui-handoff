import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceMatcapGlsl} from './source-matcap-inputs.js';
import {sourceSceneSunGlsl} from './source-scene-light.js';
import {sourceSpecular,sourceGrazing} from './source-specular.js';

// shader/surf/s26/special_jade.hlsl. The source uses five 2D textures, a
// camera-space MatCap basis and authored Fresnel/cracked/pattern emission.
// These models do not publish tangents, so the normal path uses the same
// screen-space derivative TBN policy as the other approved derived adapters.
export async function configureSpecialJade(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(change))throw Error('Unknown source permutation');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','CHAR_CHANGE_COLOR','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','LIGHT_ENABLE','TEXCOORD1_ENABLE','VERTEX_COLOR_ENABLE','USE_STANDARD_MATERIAL']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unknown active source macro');
  if(scalar(macros.ENABLE_SOFT_BODY2,0)!==0||['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ','SoftBodyCenter'].some(k=>vector(p[k],[0,0,0]).some(x=>x!==0))||vector(p.SoftBodyScale,[1,1,1,1]).some(x=>x!==1)||vector(p.SoftBodyBottom,[0,0,0,1]).some((x,i)=>x!==(i===3?1:0)))throw Error('Active source soft body unresolved');
  const high=q<2,useTangent=high&&normal===1&&o.sourceTangents===true,derivedTbn=high&&normal===1&&!useTangent;
  const I=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]);
  const keys=high?['Tex0','Tex1','Tex2','Tex3','Tex4']:['Tex0'];
  const u={neoEmissionScale:{value:1}};
  for(const key of keys){const t=await load(key,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing active source texture: '+key);u['sj'+key]={value:t};}
  setup(m,useTangent);
  if(derivedTbn){m.extensions={...m.extensions,derivatives:true};m.userData.specialJadeDerivedTangent=true;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,useTangent);
   s.fragmentShader=`uniform sampler2D sjTex0,sjTex1,sjTex2,sjTex3,sjTex4;uniform float neoEmissionScale;
    vec3 sjLinear(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
    ${sourceMatcapGlsl}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 sj0=texture2D(sjTex0,t107Uv);sj0.rgb=sjLinear(sj0.rgb);
    ${change?`float sjLum=dot(sj0.rgb,vec3(.2125,.7154,.0721));sj0.rgb=vec3(sjLum)*${rgb(base)}*${f(scalar(p.TintValue,1))};`:`sj0.rgb*=${f(scalar(p.TintValue,1))};`}${high?`sj0.rgb*=${f(scalar(p.BaseColorStr,1))};`:''}
    vec3 sjN=t107N;mat3 sjTbn=mat3(1.);vec4 sj1=vec4(0.),sj2=vec4(1.,1.,0.,0.),sj4=vec4(0.);vec4 sjCap=vec4(0.);vec3 sjV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${high?`${derivedTbn?`vec3 sjDt=normalize(dFdx(vViewPosition)*dFdy(t107Uv).y-dFdy(vViewPosition)*dFdx(t107Uv).y),sjDb=normalize(-dFdx(vViewPosition)*dFdy(t107Uv).x+dFdy(vViewPosition)*dFdx(t107Uv).x);if(dot(cross(sjDt,sjDb),sjN)<0.)sjDb=-sjDb;sjTbn=mat3(sjDt,sjDb,sjN);`:useTangent?'sjTbn=mat3(t107T,t107B,t107N);':'sjTbn=mat3(1.);'}
      sj1=texture2D(sjTex1,t107Uv);vec3 sjLocal=sj1.xyz*2.-1.;sjLocal.z=sqrt(max(1.-sjLocal.x*sjLocal.x-sjLocal.y*sjLocal.y,0.));sjLocal.xy*=${f(I[0])};sjN=normalize(sjTbn*normalize(sjLocal));
      sj2=texture2D(sjTex2,t107Uv);sj4=texture2D(sjTex4,t107Uv);vec3 sjViewN=sjN*vec3(1.,1.,-1.);sjCap=texture2D(sjTex3,sourceMatcapUV(sjViewN,sjV));
      `:''}
    diffuseColor=vec4(sj0.rgb,sj0.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(sjN*vec3(-1.,1.,-1.)));`)
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${high?`clamp(sj2.g*${f(I[1])},0.,1.)`:'0.5'};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${high?`clamp(sj2.b*${f(I[2])},0.,1.)`:'0.'};`)
   .replace('#include <emissivemap_fragment>',`
    vec3 sjSun=${sourceSceneSunGlsl()};float sjNoV=clamp(dot(sjN,sjV),0.,1.);float sjFres=pow(clamp(1.-sjNoV,0.,1.),${f(scalar(p.FresnelPow,5))})*${f(scalar(p.FresnelStr,1))};float sjSchlick=clamp(${f(scalar(p.FresnelScale,0))}+(1.-${f(scalar(p.FresnelScale,0))})*pow(clamp(1.-sjNoV,0.,1.),5.),0.,1.);
    vec3 sjEm=vec3(0.);float sjSunV=clamp(pow(clamp(dot(-sjSun,sjV),0.,1.),1.0)*1.2,0.,1.);
    ${high?`float sjEmfre=1.-clamp((dot(sjV,sjN)-.1)*1.2,0.,1.);float sjEmfrea=clamp((dot(sjV,sjN)-.5)*1.6,0.,1.);vec3 sjBBB=mix(vec3(0.),sj0.rgb*${rgb(vector(p.Color0,[0,0,0,1]))},sjEmfre);vec3 sjAAA=mix(sj0.rgb*mix(${rgb(vector(p.Color1,[0,0,0,1]))},vec3(0.),sj1.a),vec3(0.),sjEmfrea);sjEm=mix(sjAAA,sjBBB,sjSunV);` :''}
    ${high?`vec3 sjTv=normalize(vec3(dot(sjTbn[0],sjV),dot(sjTbn[1],sjV),dot(sjTbn[2],sjV)));vec2 sjCrUv=t107Uv*${f(scalar(p.CrackedUVTiling,1))}-sjTv.xy*.15;float sjCr=pow(texture2D(sjTex4,sjCrUv).r,2.)*mix(${f(scalar(p.CrackedStr,0))},.6,sj1.a);vec2 sjPatUv=t107Uv*mix(${f(scalar(p.PatternUVTiling,1))},2.,sj1.a)-sjTv.xy*.25;float sjPat=pow(texture2D(sjTex4,sjPatUv).a,2.)*mix(${f(scalar(p.PatternStr,0))},1.,sj1.a);` : 'float sjCr=0.,sjPat=0.;'}
    sjEm+=sjSchlick*${rgb(vector(p.RimColor,[0,0,0,0]))}*${f(I[3])}+sjFres*${rgb(vector(p.FresnelColor,[1,1,1,1]))};
    ${high?`sjEm+=pow(sjCap.g,1.7)*mix(${rgb(vector(p.HighLightColor,[1,1,1,1]))},vec3(1.),sj1.a)*mix(${f(scalar(p.HighLightStr,1))},.25,sj1.a);sjEm+=pow(sjCap.a,1.7)*mix(${rgb(vector(p.ReflectColor,[1,1,1,1]))},vec3(.149020,.149020,.149020),sj1.a)*.5*${f(scalar(p.ReflectStr,1))};sjEm+=sj4.b*mix(mix(${rgb(vector(p.SSSColor,[1,1,1,1]))},sj0.rgb,${f(scalar(p.SSSColorUseBaseCol,1))}),vec3(.439216,.490196,.474510),sj1.a)*${f(scalar(p.SSSColorStr,1))};sjEm+=sjCr*mix(${rgb(vector(p.CrackedColor,[1,1,1,1]))},vec3(.305882,.478431,.741176),sj1.a)+sjPat*mix(${rgb(vector(p.PatternColor,[1,1,1,1]))},vec3(.027451,.050980,.047059),sj1.a);` :''}
    sjEm+=sj0.rgb*${rgb(vector(p.EmissiveColor,[1,1,1,1]))}*${f(scalar(p.EmissiveValue,0))}*${high?'sj2.a':'0.'};
    totalEmissiveRadiance=sjEm*neoEmissionScale;
   `).replace('#include <aomap_fragment>',high?'reflectedLight.indirectDiffuse*=sj2.r;':'')
   .replace('#include <lights_physical_fragment>',sourceSpecular('1.',sourceGrazing));
  };
  if(derivedTbn)warnings.push('special_jade 源五图/MatCap/裂纹/边缘通道已接入；网格无原切线，使用屏幕导数 TBN，原设备 half 精度与完整场景光照仍未等价');
  else warnings.push('special_jade 源五图/MatCap/裂纹/边缘通道已接入；完整场景光照与设备精度仍未等价');
  return u;
 }catch(e){warnings.push('special_jade remains unsupported: '+e.message);return null;}
}
