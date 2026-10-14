import {sourceSpecular,sourceGrazing} from './source-specular.js';
import {sourceIsotropy} from './source-isotropy.js';
import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';

// standard_char_ice's two parallax layers and unusual encoded-normal blend.
// This is distinct from standard_common_ice and does not use its snow mask.
export async function configureCharIce(m,p,macros,load,o={},warnings=[]){
 try{
  const {q,normal,change,light}=flags(macros,o),n=(k,d)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d);
  if(['USE_SKIN_LUT','USE_ANISOTROPIC_SPECULAR','USE_SPECULAR_COLOR'].some(k=>scalar(macros[k],0)!==0))throw Error('Original alternate direct lighting branch not connected');
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body inputs not connected');
  const depth=v('DepthPara',[1,0,0,1]),detail=v('DepthPara2',[1,1,0,.5]),layers=v('DepthPara3',[1,1,.5,.3]),intensity=v('Intensity',[1,1,1,0]);
  if([depth[3],detail[0],layers[0],layers[1]].some(x=>x<=0))throw Error('Nonpositive source power boundary unverified');
  const colors=Object.fromEntries(['BaseColor','RimColor','iceColor','baseColor1','baseColor2'].map(k=>[k,v(k,k==='RimColor'?[0,0,0,0]:[1,1,1,1])]));
  const textures=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Five original 2D ice textures required');
  const u={neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['icTex'+i]={value:t});setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader='uniform sampler2D icTex0,icTex1,icTex2,icTex3,icTex4;uniform float neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 icBase=texture2D(icTex0,t107Uv),icDetail=texture2D(icTex1,t107Uv*${f(detail[1])}),icNormal=texture2D(icTex3,t107Uv),icMix=texture2D(icTex4,t107Uv);
    icDetail.rgb=mix(icDetail.rgb,vec3(0.,0.,1.),${f(layers[2])});
    vec3 icA=vec3(icNormal.xy,icNormal.z+1.),icB=vec3(icDetail.xy-vec2(1.),icDetail.z);
    vec3 icFinal=mix(icNormal.xyz,dot(icA,icB)*icA-icB*(icNormal.z+1.),${f(n('ifDetailN',1))});
    vec3 icView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    mat3 icTbn=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 icTV=vec3(dot(icTbn[0],icView),dot(icTbn[1],icView),dot(icTbn[2],icView));
    vec2 icUV1=t107Uv*${f(depth[0])}-${f(depth[1])}*icTV.xy,icUV2=t107Uv*${f(depth[0])}-${f(depth[2])}*icTV.xy;
    float icLayer1=texture2D(icTex2,icUV1).r,icLayer2=texture2D(icTex2,icUV2).g;
    float icLayer=pow(icLayer1,${f(layers[0])})*${f(layers[3])}+pow(icLayer2,${f(layers[1])});
    float icNV=dot(t107N,icView),icF=pow(1.-clamp(icNV,0.,1.),${f(depth[3])}),icF2=clamp(pow(1.-clamp(icNV,0.,1.),${f(detail[0])}),0.,.7);
    vec3 icColor1=mix(vec3(icLayer),${rgb(colors.iceColor)},icF);
    vec3 icColor2=mix(mix(${rgb(colors.baseColor1)},${rgb(colors.baseColor2)},icF2)*icBase.rgb,icBase.rgb,icNormal.a);
    vec3 icColor=icColor1+icColor2;
    vec3 icAlbedo=${change?'vec3(dot(icColor,vec3(.2125,.7154,.0721)))':'icColor'}*${rgb(colors.BaseColor)};
    diffuseColor.rgb=${q===2?'icAlbedo*icAlbedo':'pow(max(icAlbedo,vec3(0.)),vec3(2.2))'}*${f(n('TintValue',1))}${change?'':`*(1.+icNormal.a*${f(n('iceColorAdd',.7))})`};
    diffuseColor.a=icBase.a*${f(colors.BaseColor[3])}*opacity;
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>',`
    vec3 icN=t107N;
    ${q<2&&normal&&light?`vec3 icLocal=icFinal*2.-1.;icLocal.xy*=${f(intensity[0])};icN=icTbn*normalize(icLocal);`:''}
    normal=normalize(mat3(viewMatrix)*(icN*vec3(-1.,1.,1.)));
   `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':`clamp(mix(${f(intensity[1])},icMix.g,icNormal.a),0.,1.)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`clamp(mix(${f(intensity[2])},icMix.b,icNormal.a),0.,1.)`};`)
   .replace('#include <emissivemap_fragment>',`
    float icRim=1.-dot(icN,icView);icRim=clamp(${f(n('FresnelScale',0))}+(1.-${f(n('FresnelScale',0))})*icRim*icRim*icRim*icRim*icRim,0.,1.);
    totalEmissiveRadiance=(icRim*${rgb(colors.RimColor)}*${f(intensity[3])}+icColor*${f(detail[2])})*neoEmissionScale;
   `).replace('#include <aomap_fragment>','')
   // GetSpecularFromMaterial uses the authored signed scalar without clamping.
   .replace('#include <lights_physical_fragment>',sourceSpecular(f(detail[3]),sourceGrazing));
   sourceIsotropy(s,{quality:q,smoothDiffuse:true,light:light===1});
  };
  return u;
 }catch(e){warnings.push('Character ice remains unsupported: '+e.message);return null;}
}
