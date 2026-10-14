import {sourceSpecular} from './source-specular.js';
import {Matrix4,Vector3,Vector4,ClampToEdgeWrapping,LinearFilter,LinearMipmapLinearFilter,NoColorSpace} from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const contract=runtimeContract("water-wings-source.json");
import {scalar,vector,frame,setup} from './t107-frame.js';

export async function configureWaterWings(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  if(![0,1,2].includes(q)||![0,1].includes(normal))throw Error('Unknown source permutation');
  if(!o.sourceSecondUv)throw Error('Missing source forced TEXCOORD1');
  if(normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
  if(!o.sourceBounds?.half?.every(v=>Number.isFinite(v)&&v>0))throw Error('Missing positive original root bounds');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','TEXCOORD1_ENABLE','ALPHA_TEST_ENABLE','TWO_SIDED','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(scalar(macros.ENABLE_POINT_LIGHT_AND_SPOTLIGHT,1)!==1)throw Error('Disabled source point/spot permutation is not connected');
  for(const [key,value] of Object.entries(macros))if(!known.has(key)&&scalar(value,0)!==0)throw Error('Unsupported active '+key);
  const time={value:0},inverse=new Matrix4(),view=new Matrix4(),rx=new Matrix4().makeScale(-1,1,1),flipZ=new Matrix4().makeScale(1,1,-1),cameraPosition=new Vector3();
  const u={neoTime:time,ww_FrameTime:time,ww_InverseWorld:{value:inverse},ww_ViewMatrix:{value:view},ww_CameraPosition:{value:cameraPosition},ww_BoundHalfSize:{value:new Vector3(...o.sourceBounds.half)}};
  for(const [key,type] of Object.entries(contract.parameters)){
   if(p[key]===undefined)throw Error('Missing original default '+key);
   let value;if(type==='float')value=scalar(p[key]);
   else{const a=Array.isArray(p[key])?p[key]:JSON.parse(p[key]);if(!a.every(Number.isFinite)||a.length<Number(type.at(-1)))throw Error('Invalid '+key);value=type==='vec3'?new Vector3(...a.slice(0,3)):new Vector4(...a);}
   u['ww_'+key]={value};
  }
  if(u.ww_RainbowHue.value.lengthSq()===0)throw Error('Undefined original hue axis');
  for(const key of ['Tex0','Tex1','Tex3','Tex4']){
   const t=await load(key,false);if(!t?.isTexture||t.isCubeTexture)throw Error('Missing original '+key);u['ww_'+key]={value:t};
  }
  const cap=u.ww_Tex3.value.clone();cap.wrapS=cap.wrapT=ClampToEdgeWrapping;cap.minFilter=LinearMipmapLinearFilter;cap.magFilter=LinearFilter;cap.colorSpace=NoColorSpace;cap.needsUpdate=true;u.ww_Tex3.value=cap;m.addEventListener('dispose',()=>cap.dispose());
  setup(m,normal===1);m.defines={...m.defines,USE_UV1:''};
  m.onBeforeRender=(_r,_s,c,_g,obj)=>{
   inverse.copy(obj.matrixWorld).invert().multiply(rx).transpose();
   view.copy(c.matrixWorldInverse).premultiply(flipZ).multiply(rx).transpose();
   c.getWorldPosition(cameraPosition);cameraPosition.x*=-1;
  };
  const declarations=`#define ww_RENDER_QUALITY ${q}\n#define ww_NORMAL_MAP_ENABLE ${normal}\n`+
   Object.entries(contract.parameters).map(([key,type])=>`uniform ${type} ww_${key};`).join('\n')+`
   uniform float ww_FrameTime;uniform vec3 ww_CameraPosition,ww_BoundHalfSize;uniform mat4 ww_ViewMatrix,ww_InverseWorld;
   float ww_saturate(float x){return clamp(x,0.,1.);}vec2 ww_saturate(vec2 x){return clamp(x,0.,1.);}vec3 ww_saturate(vec3 x){return clamp(x,0.,1.);}vec4 ww_saturate(vec4 x){return clamp(x,0.,1.);}
   vec3 ww_Transform(mat3 m,vec3 v){return transpose(m)*v;}vec4 ww_Transform(mat4 m,vec4 v){return transpose(m)*v;}
   vec3 ww_srgb2linearf3(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
  `;
  const vary='varying vec2 wwSecondUv;varying vec3 wwWorld,wwOffset;\n';
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.vertexShader=declarations+vary+'struct ww_CommonVertex{vec4 uv;vec3 normal;};\n'+contract.vertex+'\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    ww_CommonVertex wwVertex;wwVertex.uv=vec4(uv,uv1);wwVertex.normal=normal;
    vec4 wwPosition=vec4(transformed,1.);ww_ApplyVertexOffsetLocal(wwVertex,wwPosition);
    wwOffset=wwPosition.xyz-transformed;transformed=wwPosition.xyz;wwSecondUv=uv1;`)
    .replace('#include <project_vertex>','#include <project_vertex>\nwwWorld=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);');
   s.fragmentShader=declarations+vary+`
    uniform sampler2D ww_Tex0,ww_Tex1,ww_Tex3,ww_Tex4;
    struct ww_Fragment{vec2 uv,second_uv;vec3 normal,tangent,binormal,position_world;};
    struct ww_Material{vec3 albedo,normal,emissive;float opacity,roughness,metalness,specular,occlusion;};
   `+contract.fragment+'\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    ww_Fragment wwFrag;wwFrag.uv=t107Uv;wwFrag.second_uv=wwSecondUv;wwFrag.normal=t107N;wwFrag.tangent=t107T;wwFrag.binormal=t107B;wwFrag.position_world=wwWorld;
    ww_RawData wwRaw=ww_GetRawData(wwFrag);ww_Material wwMtl;
    ww_GetAlbedo(wwFrag,wwRaw,wwMtl);ww_GetOpacity(wwFrag,wwRaw,wwMtl);ww_GetNormal(wwFrag,wwRaw,wwMtl);
    ww_GetRoughness(wwFrag,wwRaw,wwMtl);ww_GetMetalness(wwFrag,wwRaw,wwMtl);ww_GetSpecular(wwFrag,wwRaw,wwMtl);ww_GetEmissive(wwFrag,wwRaw,wwMtl);ww_GetOcclusion(wwFrag,wwRaw,wwMtl);
    diffuseColor=vec4(wwMtl.albedo,wwMtl.opacity*opacity);`)
    .replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(wwMtl.normal*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=wwMtl.roughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=wwMtl.metalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=wwMtl.emissive;')
    .replace('#include <lights_physical_fragment>',sourceSpecular('wwMtl.specular'));
  };
  m.userData.fidelity='source-material-channels-current-preview-lighting';
  return u;
 }catch(e){warnings.push('water wings remains unsupported: '+e.message);return null;}
}
