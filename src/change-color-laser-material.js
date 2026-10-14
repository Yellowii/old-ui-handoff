import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// APK standard_change_color_laser.hlsl, bac06f0e... . Keep the authored
// pow expression, including exponent zero; do not replace it with a clamp.
export async function configureChangeColorLaser(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),border=scalar(macros.ENABLE_BORDER,0);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','ENABLE_BORDER','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||[normal,border].some(v=>![0,1].includes(v))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented tiling/Scale9 or unknown permutation');
  if(normal&&!o.sourceTangents)throw Error('Original tangents required at every quality');
  const I=vector(p.Intensity,[1,1,1,0]),EI=vector(p.EmissiveIntensity,[0,0,0,0]);
  const colors=[0,1,2,3].map(i=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]][i]));
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d)=>rgb(vector(p[k],d));
  if(scalar(p.FresnelPow,4)<0)throw Error('Negative Fresnel exponent boundary unverified');
  const keys=['Tex0','Tex1',...(q<2?['Tex2']:[]),'Tex3'],maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original active texture');
  const u={neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['ccl'+k]={value:maps[i]});setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.fragmentShader=`uniform sampler2D cclTex0,cclTex1,cclTex2,cclTex3;uniform float neoEmissionScale;
    vec3 cclLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 cclMaskUv=t107Uv*${num('RepeatScale',1)};
    vec4 cclMask=texture2D(cclTex0,cclMaskUv),cclN=texture2D(cclTex1,t107Uv),cclOrm=${q<2?'texture2D(cclTex2,t107Uv)':'vec4(0.)'};
    vec3 cclColor=clamp(${colors.map((v,i)=>`cclMask.${'rgba'[i]}*${rgb(v)}`).join('+')},0.,1.);
    vec3 cclRawEmission=${colors.map((v,i)=>`cclMask.${'rgba'[i]}*${rgb(v)}*${f(EI[i])}`).join('+')};
    vec3 cclNrm=${normal?'mat3(t107T,t107B,t107N)*normalize(cclN.xyz*2.-1.)':'normalize(t107N)'};
    vec3 cclV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float cclNoV=clamp(dot(cclNrm,cclV),0.,1.);cclNoV=1.-min(1.-cclNoV,cclNoV)*2.;
    vec2 cclLaserUv=vec2(cclNoV*${num('LaserScale',1)},0.);
    vec3 cclLaser=cclLinear(texture2D(cclTex3,cclLaserUv).rgb);
    vec3 cclBase=mix(cclColor,cclLaser,cclN.a*${num('LaserTransition',.5)})${q===2?'+cclOrm.a*cclRawEmission':''};
    float cclF=clamp(pow(1.-dot(cclNrm,cclV),${num('FresnelPow',4)}),0.,1.);
    vec3 cclEmission=cclOrm.a*(cclRawEmission+cclF*${num('FresnelIntensity',0)}*cclColor);
    ${border?`float cclBorder=clamp(${num('BorderScale',.03)}+(1.-${num('BorderScale',.03)})*pow(1.-dot(cclNrm,cclV),5.),0.,1.);cclEmission+=cclBorder*${col('BorderColor',[1,.8,.3,1])}*${num('BorderIntensity',3)};`:''}
    float cclRough=${q===2?'.5':`clamp(cclOrm.g*${f(I[1])},0.,1.)`},cclMetal=${q===2?'0.':`clamp(cclOrm.b*${f(I[2])},0.,1.)`},cclAo=${q===2?'1.':'cclOrm.r'};
    diffuseColor=vec4(cclBase,cclN.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cclNrm*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=cclRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=cclMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cclEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cclAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cclAo,material.roughness);
     #endif`);
  };return u;
 }catch(e){warnings.push('ChangeColorLaser remains unsupported: '+e.message);return null;}
}
