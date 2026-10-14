import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl,sourceSceneLightWarning} from './source-scene-light.js';

export async function configureFemaleSkin(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),derivedTbn=normal&&!o.sourceTangents;
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown source macro');
  const n=(k,d)=>f(scalar(p[k],d)),v=(k,d)=>vector(p[k],d),c=(k,d=[1,1,1,1])=>rgb(v(k,d));
  const iv=v('Intensity',[1,.3,.18,0]),hsl=v('HSLAdjust',[0,1,1,1]);
  const maps=await Promise.all(['Tex0','Tex1','Tex2','SkinLut','Penumbra'].map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original skin texture');
  const u={neoTime:{value:0}};['Tex0','Tex1','Tex2','SkinLut','Penumbra'].forEach((k,i)=>u['neoSkin'+k]={value:maps[i]});
  setup(m,q<2&&normal);if(derivedTbn){m.extensions={...m.extensions,derivatives:true};m.userData.femaleSkinDerivedTangent=true;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,q<2&&normal&&!derivedTbn);
   s.fragmentShader=`uniform sampler2D neoSkinTex0,neoSkinTex1,neoSkinTex2,neoSkinSkinLut,neoSkinPenumbra;uniform float neoTime;
    vec3 neoSkinHue(float h){h=fract(h);vec3 k=vec3(1.,2./3.,1./3.);return clamp(abs(fract(h+k)*6.-3.)-1.,0.,1.);}
    vec3 neoSkinHsl(vec3 x){float mx=max(max(x.r,x.g),x.b),mn=min(min(x.r,x.g),x.b),l=(mx+mn)*.5,d=mx-mn;float h=0.,ss=0.;if(d>.00001){ss=d/(1.-abs(2.*l-1.));if(mx==x.r)h=mod((x.g-x.b)/d,6.);else if(mx==x.g)h=(x.b-x.r)/d+2.;else h=(x.r-x.g)/d+4.;h/=6.;}return vec3(h,ss,l);}
    vec3 neoSkinRgb(vec3 hsl){float h=hsl.x,s=hsl.y,l=hsl.z;vec3 rgb=neoSkinHue(h);float cc=(1.-abs(2.*l-1.))*s;return (rgb-.5)*cc+l;}
   `+s.fragmentShader;
   let skinTbn='';
   if(normal){if(derivedTbn)skinTbn+='vec3 neoSkinDt=normalize(dFdx(vViewPosition)*dFdy(t107Uv).y-dFdy(vViewPosition)*dFdx(t107Uv).y),neoSkinDb=normalize(-dFdx(vViewPosition)*dFdy(t107Uv).x+dFdy(vViewPosition)*dFdx(t107Uv).x);if(dot(cross(neoSkinDt,neoSkinDb),t107N)<0.)neoSkinDb=-neoSkinDb;';skinTbn+='vec3 neoSkinSample=texture2D(neoSkinTex1,neoSkinUv).xyz*2.-1.;neoSkinSample.xy*='+f(iv[0])+';neoSkinN=mat3('+(derivedTbn?'neoSkinDt,neoSkinDb,t107N':'t107T,t107B,t107N')+')*normalize(neoSkinSample);';}
   const body=`vec2 neoSkinUv=t107Uv;neoSkinUv.x+=neoSkinUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',1)}:0.;
    vec4 neoSkinBase=texture2D(neoSkinTex0,neoSkinUv),neoSkinMix=texture2D(neoSkinTex2,neoSkinUv);
    vec3 neoSkinColor=neoSkinBase.rgb;vec3 neoSkinH=neoSkinHsl(neoSkinColor);neoSkinH.x=fract(neoSkinH.x+${f(hsl[0])}*neoSkinMix.a);neoSkinH.y=clamp(neoSkinH.y*mix(1.,${f(hsl[1])},neoSkinMix.a),0.,1.);neoSkinH.z=clamp(neoSkinH.z*mix(1.,${f(hsl[2])},neoSkinMix.a),0.,1.);neoSkinColor=mix(neoSkinColor,neoSkinRgb(neoSkinH),${f(hsl[3])}*neoSkinMix.a);
    vec3 neoSkinN=t107N;
    ${q<2?skinTbn:''}
    vec3 neoSkinSun=${sourceSceneSunGlsl()},neoSkinView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);float neoSkinC=neoSkinMix.b*neoSkinMix.b;
    float neoSkinCurv=neoSkinC;vec2 neoSkinPenUv=vec2(dot(neoSkinN,-neoSkinSun)*.5+.5,neoSkinC);vec3 neoSkinPen=saturate(texture2D(neoSkinPenumbra,neoSkinPenUv).rgb*.5-.25)*${n('PenumbraStrength',.3)};
    float neoSkinTrans=saturate(dot(neoSkinView,-(-neoSkinSun+neoSkinN*${n('ScatterDistor',.7)})))*neoSkinMix.g*neoSkinMix.g*${n('ScatterStrength',1)};vec3 neoSkinScatter=neoSkinTrans*${c('ScatterColor',[0,0,0,1])};
    diffuseColor=vec4(neoSkinColor,neoSkinBase.a);
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(neoSkinN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=.6;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=0.;')
    .replace('#include <emissivemap_fragment>',`float neoSkinF=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*pow(1.-dot(neoSkinN,neoSkinView),5.),0.,1.);totalEmissiveRadiance=neoSkinPen+neoSkinScatter+neoSkinF*${c('RimColor')}*${f(iv[3])};`)
    .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=neoSkinMix.r;');
  };
  warnings.push('female_common_skin 源法线/曲率半影/背光散射/HSL表情偏移已接入；'+sourceSceneLightWarning);return u;
 }catch(e){warnings.push('female_common_skin remains unsupported: '+e.message);return null;}
}
