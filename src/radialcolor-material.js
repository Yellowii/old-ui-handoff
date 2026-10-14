import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Source standard_common_radialcolor, authored CHANGE_RADIAL=0 permutation.
export async function configureRadialColor(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','USE_LOCAL_PARAMATER','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||[normal,light].some(v=>![0,1].includes(v))||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented radial/bounds/vertex permutation');
  const on=q<2&&normal===1&&light===1;
  if(on&&!o.sourceTangents)throw Error('Original tangents required');
  const I=vector(p.Intensity,[1,1,1,0]),C=Array.from({length:4},(_,i)=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]][i]));
  const num=(k,d)=>f(scalar(p[k],d)),power=scalar(p.LerpPower,1);
  if(power<=0)throw Error('Undefined zero/negative Fresnel power boundary');
  const maps=await Promise.all(['Tex0','Tex1','Tex2'].map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original radialcolor texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};maps.forEach((t,i)=>u['rcTex'+i]={value:t});setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   s.fragmentShader=`uniform sampler2D rcTex0,rcTex1,rcTex2;uniform float neoTime,neoEmissionScale;vec3 rcLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 rc0=texture2D(rcTex0,t107Uv),rc1=texture2D(rcTex1,t107Uv),rc2=texture2D(rcTex2,t107Uv);
    vec3 rcChanged=rc0.r*${rgb(C[0])}+rc0.g*${rgb(C[1])}+rc0.b*${rgb(C[2])}+rc0.a*${rgb(C[3])};
    rc0.rgb=mix(rc0.rgb,rcChanged,${num('ChangeColorKey',0)});
    vec3 rcV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float rcMask=clamp(pow(1.-dot(t107N,rcV),${f(power)}),0.,1.);
    vec3 rcMaskColor=rcLinear(${rgb(C[2])})*dot(rc0.rgb,vec3(.3,.59,.11))*${num('MaskColor3Mult',1)};
    rcMaskColor=mix(rcLinear(rc0.rgb),rcMaskColor,${num('MaskChangeColorSwitch',0)});
    vec3 rcGradient=rcLinear(mix(${rgb(C[0])},${rgb(C[1])},rcMask));
    vec3 rcAlbedo=(rcGradient*rc0.a+rcMaskColor*(1.-rc0.a))*${num('TintValue',1)};
    vec3 rcEmission=rcLinear(${rgb(vector(p.EmissiveColor,[0,0,0,0]))})*rc2.a*${f(I[3])}*(1.-rcMask);
    rcEmission+=rcGradient*(1.-rcMask)*rc0.a*abs(sin(neoTime*${num('BreathSpeed',1)}))*${num('BreathIntensity',1)};
    vec3 rcN=t107N;
    ${on?`vec3 rcDecoded=rc1.xyz*2.-1.;rcDecoded.xy*=${f(I[0])};rcN=mat3(t107T,t107B,t107N)*normalize(rcDecoded);`:''}
    float rcRough=${q===2?'.5':`mix(${f(I[1])},clamp(rc2.g*${f(I[1])},0.,1.),${num('UGCKey_R',1)})`};
    float rcMetal=${q===2?'0.':`mix(${f(I[2])},clamp(rc2.b*${f(I[2])},0.,1.),${num('UGCKey_M',1)})`};
    float rcAo=${q===2?'1.':'rc2.r'};
    diffuseColor=vec4(rcAlbedo,rc1.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(rcN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=rcRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=rcMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=rcEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=rcAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),rcAo,material.roughness);
     #endif`);
  };return u;
 }catch(e){warnings.push('Radialcolor remains unsupported: '+e.message);return null;}
}
