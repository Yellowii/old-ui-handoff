import {scalar,vector,f,setup} from './t107-frame.js';

// Current Android unlit_diffuse_tonefix.surf/.hlsl; FrameTime and authored
// sequence Time are distinct inputs. Do not animate the latter implicitly.
export async function configureTonefix(m,p,macros,load,warnings){
 try{
  const style=scalar(macros.STYLE,0),quality=scalar(macros.RENDER_QUALITY,0);
  if(![0,1,2].includes(style)||![0,1,2].includes(quality))throw Error('Unknown STYLE/render quality');
  const known=new Set(['STYLE','RENDER_QUALITY','IS_CHARACTER','USE_LOCAL_PARAMATER','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active source permutation is not implemented');
  if(scalar(p.ImportRTKey,0)>.5)throw Error('Runtime render texture binding is not implemented');
  const n=k=>scalar(p[k],NaN),s=k=>f(n(k));
  for(const k of ['Lightness','fix','gama','AlphaTint','RectOpacity','Row','Col','Time','Fps','ScalingRatioX','UvClamp','Transition','DistortKey','DistortTilingX','DistortTilingY','DistortSpeedX','DistortSpeedY','DistortStrength'])n(k);
  if(!n('Row')||!n('Col')||!n('ScalingRatioX'))throw Error('Zero source UV divisor');
  const speed=vector(p.Speed,[0,0]),scale=vector(p.Scale,[1,1]);
  const maps=await Promise.all(['Tex0','Tex1'].map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original 2D texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1},tfTex0:{value:maps[0]},tfTex1:{value:maps[1]}};
  setup(m,false);m.roughness=1;m.metalness=0;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,u);
   shader.vertexShader='varying vec2 tfUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ntfUv=uv;');
   shader.fragmentShader=`varying vec2 tfUv;uniform sampler2D tfTex0,tfTex1;uniform float neoTime,neoEmissionScale;
    vec3 tfLinear(vec3 c){return ${quality<2?'pow(max(c,vec3(0.0)),vec3(2.2))':'c*c'};}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    vec2 tfDistort=vec2(0.0);
    ${n('DistortKey')>.5?`tfDistort=texture2D(tfTex1,tfUv*vec2(${s('DistortTilingX')},${s('DistortTilingY')})+neoTime*vec2(${s('DistortSpeedX')},${s('DistortSpeedY')})).rg;`:''}
    float tfTime=ceil(${s('Time')}*${s('Fps')}),tfRow=floor(tfTime/${s('Col')}),tfCol=tfTime-tfRow*${s('Col')};
    vec2 tfUv0=(tfUv+vec2(tfCol,tfRow))/vec2(${s('Col')},${s('Row')})+tfDistort*${s('DistortStrength')};
    vec4 tf0=texture2D(tfTex0,tfUv0),tf1=vec4(0.0);float tfMask=0.0;
    tf0.rgb=mix(tf0.rgb,tfLinear(tf0.rgb),${s('gama')});
    ${style===0?'tfMask=texture2D(tfTex1,tfUv).a;':style===1?`
     vec2 tfUv1=mix(tfUv,vec2(tfUv.x,clamp((tfUv.y-.25)*2.,0.,1.)),${s('UvClamp')});
     tfUv1=(tfUv1*vec2(${scale.map(f).join(',')})+neoTime*vec2(${speed.map(f).join(',')})*.1)/vec2(${s('ScalingRatioX')},1.);
     tf1=texture2D(tfTex1,tfUv1);tf1.rgb=tfLinear(tf1.rgb);`:
     `tf1=texture2D(tfTex1,tfUv);tf1.rgb=tfLinear(tf1.rgb);tf1.a=${s('Transition')};`}
    diffuseColor=vec4(0.,0.,0.,tf0.a*max(tfMask,1.-${s('RectOpacity')})*opacity);
   `).replace('#include <color_fragment>','').replace('#include <emissivemap_fragment>',`
    vec3 tfColor=mix(tf0.rgb,tf1.rgb,clamp(tf1.a*${s('AlphaTint')},0.,1.));
    float tfLuminance=dot(tfColor,vec3(.2125,.7154,.0721));
    totalEmissiveRadiance=mix(vec3(tfLuminance),tfColor,${s('fix')})*${s('Lightness')};
   `).replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance*neoEmissionScale;\n#include <opaque_fragment>');
  };
  warnings.push('tonefix: source texture/scroll/color rules connected; original scene postprocessing remains uncalibrated');
  return u;
 }catch(e){warnings.push('tonefix remains unsupported: '+e.message);return null;}
}
