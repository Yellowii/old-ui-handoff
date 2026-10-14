import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// wpjs_glass + built_in/shading_models/glass.hlsl. Authored cube uses raw
// source orientation/mips, without PMREM or off-specular peak correction.
export async function configureWpjsGlass(m,p,macros,load,warnings){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),light=scalar(macros.LIGHT_ENABLE,1),env=scalar(macros.ENV_CUSTOM,1),high=q<2;
  if(![0,1,2].includes(q)||![0,1].includes(light)||env!==1)throw Error('Unsupported glass light/environment permutation');
  const known=new Set(['RENDER_QUALITY','LIGHT_ENABLE','ENV_CUSTOM','NORMAL_MAP_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented glass deformation/macro');
  if(['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>vector(p[k],[0,0,0]).some(x=>x!==0)))throw Error('Active source soft body unresolved');
  const I=vector(p.Intensity,[1,.2,.8,.85]),base=vector(p.BaseColor,[1,1,1,1]);
  if(I.slice(1).some(x=>x<0||x>1))throw Error('Out-of-range glass parameters');
  const tex=await load('Tex0',false),cube=high&&light?await load('ReflectionProbeCustom',false):null;
  if(!tex?.isTexture||tex.isCubeTexture)throw Error('Original Tex0 required');
  if(high&&light&&!cube?.isCubeTexture)throw Error('Original custom cube required');
  const u={wgTex:{value:tex},wgCube:{value:cube}};setup(m,false);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   s.fragmentShader=`uniform sampler2D wgTex;uniform samplerCube wgCube;
    vec3 wgEnvBRDF(vec3 spec,float rough,float nv){
     vec4 r=rough*vec4(-1.,-.0275,-.572,.022)+vec4(1.,.0425,1.04,-.04);
     float a=min(r.x*r.x,exp2(-9.28*nv))*r.x+r.y;
     vec2 ab=vec2(-1.04,1.04)*a+r.zw;return spec*ab.x+ab.y;
    }
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
    void wgDirect(const in IncidentLight il,const in vec3 pos,const in vec3 n,const in vec3 v,const in vec3 clearN,const in PhysicalMaterial mat,inout ReflectedLight outLight){
     float nl=max(dot(n,il.direction),0.),nv=dot(v,n),nva=clamp(abs(nv)+.00006103515625,0.,1.);
     float lv=dot(il.direction,v),ih=inversesqrt(2.+2.*lv);
     float nh=min(.9999,clamp((nl+nv)*ih,0.,1.)),vh=clamp(ih+ih*lv,0.,1.);
     float a=mat.roughness*mat.roughness,lambdaV=nl*(nva*(1.-a)+a),lambdaL=nva*(nl*(1.-a)+a);
     float vis=.5/max(lambdaV+lambdaL,1.17549435e-38),aa=a*a,d=(nh*aa-nh)*nh+1.;
     float ggx=aa/max(3.14159265359*d*d,1.17549435e-38),fc=pow(1.-vh,5.);
     vec3 fresnel=clamp(50.*mat.specularColor.g,0.,1.)*fc+(1.-fc)*mat.specularColor;
     outLight.directDiffuse+=il.color*nl*mat.diffuseColor*.31830988618;
     ${high?'outLight.directSpecular+=il.color*max(0.,vis*ggx*nl)*fresnel;':''}
    }
    #undef RE_Direct
    #define RE_Direct wgDirect
   `);
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 wg0=texture2D(wgTex,t107Uv);
    vec3 wgAlbedo=${high?'pow(wg0.rgb,vec3(2.2))':'wg0.rgb*wg0.rgb'}*${rgb(base)};
    float wgStep=step(.5,wg0.a),wgRough=mix(${f(I[1])},1.,wgStep),wgMetal=mix(${f(I[2])},0.,wgStep);
    vec3 wgSpec=mix(vec3(.04),wgAlbedo,wgMetal);
    vec3 wgV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 wgDirection=reflect(-wgV,t107N),wgEnvironment=vec3(0.);
    ${high&&light?'wgEnvironment=wgEnvBRDF(wgSpec,wgRough,dot(wgV,t107N))*textureLod(wgCube,wgDirection,wgRough*6.).rgb*5.;':''}
    diffuseColor=vec4(wgAlbedo,wg0.a*${f(I[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=wgRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=wgMetal;')
    .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
     material.roughness=wgRough;material.specularColor=wgSpec;material.diffuseColor=${high?'wgAlbedo*(1.-wgMetal)':'wgAlbedo'};`)
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=vec3(0.);')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectSpecular=wgEnvironment;${high?'':'reflectedLight.indirectDiffuse*=1.5;'}`);
   if(!light)s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=wgAlbedo;\n#include <opaque_fragment>');
  };
  return u;
 }catch(error){warnings.push('wpjs_glass remains unsupported: '+error.message);return null;}
}
