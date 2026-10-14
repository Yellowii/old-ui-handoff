import * as THREE from 'three';
import {sceneRecords} from './local-scenes.js';
import {createMirrorGround} from './mirror-ground.js';
const presets=[['摄影棚','#31556f','#163148'],['晴空','#77c9f1','#e4f3f4'],['夕照','#c17796','#ffcf9e'],['夜幕','#0c153a','#43467d'],['草地','#96cfcb','#47795b'],['雪境','#9bbad4','#f2f7fc']];
const clone=value=>structuredClone(value);
const defaults=()=>({colors:['#31556f','#163148'],axis:90,image:null,imageOpacity:1,ground:{enabled:false,color:'#8195a3',size:12,mirror:false,strength:.7,blur:0,resolution:512,height:-.03},lights:{ambient:1.4,key:2.0,fill:0.8,color:'#ffffff'},filter:{brightness:1,contrast:1,saturation:1}});
const normalize=config=>({...clone(config),ground:{...defaults().ground,...config.ground}});
function background(config,image,size=768){
 const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d'),angle=config.axis*Math.PI/180,dx=Math.cos(angle)*size/2,dy=Math.sin(angle)*size/2;
 const gradient=ctx.createLinearGradient(size/2-dx,size/2-dy,size/2+dx,size/2+dy);
 config.colors.forEach((color,index)=>gradient.addColorStop(config.colors.length===1?0:index/(config.colors.length-1),color));ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
 if(image){const ratio=Math.max(size/image.width,size/image.height),w=image.width*ratio,h=image.height*ratio;ctx.globalAlpha=config.imageOpacity;ctx.drawImage(image,(size-w)/2,(size-h)/2,w,h);}
 return canvas;
}
const imageFrom=data=>new Promise((resolve,reject)=>{if(!data){resolve(null);return;}const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('背景图片读取失败'));image.src=data;});
export class PreviewScenes {
 constructor(viewer,message,onChange){
  this.viewer=viewer;this.message=message;this.onChange=onChange;this.texture=null;this.generation=0;this.current=defaults();this.saved=[];this.opened=false;
  this.base=presets.map(([name,a,b],index)=>this.resource({id:`scene:${index}`,name,config:{...defaults(),colors:[a,b]}},background({...defaults(),colors:[a,b]},null,192).toDataURL()));
  this.add={id:'scene:add',name:'新增场景',type:'场景',kind:'scene-add',source:'',quality:'基础',dyeGroup:'none',item:{itemId:'new',available:true,variants:[],quality:0}};
  this.panel=document.createElement('section');this.panel.className='ui-inline-panel ui-scene-editor';this.panel.hidden=true;this.panel.setAttribute('aria-label','场景配置');document.querySelector('.resource-surface').append(this.panel);
  this.ground=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:'#8195a3',roughness:1,side:THREE.DoubleSide}));this.ground.name='UI preview ground';this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.03;this.ground.visible=false;viewer.scene.add(this.ground);
  this.lights=viewer.scene.children.filter(node=>node.isLight);
 }
 resource(record,source=record.thumbnail){return {...record,type:'场景',kind:'scene',source,quality:'基础',dyeGroup:'none',item:{itemId:record.id,available:true,variants:[],quality:0}};}
 get resources(){return [...this.base,...this.saved.map(row=>this.resource(row)),this.add];}
 async load(){try{this.saved=await sceneRecords('read');}catch(error){this.message(`本地场景缓存不可用：${error.message}`,true);}}
 async remove(id){
  if(!this.saved.some(row=>row.id===id))return;
  await sceneRecords('delete',id);this.saved=this.saved.filter(row=>row.id!==id);
 }
 async apply(config){
  config=normalize(config);
  const token=++this.generation,image=await imageFrom(config.image);if(token!==this.generation)return;
  const canvas=background(config,image),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  this.texture?.dispose();this.texture=texture;this.viewer.scene.background=texture;this.current=clone(config);this.applySettings(config);return canvas;
 }
 applySettings(config){
  const ground={...defaults().ground,...config.ground};
  this.ground.visible=ground.enabled&&!ground.mirror;this.ground.material.color.set(ground.color);this.ground.position.y=ground.height;
  if(ground.enabled&&ground.mirror){
   if(!this.mirror){this.mirror=createMirrorGround();this.viewer.scene.add(this.mirror);}
   const resolution=[256,512,1024].includes(ground.resolution)?ground.resolution:512;
   const target=this.mirror.getRenderTarget();if(target.width!==resolution)target.setSize(resolution,resolution);
   const uniforms=this.mirror.material.uniforms;uniforms.color.value.set(ground.color);uniforms.strength.value=THREE.MathUtils.clamp(ground.strength,0,1);uniforms.blur.value=THREE.MathUtils.clamp(ground.blur,0,1);uniforms.texel.value.set(1/resolution,1/resolution);
   this.mirror.position.y=ground.height;
  }else this.releaseMirror();
  this.fitGround(config);
  let directional=0;
  for(const light of this.lights){if(light.isHemisphereLight)light.intensity=config.lights.ambient;else if(light.isDirectionalLight)light.intensity=config.lights[directional++===0?'key':'fill'];light.color.set(config.lights.color);}
  const filter=config.filter;this.viewer.renderer.domElement.style.filter=`brightness(${filter.brightness}) contrast(${filter.contrast}) saturate(${filter.saturation})`;
 }
 releaseMirror(){if(!this.mirror)return;this.mirror.removeFromParent();this.mirror.dispose();this.mirror.geometry.dispose();this.mirror=null;}
 fitGround(config=this.current){
  const size=Math.max(.1,this.viewer.radius||1)*config.ground.size;this.ground.scale.setScalar(size);this.mirror?.scale.setScalar(size);
  this.viewer.environmentRadius=config.ground.enabled?size:0;this.viewer.updateDepthRange();
 }
 async select(resource){await this.apply(resource.config);}
 reset(){this.generation++;this.texture?.dispose();this.texture=null;this.viewer.scene.background=new THREE.Color('#31556f');this.current=defaults();this.applySettings(this.current);}
 open(){
  document.dispatchEvent(new CustomEvent('appearance:panel-open',{detail:'scene'}));
  this.before=clone(this.current);this.draft=clone(this.current);this.opened=true;this.panel.hidden=false;document.body.dataset.resourcePanel='scene';this.render();
 }
 async close(restore=true){
  if(!this.opened)return;this.opened=false;this.panel.hidden=true;if(document.body.dataset.resourcePanel==='scene')delete document.body.dataset.resourcePanel;
  if(restore)await this.apply(this.before);
 }
 render(){
  this.panel.innerHTML=`<div class="ui-inline-heading"><button type="button" data-scene-back>返回</button><strong>新增场景</strong><button type="button" data-scene-save>保存</button></div>
   <div class="ui-inline-content"><label class="ui-field">场景名称<input id="scene-name" maxlength="32" placeholder="我的场景"></label>
   <fieldset><legend>背景图</legend><label class="ui-file-button">选择图片<input id="ui-background-file" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" data-image-clear>移除图片</button><label class="ui-field">图片不透明度<input data-setting="imageOpacity" type="range" min="0" max="1" step="0.05" value="${this.draft.imageOpacity}"></label><span data-image-status>${this.draft.image?'已使用背景图':'未选择图片'}</span></fieldset>
   <fieldset><legend>背景颜色</legend><div class="ui-color-stops"></div><button type="button" data-add-color>＋ 增加颜色</button><label class="ui-field">渐变轴<select id="scene-gradient-axis"><option value="90">纵向 ↓</option><option value="0">横向 →</option><option value="45">斜向 ↘</option><option value="135">斜向 ↙</option></select></label></fieldset>
   <fieldset><legend>地面设置</legend><label><input data-setting="ground.enabled" type="checkbox" ${this.draft.ground.enabled?'checked':''}>显示地面</label><label class="ui-field">地面颜色<input data-setting="ground.color" type="color" value="${this.draft.ground.color}"></label><label class="ui-field">地面范围<input data-setting="ground.size" type="range" min="2" max="30" step="1" value="${this.draft.ground.size}"></label>
   <label class="ui-field">地面高度<input data-setting="ground.height" type="range" min="-2" max="2" step="0.01" value="${this.draft.ground.height}"><output data-value="ground.height">${this.draft.ground.height}</output></label>
   <label><input data-setting="ground.mirror" type="checkbox" ${this.draft.ground.mirror?'checked':''}>镜面地面</label>
   <div data-mirror-options ${this.draft.ground.mirror?'':'hidden'}>${[['strength','反射强度'],['blur','反射模糊']].map(([key,label])=>`<label class="ui-field">${label}<input data-setting="ground.${key}" type="range" min="0" max="1" step="0.05" value="${this.draft.ground[key]}"><output data-value="ground.${key}">${Math.round(this.draft.ground[key]*100)}%</output></label>`).join('')}
   <label class="ui-field">反射清晰度<select data-setting="ground.resolution"><option value="256">低 · 256</option><option value="512">标准 · 512</option><option value="1024">高 · 1024</option></select></label><p class="ui-muted">高反射清晰度需要更多图形性能。</p></div></fieldset>
   <fieldset><legend>光效设置</legend>${[['ambient','环境光'],['key','主光'],['fill','补光']].map(([key,label])=>`<label class="ui-field">${label}<input data-setting="lights.${key}" type="range" min="0" max="6" step="0.1" value="${this.draft.lights[key]}"></label>`).join('')}<label class="ui-field">光照颜色<input data-setting="lights.color" type="color" value="${this.draft.lights.color}"></label></fieldset>
   <fieldset><legend>滤镜设置</legend>${[['brightness','亮度'],['contrast','对比度'],['saturation','饱和度']].map(([key,label])=>`<label class="ui-field">${label}<input data-setting="filter.${key}" type="range" min="0" max="2" step="0.05" value="${this.draft.filter[key]}"></label>`).join('')}</fieldset><p class="ui-muted">组件类型配置待资源完善后接入</p></div>`;
  this.panel.querySelector('[data-scene-back]').onclick=()=>this.close();this.panel.querySelector('[data-scene-save]').onclick=()=>this.save();
  this.panel.querySelector('#scene-gradient-axis').value=String(this.draft.axis);
  this.panel.querySelector('[data-setting="ground.resolution"]').value=String(this.draft.ground.resolution);
  this.panel.querySelector('#scene-gradient-axis').onchange=e=>{this.draft.axis=Number(e.target.value);this.preview();};
  this.panel.querySelector('[data-add-color]').onclick=()=>{if(this.draft.colors.length>=8){this.message('最多可配置 8 种背景颜色');return;}this.draft.colors.push('#ffffff');this.renderColors();this.preview();};
  this.panel.querySelector('#ui-background-file').onchange=e=>this.fromFile(e.target.files[0]);
  this.panel.querySelector('[data-image-clear]').onclick=()=>{this.draft.image=null;this.panel.querySelector('[data-image-status]').textContent='未选择图片';this.preview();};
  this.panel.querySelectorAll('[data-setting]').forEach(input=>input.oninput=()=>{
   const path=input.dataset.setting.split('.'),key=path.pop(),target=path.length?this.draft[path[0]]:this.draft;
   target[key]=input.type==='checkbox'?input.checked:input.type==='color'?input.value:Number(input.value);
   if(input.dataset.setting==='ground.mirror'){
    this.panel.querySelector('[data-mirror-options]').hidden=!input.checked;
    if(input.checked){this.draft.ground.enabled=true;this.panel.querySelector('[data-setting="ground.enabled"]').checked=true;}
   }
   const output=this.panel.querySelector(`[data-value="${input.dataset.setting}"]`);if(output)output.textContent=['strength','blur'].includes(key)?`${Math.round(target[key]*100)}%`:target[key];
   if(path[0]==='ground'||path[0]==='lights'||path[0]==='filter')this.applySettings(this.draft);else this.preview();
  });
  this.renderColors();
 }
 renderColors(){
  const host=this.panel.querySelector('.ui-color-stops');host.replaceChildren();
  this.draft.colors.forEach((color,index)=>{const label=document.createElement('label');label.className='ui-color-stop';label.textContent=`颜色 ${index+1}`;const input=document.createElement('input');input.type='color';input.value=color;input.setAttribute('aria-label',`背景颜色 ${index+1}`);input.oninput=()=>{this.draft.colors[index]=input.value;this.preview();};const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`移除颜色 ${index+1}`);remove.disabled=this.draft.colors.length===1;remove.onclick=()=>{this.draft.colors.splice(index,1);this.renderColors();this.preview();};label.append(input,remove);host.append(label);});
 }
 preview(){this.apply(this.draft).catch(error=>this.message(error.message,true));}
 async fromFile(file){
  if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>20*1024*1024){this.message('请选择 20 MB 以内的 PNG、JPEG 或 WebP 图片',true);return;}
  const draft=this.draft;
  try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});await imageFrom(data);if(!this.opened||this.draft!==draft)return;draft.image=data;this.panel.querySelector('[data-image-status]').textContent=file.name;await this.apply(draft);}catch(error){this.message(error.message,true);}
 }
 async save(){
  const button=this.panel.querySelector('[data-scene-save]');button.disabled=true;
  try{
   const config=clone(this.draft),canvas=await this.apply(config);if(!canvas)throw new Error('预览正在更新，请稍后保存');
   const thumbnail=document.createElement('canvas');thumbnail.width=160;thumbnail.height=200;thumbnail.getContext('2d').drawImage(canvas,0,0,160,200);
   const record={id:`scene:local:${crypto.randomUUID()}`,name:this.panel.querySelector('#scene-name').value.trim()||`我的场景 ${this.saved.length+1}`,config,thumbnail:thumbnail.toDataURL('image/jpeg',.8)};
   await sceneRecords('write',record);this.saved.push(record);await this.close(false);this.onChange(this.resource(record));document.dispatchEvent(new Event('appearance:resources'));this.message('场景已保存到本地');
  }catch(error){this.message(`场景保存失败：${error.message}`,true);}finally{button.disabled=false;}
 }
}
