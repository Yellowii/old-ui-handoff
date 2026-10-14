import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

export async function configureUnlitCrystal(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unverified crystal permutation/shadow input');
  if(normal&&!o.sourceTangents)throw Error('Original crystal tangent basis required');
  const defaults={Heigh:5,ReflectSrrength:1,Lightness:1,SmokeSpeed_X:0,SmokeSpeed_Y:.02,SmokePow:2,SparkleSpeed:.05,SparkleScale:1,SparkleStrength:4,FresnelPow:4,FresnelStrength:4,EmissivePow:4,EmissiveStrength:1,DissolveValue:1,DissolveReverse:0,DissolveStrength:.1,DissolveIntensity:6};
  const n=Object.fromEntries(Object.entries(defaults).map(([k,d])=>[k,scalar(p[k],d)])),v=Object.fromEntries(Object.entries(n).map(([k,x])=>[k,f(x)]));
  if(n.Heigh===0||n.SmokePow<=0||n.EmissivePow<=0||n.FresnelPow<=0||(q<2&&n.DissolveStrength===0))throw Error('Undefined crystal division/power boundary');
  const colors={MaskColor0:rgb(vector(p.MaskColor0,[1,0,0,1])),MaskColor1:rgb(vector(p.MaskColor1,[0,1,0,1])),DissolveColor:rgb(vector(p.DissolveColor,[1,1,1,1]))};
  const keys=q<2?['Tex0','Tex1','Tex2']:['Tex0','Tex1'],textures=await Promise.all(keys.map(k=>load(k,false)));
  if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original crystal texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['uc'+k]={value:textures[i]});setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.vertexShader='varying vec3 ucLocal;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nucLocal=transformed;');
   s.fragmentShader=`varying vec3 ucLocal;uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D uc'+k+';').join('')}
    vec3 ucLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
    // HLSL smoothstep explicitly saturates the quotient; descending edges are
    // used by this source and cannot be passed to GLSL's undefined edge order.
    float ucSmooth(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec3 ucV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 ucTV=${normal?'normalize(vec3(dot(t107T,ucV),dot(t107B,ucV),dot(t107N,ucV)))':'normalize(ucV)'};
    vec2 ucSpeed=vec2(${v.SmokeSpeed_X},${v.SmokeSpeed_Y});
    vec2 ucUv1=t107Uv+neoTime*ucSpeed+ucTV.xy*.1;
    vec4 ucSmoke1=texture2D(ucTex0,ucUv1);
    vec2 ucUv2=t107Uv*2.+ucSmoke1.r+neoTime*ucSpeed+ucTV.xy*.05;
    float ucSmoke=pow(texture2D(ucTex0,ucUv2).r,${v.SmokePow});
    vec3 ucVN=mat3(viewMatrix)*(t107N*vec3(-1.,1.,1.)),ucVV=normalize(vViewPosition);
    vec3 ucVT=normalize(cross(ucVV,vec3(0.,1.,0.))),ucVB=normalize(cross(ucVV,ucVT));
    vec2 ucCapUv=vec2(dot(ucVN,ucVT),dot(ucVN,ucVB))*.5+.5;
    vec4 ucCap=texture2D(ucTex1,ucCapUv);
    float ucSparkle=0.,ucOpacity=0.,ucDissolve=0.;
    ${q<2?`
     ucSparkle=texture2D(ucTex2,t107Uv*${v.SparkleScale}+neoTime*${v.SparkleSpeed}).r*texture2D(ucTex2,t107Uv*${v.SparkleScale}*2.+ucTV.xy*.1).r*(1.-ucSmoke);
     float ucThreshold=${v.DissolveValue}*(1.+${v.DissolveStrength})+ucSmoke1.g,ucAxis=abs(t107Uv.x-${v.DissolveReverse});
     ucOpacity=1.-ucSmooth(ucAxis,ucAxis-${v.DissolveStrength},ucThreshold);
     ucDissolve=step(ucAxis,ucThreshold+${v.DissolveStrength})-step(ucAxis,ucThreshold);
    `:''}
    vec3 ucReflection=ucLinear(ucCap.ggg)+ucLinear(ucCap.rrr)*.3;
    float ucHeight=clamp(ucLocal.y/${v.Heigh},0.,1.);
    vec3 ucHeightEmission=clamp(pow(ucHeight,${v.EmissivePow}),0.,1.)*${colors.MaskColor1};
    vec3 ucEmission=ucLinear(mix(${colors.MaskColor0},${colors.MaskColor1},ucSmoke))*${v.Lightness}+ucHeightEmission*${v.EmissiveStrength};
    ${q===2?'ucEmission+=ucReflection*2.;':`
     float ucFresnel=clamp(pow(1.-dot(t107N,ucV),${v.FresnelPow}),0.,1.);
     ucEmission+=ucFresnel*${colors.MaskColor0}*${v.FresnelStrength}+ucFresnel+ucReflection*${v.ReflectSrrength}+ucSparkle*${v.SparkleStrength}+ucDissolve*${colors.DissolveColor}*${v.DissolveIntensity};
    `}
    diffuseColor=vec4(0.,0.,0.,ucOpacity*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=ucEmission*neoEmissionScale;')
    .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;','vec3 outgoingLight = totalEmissiveRadiance;');
  };return u;
 }catch(e){warnings.push('Unlit crystal remains unsupported: '+e.message);return null;}
}
