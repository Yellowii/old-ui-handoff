// Android CharAgentFaceComp + FaceAnimHelper + FaceStatus.DEFAULT_STATUS_2_FACE_CONF.
export class SourceFaceAnimation {
  constructor(apply,random=Math.random){this.apply=apply;this.random=random;this.reset();}
  reset(track=null){this.track=track;this.clock=0;this.checkAt=5;this.blinkAt=null;this.started=null;this.offset=0;this.apply(0);}
  setOffset(value){if(this.offset!==value){this.offset=value;this.apply(value);}}
  update(dt,idle){
    this.clock+=dt;
    const checkDue=this.clock>=this.checkAt;if(checkDue)this.checkAt=this.clock+5;
    if(!idle){this.blinkAt=null;this.started=null;this.setOffset(0);return;}
    if(!this.track?.length)return;
    if(checkDue&&this.blinkAt===null)this.blinkAt=this.clock+2+Math.floor(this.random()*4);
    if(this.blinkAt!==null&&this.clock>=this.blinkAt){this.started=this.blinkAt;this.blinkAt=null;}
    if(this.started!==null){
      const frame=(this.clock-this.started)*30;
      let index=0;for(const [at,value] of this.track){if(at>frame)break;if(value>0)index=value;}
      if(index>0)this.setOffset((index-1)*.25);
      if(frame>=this.track.at(-1)[0])this.started=null;
    }
  }
}
