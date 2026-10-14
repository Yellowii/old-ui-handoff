import {sourceSfxRecomposeController} from './source-sfx-controller.js';
const f32=Math.fround,epsilon=9.999999747378752e-5,minDuration=66.66666666666667;
const finite=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new TypeError(`${name} required`);return x;};

// Generic FrameClock 4945ba8/c98/cc8/d4c/6088. Values stored as double stay
// JS numbers; only native float loads/conversions are rounded through f32.
export function createSourceSfxTrackClock({durationMilliseconds,loop,rate=1,reverse=false}){
  durationMilliseconds=finite(durationMilliseconds,'durationMilliseconds');
  if(typeof loop!=='boolean'||typeof reverse!=='boolean')throw new TypeError('Explicit clock loop/reverse required');
  const state={time:0,duration:0,rate:f32(finite(rate,'rate')),loop,running:true,reverse,loopCount:0,event:0,previousEvent:0,start:0,end:0};
  if(durationMilliseconds<0){state.duration=-1;state.end=-1;state.loop=false;state.reverse=false;}
  if(f32(durationMilliseconds)>f32(epsilon)){
    state.duration=Math.max(f32(durationMilliseconds),minDuration);state.end=f32(durationMilliseconds);
  }
  const reset=()=>{state.running=false;state.time=0;state.duration=0;state.start=0;state.end=0;};
  const start=()=>{
    if(state.duration===0)return false;
    state.running=true;
    if(state.duration<0){state.reverse=false;state.time=0;return true;}
    if(state.reverse){if(state.time<state.start+epsilon)state.time=state.end;}
    else if(state.time>state.end-epsilon)state.time=state.start;
    return true;
  };
  const seek=value=>{
    value=f32(finite(value,'track seek time'));
    state.previousEvent=state.event;state.event=0;state.time=value;
    if(state.duration<0){
      if(state.start+epsilon>value){state.time=state.start;state.event=1;}
      return state.time;
    }
    if(state.duration<epsilon){state.time=0;return state.time;}
    if(state.end<value)state.time=state.start+(value%(state.end-state.start));
    if(state.time<state.start+epsilon){state.time=state.start;state.event=1;}
    else if(state.time>state.end-epsilon){state.time=state.end;state.event=2;}
    return state.time;
  };
  const advance=({primaryDeltaMilliseconds,fallbackDeltaMilliseconds})=>{
    if(!state.running)return false;
    const primary=f32(finite(primaryDeltaMilliseconds,'primaryDeltaMilliseconds'));
    const fallback=finite(fallbackDeltaMilliseconds,'fallbackDeltaMilliseconds');
    const delta=(primary!==0?primary:fallback)*state.rate;
    if(state.duration>=0&&state.duration<delta)return false;
    if(state.duration<epsilon){
      if(state.duration>=0)return false;
      state.time+=delta;
      return true;
    }
    state.previousEvent=state.event;state.event=0;
    if(state.reverse){
      state.time-=delta;
      if(state.time<state.start+epsilon){
        if(state.loop){
          const span=state.end-state.start;
          state.event=1;
          do{state.time=Math.min(state.end,state.time+span);state.loopCount=(state.loopCount+1)>>>0;}while(state.time<state.start+epsilon);
        }else{state.time=state.start;state.running=false;state.event=2;return true;}
      }
      if(state.time-delta<state.start+epsilon&&state.loop)state.event=2;
    }else{
      state.time+=delta;
      if(state.time>state.end-epsilon){
        if(state.loop){
          const span=state.end-state.start;
          state.event=1;
          do{state.time=Math.max(state.start,state.time-span);state.loopCount=(state.loopCount+1)>>>0;}while(state.time>state.end-epsilon);
        }else{state.time=state.end;state.running=false;state.event=2;return true;}
      }
      if(state.time+delta>state.end-epsilon&&state.loop)state.event=2;
    }
    return true;
  };
  return {state,start,reset,seek,advance};
}

// Track update 2e77428: update parent first. A parent sample or a dirty child
// forces sampling even when this clock did not advance.
export function bindSourceSfxTrackClock(track,{parentTrack,propagateParentControl=false,readFrameDelta,durationMilliseconds=track.periodMilliseconds,loop=track.loop,rate=1,reverse=false}){
  if(typeof readFrameDelta!=='function')throw new TypeError('readFrameDelta required');
  if(typeof propagateParentControl!=='boolean')throw new TypeError('Parent-control propagation flag required');
  const clock=createSourceSfxTrackClock({durationMilliseconds,loop,rate,reverse});
  clock.state.running=false; // Controller attachment calls track virtual40 (stop).
  let dirty=false;
  return {
    isStatic:track.isStatic,parentTrack,
    getTransform:()=>track.getTransform(),
    start(){const started=clock.start();if(started&&parentTrack&&propagateParentControl)parentTrack.start();return started;},
    stop(){clock.state.running=false;if(parentTrack&&propagateParentControl)parentTrack.stop();},
    reset(){clock.reset();if(parentTrack&&propagateParentControl)parentTrack.reset();},
    seek(time){clock.seek(time);if(parentTrack&&propagateParentControl)parentTrack.seek(time);track.sampleClock(clock.state.time);return track.getTransform();},
    markDirty(){dirty=true;},
    update(){
      const parentChanged=parentTrack?(parentTrack.updateCore??parentTrack.update)():false;
      const advanced=clock.advance(readFrameDelta());
      const changed=parentChanged||dirty||advanced;
      if(changed)track.sampleClock(clock.state.time);
      dirty=false;return changed;
    },
    clock,
  };
}

// Controller 2b84ec8/2b84f18: seek samples first, then starts the clock and
// recomposes. Starting at the end can rewind the clock without resampling.
export function bindSourceSfxControllerRuntime(controller,{readTransformContext}){
  if(typeof readTransformContext!=='function')throw new TypeError('readTransformContext required');
  controller.recompose=()=>sourceSfxRecomposeController(controller,readTransformContext(controller));
  controller.seekMilliseconds=time=>{
    if(!controller.track)return;
    controller.track.seek(time);controller.track.start();
    return controller.recompose();
  };
  controller.stop=()=>controller.track?.stop();
  return controller;
}

export function createSourceSfxControllerLifecycleHooks(getController){
  if(typeof getController!=='function')throw new TypeError('getController required');
  return {
    controllerSeek(node,milliseconds){getController(node)?.seekMilliseconds(milliseconds);},
    controllerStop(node){getController(node)?.stop();},
  };
}
