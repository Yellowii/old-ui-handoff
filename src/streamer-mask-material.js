import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// unlit_change_color_streamer_mask uses the same emission equations with
// MaskColor0/1/2 in place of Color0/1/BaseColor. WindSpeed is a scene input.
export async function configureChangeColorStreamerMask(m,p,macros,load,warnings){
 try{
  if(scalar(p.AudioRange,0)!==0)throw Error('Source audio modulation is not connected');
  return await configureStreamerMask(m,{...p,Color0:p.MaskColor0,Color1:p.MaskColor1,BaseColor:p.MaskColor2},macros,load,warnings);
 }catch(e){warnings.push('change-color-streamer-mask remains unsupported: '+e.message);return null;}
}

// Current PPK unlit_streamer_mask.hlsl; defaults from the APK Surface.
export async function configureStreamerMask(m,p,macros,load,warnings){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),enabled=scalar(macros.ENABLE_STREAMER,0),linear=scalar(macros.ENABLE_STREAMER_LINEAR,0);
  const known=new Set(['RENDER_QUALITY','ENABLE_STREAMER','ENABLE_STREAMER_LINEAR','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(![0,1,2].includes(q)||![0,1].includes(enabled)||![0,1].includes(linear)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unimplemented active source permutation (including original shadow input)');
  const c0=vector(p.Color0,[1,1,1,1]),c1=vector(p.Color1,[1,1,1,1]),base=vector(p.BaseColor,[1,1,1,1]);
  const light=scalar(p.Lightness,1),noiseScale=scalar(p.NoiseScale,10),speed=enabled?scalar(p.StreamerSpeed,1):0,strength=scalar(p.StreamerLightness,1);
  if(!linear&&noiseScale===0)throw Error('Undefined source noise division');
  const tex0=await load('Tex0',false),tex1=linear?null:await load('Tex1',false);
  if(!tex0?.isTexture||tex0.isCubeTexture||(!linear&&(!tex1?.isTexture||tex1.isCubeTexture)))throw Error('Missing original active 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1},smTex0:{value:tex0},...(tex1?{smTex1:{value:tex1}}:{})};setup(m,false);m.roughness=1;m.metalness=0;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   const vary='varying vec3 smWorld;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nsmWorld=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);');
   s.fragmentShader=vary+`uniform sampler2D smTex0,smTex1;uniform float neoTime,neoEmissionScale;
    vec3 smLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 smD=texture2D(smTex0,t107Uv);
    ${linear?`float smPhase=t107Uv.x+neoTime*${f(speed)};
    // HLSL fmod uses truncation, unlike GLSL mod for negative phases.
    float smWave=cos(3.1415*((smPhase-trunc(smPhase))*2.-1.)/2.);float smAlpha=smWave*smWave;
    vec3 smEmission=smLinear(mix(${rgb(c0)},${rgb(c1)},smAlpha))*${f(strength)};`:`
    vec3 smP=smWorld/${f(noiseScale)}+vec3(${f(speed)})*neoTime;
    vec3 smWeights=pow(abs(t107N),vec3(.5));smWeights/=smWeights.x+smWeights.y+smWeights.z;
    vec3 smNoise=texture2D(smTex1,smP.zy).rgb*smWeights.x+texture2D(smTex1,smP.xz).rgb*smWeights.y+texture2D(smTex1,smP.xy).rgb*smWeights.z;
    vec3 smEmission=smLinear(mix(${rgb(c0)},${rgb(c1)},smNoise.r));`}
    // The linear source branch applies StreamerLightness twice.
    smEmission=smEmission*smD.a*${f(strength)}+smLinear((1.-smD.a)*${rgb(base)}*smD.rgb)*${f(light)};
    diffuseColor=vec4(vec3(0.),smD.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=smEmission;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance*neoEmissionScale;\n#include <opaque_fragment>');
  };
  return u;
 }catch(e){warnings.push('streamer-mask remains unsupported: '+e.message);return null;}
}
