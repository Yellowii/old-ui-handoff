import {Matrix4,Vector3,Quaternion} from 'three';

// Original legacy SpringAnim leaf path, constrained to type0/no collision/wind.
// Native 2a00470 schedules restoring force AFTER 2e9f718 integration; applying
// it before the step changes the phase. Mix applies to mass endpoints, not a
// quaternion slerp. Length is source mesh bone-bounds half.x, not child distance.
export class SourceLeafSpring {
 constructor(config,initialMatrix,axisSign=1){
  this.config=config;this.axisSign=axisSign;this.velocity=new Vector3();this.force=new Vector3();
  const {back,tip}=this.targets(initialMatrix);this.pin=back;this.position=tip;
 }
 targets(matrix){
  const center=new Vector3().setFromMatrixPosition(matrix),axis=new Vector3().setFromMatrixColumn(matrix,0).normalize().multiplyScalar(this.axisSign);
  const half=this.config.halfLength*this.config.scale;
  return {center,axis,half,back:center.clone().addScaledVector(axis,-half),tip:center.clone().addScaledVector(axis,half)};
 }
 step(matrix,delta){
  // SpringAnim::update (2a01800) caps the incoming frame at float32(.033)
  // before its no-pending-yaw tail call into 2a00470.
  const frameDelta=Math.min(Math.fround(delta),Math.fround(.033));
  const c=this.config,{axis,half,back,tip}=this.targets(matrix),dt=Math.max(Math.fround(.002),Math.min(1,frameDelta*3*c.speed));
  const old=this.position.clone(),acceleration=this.force.clone().add(c.gravity||new Vector3()).addScaledVector(this.velocity,-Math.min(c.airFriction+c.idleFriction,1));
  this.position.addScaledVector(this.velocity,dt*c.damping).addScaledVector(acceleration,dt*dt);
  this.velocity.copy(this.position).sub(old).multiplyScalar(1/dt);this.force.set(0,0,0);
  // Pin is evaluated before the first link; this leaf has a single free mass.
  this.pin.copy(back);const link=this.position.clone().sub(back),length=link.length();
  if(!(length>0))throw Error('Degenerate source spring link');
  this.position.addScaledVector(link,-(length-2*half)/length);
  const mixedTip=tip.clone().lerp(this.position,c.mix),mixedBack=back;
  this.force.copy(tip).sub(mixedTip).multiplyScalar(c.stiffness*10);
  const direction=mixedTip.clone().sub(mixedBack).normalize(),dot=axis.dot(direction),output=matrix.clone();
  if(Math.abs(dot)<Math.fround(.99999)){
   const rotation=new Quaternion().setFromUnitVectors(axis,direction);
   output.premultiply(new Matrix4().makeRotationFromQuaternion(rotation));
  }else if(dot<0){for(const column of [0,4,8])for(let j=0;j<3;j++)output.elements[column+j]*=-1;}
  const transformedAxis=new Vector3().setFromMatrixColumn(output,0).normalize().multiplyScalar(this.axisSign);
  output.setPosition(mixedTip.clone().addScaledVector(transformedAxis,-half));
  return output;
 }
}
