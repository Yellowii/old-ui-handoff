import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

export async function configureT145(m,p,macros,load,warnings,o={},family){
 try{
  const j=family==='jgyj',q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),border=scalar(macros.ENABLE_BORDER,0),uv1=!j&&scalar(macros.TEXCOORD1_ENABLE,1)===1;
  if(![0,1,2].includes(q)||[normal,light,change,border,scalar(macros.TEXCOORD1_ENABLE,j?0:1)].some(v=>![0,1].includes(v)))throw Error('Unknown source macro');
  const tbn=normal===1&&(j||(q<2&&light===1));
  if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(uv1&&!o.sourceSecondUv)throw Error('Missing original UV1');
  for(const k of ['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING','LIGHT_MAP_ENABLE','USE_TEXCOORD1'])if(scalar(macros[k],0)!==0)throw Error('Unsupported active '+k);
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(v=>v!==0))throw Error('Active soft-body unresolved');
  if(!j&&(scalar(p.Slider,.05)<=0||scalar(p.MSKRange,.3)<=0))throw Error('Undefined source smoothstep range');
  const n=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,j?0:1]);
  const u={neoTime:{value:0}};
  for(const k of (j?['Tex0','Tex1','Tex2','Tex3']:['Tex0','Tex1','Tex2'])){const t=await load(k,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing source '+k);u['b145'+k]={value:t};}
  setup(m,tbn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,tbn);
   if(!j){
    s.vertexShader=`${uv1?'attribute vec2 uv1;':''}varying float b145W;varying vec3 b145World;\n`+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nb145W=${uv1?'uv1.y':'0.'};`).replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nb145World=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);');
    s.fragmentShader='varying float b145W;varying vec3 b145World;\n'+s.fragmentShader;
   }
   s.fragmentShader=`uniform sampler2D b145Tex0,b145Tex1,b145Tex2,b145Tex3;uniform float neoTime;vec3 b145Linear(vec3 c){return ${q<2?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}\n`+s.fragmentShader;
   let body=`vec2 b145Uv=t107Uv;${j?'':`b145Uv.x+=b145Uv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',1)}:0.;`}
    vec4 b145Base=texture2D(b145Tex0,b145Uv),b145NormalMap=texture2D(b145Tex1,b145Uv),b145Orm=texture2D(b145Tex2,b145Uv);
    vec3 b145N=t107N,b145CapN=t107N,b145V=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${tbn?`vec3 b145Sample=b145NormalMap.xyz*2.-1.;b145Sample.xy*=${f(intensity[0])};b145CapN=mat3(t107T,t107B,t107N)*normalize(b145Sample);${q<2&&light?'b145N=normalize(b145CapN);':''}`:''}
    float b145Roughness=${q===2?'.5':`clamp(b145Orm.g*${f(intensity[1])},0.,1.)`},b145Metalness=${q===2?'0.':`clamp(b145Orm.b*${f(intensity[2])},0.,1.)`},b145Ao=${q===2?'1.':'b145Orm.r'};
    vec3 b145Albedo,b145Emission;float b145Alpha;`;
   if(j)body+=`
    vec3 b145ViewN=mat3(viewMatrix)*(b145CapN*vec3(-1.,1.,1.)),b145ViewV=mat3(viewMatrix)*(b145V*vec3(-1.,1.,1.));
    vec3 b145T=normalize(cross(b145ViewV,vec3(0.,1.,0.))),b145B=normalize(cross(b145ViewV,b145T));
    vec2 b145CapUv=vec2(dot(b145ViewN,b145T),dot(b145ViewN,b145B))*.5+.5;
    vec3 b145Cap=texture2D(b145Tex3,b145CapUv).rgb;
    b145Albedo=b145Linear(${change?'vec3(dot(b145Base.rgb,vec3(.2125,.7154,.0721)))':'mix(b145Cap,b145Base.rgb,.5)*1.5*b145Base.rgb'}*${rgb(base)})*${n('TintValue',1)};
    b145Alpha=${f(base[3])}*${n('AlphaMult',1)};
    b145Emission=b145Base.rgb*${f(intensity[3])}*${n('TintValue',1)};
    ${border?`float b145Edge=clamp(1.-dot(b145N,b145V),0.,1.),b145Edge2=b145Edge*b145Edge;
    b145Emission+=${col('BorderColor',[1,.8,.3,1])}*clamp(${n('BorderScale',.03)}+b145Edge2*b145Edge2*b145Edge*(1.-${n('BorderScale',.03)}),0.,1.)*${n('BorderIntensity',3)};`:''}`;
   else body+=`
    vec3 b145Recolor=vec3(dot(b145Base.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)};
    b145Albedo=b145Linear(${change?(q===2?'b145Recolor':'mix(b145Base.rgb,b145Recolor,b145NormalMap.a)'):`b145Base.rgb*${rgb(base)}`});
    b145Alpha=step(${n('Control',0)},b145W);
    float b145Edge=(1.-smoothstep(${n('Control',0)},${n('Control',0)}+${n('Slider',.05)},b145W))*${n('EdgeBright',2)};
    float b145Fw=1.-smoothstep(${n('Control',0)},${n('Control',0)}+${n('MSKRange',.3)},b145W);
    vec3 b145Cell=ceil(vec3(b145World.xy,b145World.y+neoTime*${n('MSKSpeed',1)})*${n('MSKDensity',8)});
    float b145A=dot(b145Cell,vec3(2.52,3.05,3.87)),b145M=fract(sin(b145A)*neoTime*.5)-.5;
    b145Emission=clamp(b145M,0.,1.)*b145Fw*${n('MSKBright',6)}*${col('MSKCol')}+vec3(b145Edge);`;
   body+='diffuseColor=vec4(b145Albedo,b145Alpha*opacity);';
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(b145N*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=b145Roughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=b145Metalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=b145Emission;')
    .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=b145Ao;');
  };
  warnings.push(family+' source material channels; full lighting, runtime clock and half precision remain distinct.');return u;
 }catch(e){warnings.push(family+' remains unsupported: '+e.message);return null;}
}
