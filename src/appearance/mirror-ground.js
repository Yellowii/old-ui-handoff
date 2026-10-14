import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

// UI-owned planar reflection, using the installed Three.js reflection camera.
export function createMirrorGround(){
  const shader={...Reflector.ReflectorShader,uniforms:{...Reflector.ReflectorShader.uniforms,
    strength:{value:.7},blur:{value:0},texel:{value:new THREE.Vector2(1/512,1/512)},
  }};
  shader.fragmentShader=shader.fragmentShader
    .replace('uniform vec3 color;','uniform vec3 color;\n uniform float strength;\n uniform float blur;\n uniform vec2 texel;')
    .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`
      vec2 uv = vUv.xy / vUv.w;
      vec2 delta = texel * blur * 8.0;
      vec4 base = texture2D(tDiffuse, uv) * 0.25;
      base += texture2D(tDiffuse, uv + vec2(delta.x, 0.0)) * 0.125;
      base += texture2D(tDiffuse, uv - vec2(delta.x, 0.0)) * 0.125;
      base += texture2D(tDiffuse, uv + vec2(0.0, delta.y)) * 0.125;
      base += texture2D(tDiffuse, uv - vec2(0.0, delta.y)) * 0.125;
      base += texture2D(tDiffuse, uv + delta) * 0.0625;
      base += texture2D(tDiffuse, uv - delta) * 0.0625;
      base += texture2D(tDiffuse, uv + vec2(delta.x, -delta.y)) * 0.0625;
      base += texture2D(tDiffuse, uv + vec2(-delta.x, delta.y)) * 0.0625;
    `)
    .replace('blendOverlay( base.rgb, color )','mix(color, base.rgb, strength)');
  const mirror=new Reflector(new THREE.PlaneGeometry(1,1),{shader,textureWidth:512,textureHeight:512,multisample:0,clipBias:.003,color:'#8195a3'});
  mirror.name='UI mirror ground';mirror.rotation.x=-Math.PI/2;mirror.frustumCulled=false;
  return mirror;
}
