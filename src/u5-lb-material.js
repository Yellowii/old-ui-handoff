// APK 0xe1992c23.dat: u5_vfx_lb_1, actual FX_UV_OPT / no-soft-body permutation.
import {Vector2,Vector4} from 'three';
import {scalar,vector,f,rgb} from './t107-frame.js';

export async function configureU5Lb(m,p,macros,load,warnings){
 try{
  const n=(k,d=0)=>scalar(p[k],d),v=k=>vector(p[k],[1,1,1,1]);
  const flag=(k,d=0)=>{const value=String(macros[k]??d).toLowerCase();if(['1','true'].includes(value))return true;if(['0','false'].includes(value))return false;throw Error('Unknown macro '+k);};
  if(flag('ENABLE_SOFT_BODY2',1)||flag('Use_VertexColor_Split')||!flag('FX_UV_OPT',1))throw Error('Unresolved soft-body, vertex-color split or non-FX_UV_OPT permutation');
  const maskOn=flag('MaskTex_Switch'),productMask=flag('DiffuseTex4TODiffuseTex3Mask'),quality=scalar(macros.RENDER_QUALITY,0);
  if(![0,1,2].includes(quality))throw Error('Unknown source quality');
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},lbRTSize:{value:new Vector4()}};
  for(const key of ['DiffuseTex1','DiffuseTex2','DiffuseTex3','DiffuseTex4','DistortTex1','MaskTex','CharDissolve']){
   const tex=await load(key,false);if(!tex?.isTexture||tex.isCubeTexture)throw Error('Missing original '+key);uniforms['lb'+key]={value:tex};
  }
  const size=new Vector2();m.onBeforeRender=renderer=>{const target=renderer.getRenderTarget();if(target){const level=2**renderer.getActiveMipmapLevel();size.set(Math.max(1,Math.floor(target.width/level)),Math.max(1,Math.floor(target.height/level)));}else renderer.getDrawingBufferSize(size);uniforms.lbRTSize.value.set(size.x,size.y,1/size.x,1/size.y);};
  m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.vertexColors=false;m.color.set(0);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const pair=(a,b,d=0)=>`vec2(${f(n(a,d))},${f(n(b,d))})`,num=(k,d=0)=>f(n(k,d)),col=k=>rgb(v(k));
  const uv=i=>`lbUv*${pair('Diffuse'+i+'_Tiling_X','Diffuse'+i+'_Tiling_Y',1)}+${pair('Diffuse'+i+'_Offset_X','Diffuse'+i+'_Offset_Y')}+neoTime*${pair('Diffuse'+i+'_Speed_X','Diffuse'+i+'_Speed_Y')}`;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   const vary='varying vec2 lbUv;varying vec3 lbNormal,lbWorld,lbLocal;\n';
   shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nlbUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 lbVertexNormal=transformedNormal;
    #ifdef FLIP_SIDED
    lbVertexNormal=-lbVertexNormal;
    #endif
    lbNormal=normalize(inverseTransformDirection(lbVertexNormal,viewMatrix))*vec3(-1.,1.,1.);`).replace('#include <project_vertex>','lbLocal=transformed*vec3(-1.,1.,1.);lbWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
   shader.fragmentShader=vary+`
    uniform float neoTime,neoEmissionScale;uniform vec4 lbRTSize;
    uniform sampler2D lbDiffuseTex1,lbDiffuseTex2,lbDiffuseTex3,lbDiffuseTex4,lbDistortTex1,lbMaskTex,lbCharDissolve;
    vec2 lbRotate(vec2 uv,float time){float a=time*.25;vec2 d=uv-.5;return vec2(dot(vec2(cos(a),-sin(a)),d),dot(vec2(sin(a),cos(a)),d))+.5;}
    vec3 lbHue(vec3 c,float s){vec3 p=vec3(.55735)*dot(vec3(.55735),c),u=c-p;return u*cos(s*6.2832)+cross(vec3(.55735),u)*sin(s*6.2832)+p;}
    vec3 lbDesaturate(vec3 c,float s){return c*(1.-s)+dot(c,vec3(.3,.59,.11))*s;}
    float lbSmooth(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    vec4 lbDist=texture2D(lbDistortTex1,lbUv*${pair('Distort_Tiling_X','Distort_Tiling_Y',1)}+neoTime*${pair('Distort_Speed_X','Distort_Speed_Y')});
    float lbDist2=texture2D(lbDistortTex1,lbUv*${pair('Distorttiling_Tex2_X','DistortTiling_Tex2_Y',1)}+neoTime*${pair('DistortSpeed_Tex2_X','DistortSpeed_Tex2_Y')}).r;
    vec2 lbOffset=lbDist.rg*${pair('DistortStrengthX','DistortStrengthY')},lbOffset2=lbDist2*${pair('DistortStrength_Tex2_X','DistortStrength_Tex2_Y')};
    vec2 lbD1Uv=lbRotate(${uv(1)}+lbOffset,${num('Diffuse1_Rotate')}*8.*3.141592653589793);
    vec4 lbD1=texture2D(lbDiffuseTex1,lbD1Uv),lbD2=texture2D(lbDiffuseTex2,lbRotate(${uv(2)}+lbOffset,${num('Diffuse2_Rotate')}*8.*3.141592653589793));
    vec4 lbD3=texture2D(lbDiffuseTex3,lbRotate(${uv(3)}+lbOffset2,${num('Diffuse3_Rotate')}*8.*3.141592653589793)),lbD4=texture2D(lbDiffuseTex4,lbRotate(${uv(4)}+lbOffset2,${num('Diffuse4_Rotate')}*8.*3.141592653589793));
    vec2 lbMaskUv=lbRotate(lbUv*${pair('Mask_TilingX','Mask_TilingY',1)}+${pair('Mask_OffsetX','Mask_OffsetY')}+neoTime*${pair('Mask_SpeedX','Mask_SpeedY')},${num('MaskTex_Rotate')}*25.13)+lbDist.rg*${pair('AlphaMaskDistortX','AlphaMaskDistortY')};
    vec4 lbMask=texture2D(lbMaskTex,lbMaskUv);
    lbD1.rgb=pow(lbD1.rgb,vec3(${quality===0?'2.2':'2.'}));lbD2.rgb=pow(lbD2.rgb,vec3(${quality===0?'2.2':'2.'}));lbD3.rgb=pow(lbD3.rgb,vec3(${quality===0?'2.2':'2.'}));lbD4.rgb=pow(lbD4.rgb,vec3(${quality===0?'2.2':'2.'}));lbMask.rgb=pow(lbMask.rgb,vec3(${quality===0?'2.2':'2.'}));
    lbD1.a=pow(lbD1.a,${num('DiffuseTex1_Power',1)});lbD2.a=pow(lbD2.a,${num('DiffuseTex2_Power',1)})*clamp(${num('DiffuseTex2_Strength',1)},0.,1.);lbD3.a=pow(lbD3.a,${num('DiffuseTex3_Power',1)})*clamp(${num('DiffuseColor3_Strength',1)},0.,1.);lbD4.a=pow(lbD4.a,${num('DiffuseTex4_Power',1)})*clamp(${num('DiffuseColor4_Strength',1)},0.,1.);
    vec3 lbView=normalize(cameraPosition-lbWorld)*vec3(-1.,1.,1.);float lbFresnel=pow(1.-clamp(dot(lbNormal,lbView),0.,1.),${num('Frenel_Power',1)});lbFresnel=mix(lbFresnel,clamp(1.-lbFresnel,0.,1.),${num('InvFresnel')});lbFresnel=mix(1.,lbFresnel,${num('OnFresnel')});
    vec4 lbDissolve=texture2D(lbCharDissolve,gl_FragCoord.xy*lbRTSize.zw+neoTime*.3);float lbNoise=(lbDissolve.r*lbDissolve.g*2.-1.)*.8,lbRemap=${num('Bias')}*4.-2.;
    float lbDissolve1=lbSmooth(lbRemap+.8,lbRemap,.8+lbNoise+lbLocal.x),lbDissolve2=lbSmooth(lbRemap,lbRemap+.8,.8+lbNoise+lbLocal.x);float lbCut=mix(lbDissolve1,lbDissolve2,${num('DissolveChange')}),lbEdge=step(.5,lbCut)-step(.7,lbCut);lbCut=step(.5,lbCut);
    vec2 lbProcedural=pow(abs(sin(lbUv*3.14)),${pair('MaskR_Power','MaskG_Power')});float lbMaskAlpha=${maskOn?`pow(lbMask.r,${num('AlphaMask_Power',1)})`:'1.'};
    lbMaskAlpha=mix(lbD1.a+lbMaskAlpha,lbD1.a*lbMaskAlpha,${num('DiffuseTex1_AddOrMult')});float lbAlpha=clamp(lbProcedural.x*lbProcedural.y*lbMaskAlpha,0.,1.);
    lbAlpha=mix(lbAlpha+lbD2.a,lbAlpha*lbD2.a,${num('DiffuseTex2_AddOrMult')});
    ${productMask?'lbAlpha+=lbD3.a*lbD4.a;':`lbAlpha=mix(lbAlpha+lbD3.a,lbAlpha*lbD3.a,${num('DiffuseTex3_AddOrMult')});lbAlpha=mix(lbAlpha+lbD4.a,lbAlpha*lbD4.a,${num('DiffuseTex4_AddOrMult')});`}
    lbAlpha=clamp(lbAlpha,0.,1.)*${num('Alpha_Strength',1)}*lbFresnel;float lbWorldMask=step(.01,lbWorld.y);${n('ABKey',1)===n('ContrastValue')?'':'lbWorldMask=1.-lbWorldMask;'}lbAlpha=mix(lbAlpha,lbAlpha*lbWorldMask,${num('OpacKey')});lbAlpha*=mix(1.,lbCut,${num('DissolveCharKey')});
    vec3 lbColor2=lbHue(lbDesaturate(pow(lbD2.rgb,vec3(${num('DiffuseTex2_Power',1)})),${num('DiffuseTex2_Desaturation')}),${num('DiffuseTex2_HueShift')})*${num('DiffuseTex2_Strength',1)}*${col('Diffuse2_ColorMult')};
    vec3 lbColor1=lbDesaturate(pow(lbD1.rgb,vec3(${num('DiffuseTex1_Power',1)}))*${col('Diffuse1_ColorMult')},${num('Desaturation')})*${col('DiffuseColor')}*${num('DiffuseColor_Strength',1)}+lbColor2;
    vec3 lbColor3=pow(lbD3.rgb,vec3(${num('DiffuseTex3_Power',1)}))*${num('DiffuseColor3_Strength',1)}*${col('DiffuseColor3')},lbColor4=pow(lbD4.rgb,vec3(${num('DiffuseTex4_Power',1)}))*${num('DiffuseColor4_Strength',1)}*${col('DiffuseColor4')};
    vec3 lbEmission=lbHue(${col('Frenel_Emission_Color')}*${num('Frenel_Emission_Strength')}+lbColor1+${productMask?'lbColor3*lbColor4':'lbColor3+lbColor4'},${num('FinalHuePercent')});lbEmission+=mix(vec3(0.),lbEdge*${col('EdgeColor')}*20.,${num('DissolveCharKey')});
    diffuseColor=vec4(0.,0.,0.,lbAlpha*opacity);totalEmissiveRadiance=lbEmission*neoEmissionScale;
   `).replace('#include <color_fragment>','').replace('#include <emissivemap_fragment>','').replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('原LB特效四图混合、透明、时间UV和溶解已接入；原half精度、粒子实例和后处理未宣称等价');
  return uniforms;
 }catch(error){warnings.push('u5_vfx_lb_1 保持未适配：'+error.message);return null;}
}
