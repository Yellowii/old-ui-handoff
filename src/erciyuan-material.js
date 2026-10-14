import {BackSide} from 'three';
import {scalar,vector,f,rgb,frame,setup,flags} from './t107-frame.js';
import {sourceSceneSunGlsl} from './source-scene-light.js';

// Original standard_char_t1erciyuan lit and layer1 programs. Their color is
// emissive; sending it through the generic albedo/ORM path changes the result.
export async function configureErciyuan(m,p,macros,load,o={},warnings=[]){
 try{
  const {q,normal,change,light}=flags(macros,o),n=(k,d=0)=>scalar(p[k],d),v=(k,d)=>vector(p[k],d),outline=o.t1Outline===true;
  const second=scalar(macros.TEXCOORD1_ENABLE,1);
  if(![0,1].includes(second))throw Error('Unknown second-UV permutation');
  if(!outline&&second&&!o.sourceSecondUv)throw Error('Missing original second UV; source fallback not established');
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('Active source soft-body inputs not connected');
  const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]),wave=v('WavePara',[0,0,0,1]),hair=v('hairOutLine',[0,1,1,1]);
  if(outline?(hair[0]===hair[1]||hair[2]<=0||hair[3]<=0):(n('CT_AlbedoPow',1)<=0||n('CT_HighlightPow',50)<=0||n('CT_RimSSMin')===n('CT_RimSSMax',1)))throw Error('Undefined source power/smoothstep boundary');
  const keys=outline?[0,1,3,5]:[0,1,3,5,6],textures=await Promise.all(keys.map(i=>load('Tex'+i,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original erciyuan 2D textures required');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};textures.forEach((t,i)=>u['ecTex'+keys[i]]={value:t});setup(m,normal===1);
  if(outline){m.side=BackSide;m.alphaTest=0;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   const declarations='uniform sampler2D ecTex0,ecTex1,ecTex3,ecTex5,ecTex6;uniform float neoTime,neoEmissionScale;\n';
   if(second&&!outline){s.vertexShader='attribute vec2 uv1;varying vec2 ecUv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\necUv1=uv1;');s.fragmentShader='varying vec2 ecUv1;\n'+s.fragmentShader;}
   if(outline)s.vertexShader=declarations+s.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>\nfloat ecWidth=mix(${f(n('outLineWidth2'))},${f(n('outLineWidth'))},texture2D(ecTex3,uv).a);transformed+=objectNormal*ecWidth;`);
   s.fragmentShader=declarations+`vec3 ecLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
    float ecSmooth(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 ecUv=t107Uv;
    ${outline&&scalar(macros.CHAR_OFFSET,0)!==0?`if(ecUv.y<.25)ecUv.x+=${f(n('FaceUVOffset'))};`:''}
    vec4 ecBase=texture2D(ecTex0,ecUv),ecEncoded=texture2D(ecTex1,ecUv);
    mat3 ecTbn=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 ecView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 ecRawN=${normal?'ecTbn*normalize(ecEncoded.xyz*2.-1.)':'t107N'};
    vec3 ecComposite;
    ${outline?`
     float ecMask=texture2D(ecTex3,ecUv).a;
     float ecNoise=texture2D(ecTex5,ecUv*${f(n('outLineNoiseScale',1))}+neoTime*${f(n('outLineNoiseSpeed'))}).b;
     float ecHair=ecSmooth(${f(hair[0])},${f(hair[1])},pow(ecEncoded.a,${f(hair[2])}));
     vec3 ecLine=mix(pow(${rgb(v('outLineColor',[1,1,1,1]))},vec3(${f(hair[3])})),${rgb(v('outLineColor',[1,1,1,1]))},ecHair);
     ecComposite=ecLinear(mix(ecBase.rgb*${f(v('outLineColor2',[1,1,1,1])[0])},ecLine*clamp(ecNoise+${f(n('outLineNoiseBaseAdd'))},0.,1.),ecMask))*mix(${f(n('outLinePower2',1))},${f(n('outLinePower',1))},ecMask);
     diffuseColor=vec4(0.,0.,0.,opacity);
    `:`
     vec2 ecWaveBase=${second?'ecUv1':'ecUv'};
     float ecNoise=texture2D(ecTex5,ecUv*${f(wave[3])}).a;
     vec2 ecWaveUv=ecWaveBase+vec2(0.,neoTime*${f(wave[0])})+ecNoise*${f(wave[2])};
     float ecMask=texture2D(ecTex5,ecWaveBase).g;
     float ecNV=dot(ecRawN,ecView),ecNormalMask=1.-ecSmooth(.3,1.,pow((ecNV+1.)*.5,2.));
     float ecWave=texture2D(ecTex5,ecWaveUv).r*ecMask*${f(wave[1])}*pow(ecNormalMask,.7);
     vec3 ecSun=${sourceSceneSunGlsl()};
     float ecHighlight=pow(max(0.,dot(ecRawN,normalize(-ecSun+ecView))),${f(n('CT_HighlightPow',50))});
     float ecRamp=texture2D(ecTex3,vec2(dot(ecRawN,-ecSun)*.5+.5,0.)).r;
     float ecRim=ecSmooth(${f(n('CT_RimSSMin'))},${f(n('CT_RimSSMax',1))},1.-max(0.,ecNV));
     float ecSide=mix(max(0.,dot(ecRawN,vec3(2.*step(0.,ecSun.x)-1.,0.,0.))),1.,${f(n('CT_RimTwoSide'))});
     // NEOX's forward-positive view space, after source-world X reflection.
     vec3 ecViewN=(mat3(viewMatrix)*(ecRawN*vec3(-1.,1.,1.)))*vec3(1.,1.,-1.);
     vec3 ecViewV=vViewPosition*vec3(1.,1.,-1.);
     vec3 ecT=normalize(cross(ecViewV,vec3(0.,1.,0.))),ecB=normalize(cross(ecViewV,ecT));
     vec2 ecCapUv=vec2(dot(ecViewN,ecT),dot(ecViewN,ecB))*.5+.5;
     vec4 ecCap=texture2D(ecTex6,ecCapUv);
     ecComposite=ecLinear(pow(ecRamp*ecBase.rgb,vec3(${f(n('CT_AlbedoPow',1))}))*${rgb(base)})*${f(n('TintValue',1))}
      +ecHighlight*${rgb(v('CT_HighlightC',[1,1,1,1]))}*${f(n('CT_HighlightV'))}*step(.25,ecUv.y)
      +ecRim*${rgb(v('CT_RimC',[1,1,1,1]))}*ecSide+ecWave*${rgb(v('waveColor',[1,1,1,1]))}
      +ecLinear(ecCap.aaa)*${f(n('HightLightPower'))}*${rgb(v('HightColor',[1,1,1,1]))}*ecMask
      +ecLinear(ecCap.rgb).g*${f(n('RefelectPower'))}*${rgb(v('RefelctColor',[1,1,1,1]))}*ecMask;
     diffuseColor.rgb=${change?`ecLinear(vec3(dot(ecBase.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)})*${f(n('TintValue',1))}`:'vec3(0.)'};
     diffuseColor.a=ecBase.a*${f(base[3])}*opacity;
    `}
   `).replace('#include <color_fragment>','')
   // layer1 leaves RawData.tex1 zero-initialized; only its alpha is sampled
   // separately as hairLineDetail. Keep that unusual lighting-normal input.
   .replace('#include <normal_fragment_maps>',`
    vec3 ecN=t107N;
    ${q<2&&normal&&light?`vec3 ecLocal=${outline?'vec3(-1.)':'ecEncoded.xyz*2.-1.'};ecLocal.xy*=${f(intensity[0])};ecN=ecTbn*normalize(ecLocal);`:''}
    normal=normalize(mat3(viewMatrix)*(ecN*vec3(-1.,1.,1.)));
   `).replace('#include <roughnessmap_fragment>','float roughnessFactor=1.;')
   .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
   .replace('#include <emissivemap_fragment>',`
    float ecF=1.-dot(ecN,ecView);ecF=clamp(${f(n('FresnelScale'))}+(1.-${f(n('FresnelScale'))})*ecF*ecF*ecF*ecF*ecF,0.,1.);
    totalEmissiveRadiance=(ecComposite${outline?'':`+ecF*${rgb(v('RimColor',[0,0,0,0]))}*${f(intensity[3])}`})*neoEmissionScale;
   `).replace('#include <aomap_fragment>','');
  };return u;
 }catch(e){warnings.push('Erciyuan remains unsupported: '+e.message);return null;}
}
