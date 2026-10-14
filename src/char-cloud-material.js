import {BackSide,FrontSide} from 'three';
import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';

// standard_char_cloud's authored layer1/lit draws share the same program.
export async function configureCharCloud(m,p,macros,load,o={},warnings=[]){
 try{
  const {q,normal,change,light}=flags(macros,{sourceTangents:true}),n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d);
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body inputs not connected');
  const tangentNeeded=q<2&&normal===1&&light===1;
  if(tangentNeeded&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const maskPow=n('maskPow',1),fPow=n('frenelPow',1),yPow=n('yinCangPow',1),wingPow=n('wingPow',1.5);
  const fMin=n('frenelSSMin'),fMax=n('frenelSSMax',1),yMin=n('yinCangSSMin'),yMax=n('yinCangSSMax',1);
  if([maskPow,fPow,yPow,wingPow].some(x=>x<=0)||fMin===fMax||yMin===yMax)throw Error('Undefined source power/smoothstep boundary');
  const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]);
  const textures=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Five original cloud 2D textures/defaults required');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['clTex'+i]={value:t});setup(m,tangentNeeded);
  m.side=o.cloudFront===true?FrontSide:BackSide;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tangentNeeded);
   const offsetUv=`uv*vec2(${f(n('offsetTexTilingX',1))},${f(n('offsetTexTilingY',1))})+neoTime*vec2(${f(n('offsetTexSpeedX'))},${f(n('offsetTexSpeedY'))})`;
   s.vertexShader='uniform sampler2D clTex3;uniform float neoTime;\n'+s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
    float clOffset=texture2D(clTex3,${offsetUv}).r*${f(n('offsetTexMult',1))}*pow(abs(sin(uv.y*3.1416)),${f(maskPow)});
    float clVertexMask=texture2D(clTex3,uv).g;clOffset*=clVertexMask*clVertexMask*clVertexMask;
    transformed+=objectNormal*clOffset;
   `);
   s.fragmentShader=`uniform sampler2D clTex0,clTex1,clTex2,clTex3,clTex4;uniform float neoTime,neoEmissionScale;
    float clSmooth(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 clBase=texture2D(clTex0,t107Uv),clNormal=texture2D(clTex1,t107Uv),clMix=texture2D(clTex2,t107Uv);
    vec3 clView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float clNV=abs(dot(t107N,clView));
    float clF=clSmooth(${f(fMin)},${f(fMax)},pow(clNV,${f(fPow)}));
    float clWingF=clSmooth(${f(fMin)},${f(fMax)},pow(clNV,${f(wingPow)}));
    float clHidden=clSmooth(${f(yMin)},${f(yMax)},pow(clNV,${f(yPow)}));
    float clWingMask=texture2D(clTex3,t107Uv).b;
    vec2 clStarUv=t107Uv*${f(n('DotScale',2.5))}+clView.xy*.1;
    vec4 clStar1=texture2D(clTex4,clStarUv),clStar2=texture2D(clTex4,t107Uv*${f(n('DotScale',2.5))}+neoTime*.005);
    vec3 clStars=clStar1.rgb*clStar2.a*clStar1.a*2000.;
    vec3 clColor=${change?'vec3(dot(clBase.rgb,vec3(.2125,.7154,.0721)))':'clBase.rgb'}*${rgb(base)};
    diffuseColor.rgb=${q===2?'clColor*clColor':'pow(max(clColor,vec3(0.)),vec3(2.2))'}*${f(n('TintValue',1))};
    diffuseColor.a=mix(clWingF,clF,clWingMask)*${f(base[3])}*opacity;
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>',`
    vec3 clN=t107N;
    ${q<2&&normal&&light?`vec3 clLocal=clNormal.xyz*2.-1.;clLocal.xy*=${f(intensity[0])};clN=mat3(t107T,t107B,t107N)*normalize(clLocal);`:''}
    normal=normalize(mat3(viewMatrix)*(clN*vec3(-1.,1.,1.)));
   `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':`clamp(clMix.g*${f(intensity[1])},0.,1.)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`clamp(clMix.b*${f(intensity[2])},0.,1.)`};`)
   .replace('#include <emissivemap_fragment>',`
    float clRim=1.-dot(clN,clView);clRim=clamp(${f(n('FresnelScale'))}+(1.-${f(n('FresnelScale'))})*clRim*clRim*clRim*clRim*clRim,0.,1.);
    totalEmissiveRadiance=(clRim*${rgb(v('RimColor',[0,0,0,0]))}*${f(intensity[3])}
      +clMix.a*${rgb(v('EmissiveColor',[1,1,1,1]))}*${f(n('EmissiveValue',1))}
      +(1.-clHidden)*${rgb(v('yinCangColor',[0,0,0,1]))}*2.+clStars)*neoEmissionScale;
   `).replace('#include <aomap_fragment>',q===2?'':`
    reflectedLight.indirectDiffuse*=clMix.r;
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),clMix.r,material.roughness);
    #endif
   `);
  };return u;
 }catch(e){warnings.push('Character cloud remains unsupported: '+e.message);return null;}
}
