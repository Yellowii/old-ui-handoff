import {sourceSfxNormalize3} from './source-sfx-vector.js';
const f=Math.fround,EPS=f(.0001),sub=(a,b)=>a.map((v,i)=>f(v-b[i]));
const length=v=>f(Math.sqrt(f(f(f(v[0]*v[0])+f(v[1]*v[1]))+f(v[2]*v[2]))));
const side=(d,v)=>{
 const c=[f(f(d[2]*v[1])-f(d[1]*v[2])),f(f(d[0]*v[2])-f(d[2]*v[0])),f(f(d[1]*v[0])-f(d[0]*v[1]))];
 return c.some(x=>x>EPS||x< -EPS)?sourceSfxNormalize3(c):c;
};

// Selected original PolyTubeEx branch: no forces/shake, alignment0, TexStyle0,
// TextureClockRotate1, ColorStyle0. Head remains editable until a section forms.
export function createSourceSfxTrail({lifespan,maxSegment,width,maxNodes,widthCurve=()=>1,colorCache,colorCacheEpsilon}){
 if(!(lifespan>0&&maxSegment>0&&width>0&&maxNodes>=2)||colorCache.length!==100||!Number.isFinite(colorCacheEpsilon))throw Error('Invalid source trail inputs');
 const state={points:[],previousPosition:[0,0,0],previousAxis:[0,0,0],previousView:[0,0,0],totalLength:0,sourceCount:0};
 const setPoint=(point,position,axis,scale)=>{
  Object.assign(point,{position:[...position],direction:sourceSfxNormalize3(axis),controlPlus:[...position],controlMinus:[...position],age:0,baseWidth:f(scale*width)});
  point.width=f(point.baseWidth*widthCurve(0));state.sourceCount++;
  const older=state.points[1];point.length=older?length(sub(position,older.position)):0;
  if(older){
   if(state.points.length>2){const d=sub(position,state.points[2].position).map(v=>f(v*.25));older.controlPlus=older.position.map((v,i)=>f(v+d[i]));older.controlMinus=older.position.map((v,i)=>f(v-d[i]));}
   point.direction=side(sub(position,older.position),state.previousView);
  }
 };
 return {state,update(delta,{position,axis=[0,1,0],orientation=[0,0,1],scale=1,view}){
  delta=f(delta);position=position.map(f);axis=axis.map(f);view=view.map(f);
  const changed=view.some((v,i)=>Math.abs(f(v-state.previousView[i]))>EPS);state.previousView=view;
  while(state.points.length&&f(state.points.at(-1).age+delta)>lifespan)state.points.pop();
  state.sourceCount=state.points.length;
  for(let i=0;i<state.points.length;i++){
   const p=state.points[i],older=state.points[i+1];
   if(older&&changed){p.length=length(sub(p.position,older.position));p.direction=side(sub(p.position,older.position),view);}
   p.age=f(p.age+delta);p.width=f(p.baseWidth*widthCurve(f(p.age/lifespan)));
  }
  const moved=sub(position,state.previousPosition).some(v=>Math.abs(v)>EPS);
  const rotated=f(1-f(f(f(orientation[0]*state.previousAxis[0])+f(orientation[1]*state.previousAxis[1]))+f(orientation[2]*state.previousAxis[2])))>f(.001);
  if(moved||rotated){
   if(!state.points.length){state.points.unshift({});setPoint(state.points[0],position,axis,scale);}
   if(state.points.length===1)state.points.unshift({});
   setPoint(state.points[0],position,axis,scale);
   if(state.points[0].length>maxSegment&&state.points[0].length<100000&&state.sourceCount<maxNodes){state.points.unshift({});setPoint(state.points[0],position,axis,scale);}
  }
  state.previousPosition=position;state.previousAxis=orientation.map(f);
  state.totalLength=state.points.slice(0,-1).reduce((a,p)=>f(a+p.length),0);
 },ribbon(){
  const points=state.points,rows=[];if(points.length<2||state.totalLength<EPS)return rows;
  const remaining=maxNodes-state.sourceCount;
  let spacing=remaining<1?1e10:(f(state.totalLength/maxSegment)>remaining?f(state.totalLength/remaining):maxSegment);
  let distance=0;
  const row=(position,direction,width,d)=>{
   const half=f(width*.5),offset=direction.map(v=>f(v*half));
   const phase=f(d/state.totalLength),index=Math.trunc(f(f(Math.max(0,Math.min(1,phase))-f(colorCacheEpsilon/100))*100));
   rows.push({positions:[...position.map((v,i)=>f(v-offset[i])),...position.map((v,i)=>f(v+offset[i]))],color:index>=0&&index<100?colorCache[index]:0xffffffff,uv:[1,phase,0,phase]});
  };
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[i+1];row(a.position,a.direction,a.width,distance);
   if(!b)break;
   let count=a.length>f(spacing*1.5)&&a.length<100000?Math.trunc(f(a.length/spacing)):0;
   count=Math.min(count,maxNodes-(i+1));
   if(count>=3){
    const step=f(1/count);
    for(let j=1;j<count-1;j++){
     const t=f(j*step),u=f(1-t),w0=f(u*f(u*u)),w1=f(u*f(f(t*3)*u)),w2=f(u*f(f(t*3)*t)),w3=f(f(t*t)*t);
     const position=a.position.map((v,k)=>f(f(f(f(v*w0)+f(a.controlMinus[k]*w1))+f(b.controlPlus[k]*w2))+f(b.position[k]*w3)));
     const direction=sourceSfxNormalize3(a.direction.map((v,k)=>f(v+f(f(b.direction[k]-v)*t))));
     row(position,direction,f(f(u*a.width)+f(t*b.width)),f(distance+f(a.length*t)));
    }
   }
   distance=f(distance+a.length);
  }
  return rows;
 }};
}
