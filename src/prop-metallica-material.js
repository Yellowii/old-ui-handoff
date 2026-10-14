import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {previewShadowUniforms,bindPreviewShadow} from './scene-material-shadow.js';

// Original matcap_prop_metallica.hlsl; see material-candidates-t348 sources.
export async function configurePropMetallica(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),border=scalar(macros.ENABLE_BORDER,0);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_BORDER','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||[normal,light,border].some(x=>![0,1].includes(x))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active source permutation');
  // Raw matcap normal uses the authored TBN even at low rendering quality.
  if(normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const reflection=scalar(p.ReflectStrength,0),shadow=scalar(p.ShadowStrength,0);
  const probe= q<2&&reflection>0 ? await load('ReflectionProbeCustom',false) : null;
  if(q<2&&reflection>0&&(!probe?.isCubeTexture))throw Error('Original custom reflection probe path not connected');
  const colors=[0,1,2,3].map(i=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[0,0,0,1]][i]));
  const change=scalar(p.ChangeColorKey,0),emission=scalar(p.EmissiveIntensity,0),fresnelPower=scalar(p.FresnelPow,1),fresnelIntensity=scalar(p.FresnelIntensity,0);
  if(fresnelPower<=0)throw Error('Undefined source Fresnel power boundary');
  const borderColor=vector(p.BorderColor,[0,0,0,1]),borderScale=scalar(p.BorderScale,.03),borderIntensity=scalar(p.BorderIntensity,3);
  const keys=['Tex0','Tex1','Tex2',...(q<2?['Tex3']:[])],textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active 2D texture');
  const u={neoEmissionScale:{value:1},pmReflection:{value:probe},...previewShadowUniforms()};keys.forEach((k,i)=>u['pm'+k]={value:textures[i]});setup(m,normal===1);
  const reflectionSample=probe?`textureLod(pmReflection,reflect(-pmV,pmRawN),${f(scalar(p.reflectionMip,0))}).rgb*pmOrm.b`:'vec3(0.)';
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);bindPreviewShadow(s);
   s.fragmentShader=`uniform sampler2D pmTex0,pmTex1,pmTex2,pmTex3;uniform samplerCube pmReflection;uniform float neoEmissionScale;
    vec3 pmLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 pmMask=texture2D(pmTex2,t107Uv);pmMask.rgb=pmLinear(pmMask.rgb);
    vec3 pmColor=mix(pmLinear(${rgb(colors[0])}),pmLinear(${rgb(colors[1])}),pmMask.r);
    pmColor=mix(pmColor,pmLinear(${rgb(colors[2])}),pmMask.g);
    pmColor=mix(pmColor,pmLinear(${rgb(colors[3])}),pmMask.b);
    pmColor=mix(${rgb(colors[0])}*pmMask.rgb,pmColor,${f(change)});
    vec3 pmSample=texture2D(pmTex1,t107Uv).xyz*2.-1.;
    vec3 pmRawN=${normal?'mat3(t107T,t107B,t107N)*':''}normalize(pmSample);
    vec4 pmOrm=${q<2?'texture2D(pmTex3,t107Uv)':'vec4(1.,0.,0.,0.)'};
    vec3 pmN=${q<2&&normal&&light?'pmRawN':'t107N'};
    vec3 pmV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    // Same source left-handed view convention as the existing matcap adapter.
    vec3 pmViewN=(mat3(viewMatrix)*(pmRawN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 pmViewV=normalize(vViewPosition)*vec3(1.,1.,-1.);
    vec3 pmT=normalize(cross(pmViewV,vec3(0.,1.,0.))),pmB=normalize(cross(pmViewV,pmT));
    vec2 pmCapUv=vec2(dot(pmViewN,pmT),dot(pmViewN,pmB))*.5+.5;
    vec3 pmCap=pmLinear(texture2D(pmTex0,pmCapUv).rgb);
    vec3 pmAlbedo=pmColor*(1.-pmOrm.b);
    float pmNoV=clamp(1.-dot(pmN,pmV),0.,1.);
    vec3 pmReflect=${reflectionSample};
    vec3 pmDiffuse=(pmCap+pmReflect*${f(reflection)})*pmOrm.b*pmColor;
    pmDiffuse*=mix(1.,neoPreviewShadow(),${f(shadow)});
    vec3 pmEmission=pmDiffuse+pmAlbedo*pmOrm.a*${f(emission)}+pmAlbedo*pow(pmNoV,${f(fresnelPower)})*${f(fresnelIntensity)}*pmOrm.a;
    ${border?`pmEmission+=${rgb(borderColor)}*clamp(${f(borderScale)}+(1.-${f(borderScale)})*pow(pmNoV,5.),0.,1.)*${f(borderIntensity)};`:''}
    diffuseColor=vec4(pmAlbedo,pmMask.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(pmN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=pmOrm.g;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=pmOrm.b;')
    .replace('#include <lights_physical_fragment>',sourceSpecular('0.',sourceGrazing))
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=pmEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=pmOrm.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),pmOrm.r,material.roughness);
     #endif`);
   sourceIsotropy(s,{quality:q,smoothDiffuse:false,light:light===1,standardMaterial:true});
  };
  warnings.push(probe
    ? 'prop-metallica: source matcap/color/normal/shadow/custom reflection channels connected'
    : 'prop-metallica: source matcap/color/normal/shadow channels connected; custom reflection probe remains gated');
  return u;
 }catch(e){warnings.push('prop-metallica remains unsupported: '+e.message);return null;}
}
