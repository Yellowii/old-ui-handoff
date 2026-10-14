// Existing full glass adapter recovered from the last accepted T347 bundle.
// Preserve Pattern/parallax/RNM behavior; T348 repairs inputs and original IBL scale.
export async function configureGlass(e,t,n,r,i){let a=(e,n=0)=>(Number.isFinite(Number(t[e]))?Number(t[e]):n).toFixed(8),o=(e,n)=>{try{let r=JSON.parse(t[e]);if(Array.isArray(r)&&r.length===n.length&&r.every(Number.isFinite))return r}catch{}return n},s=e=>`vec${e.length}(${e.map(e=>e.toFixed(8)).join(`,`)})`,c=Number(n.RENDER_QUALITY)>=2,l=Number(n.ENABLE_PATTERN)===1,u=Number(n.NORMAL_MAP_ENABLE)!==0,d=await r(`Tex1`),f=await r(`Tex2`),p=l?await r(`PatternTex`):null;if(!c&&(!d||!f)||l&&!p)return null;let m=o(`BaseColor`,[1,1,1,1]),h=o(`DesignColor`,[1,1,1,1]),g=o(`Intensity`,[1,1,1,0]),_=o(`PatternIntensity`,[1,.5,0,0]),v=o(`PatternPara`,[1,1,0,0]);e.map=null,e.normalMap=!c&&u?d:null,e.normalScale.setScalar(g[0]),e.color.set(16777215),e.roughness=c?1:g[1],e.metalness=c?0:g[2],e.emissive.set(16777215),e.emissiveIntensity=1;let y={neoGlassN:{value:d},neoGlassP:{value:f},neoGlassPattern:{value:p},neoEmissionScale:{value:1}};return e.onBeforeCompile=e=>{Object.assign(e.uniforms,y),e.vertexShader=`varying vec2 neoGlassUv;
`+e.vertexShader.replace(`#include <uv_vertex>`,`#include <uv_vertex>
neoGlassUv=uv;`),e.fragmentShader=`varying vec2 neoGlassUv;
      uniform sampler2D neoGlassN,neoGlassP,neoGlassPattern;
      uniform float neoEmissionScale;
      vec3 neoGlassLinear(vec3 c){return ${c?`c*c`:`pow(max(c,vec3(0.0)),vec3(2.2))`};}
    `+e.fragmentShader,e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,``),e.fragmentShader=e.fragmentShader.replace(`#include <alphatest_fragment>`,``).replace(`#include <alphahash_fragment>`,``),e.fragmentShader=e.fragmentShader.replace(`#include <normal_fragment_maps>`,`
      vec4 glassP=${c?`vec4(1.0)`:`texture2D(neoGlassP,neoGlassUv)`};
      vec4 glassPat=vec4(.5,.5,1.0,0.0);
      ${l?`vec2 glassUv=neoGlassUv*${s(v.slice(0,2))};
      ${c?``:`vec3 glassView=${u?`normalize(transpose(tbn)*normalize(vViewPosition))`:`normalize(inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0))`};
      float glassZ=abs(glassView.z)<.000001?(glassView.z<0.0?-.000001:.000001):glassView.z;
      glassUv-=glassView.xy/glassZ*${a(`PatternDeapthOffset`)};`}
      glassUv-=.5;
      float glassAngle=${a(`PatternRotationAngle`)}*6.283/360.0;
      glassUv=mat2(cos(glassAngle),sin(glassAngle),-sin(glassAngle),cos(glassAngle))*glassUv;
      glassUv+=.5+${s(v.slice(2))};
      glassPat=texture2D(neoGlassPattern,glassUv);`:``}
      ${!c&&u&&Number(n.LIGHT_ENABLE)!==0?`vec3 glassTexN=texture2D(neoGlassN,neoGlassUv).xyz;
      vec3 glassNormal=glassTexN*2.0-1.0;glassNormal.xy*=${g[0].toFixed(8)};
      ${l?`vec3 glassT=glassTexN*2.0+vec3(-1.0,-1.0,0.0);
      vec3 glassU=glassPat.xyz*vec3(-2.0,-2.0,2.0)+vec3(1.0,1.0,-1.0);
      glassT.xy*=${g[0].toFixed(8)};glassU.xy*=${_[0].toFixed(8)};
      glassNormal=glassT*dot(glassT,glassU)-glassU*glassT.z;`:``}
      normal=normalize(tbn*normalize(glassNormal));`:``}
      diffuseColor.rgb=neoGlassLinear(mix(${s(m.slice(0,3))},${s(h.slice(0,3))},glassPat.a*${a(`PatternColorKey`,1)}));
      diffuseColor.a=${m[3].toFixed(8)}*mix(${a(`Extra_Op`,1)},${a(`Pattern_Op`,1)},glassPat.a)*opacity;
      roughnessFactor=${c?`1.0`:`mix(${g[1].toFixed(8)},clamp(glassP.g*${g[1].toFixed(8)},0.0,1.0),${a(`UGCKey_R`,1)})`};
      metalnessFactor=${c?`0.0`:`mix(${g[2].toFixed(8)},clamp(glassP.b*${g[2].toFixed(8)},0.0,1.0),${a(`UGCKey_M`,1)})`};
      ${!c&&l?`roughnessFactor=mix(roughnessFactor,${_[1].toFixed(8)},glassPat.a);
      metalnessFactor=mix(metalnessFactor,${_[2].toFixed(8)},glassPat.a);`:``}
      #include <alphatest_fragment>
      #include <alphahash_fragment>
    `),e.fragmentShader=e.fragmentShader.replace(`#include <emissivemap_fragment>`,`totalEmissiveRadiance=${c?`vec3(0.0)`:`neoGlassLinear(${s(h.slice(0,3))})*glassPat.a*${a(`PatternColorKey`,1)}*${_[3].toFixed(8)}*neoEmissionScale`};`),e.fragmentShader=e.fragmentShader.replace(`#include <aomap_fragment>`,`
      reflectedLight.indirectDiffuse*=glassP.r;
      // Current source glass EnvLighting: specular *5; quality2 forward path omits specular.
      reflectedLight.indirectSpecular*=${c?`0.0`:`5.0`};
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),glassP.r,material.roughness);
      #endif
    `)},i.push(`玻璃材质输入与 Pattern 公式已转写；NeoX GLASS 光照模型、场景透射及 Scale9/软体未完整还原`),y}