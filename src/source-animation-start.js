export const SourceAnimationType=Object.freeze({SINGLE:0,LOOP:1,SINGLE_LOOP:2});

function positiveModulo(value,divisor){return ((value%divisor)+divisor)%divisor;}

// startTime and getDurationSeconds values are seconds. The source callback returned
// milliseconds and divided by 1000 before applying these rules.
export function calculateAnimationStart(rule,startTime,getDurationSeconds){
  const animNames=rule?.anim_names??[];
  const animType=rule?.anim_type??SourceAnimationType.SINGLE;
  if(!animNames.length)return {animNames:[],startTime:0,animType};

  if(animType===SourceAnimationType.SINGLE){
    const animName=animNames[0];
    const duration=getDurationSeconds(animName);
    return {animNames:[animName],startTime:startTime>=duration?duration:startTime,animType};
  }

  if(animType===SourceAnimationType.LOOP){
    const animName=animNames[0];
    const duration=getDurationSeconds(animName);
    return {animNames:[animName],startTime:duration>0?positiveModulo(startTime,duration):0,animType};
  }

  if(animType===SourceAnimationType.SINGLE_LOOP&&animNames.length>=2){
    const [firstAnimName,loopAnimName]=animNames;
    const firstDuration=getDurationSeconds(firstAnimName);
    if(startTime<firstDuration)return {animNames:[firstAnimName,loopAnimName],startTime,animType};
    const loopDuration=getDurationSeconds(loopAnimName);
    return {
      animNames:[loopAnimName],
      startTime:loopDuration>0?positiveModulo(startTime-firstDuration,loopDuration):0,
      animType:SourceAnimationType.LOOP,
    };
  }

  return {animNames,startTime,animType};
}
