import * as THREE from 'three';

// char_laser01: source Tex0 lookup driven by laser normal, with Tex3 blend.
export async function configureCharLaser(m,p,macros,load,warnings){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const v=(k,d)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)?a:d;}catch{return d;}};
  const rgb=(k,d)=>`vec3(${v(k,d).slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
  const [al,nm,laser,diff]=await Promise.all([load('Tex0',true),load('Tex1'),load('Tex2'),load('Tex3')]);
  if(!al||!nm||!laser||!diff)return null;
  const i=v('Intensity',[1,1,1,0]); m.map=al;m.normalMap=nm;m.normalScale.setScalar(Number(i[0])||1);m.roughness=0;m.metalness=0;m.specularIntensity=.5;
  const u={charLaserNormal:{value:laser},charLaserDiffuse:{value:diff},charLaserTime:{value:0}};
  const change=Number(macros.CHAR_CHANGE_COLOR)===1;
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.fragmentShader='uniform sampler2D charLaserNormal,charLaserDiffuse;uniform float charLaserTime;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec3 cln=texture2D(charLaserNormal,vUv*1.2).xyz*2.0-1.0;vec3 clview=normalize(vViewPosition);float cldot=dot(clview,normalize(cln));float clgray=clamp(0.2125*clamp(cos(cldot),0.0,1.0)+0.7154*clamp(sin(cldot),0.0,1.0),0.0,1.0);vec3 clbase=texture2D(map,vUv*${n('TilingAmount',.5).toFixed(8)}).rgb;clbase=mix(clbase,texture2D(charLaserDiffuse,vUv).rgb,.5);clbase=mix(clbase,${rgb('BlendColor',[1,1,1,1])},clgray);${change?'clbase=vec3(dot(clbase,vec3(.2125,.7154,.0721)))*'+rgb('BaseColor',[1,1,1,1])+';':''}diffuseColor.rgb=clbase*${n('TintValue',1).toFixed(8)};diffuseColor.a=1.0*opacity;`);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',Number(macros.RENDER_QUALITY)>=2?'':'#include <normal_fragment_maps>');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`float clf=clamp(${n('FresnelScale',0).toFixed(8)}+(1.0-${n('FresnelScale',0).toFixed(8)})*pow(1.0-dot(normal,clview),5.0),0.0,1.0);totalEmissiveRadiance=clf*${rgb('RimColor',[0,0,0,1])}*${Number(i[3])||0}.0;`);
  };
  warnings.push('char_laser01 已按源 Tex0/1/2/3、激光法线灰度查找、BlendColor、TintValue 与 Fresnel 接入；SoftBody 参数源函数为空');
  return u;
}
