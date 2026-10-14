import {ClampToEdgeWrapping,Vector3} from 'three';
import {configureLineDogOutline} from './line-dog-outline.js';

// Current source main pass and the independent outline selected by the SURF.
export async function configureLineDog(m,p,macros,load,warnings,o={}){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const f=(k,d=0)=>n(k,d).toFixed(8);
  const v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length===d.length&&a.every(Number.isFinite))return a;}catch{}return d;};
  const rgb=(k,d)=>`vec3(${v(k,d).slice(0,3).map(x=>x.toFixed(8)).join(',')})`;
  const i=v('Intensity',[1,1,1,0]),low=Number(macros.RENDER_QUALITY)>=2;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const noisy=o.lineDogNoisy===true,gaps=[];
  if(![0,1,2].includes(Number(macros.RENDER_QUALITY??0)))gaps.push('未验证画质');
  if(useNormal&&!o.sourceTangents)gaps.push('缺少原切线');
  if(n('Line_Width')!==0&&!o.sourceVertexColors)gaps.push('描边缺少原顶点色');
  const scalars=['Line_Width','Lightness','TintValue','CharOffset','FaceUVOffset','FresnelScale',...(noisy?['Line_Tiling_U','Line_Tiling_V','Line_Offset_U','Line_Offset_V']:[])];
  if(scalars.some(k=>!Number.isFinite(Number(p[k]))))gaps.push('无效原参数');
  for(const [k,size] of [['Intensity',4],['BaseColor',4],['RimColor',4],...(noisy?[['Center',3],['CenterOF',3],['OutlineColor',4]]:[])]){
   try{const a=JSON.parse(p[k]);if(!Array.isArray(a)||a.length!==size||!a.every(Number.isFinite))gaps.push('无效 '+k);}catch{gaps.push('无效 '+k);}
  }
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){
   try{const a=JSON.parse(p[k]??'[0,0,0]');if(!Array.isArray(a)||a.length!==3||a.some(x=>x!==0))gaps.push('活动软体未验证');}catch{gaps.push('无效软体参数');}
  }
  if(['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'].some(k=>Number(macros[k]??0)!==0))gaps.push('未验证顶点分支');
  if(gaps.length){warnings.push(...gaps.map(g=>'LineDog：'+g));return null;}
  const required=['Tex0','Ramp',...(useNormal?['Tex1']:[]),...(noisy?['Line']:[])],maps={};
  for(const k of required)maps[k]=await load(k,false);
  if(required.some(k=>!maps[k]?.isTexture||maps[k].isCubeTexture)){warnings.push('LineDog 两 Pass 缺少有效二维贴图');return null;}
  if(o.lineDogOutline)return configureLineDogOutline(m,p,maps,noisy);
  const {Tex0:al,Tex1:nm,Ramp:originalRamp}=maps;
  const ramp=originalRamp.clone();ramp.wrapS=ramp.wrapT=ClampToEdgeWrapping;ramp.needsUpdate=true;
  m.addEventListener('dispose',()=>ramp.dispose());
  const sun=v('SunDirection',[0,0,0]),hasSun=Math.hypot(...sun)>0;
  m.map=al;m.normalMap=useNormal?nm:null;m.normalScale.setScalar(i[0]);
  m.color.set(0xffffff);m.roughness=i[1];m.metalness=i[2];m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoDogAlbedo:{value:al},neoDogNormal:{value:nm},neoDogRamp:{value:ramp},
    neoDogSun:{value:new Vector3(...sun).normalize()},neoFaceOffset:{value:n('FaceUVOffset')},neoEmissionScale:{value:1}};
  m.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);
    const vary='varying vec3 dogN,dogT,dogB;\n';
    s.vertexShader=vary+s.vertexShader.replace('#include <normal_vertex>',`#include <normal_vertex>
      vec3 dogInputN=transformedNormal;
      #ifdef FLIP_SIDED
      dogInputN=-dogInputN;
      #endif
      dogN=normalize(inverseTransformDirection(dogInputN,viewMatrix))*vec3(-1,1,1);
      dogT=vec3(1,0,0);dogB=vec3(0,1,0);
      ${useNormal?'dogT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1,1,1);dogB=cross(dogN,dogT)*tangent.w;':''}
    `);
    s.fragmentShader=vary+s.fragmentShader;
    s.fragmentShader=`uniform sampler2D neoDogAlbedo,neoDogNormal,neoDogRamp;
      uniform vec3 neoDogSun;uniform float neoFaceOffset,neoEmissionScale;
      vec2 neoDogUv(vec2 uv){uv.x+=uv.y<.25?neoFaceOffset*${f('CharOffset',1)}:0.0;return uv;}
      vec3 neoDogLinear(vec3 c){return ${low?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      vec4 dogTex=texture2D(neoDogAlbedo,neoDogUv(vMapUv));
      vec3 dogBase=neoDogLinear(dogTex.rgb);
      ${Number(macros.CHAR_CHANGE_COLOR)===1?`dogBase=vec3(dot(dogBase,vec3(.2125,.7154,.0721)))*${rgb('BaseColor',[1,1,1,1])};`:''}
      dogBase*=${f('TintValue',1)};
      diffuseColor=vec4(vec3(0.0),dogTex.a*opacity);
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?`
      vec3 dogLocal=texture2D(neoDogNormal,neoDogUv(vMapUv)).xyz*2.0-1.0;
      dogLocal.xy*=${i[0].toFixed(8)};
      vec3 dogWorldN=mat3(dogT,dogB,dogN)*normalize(dogLocal);
      normal=mat3(viewMatrix)*(dogWorldN*vec3(-1,1,1));
    `:'');
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`
      vec3 dogLight=vec3(0.0);
      ${hasSun?'dogLight=normalize(mat3(viewMatrix)*(-neoDogSun*vec3(-1.0,1.0,1.0)));':`
      #if NUM_DIR_LIGHTS > 0
      dogLight=directionalLights[0].direction;
      #endif
      `}
      float dogRampUv=dot(normal,dogLight)*.5+.5;
      float dogRamp=neoDogLinear(texture2D(neoDogRamp,vec2(dogRampUv,0.0)).rgb).r;
      float dogF=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(normal,normalize(vViewPosition)),5.0),0.0,1.0);
      totalEmissiveRadiance=(dogBase*${f('Lightness',1)}*dogRamp+dogF*${rgb('RimColor',[0,0,0,0])}*${i[3].toFixed(8)})*neoEmissionScale;
    `).replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  if(!hasSun)warnings.push('LineDog 未提供源场景 SunDirection，预览使用当前场景首个方向光，非原游戏光照还原');
  if(useNormal)m.defines={...m.defines,USE_TANGENT:''};
  warnings.push('LineDog 原主/描边两 Pass 与存储切线已接入；原场景和活动软体仍未完整还原');
  return uniforms;
}
