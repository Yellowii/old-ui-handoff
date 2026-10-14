import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';

// Original Surface draws layer1 (back faces), then lit (front faces).
export async function configureHelmet(m,p,macros,load,o={},warnings=[]){
 try{
  const {q,normal,change,light}=flags(macros,{sourceTangents:true}),back=!o.helmetFront,n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d);
  if(normal&&!o.sourceTangents)throw Error('Missing original helmet tangent basis, including low-quality MatCap');
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body inputs not connected');
  const prefix=back?'b_':'f_',min=n(prefix+'frenelSSMin'),max=n(prefix+'frenelSSMax',1),power=n(back?'b_alphaPow':'alphaPow',1);
  if(min===max||power<=0)throw Error('Undefined helmet alpha boundary');
  const keys=['Tex0','Tex1','Tex2','Tex4',...(back?[]:['Tex3'])],textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original helmet 2D textures required');
  const u={neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['he'+keys[i]]={value:t});setup(m,!!normal);m.side=back?1:0;
  const base=v('BaseColor',[1,1,1,1]),intensity=v('Intensity',[1,1,1,0]);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,!!normal);
   s.fragmentShader=`uniform sampler2D heTex0,heTex1,heTex2,heTex3,heTex4;uniform float neoEmissionScale;
    vec3 heLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 he0=texture2D(heTex0,t107Uv),he1=texture2D(heTex1,t107Uv),he2=texture2D(heTex2,t107Uv);
    vec3 heLocal=he1.xyz*2.-1.;heLocal.xy*=${f(intensity[0])};
    vec3 heCapN=${normal?'mat3(t107T,t107B,t107N)*normalize(heLocal)':'t107N'};
    vec3 heN=${q<2&&light&&normal?'heCapN':'t107N'};
    vec3 heViewN=(mat3(viewMatrix)*(heCapN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
    vec3 heViewV=vViewPosition*vec3(1.,1.,-1.);
    vec3 heT=normalize(cross(heViewV,vec3(0.,1.,0.))),heB=normalize(cross(heViewV,heT));
    vec2 heUv=vec2(dot(heViewN,heT),dot(heViewN,heB))*.5+.5;
    vec4 he4=texture2D(heTex4,heUv),he3=${back?'vec4(0.)':'texture2D(heTex3,heUv)'};
    float heX=clamp((${back?`pow(he4.a,${f(power)})`:'he4.a'}-${f(min)})/${f(max-min)},0.,1.);
    float heF=heX*heX*(3.-2.*heX);
    vec3 heAlbedo=${change?`heLinear(vec3(dot(he0.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)})*${f(n('TintValue',1))}`:back?`heLinear(he4.rgb)*${f(n('TintValue',1))}`:`heLinear(he3.rgb)+heLinear(${rgb(base)})*${f(n('addColorMult',1))}*clamp(heF+${f(n('f_frenelSSBaseAdd'))},0.,1.)`};
    float heAlpha=${back?`${f(n('backAlpha',1))}*clamp(heF+${f(n('b_frenelSSBaseAdd'))},0.,1.)`:`clamp(pow(he3.a,${f(power)})*${f(base[3]*n('alphaMult',1))},0.,1.)`};
    diffuseColor=vec4(heAlbedo,heAlpha*opacity);
   `).replace('#include <color_fragment>','')
   .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(heN*vec3(-1.,1.,1.)));')
   .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'.5':`clamp(he2.g*${f(intensity[1])},0.,1.)`};`)
   .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`clamp(he2.b*${f(intensity[2])},0.,1.)`};`)
   .replace('#include <emissivemap_fragment>',`
    vec3 heV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    float heRim=1.-dot(heN,heV);heRim=clamp(${f(n('FresnelScale'))}+(1.-${f(n('FresnelScale'))})*heRim*heRim*heRim*heRim*heRim,0.,1.);
    totalEmissiveRadiance=(heRim*${rgb(v('RimColor',[0,0,0,0]))}*${f(intensity[3])}+he2.a*${rgb(v('EmissiveColor',[1,1,1,1]))}*${f(n('EmissiveValue',1))})*neoEmissionScale;
   `).replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=${q===2?'1.':'he2.r'};
    #if defined(USE_ENVMAP) && defined(STANDARD)
    reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),${q===2?'1.':'he2.r'},material.roughness);
    #endif`);
  };return u;
 }catch(e){warnings.push('Helmet remains unsupported: '+e.message);return null;}
}
