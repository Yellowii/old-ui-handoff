// Source-space basis shared only by the two T107 adapters.
export const scalar=(v,d)=>{const x=v===undefined?d:Number(v);if(!Number.isFinite(x))throw Error('Invalid source scalar');return x;};
export const vector=(v,d)=>{const a=v===undefined?d:Array.isArray(v)?v:JSON.parse(String(v).startsWith('[')?v:'['+v+']');if(a.length!==d.length||!a.every(Number.isFinite))throw Error('Invalid source vector');return a;};
export const f=v=>v.toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(f).join(',')})`;
export function frame(material,shader,normalOn){
 const vary='varying vec2 t107Uv;varying vec3 t107N,t107T,t107B;\n';
 shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nt107Uv=uv;')
 .replace('#include <normal_vertex>',`#include <normal_vertex>
 vec3 t107Normal=transformedNormal;
 #ifdef FLIP_SIDED
 t107Normal=-t107Normal;
 #endif
 t107N=normalize(inverseTransformDirection(t107Normal,viewMatrix))*vec3(-1.,1.,1.);
 t107T=vec3(1,0,0);t107B=vec3(0,1,0);
 ${normalOn?'t107T=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.,1.,1.);t107B=cross(t107N,t107T)*tangent.w;':''}`);
 shader.fragmentShader=vary+shader.fragmentShader;
}
export function setup(m,normalOn){
 m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.vertexColors=false;
 m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
 if(normalOn)m.defines={...m.defines,USE_TANGENT:''};
}
export function flags(macros,o){
 const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),light=scalar(macros.LIGHT_ENABLE,1);
 if(![0,1,2].includes(q)||[normal,change,light].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
 if(normal&&!o.sourceTangents)throw Error('Missing original tangent basis');
 return {q,normal,change,light};
}
