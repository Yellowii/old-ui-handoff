import {WardrobeViewer} from '../viewer.js';
import {Box3,Vector3} from 'three';
import {expandPosedBounds} from '../posed-bounds.js';

// Only the main appearance viewport retains user zoom. Thumbnails and the
// migration page continue using WardrobeViewer without session state.
export class SessionViewer extends WardrobeViewer {
  constructor(...args) {
    super(...args);
    this.sessionZoom=null;
    this.userGesture=false;
    this.controls.addEventListener('start',()=>{
      this.userGesture=true;this.gestureZoom=this.zoomFactor();
      if(this.pairFraming)this.pairFraming.manual=true;
    });
    this.controls.addEventListener('end',()=>{this.userGesture=false;});
    this.controls.addEventListener('change',()=>{
      if(!this.userGesture || this.adjustingCamera || !this.actor)return;
      const factor=this.zoomFactor();
      // Orbit/pan events also emit change. Rotation alone must not pin zoom.
      if(Math.abs(factor-this.gestureZoom)>1e-6){
        this.sessionZoom=factor;this.gestureZoom=factor;
      }
    });
  }
  zoomFactor(){return this.camera.position.distanceTo(this.controls.target)/this.radius;}
  updateDepthRange(){
    // Zoom must never move the near plane into an actor's animated limbs/props.
    // The shared loader already disables static mesh-bound culling for these models.
    const radius=Math.max(.01,this.radius||1),distance=this.camera.position.distanceTo(this.controls.target);
    this.camera.near=Math.max(.0001,Math.min(.01,radius*.0001));
    this.camera.far=Math.max(1000,distance+radius*200,distance+(this.environmentRadius||0)*2);
    this.camera.updateProjectionMatrix();
  }
  adjustCamera(action) {
    this.adjustingCamera=(this.adjustingCamera||0)+1;
    try{return action();}finally{
      this.adjustingCamera--;
      if(this.userGesture)this.gestureZoom=this.zoomFactor();
    }
  }
  restoreSessionZoom() {
    if(Number.isFinite(this.sessionZoom))super.setDistance(this.sessionZoom);
  }
  setUserZoom(factor) {
    if(!Number.isFinite(factor))return;
    this.adjustCamera(()=>{super.setDistance(factor);this.sessionZoom=this.zoomFactor();});
  }
  resetCamera() {
    this.sessionZoom=null;
    if(this.multiActorTransform){this.pairFraming=null;this.updatePreviewFraming(true);return;}
    this.adjustCamera(()=>super.fit());
  }
  updatePreviewFraming(force=false) {
    if(!this.multiActorTransform){
      const previous=this.pairFraming;
      // returnIdle loads asynchronously. Don't frame the last airborne pose
      // as though it were the restored idle pose.
      if(previous?.actor===this.actor&&!this.playingIdle)return;
      this.pairFraming=null;
      if(previous?.actor===this.actor&&this.playingIdle){
        this.world.updateMatrixWorld(true);
        const bounds=expandPosedBounds(this.actor,new Box3());
        for(const companion of this.companions.values())expandPosedBounds(companion.root,bounds);
        this.adjustCamera(()=>{super.frameBounds(bounds,0);this.restoreSessionZoom();});
      }
      return;
    }
    if(this.pairFraming?.transform!==this.multiActorTransform)
      this.pairFraming={transform:this.multiActorTransform,actor:this.actor,bounds:new Box3(),radius:0,manual:false};
    const frame=this.pairFraming;
    if(this.autoRotate)frame.manual=true;
    // A user's closer view or pan/rotation takes precedence until reset/new pair.
    if(!force&&(frame.manual||this.userGesture||Number.isFinite(this.sessionZoom)))return;
    this.world.updateMatrixWorld(true);
    const current=expandPosedBounds(this.actor,new Box3());
    for(const companion of this.companions.values())expandPosedBounds(companion.root,current);
    if(current.isEmpty()||![...current.min.toArray(),...current.max.toArray()].every(Number.isFinite))return;
    const size=current.getSize(new Vector3()),center=current.getCenter(new Vector3());
    const radius=Math.max(size.length()/2,.01);
    // Follow travel, retaining the largest pose radius so a repeating jump
    // doesn't pump zoom or reserve empty space all the way down to the floor.
    frame.radius=Math.max(frame.radius,radius);
    const next=new Box3().setFromCenterAndSize(center,size.multiplyScalar(frame.radius/radius));
    if(frame.bounds.equals(next))return;
    frame.bounds.copy(next);
    this.adjustCamera(()=>super.frameBounds(frame.bounds,0));
  }
  fit() {
    this.adjustCamera(()=>{super.fit();this.restoreSessionZoom();});
  }
  frameVisible(...args) {
    this.adjustCamera(()=>{super.frameVisible(...args);this.restoreSessionZoom();});
  }
  resize() {
    // Base constructor calls resize before the session fields are initialized.
    this.adjustCamera(()=>{super.resize();this.restoreSessionZoom();});
  }
}
