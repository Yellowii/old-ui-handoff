import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {ClampToEdgeWrapping} from 'three';

// Independent source material, not standard_char_jade. The source ISO specular
// color multiplies direct specular lighting, not F0 or environment reflections.
export async function configureSilverJade(m,p,macros,load,warnings,o={}){
 const owned=[];
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normalMap=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0);
  if(![0,1,2].includes(q)||[normalMap,change].some(v=>![0,1].includes(v)))throw Error('Unknown source permutation');
  const basis=normalMap===1&&q<2;
  if(basis&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const key of ['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING','GLOBAL_VSM_ENABLE','LIGHT_MAP_ENABLE','H56_SH_ENABLE','SHADOW_INTERFACE'])if(scalar(macros[key],0)!==0)throw Error('Active source '+key+' unresolved');
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(v=>v!==0))throw Error('Active soft body unresolved');
  const intensity=vector(p.Intensity,[1,.5,0,0]),base=vector(p.BaseColor,[1,1,1,1]),rim=vector(p.RimColor,[1,1,1,1]),spec=vector(p.SpecularColor,[1,1,1,1]),gem=vector(p.GemColor,[1,1,1,1]);
  const n=(key,d)=>f(scalar(p[key],d));
  const nums={tint:n('TintValue',1),fresnel:n('FresnelScale',0),offset:n('CharOffset',1),spec:n('SpecularIntensity',1),gem:n('GemIntensity',2.5),gemH:n('GemHIntensity',3),gemMask:n('GemMaskValue',1),irid:n('IridescenceFIntensity',1),emissive:n('EmissiveValue',0)};
  const u={neoTime:{value:0},neoFaceOffset:{value:scalar(p.FaceUVOffset,0)}};
  const keys=['Tex0','Tex3',...(q<2?['Tex2','Matcap','IridescenceLUT']:[]),...(basis?['Tex1']:[])];
  for(const key of keys){let t=await load(key,false,key==='Tex0'?o.baseColor:undefined);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+key);
   // Matcap uses its own clamp sampler even if the source image is shared.
   if(key==='Matcap'){t=t.clone();t.wrapS=t.wrapT=ClampToEdgeWrapping;t.needsUpdate=true;owned.push(t);}
   u['sj'+key]={value:t};
  }
  setup(m,basis);
  m.addEventListener('dispose',()=>{for(const texture of owned)texture.dispose();});
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,basis);
   s.fragmentShader=`uniform sampler2D sjTex0,sjTex1,sjTex2,sjTex3,sjMatcap,sjIridescenceLUT;uniform float neoTime,neoFaceOffset;
    vec3 sjLinear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    vec3 sjHSV(vec3 c){vec4 p=c.g<c.b?vec4(c.bg,-1.,2./3.):vec4(c.gb,0.,-1./3.);vec4 q=c.r<p.x?vec4(p.xyw,c.r):vec4(c.r,p.yzx);float d=q.x-min(q.w,q.y);return vec3(abs((q.w-q.y)/(6.*d+1.e-10)+q.z),d/(q.x+1.e-10),q.x);}
    vec3 sjRGB(vec3 c){vec3 hue=clamp(vec3(abs(c.x*6.-3.)-1.,2.-abs(c.x*6.-2.),2.-abs(c.x*6.-4.)),0.,1.);return ((hue-1.)*c.y+1.)*c.z;}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>');
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 sjUv=t107Uv;sjUv.x+=sjUv.y<.25?neoFaceOffset*${nums.offset}:0.;
    vec4 sjBase=texture2D(sjTex0,sjUv);sjBase.rgb=sjLinear(sjBase.rgb);
    ${change?`sjBase.rgb=vec3(dot(sjBase.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)}*${nums.tint};`:`sjBase.rgb*=${nums.tint};`}
    vec4 sjNoise=texture2D(sjTex3,sjUv*12.-neoTime*.05*vec2(0.,1.));
    vec4 sjNormalTex=vec4(0.);vec3 sjN=t107N,sjTangentV=vec3(0.);
    vec3 sjV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${basis?`sjNormalTex=texture2D(sjTex1,sjUv);vec3 sjDecoded=sjNormalTex.xyz*2.-1.;sjDecoded.xy*=${f(intensity[0])};sjN=mat3(t107T,t107B,t107N)*normalize(sjDecoded);sjTangentV=normalize(vec3(dot(t107T,sjV),dot(t107B,sjV),dot(t107N,sjV)));`:''}
    float sjNdV=clamp(dot(sjN,sjV),0.,1.);
    vec4 sjMix=vec4(1.,.5,0.,0.),sjCap=vec4(0.),sjIrid=vec4(1.);float sjGem=0.,sjPattern=0.;vec2 sjCapUv=vec2(0.),sjIridUv=vec2(0.);
    ${q<2?`sjMix=texture2D(sjTex2,sjUv);
     vec3 sjViewN=(mat3(viewMatrix)*(sjN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.),sjViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
     vec3 sjT=normalize(cross(sjViewV,vec3(0.,1.,0.))),sjB=normalize(cross(sjViewV,sjT));
     sjCapUv=vec2(dot(sjViewN,sjT),dot(sjViewN,sjB))*.5+.5;sjCap=texture2D(sjMatcap,sjCapUv);sjCap.rgb=sjLinear(sjCap.rgb);
     sjGem=step(.1,sjMix.a)-step(.3,sjMix.a);
     sjPattern=texture2D(sjTex3,sjUv*12.).b*sjBase.a*smoothstep(.6,1.,sjNdV*sjNdV*sjNdV);
     sjIridUv=vec2(mix((sjNdV*3.+sjNoise.g*.5)*1.5+neoTime*.1,1.,sjGem),.5);
     sjIrid=texture2D(sjIridescenceLUT,sjIridUv);sjIrid.rgb=sjLinear(sjIrid.rgb);`:''}
    float sjInterface=step(.25,sjUv.y);
    vec3 sjAlbedo=sjBase.rgb*(1.-clamp(sjNormalTex.a+sjGem*${nums.gemMask},0.,1.));sjAlbedo*=1.-clamp(sjMix.a*.6,0.,1.)*sjInterface;
    diffuseColor=vec4(mix(sjAlbedo,sjIrid.rgb,sjPattern),opacity);
    vec3 sjSpec=mix(vec3(1.),${rgb(spec)}*${nums.spec},sjNormalTex.a);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(sjN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(sjMix.g*${f(intensity[1])},0.,1.);`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(sjMix.b*${f(intensity[2])},0.,1.);`)
   .replace('#include <emissivemap_fragment>',`
    float sjOneMinus=1.-sjNdV,sjF=clamp(${nums.fresnel}+(1.-${nums.fresnel})*sjOneMinus*sjOneMinus*sjOneMinus*sjOneMinus*sjOneMinus,0.,1.);
    float sjShadow=getShadowMask()*.5+.5;
    vec3 sjIridEmission=sjIrid.rgb*sjMix.a*sjInterface;
    vec3 sjEmission=sjF*${rgb(rim)}*${f(intensity[3])};
    sjEmission+=sjCap.rgb*sjNormalTex.a*1.2*sjMix.r;
    sjEmission+=sjBase.rgb*sjIridEmission*sjShadow*(sjNoise.r*.5+.5);
    sjEmission+=sjIrid.rgb*sjCap.a*sjMix.a*sjInterface*2.;
    sjEmission+=sjOneMinus*sjIridEmission*${nums.irid};
    sjEmission+=sjPattern*sjIrid.rgb*3.;
    vec3 sjHsv=sjHSV(sjBase.rgb);float sjHueOffset=(sjTangentV.x+sjTangentV.y)*.8*sjHsv.y*sjNoise.r+sjNoise.r*.4-.2;
    vec3 sjHueColor=sjRGB(vec3(fract(sjHsv.x+sjHueOffset),sjHsv.yz));
    vec3 sjGemHighlight=${rgb(gem)}*sjIrid.rgb*${nums.gem}+pow(sjCap.a,3.)*${nums.gemH};
    sjEmission+=sjHueColor*sjGemHighlight*sjGem+sjBase.rgb*sjMix.a*${nums.emissive}*(1.-sjInterface);
    totalEmissiveRadiance=sjEmission;
   `)
   .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=sjSpec;')
   .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=sjMix.r;');
  };
  warnings.push('silver_jade原颜色/宝石/虹彩/Matcap通道已接入；光照与阴影取当前场景，原盘形阴影及整场景对照未完成。');return u;
 }catch(e){for(const texture of owned)texture.dispose();warnings.push('silver_jade remains unsupported: '+e.message);return null;}
}
