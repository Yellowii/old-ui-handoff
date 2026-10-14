import {sourceSpecular} from './source-specular.js';
import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';

export async function configureLantern(m,p,macros,load,o={},warnings=[]){
 try{
  const {q,normal,change}=flags(macros,{sourceTangents:true}),n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d),high=q<2,hasTbn=high&&normal===1;
  if(hasTbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body inputs not connected');
  const maskPow=n('InnerMaskPow',1),breathing=n('InnerEmiBreathing',.25),fb=n('FB',.3);
  if(maskPow-Math.abs(breathing)<=0||fb<=0)throw Error('Nonpositive source exponent boundary unverified');
  const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]),keys=high?['Tex0','Tex1','Tex2','MatCap']:['Tex0'];
  const textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original active lantern 2D textures required');
  const u={neoTime:{value:0},neoEmissionScale:{value:1},neoFaceOffset:{value:n('FaceUVOffset')}};textures.forEach((t,i)=>u['la'+keys[i]]={value:t});setup(m,hasTbn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,hasTbn);
   s.fragmentShader=`uniform sampler2D laTex0,laTex1,laTex2,laMatCap;uniform float neoTime,neoEmissionScale,neoFaceOffset;
    vec3 laLinear(vec3 x){return ${high?'pow(max(x,vec3(0.)),vec3(2.2))':'x*x'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 laUv=t107Uv;if(laUv.y<.25)laUv.x+=neoFaceOffset*${f(n('CharOffset'))};
    vec4 laBase=texture2D(laTex0,laUv);laBase.rgb=laLinear(laBase.rgb);
    vec4 laMix=vec4(1.,1.,0.,0.),laCap=vec4(0.);
    vec3 laView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 laN=t107N,laCamera=vec3(0.);vec2 laCapUv=vec2(0.);
    ${high?`
     laMix=texture2D(laTex2,laUv);laCamera=laView;
     vec3 laLocal=texture2D(laTex1,laUv).xyz*2.-1.;laLocal.xy*=${f(intensity[0])};
     laN=${hasTbn?'mat3(t107T,t107B,t107N)*normalize(laLocal)':'normalize(laLocal)'};
     laCapUv=(mat3(viewMatrix)*(laN*vec3(-1.,1.,1.))).xy*.5+.5;laCapUv.y*=-1.;
     laCap=texture2D(laMatCap,laCapUv);laCap.rgb=laLinear(laCap.rgb);laCap.a=texture2D(laMatCap,laUv).a;
    `:''}
    diffuseColor.rgb=${change?`laLinear(vec3(dot(laBase.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)})*${f(n('TintValue',1))}`:`laBase.rgb*${rgb(base)}*${f(n('TintValue',1)*n('BaseColInten',1))}`};
    diffuseColor.a=laBase.a*opacity;
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(laN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;')
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(laMix.b*${f(intensity[2])},0.,1.);`)
   .replace('#include <emissivemap_fragment>',`
    float laRim=1.-dot(laN,laView);laRim=clamp(${f(n('FresnelScale'))}+(1.-${f(n('FresnelScale'))})*laRim*laRim*laRim*laRim*laRim,0.,1.);
    float laF=clamp(pow(clamp(${f(n('FA',.8))}-dot(laN,laCamera),0.,1.),${f(fb)}),0.,1.);
    float laPower=${f(maskPow)}+sin(neoTime*2.)*${f(breathing)};
    vec3 laInner=${rgb(v('InnerEmisColor',[1,1,1,1]))};
    totalEmissiveRadiance=(laRim*${rgb(v('RimColor',[0,0,0,0]))}*${f(intensity[3])}
     +laF*${rgb(v('FrenelColor',[1,1,1,1]))}*${f(n('FrenelEmiStr'))}
     +pow(laCap.r,laPower)*laInner*${f(n('InnerEmiStr'))}*laCap.a
     +laMix.a*laInner*${f(n('AddEmiStr'))}*laCap.a)*neoEmissionScale;
   `).replace('#include <aomap_fragment>','')
   .replace('#include <lights_physical_fragment>',sourceSpecular('1.'));
  };return u;
 }catch(e){warnings.push('Lantern remains unsupported: '+e.message);return null;}
}
