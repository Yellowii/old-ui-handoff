const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};

// Scene actor2a0edfc, reached by Dummy29ded80 and Group2b66df8. Each source
// word encodes service indices in reverse bit order: bit0→31, bit31→0.
export function sourceSfxLeaveActorServices(actor,context,{getService,diagnostic}){
  if(!actor||!context)return;
  const words=actor.sceneServiceMask;
  if(!Array.isArray(words)||words.length!==4||words.some(n=>!Number.isInteger(n)||n<0||n>0xffffffff))throw new TypeError('Source four-word scene service mask required');
  // Original virtuala0 supplies a snapshot before any service callbacks.
  const snapshot=[...words];
  for(let word=0;word<4;word++){
    for(let bit=0;bit<32;bit++){
      if((snapshot[word]&(1<<bit))===0)continue;
      const index=word*32+31-bit;
      const service=required(getService,'source scene service lookup')(context,index);
      if(service)required(service.removeActor,'scene service virtual28').call(service,actor);
      else required(diagnostic,'source scene diagnostic')('missing-actor-service',index,actor);
    }
  }
  // virtualb8 writes all four zero words even if callbacks modified the mask.
  actor.sceneServiceMask=[0,0,0,0];
}
