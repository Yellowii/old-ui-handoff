import {ShaderChunk} from 'three';

// Original built_in/shading_models/isotropy.hlsl + common/lighting.hlsl.
// This replaces the direct BRDF only. Lights, shadow attenuation and indirect
// lighting still come from the current preview; source scene binding is pending.
export function sourceIsotropy(shader,{quality,smoothDiffuse,light=true,standardMaterial=false,isoSpecularColor=null}){
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
 void neoIsotropyDirect(const in IncidentLight il,const in vec3 pos,const in vec3 n,const in vec3 v,const in vec3 clearN,const in PhysicalMaterial mat,inout ReflectedLight outLight){
  float nl=clamp(dot(n,il.direction),0.,1.),nv=dot(v,n);
  float nva=clamp(abs(nv)+.000061035,0.,1.);
  float lv=dot(il.direction,v),ih=inversesqrt(2.+2.*lv);
  float nh=min(.9999,clamp((nl+nv)*ih,0.,1.)),vh=clamp(ih+ih*lv,0.,1.);
  float rough=mat.neoSourceRoughness,a=max(0.,rough)*max(0.,rough);
  float dfBase=1.-nl,df2=dfBase*dfBase,df5=df2*df2*dfBase;
  float df=${smoothDiffuse?'mix(1.,1.-df5,1.-rough*rough)*nl':'nl'};
  outLight.directDiffuse+=il.color*${quality===2?'mat.diffuseColor':'mat.diffuseContribution'}*df*.31831;
  ${quality<2?`float lambdaV=nl*(nva*(1.-a)+a),lambdaL=nva*(nl*(1.-a)+a);
  float vis=.5/max(lambdaV+lambdaL,1.175494351e-38),aa=a*a,d=(nh*aa-nh)*nh+1.;
  float ggx=aa/max(3.141592654*d*d,1.175494351e-38);
  float fcBase=1.-vh,fc2=fcBase*fcBase,fc=fc2*fc2*fcBase;
  vec3 spec=mat.specularColorBlended,fresnel=clamp(50.*spec.g,0.,1.)*fc+(1.-fc)*spec;
  outLight.directSpecular+=il.color*max(0.,vis*ggx*nl)*fresnel${isoSpecularColor?`*(${isoSpecularColor})`:''};`:''}
 }
 #undef RE_Direct
 #define RE_Direct neoIsotropyDirect
 `);
 // Keep raw source roughness separate from Three's geometric/minimum roughness,
 // which remains in its existing indirect preview path.
 // PhysicalMaterial is declared inside the stock chunk; extending its struct
 // requires expansion before Three recursively resolves the remaining includes.
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',
  ShaderChunk.lights_physical_pars_fragment.replace('struct PhysicalMaterial {','struct PhysicalMaterial {\n float neoSourceRoughness;'));
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',
  '#include <lights_physical_fragment>\nmaterial.neoSourceRoughness=roughnessFactor;');
 if(quality===2)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
  `reflectedLight.indirectSpecular=vec3(0.);\noutgoingLight=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse*1.5${standardMaterial?'+totalEmissiveRadiance':''};\n#include <opaque_fragment>`);
 if(!light)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
  `outgoingLight=${standardMaterial?'totalEmissiveRadiance':'diffuseColor.rgb'};\n#include <opaque_fragment>`);
}
