import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';

// standard_xy_star adds its masked stars BEFORE gamma conversion of albedo.
// This differs from the cloud shader's linear emissive stars.
export async function configureXyStar(m,p,macros,load,o={},warnings=[]){
 try{
  const {q,normal,change,light}=flags(macros,{sourceTangents:true}),n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d);
  const hasNormal=q<2&&normal===1&&light===1,star=n('ViewStarMult');
  if(hasNormal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body inputs not connected');
  const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]),keys=[0,2,...(hasNormal?[1]:[]),...(star!==0?[3,4]:[])];
  const textures=await Promise.all(keys.map(i=>load('Tex'+i,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original active XY-star 2D textures required');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['xsTex'+keys[i]]={value:t});setup(m,hasNormal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,hasNormal);
   s.fragmentShader='uniform sampler2D xsTex0,xsTex1,xsTex2,xsTex3,xsTex4;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 xsBase=texture2D(xsTex0,t107Uv),xsMix=texture2D(xsTex2,t107Uv);
    vec3 xsView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec2 xsStarUv=t107Uv*${f(n('DotScale',2.5))}+xsView.xy*.04;
    vec2 xsFlowUv=t107Uv*${f(n('DotScale',2.5))}+neoTime*vec2(.003,.002);
    vec3 xsStar=vec3(0.);
    ${star!==0?`vec4 xsS1=texture2D(xsTex3,xsStarUv),xsS2=texture2D(xsTex3,xsFlowUv);xsStar=xsS1.rgb*xsS2.a*xsS1.a*texture2D(xsTex4,t107Uv).r;`:''}
    vec3 xsColor=${change?'vec3(dot(xsBase.rgb,vec3(.2125,.7154,.0721)))':'xsBase.rgb'}*${rgb(base)}+xsStar*${f((change?3500:5000)*star)};
    diffuseColor.rgb=${q===2?'xsColor*xsColor':'pow(max(xsColor,vec3(0.)),vec3(2.2))'}*${f(n('TintValue',1))};
    diffuseColor.a=xsBase.a*${f(base[3])}*opacity;
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>',`
    vec3 xsN=t107N;
    ${hasNormal?`vec3 xsLocal=texture2D(xsTex1,t107Uv).xyz*2.-1.;xsLocal.xy*=${f(intensity[0])};xsN=mat3(t107T,t107B,t107N)*normalize(xsLocal);`:''}
    normal=normalize(mat3(viewMatrix)*(xsN*vec3(-1.,1.,1.)));
   `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':`clamp(xsMix.g*${f(intensity[1])},0.,1.)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`clamp(xsMix.b*${f(intensity[2])},0.,1.)`};`)
   .replace('#include <emissivemap_fragment>',`
    float xsRim=1.-dot(xsN,xsView);xsRim=clamp(${f(n('FresnelScale'))}+(1.-${f(n('FresnelScale'))})*xsRim*xsRim*xsRim*xsRim*xsRim,0.,1.);
    totalEmissiveRadiance=(xsRim*${rgb(v('RimColor',[0,0,0,0]))}*${f(intensity[3])}+xsMix.a*${rgb(v('EmissiveColor',[1,1,1,1]))}*${f(n('EmissiveValue',1))})*neoEmissionScale;
   `).replace('#include <aomap_fragment>',q===2?'':`
    reflectedLight.indirectDiffuse*=xsMix.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),xsMix.r,material.roughness);
    #endif
   `);
  };return u;
 }catch(e){warnings.push('XY star remains unsupported: '+e.message);return null;}
}
