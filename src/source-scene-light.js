import {getHandoffServices} from './handoff/services.js';

// Host scene inputs use source coordinates. Normalize only the direction;
// color is the source Diffuse Color already multiplied by Intensity.
function sceneVector(name){
  const value=getHandoffServices().runtimePolicy?.sceneLight?.[name];
  if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw Error(`Provide runtimePolicy.sceneLight.${name} (three finite numbers)`);
  if(name==='sunDirection'){
    const length=Math.hypot(...value);
    if(!Number.isFinite(length)||length===0)throw Error('Nonzero finite runtimePolicy.sceneLight.sunDirection required');
  }
  return [...value];
}

export function sourceSceneSunDirection(){return sceneVector('sunDirection');}
export function sourceSceneSunColor(){return sceneVector('sunColor');}
export const sourceSceneLightWarning='Host-provided source scene lighting preview; full runtime lighting, BRDF and half precision are not equivalent.';

export function sourceSceneSunGlsl(){
  const direction=sourceSceneSunDirection(),length=Math.hypot(...direction);
  return `vec3(${direction.map(value=>(value/length).toFixed(8)).join(',')})`;
}

export function sourceSceneSunColorGlsl(){return `vec3(${sourceSceneSunColor().map(x=>x.toFixed(8)).join(',')})`;}
