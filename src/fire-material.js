// Current PPK standard_char_fire.hlsl and common/function.hlsl; see reports/FIRE_SURFACE_DELIVERY.md.
export async function configureFire(m,p,macros,load){
  const tex0=await load('Tex0',false),tex1=await load('Tex1',false);
  if(!tex0||!tex1)return null;
  const f=(key,fallback)=>(Number.isFinite(Number(p[key]))?Number(p[key]):fallback).toFixed(8);
  const v=(key,fallback)=>{
    let value;try{value=JSON.parse(p[key]);}catch{}
    if(!Array.isArray(value)||value.length!==fallback.length||!value.every(Number.isFinite))value=fallback;
    return `vec${value.length}(${value.map(x=>x.toFixed(8)).join(',')})`;
  };
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},neoFireTex0:{value:tex0},neoFireTex1:{value:tex1}};
  m.defines={...m.defines,USE_UV1:''};m.color.set(0xffffff);m.roughness=0;m.metalness=0;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    const varying='varying vec2 neoFireUv;\n';
    shader.vertexShader=varying+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoFireUv=uv1;');
    shader.fragmentShader=varying+`
      uniform float neoTime,neoEmissionScale;
      uniform sampler2D neoFireTex0,neoFireTex1;
      vec3 neoFireLinear(vec3 c){return ${Number(macros.RENDER_QUALITY??0)<2?'pow(max(c,vec3(0.0)),vec3(2.2))':'c*c'};}
      vec3 neoFireHSV(vec3 c){
        vec4 p=c.g<c.b?vec4(c.bg,-1.0,2.0/3.0):vec4(c.gb,0.0,-1.0/3.0);
        vec4 q=c.r<p.x?vec4(p.xyw,c.r):vec4(c.r,p.yzx);
        float chroma=q.x-min(q.w,q.y);
        return vec3(abs((q.w-q.y)/(6.0*chroma+1e-10)+q.z),chroma/(q.x+1e-10),q.x);
      }
      vec3 neoFireRGB(vec3 hsv){
        vec3 rgb=clamp(vec3(abs(hsv.x*6.0-3.0)-1.0,2.0-abs(hsv.x*6.0-2.0),2.0-abs(hsv.x*6.0-4.0)),0.0,1.0);
        return ((rgb-1.0)*hsv.y+1.0)*hsv.z;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 neoNoiseUv=neoFireUv*${f('FireScale1',1.5)}*(1.0-.2*step(.5,neoFireUv.y))+neoTime*${v('FireDir1',[0,0])}*.04;
      vec4 neoNoise1=texture2D(neoFireTex1,neoNoiseUv);
      vec4 neoNoise2=texture2D(neoFireTex1,neoFireUv*${f('FireScale2',1)}+neoTime*${v('FireDir2',[0,0])}*.06);
      vec4 neoFireMask=texture2D(neoFireTex1,neoFireUv);
      float neoFireBand=smoothstep(0.0,.1,fract(neoFireUv.y*4.0));
      vec2 neoFirePan=vec2(fract(neoFireUv.x*2.0+neoTime*${f('FireSpeed',.25)}),neoFireUv.y)-neoNoise1.g*${f('FireStrength1',.04)}*neoFireBand;
      vec4 neoFireA=texture2D(neoFireTex0,neoFirePan);
      vec4 neoFireB=texture2D(neoFireTex0,neoFireUv-vec2(neoNoise2.g*${f('FireStrength2',.03)}*neoFireMask.b,0.0));
      neoFireA.rgb=neoFireLinear(neoFireA.rgb);neoFireB.rgb=neoFireLinear(neoFireB.rgb);
      float neoFireTop=step(.75,neoFireUv.y);
      vec3 neoFireColor=mix(neoFireA.rgb,neoFireB.rgb,neoFireTop);
      diffuseColor.rgb=vec3(0.0);
      diffuseColor.a=clamp(mix(neoFireA.a,neoFireB.a*neoFireMask.a,neoFireTop),0.0,1.0)*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',Number(macros.CHAR_CHANGE_COLOR??1)!==0?`
      float neoFireLuma=dot(neoFireColor,vec3(.2125,.7154,.0721));
      totalEmissiveRadiance=neoFireLinear(vec3(neoFireLuma)*${v('BaseColor',[1,1,1,1])}.rgb)*${f('TintValue',1)}*neoEmissionScale;
    `:`
      float neoFireDot=dot(normal,normalize(vViewPosition));
      float neoFireFresnel=clamp(.5*neoFireDot*neoFireDot*neoFireDot*neoFireDot,0.0,1.0);
      vec3 neoHsv=neoFireHSV(neoFireColor);
      float neoHue=(floor(neoFireUv.y*4.0)-.25)*${f('HueStrength',.015)}*step(.25,1.0-neoFireUv.y);
      // HLSL fmod truncates toward zero, unlike GLSL mod for negative hues.
      float neoDegrees=(neoHsv.x+neoHue)*360.0;
      neoHsv.x=(neoDegrees-trunc(neoDegrees/360.0)*360.0)/360.0;
      totalEmissiveRadiance=neoFireRGB(neoHsv)*(1.0+neoHue+neoFireFresnel-(1.0-neoFireMask.b)*.2)*${f('TintValue',1)}*neoEmissionScale;
    `);
    // Source IS_UNLIT_MATERIAL: do not add Three's scene specular lighting.
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  return uniforms;
}
