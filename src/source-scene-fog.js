import {getHandoffServices} from './handoff/services.js';

export function sourceSceneFogFor(source){
  const configured=getHandoffServices().runtimePolicy?.sceneFogMatcher;
  return typeof configured==='function'?configured(source)||null:null;
}
