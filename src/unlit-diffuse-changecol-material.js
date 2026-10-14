// Exact channel path for unlit_diffuse_changecol_v.surf.
// The source uses Tex0 alpha for opacity and four authored mask colors to
// build the emissive result; foliage-only vertex mask branches stay disabled.
export async function configureUnlitDiffuseChangeColor(m,p,macros,load,warnings){
  const n=(k,d=0)=>{const x=Number(p[k]);return Number.isFinite(x)?x:d;}, v=(k,d)=>{try{const a=JSON.parse(p[k]??'');return Array.isArray(a)&&a.length===4&&a.every(Number.isFinite)?a:d;}catch{return d;}};
  const tex=await load('Tex0',false),maskTex=await load('Tex1',false); if(!tex?.isTexture||tex.isCubeTexture||!maskTex?.isTexture||maskTex.isCubeTexture){warnings.push('unlit_diffuse_changecol_v 缺少源二维 Tex0/Tex1');return null;}
  const mask=[v('MaskColor0',[1,0,0,1]),v('MaskColor1',[0,1,0,1]),v('MaskColor2',[0,0,1,1]),v('MaskColor3',[0,0,0,1])];
  const finite=['OffsetSpeed','OffsetStrength','OffsetScale'].every(k=>Number.isFinite(n(k)));
  if(!finite){warnings.push('unlit_diffuse_changecol_v 源参数无效');return null;}
  const f=x=>Number(x).toFixed(8), rgb=a=>`vec3(${a.slice(0,3).map(f).join(',')})`,em=v('EmissiveIntensity',[0,0,0,0]);
  const u={neoEmissionScale:{value:1},ucvTex0:{value:tex},ucvTex1:{value:maskTex}};
  m.map=null;m.normalMap=null;m.roughness=1;m.metalness=0;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,u);
    const vary='varying vec2 ucvUv;varying vec3 ucvN;\n';
    s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nucvUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>\nucvN=normalize(transformedNormal);`);
    s.fragmentShader=vary+`uniform sampler2D ucvTex0,ucvTex1;uniform float neoEmissionScale;\n`+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec4 ucvBase=texture2D(ucvTex0,ucvUv);\n diffuseColor=vec4(0.0,0.0,0.0,ucvBase.a*opacity);`)
      .replace('#include <emissivemap_fragment>',`vec4 ucvBase2=texture2D(ucvTex0,ucvUv),ucvEmissiveMask=texture2D(ucvTex1,ucvUv);\n float ucvMask=1.0+${f(em[0])}*ucvEmissiveMask.r;\n vec3 ucvCol0=mix(${rgb(mask[0])}*ucvMask,${rgb(mask[1])}*ucvMask,ucvUv.y);\n vec3 ucvCol=mix(${rgb(mask[0])}*ucvMask,${rgb(mask[1])}*ucvMask,ucvBase2.r);\n ucvCol=mix(ucvCol,${rgb(mask[2])}*ucvMask,ucvBase2.g);ucvCol=mix(ucvCol,${rgb(mask[3])}*ucvMask,ucvBase2.b);\n vec3 ucvResult=mix(ucvCol0,ucvCol,${f(n('ChangeColorKey',1))});\n float ucvShadow=getShadowMask()*0.5+0.5; totalEmissiveRadiance=ucvResult*${f(n('Lightness',1))}*ucvShadow*neoEmissionScale;`)
      .replace('#include <aomap_fragment>','');
  };
  warnings.push('unlit_diffuse_changecol_v颜色/透明通道已接入；原局部顶点噪声位移与植被交互仍未接入');
  return u;
}
