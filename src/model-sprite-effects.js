import * as THREE from 'three';
import {requestJSON} from './handoff/services.js';

export const STATIC_SPRITE_PROFILE='static-camera-sprite-blend0-v1';
export const ADDITIVE_SPRITE_PROFILE='static-camera-sprite-blend2-v1';
let registry;
function profiles(){return registry??=requestJSON('/data/model-sprite-effects.json').then(r=>{if(!r.ok)throw Error('模型特效目录缺失');return r.json();}).catch(error=>{registry=null;throw error;});}

// Native blendadd.nfx/.ps, Sprite quad2b825a4 and GLES state3f90980.
// This closed profile has no animated color, atlas, roll, fog or soft depth.
export function createModelSprite(profile,texture){
  if(![STATIC_SPRITE_PROFILE,ADDITIVE_SPRITE_PROFILE].includes(profile.profile)||!Number.isFinite(profile.radius)||profile.radius<=0||!Number.isFinite(profile.ratio)||profile.ratio<=0||!Array.isArray(profile.rgba)||profile.rgba.length!==4||profile.rgba.some(v=>!Number.isFinite(v)||v<0||v>1)||!Array.isArray(profile.position)||profile.position.length!==3||profile.position.some(v=>!Number.isFinite(v)))throw Error('未支持的模型 Sprite 配置');
  const destination=profile.profile===ADDITIVE_SPRITE_PROFILE?THREE.OneFactor:THREE.OneMinusSrcAlphaFactor;
  const sampler=texture.clone();sampler.flipY=false;sampler.colorSpace=THREE.NoColorSpace;sampler.wrapS=sampler.wrapT=THREE.RepeatWrapping;sampler.needsUpdate=true;
  const material=new THREE.ShaderMaterial({
    uniforms:{sourceImage:{value:sampler},sourceColor:{value:new THREE.Vector4(...profile.rgba)}},
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 sourceUv;
      void main(){
        sourceUv=vec2(uv.x,1.0-uv.y);
        vec4 center=modelViewMatrix*vec4(0.0,0.0,0.0,1.0);
        vec2 size=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
        center.xy+=position.xy*size;
        gl_Position=projectionMatrix*center;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D sourceImage;
      uniform vec4 sourceColor;
      varying vec2 sourceUv;
      void main(){
        #include <logdepthbuf_fragment>
        gl_FragColor=clamp(texture2D(sourceImage,sourceUv,-2.0)*sourceColor,0.0,1.0);
      }`,
    // Billboards always face the camera. DoubleSide avoids the negative NeoX
    // parent determinant flipping GL culling after the basis was rebuilt here.
    side:THREE.DoubleSide,forceSinglePass:true,transparent:true,depthTest:true,depthWrite:false,depthFunc:THREE.LessEqualDepth,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:destination,
    blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.SrcAlphaFactor,blendDstAlpha:destination
  });
  material.userData={baseTransparent:true,baseAlphaTest:0,baseDepthWrite:false,baseDepthTest:true,baseBlending:THREE.CustomBlending,baseEmission:0,sourceSpriteProfile:profile.profile};
  material.addEventListener('dispose',()=>sampler.dispose());
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2*profile.radius,2*profile.radius*profile.ratio),material);
  mesh.name=profile.socket?.Name||'sourceSprite';mesh.position.fromArray(profile.position);mesh.frustumCulled=false;mesh.userData.sourceSprite=profile.effectPath;
  return mesh;
}

export async function attachModelSpriteEffects(root,desc,loadTexture){
  const data=await profiles();if(data.schemaVersion!==1||data.profile!==STATIC_SPRITE_PROFILE)throw Error('模型特效目录版本不受支持');
  const profile=data.models[desc.id];if(!profile)return;
  if(profile.modelSource.sha256!==desc.sourceBounds?.source?.sha256||!desc.dependencies?.some(d=>d.path===profile.effectPath))throw Error('模型特效来源已变化，请重新生成');
  const texture=await loadTexture(profile.texture);
  root.add(createModelSprite(profile,texture));
}
