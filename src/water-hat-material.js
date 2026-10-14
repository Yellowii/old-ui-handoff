import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourcePerlinGlsl} from './source-perlin.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl} from './source-scene-light.js';

// standard_char_water_hat.hlsl. Tex5 has an explicit white source builtin;
// UV1 and the stored tangent stream remain hard geometry gates.
export async function configureWaterHat(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),offsetScale=Number.isFinite(Number(p.PositionOffsetScale))?Number(p.PositionOffsetScale):1,needsSecondUv=q<2&&offsetScale!==0;
  if(![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(change))throw Error('Unknown water-hat macro permutation');
  if(needsSecondUv&&o.sourceSecondUv!==true)throw Error('Original water-hat second UV required');
  if(q<2&&normal===1&&o.sourceTangents!==true)throw Error('Original water-hat tangent basis required');
  const keys=['Tex0','Tex1','Tex2','Tex3','Tex5'],maps={};
  for(const k of keys)maps[k]=await load(k,k==='Tex0'||k==='Tex3'||k==='Tex5');
  if(Object.values(maps).some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original water-hat Tex0/Tex1/Tex2/Tex3/Tex5 required');
  const n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d),I=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]);
  const flow=v('FlowParam',[1,1,1,1]),caustic=v('CausticColor',[1,1,1,1]),rim=v('RimColor',[0,0,0,0]),emissive=v('EmissiveColor',[1,1,1,1]);
  const u={neoTime:{value:0}};for(const k of keys)u['wh'+k]={value:maps[k]};
  setup(m,q<2&&normal===1);m.vertexColors=o.sourceVertexColors===true;if(needsSecondUv)m.defines={...m.defines,USE_UV1:''};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal===1);
   s.vertexShader=`varying vec2 whUv1;varying float whColorR;uniform sampler2D whTex1;uniform float neoTime;\n${sourcePerlinGlsl}\n`+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\n#ifdef USE_UV1\nwhUv1=uv1;\n#else\nwhUv1=uv;\n#endif\n#ifdef USE_COLOR\nwhColorR=color.r;\n#else\nwhColorR=1.;\n#endif`);
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n${q<2?`float whNoise=-.5+texture2D(whTex1,whUv1).a;float whNoise1=whNoise*sqrt(whUv1.x*whUv1.x+(1.-whUv1.y)*(1.-whUv1.y));transformed+=mix(whNoise,whNoise1,clamp(${f(n('PositionOffsetMode'))},0.,1.))*mix(objectNormal,vec3(1.,1.,0.),clamp(${f(n('PositionOffsetMode'))}-1.,0.,1.))*whColorR*.1*${f(n('PositionOffsetScale',1))};`:''}`);
   const noise=`vec3 whMod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec2 whMod289(vec2 x){return x-floor(x*(1./289.))*289.;}vec3 whPermute(vec3 x){return whMod289(((x*34.)+1.)*x);}float whNoise1(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);vec2 i=floor(v+dot(v,C.yy)),x0=v-i+dot(i,C.xx);vec2 i1=x0.x>x0.y?vec2(1.,0.):vec2(0.,1.),x1=x0+C.xx-i1,x2=x0+C.zz;i=whMod289(i);vec3 pp=whPermute(whPermute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 mm=max(.5-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.);mm*=mm;mm*=mm;vec3 xx=2.*fract(pp*C.www)-1.,h=abs(xx)-.5,ox=floor(xx+.5),a0=xx-ox;mm*=1.792842914-.85373472*(a0*a0+h*h);vec3 g=vec3(a0.x*x0.x+h.x*x0.y,a0.y*x1.x+h.y*x1.y,a0.z*x2.x+h.z*x2.y);return 130.*dot(mm,g);}`;
   s.fragmentShader=`uniform sampler2D whTex0,whTex1,whTex2,whTex3,whTex5;uniform float neoTime;${noise}\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 wh0=texture2D(whTex0,t107Uv),wh1=texture2D(whTex1,t107Uv),wh2=texture2D(whTex2,t107Uv);vec3 whBase=pow(max(wh0.rgb,vec3(0.)),vec3(2.2));vec3 whN=t107N;vec3 whView=normalize(-vViewPosition);
    ${q<2?`vec3 whTS=wh1.xyz*2.-1.;whTS.xy*=${f(I[0])};whN=normalize(mat3(t107T,t107B,t107N)*normalize(whTS));`:''}
    float whMode1=clamp(${f(n('UseDistortion'))}*abs(${f(n('UseDistortion'))}-2.),0.,1.),whMode2=clamp(abs(${f(n('UseDistortion'))}-1.),0.,1.);float whSkirt=mix(1.,1.,whMode1);
    float whFoam=texture2D(whTex2,t107Uv*mix(vec2(2.5,5.),vec2(2.5),clamp(${f(n('PositionOffsetMode'))},0.,1.))+neoTime*vec2(.12,-.125)).g;
    ${q<2?`if(${f(n('UseDistortion'))}>=1.){float whSpeed=neoTime*.275*${f(flow[2])};vec2 whDir=-vec2(${f(flow[0])},${f(flow[1])})*2.+vec2(.1);vec2 whA=t107Uv+vec2(1.,-1.)*whDir*.08*fract(whSpeed),whB=t107Uv+vec2(1.,-1.)*whDir*.08*fract(whSpeed+.5);whBase=mix(whBase,pow(max(mix(texture2D(whTex0,whA).rgb,texture2D(whTex0,whB).rgb,abs(fract(whSpeed)*2.-1.)),vec3(0.)),vec3(2.2)),clamp(${f(n('UseDistortion'))},0.,1.)*whSkirt);whBase=clamp(whBase+clamp(wh2.b*.65+whFoam*.35,0.,1.)*whMode1,0.,1.);}`:''}
    ${q<2?`float whC=1.17-exp2(log2(max(abs(.005+whNoise1(t107Uv*8.+neoTime*.52)),.000001))*1.40000000);whBase+=pow(vec3(max(abs(whC),0.)),vec3(5.))*${rgb(caustic)}*${f(n('CausticInten'))}*.3;`:''}
    whBase=pow(whBase,vec3(${f(n('BaseColorPow',1))}));${q<2?`vec3 whT=normalize(cross(whView,vec3(0.,1.,0.))),whB=normalize(cross(whView,whT));vec2 whCapUv=vec2(dot(normalize(whN),whT),dot(normalize(whN),whB))*.5+.5;vec3 whMat=pow(max(texture2D(whTex3,whCapUv).rgb,vec3(0.)),vec3(2.2))*${f(n('MatcapIntensity',1))};whBase=clamp(whBase*${f(n('BaseColorIntensity',1))}+whMat,0.,1.);`:''}
    ${change?`float whLum=dot(whBase,vec3(.2125,.7154,.0721));whBase=whLum*vec3(${base.slice(0,3).map(f).join(',')})*${f(n('TintValue',1))};`:`whBase*=${f(n('TintValue',1))};`}
    diffuseColor=vec4(whBase,${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(whN);')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=clamp(wh2.g*${f(I[1])},0.,1.);`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=clamp(wh2.b*${f(I[2])},0.,1.);`)
    .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=wh2.r;')
    .replace('#include <emissivemap_fragment>',`vec3 whSun=${sourceSceneSunGlsl()},whSunColor=${sourceSceneSunColorGlsl()};float whF=1.-clamp(pow(max(dot(whView,normalize(whN))-${f(n('COA',.4))},0.),${f(n('COB',1))})*2.,0.,1.);vec3 whTrick=whBase*.5*max(dot(whN,normalize(-whSun)),0.);totalEmissiveRadiance=whF*vec3(${rim.slice(0,3).map(f).join(',')})*${f(I[3])}+wh2.a*vec3(${emissive.slice(0,3).map(f).join(',')})*${f(n('EmissiveValue',1))}+whTrick*whSunColor*.2+whBase*${f(n('AllEmissiveIntensity'))};`);
  };
  warnings.push('water-hat 已接入源 Tex0/1/2/3/5、UV1 位移、法线、流动泡沫、caustic、MatCap、Fresnel 与源预览 Sun；SH/运行时半精度仍存在预览差异');
  return u;
 }catch(e){warnings.push('Water-hat remains unsupported: '+e.message);return null;}
}
