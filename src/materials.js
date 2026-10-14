import {getHandoffServices} from './handoff/services.js';
import {configureDetailLighting} from './detail-lighting.js';
import {configureStandardLighting} from './standard-lighting.js';
import {configureHelmet} from './helmet-material.js';
import {configureLantern} from './lantern-material.js';
import {configureXyStar} from './xy-star-material.js';
import {configureCharCloud} from './char-cloud-material.js';
import {configureErciyuan} from './erciyuan-material.js';
import {configureCharIce} from './char-ice-material.js';
import {configureCharNos} from './char-nos-material.js';
import {configureChangeColorMix} from './change-color-mix-material.js';
import {configureWingCrystal} from './wing-crystal-material.js';
import {configureHorseWing} from './horse-wing-material.js';
import {configureHorse} from './horse-material.js';
import {configureIcefloor} from './icefloor-material.js';
import {configureCommonIce} from './common-ice-material.js';
import {configureUnlitCrystal} from './unlit-crystal-material.js';
import {configureBathWater} from './bath-water-material.js';
import {configureBathBubble} from './bath-bubble-material.js';
import {configureMountsFish} from './mounts-fish-material.js';
import {configurePet} from './pet-material.js';
import {configureMountFestival} from './mount-festival-material.js';
import {configureCarbody} from './carbody-material.js';
import {configureCarPaint} from './car-paint-material.js';
import {configureWpjsGlass} from './wpjs-glass-material.js';
import {configureAnimal} from './animal-material.js';
import {configureRadialColor} from './radialcolor-material.js';
import {configurePearl03} from './pearl03-material.js';
import {configureChangeColorLaser} from './change-color-laser-material.js';
import {configureFireworkText} from './firework-text-material.js';
import {configureTintWing} from './tint-wing-material.js';
import {configurePropMetallica} from './prop-metallica-material.js';
import {configureStandardCrystalBall} from './standard-crystal-ball-material.js';
import {configureCatwoman} from './catwoman-material.js';
import {configureCharDiamond} from './char-diamond-material.js';
import {configureStreamerMask,configureChangeColorStreamerMask} from './streamer-mask-material.js';
import {configureUvFlow} from './uvflow-material.js';
import {configureTonefix} from './tonefix-material.js';
import {configureNormalBlend} from './normalblend-material.js';
import {configureJellyObject} from './jelly-object-material.js';
import {configureJellyFlakes} from './jelly-flakes-material.js';
import {configureWaterWings} from './water-wings-material.js';
import {configureSilverJade} from './silver-jade-material.js';
import {configureColorVariant} from './color-variants-material.js';
import {configureActionExtra} from './action-extra-materials.js';
import {configureVertOffset} from './vertoffset-material.js';
import {configureT145} from './t145-materials.js';
import {configureJellyChar01} from './jelly-char01-material.js';
import {configureAngelBody} from './angel-body-material.js';
import {configureXmbl2} from './xmbl2-material.js';
import {configureRyxs} from './ryxs-material.js';
import {configureCharTest} from './char-test-material.js';
import {configureFemaleSkin} from './female-skin-material.js';
import {configureSlzsCloth} from './slzs-cloth-material.js';
import {configureSlzsSha} from './slzs-sha-material.js';
import {configureYcymvHair} from './ycymv-hair-material.js';
import {configureHouyi} from './houyi-material.js';
import {configureFireWing} from './fire-wing-material.js';
import {configurePgy} from './pgy-material.js';
import {configureZmt} from './zmt-material.js';
import {configureXiaohei} from './xiaohei-material.js';
import {configureHackerDissolve} from './t125-material.js';
import {configurePaper,configureLiuma} from './t124-material.js';
import {configureHw} from './hw-material.js';
import {configureQingsheCloth} from './qingshe-cloth-material.js';
import {configureBgz,configureHouyiYifu} from './t120-material.js';
import {configureQingshe,configureLaserflash} from './t121-material.js';
import {configureT101Hair} from './t101-hair-material.js';
import {configureCharLocalEffects} from './char-local-effects-material.js';
import {configureMarble} from './marble-material.js';
import {configureJgyj2} from './jgyj2-material.js';
import {configureCrystal2} from './crystal2-material.js';
import {configureElecMusic} from './elec-music-material.js';
import {configureStarScreen} from './star-screen-material.js';
import {configureShenianzuoqiStar} from './shenianzuoqi-star-material.js';
import {configurePetEspecial} from './pet-especial-material.js';
import {configurePudding} from './pudding-material.js';
import {configureU5Lb} from './u5-lb-material.js';
import {configureFlowsand} from './flowsand-material.js';
import {configureSnzq} from './snzq-material.js';
import {configureNinecolor} from './ninecolor-material.js';
import * as THREE from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const defaults=runtimeContract("surface-defaults.json");
import {configureParticle,particle5Gaps} from './particle-material.js';
import {configureJelly} from './jelly-material.js';
import {configureMatcap} from './matcap-material.js';
import {configureBreath} from './breath-material.js';
import {configureSdg} from './sdg-material.js';
import {configureCommonYp} from './common-yp-material.js';
import {configureTpl} from './tpl-material.js';
import {configureDynlight} from './dynlight-material.js';
import {configureTangzhi} from './tangzhi-material.js';
import {configureRainbowStar} from './rainbow-star-material.js';
import {configureWing} from './wing-material.js';
import {configureGoldfish} from './goldfish-material.js';
import {configureSplendor} from './splendor-material.js';
import {configureTexemis,texemisGaps} from './texemis-material.js';
import {configureFlowmap} from './flowmap-material.js';
import {configureHair} from './hair-material.js';
import {configureXyHair} from './xy-hair-material.js';
import {configurePearl} from './pearl-material.js';
import {configureWingPearl} from './wing-pearl-material.js';
import {configureKqbs} from './kqbs-material.js';
import {configureDiamondMetal} from './diamond-metal-material.js';
import {configureSparkle} from './sparkle-material.js';
import {configureCrystal} from './crystal-material.js';
import {configureHdcbCrystal} from './hdcb-crystal-material.js';
import {configureHdcbFamily} from './hdcb-family-material.js';
import {configureDjlwHair} from './djlw-hair-material.js';
import {configureSjmgcb} from './sjmgcb-material.js';
import {configureDepthOffset} from './depthoffset-material.js';
import {configureMumaxuanzhuan} from './mumaxuanzhuan-material.js';
import {configureCharLaser} from './char-laser-material.js';
import {configureCharLaserSource} from './char-laser-source-material.js';
import {configureMkf} from './mkf-material.js';
import {configureBsqs} from './bsqs-material.js';
import {configureDjhdj02} from './djhdj02-material.js';
import {configureDjhdj} from './djhdj-material.js';
import {configureCommonJgyj} from './jgyj-common-material.js';
import {configureRrDeco} from './rr-deco-material.js';
import {configureRrStar} from './rr-star-material.js';
import {configureRampDistort} from './rampdistort-material.js';
import {configureAddEmissive} from './add-emissive-material.js';
import {configureUnlitDiffuse} from './unlit-diffuse-material.js';
import {configureUnlitDiffuseChangeColor} from './unlit-diffuse-changecol-material.js';
import {configureUnlitRim} from './unlit-rim-material.js';
import {configureXced} from './xced-material.js';
import {configureCyberEyes} from './cyber-eyes-material.js';
import {configureFriedChicken} from './fried-chicken-material.js';
import {configureTwosided} from './twosided-material.js';
import {configureSnow} from './snow-material.js';
import {configureCharGlitch} from './char-glitch-material.js';
import {configureMusicwing} from './musicwing-material.js';
import {configureMagicCard} from './magic-card-material.js';
import {configureMffxbb} from './mffxbb-material.js';
import {configureMjclip} from './mjclip-material.js';
import {configureAnisotropic} from './anisotropic-material.js';
import {configureCartoon} from './cartoon-material.js';
import {configureWaterHat} from './water-hat-material.js';
import {configureSandHat} from './sand-hat-material.js';
import {configureFur} from './fur-material.js';
import {configureSparkle02} from './sparkle02-material.js';
import {configureJade} from './jade-material.js';
import {configureSpecialJade} from './special-jade-material.js';
import {configureRainbow} from './rainbow-material.js';
import {configureShellCrystal} from './shell-crystal-material.js';
import {configureBlend2Mc} from './blend2mc-material.js';
import {configurePlantGrowth} from './plant-growth-material.js';
import {configureLaser} from './laser-material.js';
import {configureAl} from './al-material.js';
import {configureFace} from './face-material.js';
import {configureFire} from './fire-material.js';
import {configureFire2} from './fire2-material.js';
import {configureCar} from './car-material.js';
import {configureRoses} from './roses-material.js';
import {configureMoba} from './moba-material.js';
import {configureCompoundShell} from './compound-shell-material.js';
import {configureCrayon} from './crayon-material.js';
import {configureFirenoise} from './firenoise-material.js';
import {configureWaterPainting} from './water-painting-material.js';
import {configureSpecialScale} from './special-scale-material.js';
import {configurePbrMatcap} from './pbr-matcap-material.js';
import {configureIridescent} from './iridescent-material.js';
import {configureLineDog} from './line-dog-material.js';
import {configureGlass} from './glass-material.js';
import {configureNl} from './nl-material.js';
import {configureBackGlass} from './back-glass-material.js';
import {configureTilingAll} from './tiling-all-material.js';
import {configureUgcCrystal} from './ugc-crystal-material.js';
import {configureDwgHead} from './dwg-head-material.js';
import {configureCharOutline} from './char-outline-material.js';

import {configureInk} from './ink-material.js';
import {configureCharAnisoSparkle} from './char-aniso-sparkle-material.js';
import {configureAlien} from './alien-material.js';
import {configureSpecialWings} from './special-wings-material.js';
import {configurePetEmote} from './pet-emote-material.js';
import {configureNfxGrass,grassPassCount} from './nfx-grass-material.js';
import {sourceSceneFogFor} from './source-scene-fog.js';
import {configureOutlineSoul} from './outline-soul-material.js';
import {configureWingObj,configureNfxWing} from './wing-obj-material.js';
import {configureBoomSugarPass} from './boomsugar-material.js';
import {configureColorObjectVtxOffset} from './change-color-object-vtxoffset-material.js';
import {configureCiyuanzhan} from './ciyuanzhan-material.js';
import {configureZnqAudiokey} from './znq-audiokey-material.js';

const number=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
const vec=(v,f)=>{try{const a=JSON.parse(v);return Array.isArray(a)&&a.length===f.length&&a.every(Number.isFinite)?a:f;}catch{return f;}};
const color=v=>new THREE.Color().setRGB(...v.slice(0,3),THREE.SRGBColorSpace);
const scalar=v=>Number(v).toFixed(8);
const glvec=v=>`vec${v.length}(${v.map(scalar).join(',')})`;
const builtinTextures=new Map();
function builtinTexture(name,srgb=false){
  const key=`${name}|${srgb}`;if(builtinTextures.has(key))return builtinTextures.get(key);
  const rgba={white:[255,255,255,255],black:[0,0,0,255],green:[0,255,0,255],normal:[128,128,255,255],red:[255,0,0,255]}[name];
  if(!rgba)return null;const t=new THREE.DataTexture(new Uint8Array(rgba),1,1,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;t.userData={neoBuiltin:name};builtinTextures.set(key,t);return t;
}
const builtinCubeTextures=new Map();
function builtinCubeTexture(name){
  if(builtinCubeTextures.has(name))return builtinCubeTextures.get(name);
  const rgba={white:[255,255,255,255],black:[0,0,0,255]}[name];
  if(!rgba)return null;
  const faces=Array.from({length:6},()=>{
    const face=new THREE.DataTexture(new Uint8Array(rgba),1,1,THREE.RGBAFormat,THREE.UnsignedByteType);
    face.colorSpace=THREE.NoColorSpace;face.needsUpdate=true;return face;
  });
  const cube=new THREE.CubeTexture(faces);
  cube.colorSpace=THREE.NoColorSpace;cube.flipY=false;cube.generateMipmaps=false;
  cube.minFilter=THREE.LinearFilter;cube.magFilter=THREE.LinearFilter;cube.needsUpdate=true;
  cube.userData={neoBuiltin:name,neoBuiltinCube:true};builtinCubeTextures.set(name,cube);return cube;
}

// Values read from the running source engine's render module; see evidence manifest.
export function renderState(r={}){
  const mode=number(r.TransparentMode?.TransparentMode,1),cut=mode===3||mode===6;
  return {side:Number(r.CullMode)===0?THREE.DoubleSide:Number(r.CullMode)===1?THREE.BackSide:THREE.FrontSide,
    opacity:THREE.MathUtils.clamp(number(r.AlphaVal,255)/255,0,1),transparent:[2,4,5,6,8,11].includes(mode),
    alphaTest:cut?number(r.AlphaRef,0)/255:0,depthWrite:![2,5,8,11].includes(mode),depthTest:mode!==8,
    blending:mode===5?THREE.AdditiveBlending:THREE.NormalBlending,mode};
}

export async function sourceMaterial(source,texture,overrides={}){
  const surface=(source.technique?.Surface||'').replaceAll('\\','/').toLowerCase();
  const p={...defaults[surface]?.parameters,...source.parameters,...(surface==='shader/particle_surf/u5_vfx_common_paopao.surf'&&source.parameters?.MatcapTex===undefined?{MatcapTex:'white'}:{}),...(surface==='shader/surf/standard_char_water_hat.surf'&&source.parameters?.Tex5===undefined?{Tex5:'white'}:{})},maps=source.textures||{},macros=Object.fromEntries(Object.entries({...defaults[surface]?.macros,...source.macros}).map(([key,value])=>[key,typeof value==='string'&&/^(true|false)$/i.test(value.trim())?(value.trim().toLowerCase()==='true'?1:0):value]));
  const sourcePass=overrides.sourcePass===1?1:0,boomsugar=surface==='shader/surf/s24/boomsugar.surf',boomsugarPass=overrides.boomsugarPass===true;
  const char=surface==='shader/surf/standard_char.surf'||(boomsugar&&!boomsugarPass),common=surface==='shader/surf/standard_common.surf',plastic=surface==='shader/surf/plastic.surf',detail=surface==='shader/surf/standard_char_detail.surf',iceCream=surface==='shader/surf/s24/ice_cream.surf',iceChar=surface==='shader/surf/standard_char_ice.surf',ftwj=surface==='shader/surf/standard_char_ftwj.surf',sodaWater=surface==='shader/surf/s24/sodawater.surf',xyStar=surface==='shader/surf/standard_xy_star.surf',t1erciyuan=surface==='shader/surf/standard_char_t1erciyuan.surf',glassCrystal=surface==='shader/surf/s29/standard_char_glass_crystal.surf',parallaxSkirt=surface==='shader/surf/2026_znq/standard_char_parallax_skirt.surf',vertOffset=surface==='shader/surf/standard_char_vertoffset_hztt.surf',lantern=surface==='shader/surf/2024_spring_festival/standard_lantern.surf',cloud=surface==='shader/surf/standard_char_cloud.surf',specialCloud=surface==='shader/surf/standard_char_specialcloud.surf',wingCrystal=surface==='shader/surf/anglel_wing_crystal.surf',charXhqp=surface==='shader/surf/s29/char_xhqp.surf',blackSmoking=surface==='shader/surf/black_smoking.surf',xhm=surface==='shader/surf/xhm/xhm.surf',handprint=surface==='shader/surf/water_painting_handprint.surf',laserMask=surface==='shader/surf/char_laser01_mask.surf',baoshi=surface==='shader/surf/baoshi01.surf',gemLn=surface==='shader/surf/gem_ln.surf',tulle=surface==='shader/surf/s24/standard_char_tulle.surf',xzll=surface==='shader/surf/xzll.surf',rainbowPearl=surface==='shader/surf/2026_spring_festival/rainbow_pearl.surf';
  const colorVariant={'shader/surf/standard_change_color_object.surf':'color-object','shader/surf/standard_change_color_object_vtxoffset.surf':'color-object-vtxoffset','shader/surf/standard_change_color_emissive.surf':'color-emissive','shader/surf/s23/standard_change_color_pattern.surf':'color-pattern'}[surface];
  const specialJade=surface==='shader/surf/s26/special_jade.surf';
  const extraChange=surface==='shader/surf/standard_change_color_new.surf',extraFrenel=surface==='shader/surf/standard_common_frenel.surf';
  const uvflow=surface==='shader/surf/standard_common_uvflow.surf';
  const reflection=surface==='shader/surf/char_high_reflection.surf';
  const bgz=surface==='shader/surf/bgz/bgz.surf',houyiYifu=surface==='shader/surf/2025_anniversary/houyiyifu.surf';
  const qingshe=surface==='shader/surf/s31/qingshe.surf',laserflash=surface==='shader/surf/s28/standard_char_laserflash.surf';
  const fireWing=surface==='shader/surf/2025_anniversary/fire_wing.surf';
  const pgy=surface==='shader/surf/2026_pgy/pgy.surf'||surface==='shader/surf/2026_pgy/pgy_low.surf';
  const zmt=surface==='shader/surf/2026_zmt/zmt.surf';
  const angelBody=surface==='shader/surf/angel_body_parallax.surf';
  const xmbl2=surface==='shader/surf/xmbl_surf/xmbl_base2.surf';
  const ryxs=surface==='shader/surf/standard_ryxs.surf';
  const charTest=surface==='shader/surf/standard_char_test.surf';
  const femaleSkin=surface==='shader/surf/female/female_common_skin.surf';
  const slzsCloth=surface==='shader/surf/s31/slzs_cloth.surf';
  const slzsSha=surface==='shader/surf/s31/slzs_sha.surf';
  const ycymvHair=surface==='shader/surf/standard_ycymv_hair.surf';
  const houyi=surface==='shader/surf/2025_anniversary/houyi.surf';
  const xiaohei=surface==='shader/surf/s31/xiaohei_halftone.surf'||surface==='shader/surf/s31/xiaohei_halftone_onepass.surf';
  const hackerDissolve=surface==='shader/surf/2025_gqing/gqing_hacker_dissolve.surf';
  const paper=surface==='shader/surf/standard_paper.surf',liuma=surface==='shader/surf/standard_xxg_liuma.surf';
  const petEmote=surface==='shader/surf/standard_pet_emote.surf';
  const mult=surface==='shader/surf/mult_emission_color.surf';
  const special=surface==='shader/surf/standard_char_specialmet.surf'||surface==='shader/surf/s26/flow_specialmet.surf';
  const vfx4=surface==='shader/particle_surf/u5_vfx_common_4.surf',vfx6=surface==='shader/particle_surf/u5_vfx_common_6.surf';
  const vfx7=surface==='shader/particle_surf/u5_vfx_common_7.surf';
  const vfx5Source=surface==='shader/particle_surf/u5_vfx_common_5.surf';
  const vfx5Issues=vfx5Source?particle5Gaps(p,macros):[];
  const vfx5=vfx5Source&&!vfx5Issues.length;
  const jelly=surface==='shader/surf/unlit_jelly_char.surf'||surface==='shader/surf/unlit_jelly_char_gradient.surf'||surface==='shader/surf/standard_char_jelly.surf';
  const inner=surface==='shader/surf/unlit_jelly_inner.surf';
  const matcap2=surface==='shader/surf/matcap_common_2uv.surf',matcap=surface==='shader/surf/matcap_common.surf'||matcap2;
  const breath=surface==='shader/surf/standard_common_emisbreath.surf';
  const sdg=surface==='shader/surf/standard_char_sdg.surf';
  const commonYp=surface==='shader/surf/standard_common_yp.surf';
  const tpl=surface==='shader/surf/standard_char_tpl.surf';
  const dynlight=surface==='shader/surf/standard_jgjl_dynlight.surf';
  const tangzhi=surface==='shader/surf/standard_char_tangzhi.surf';
  const rainbowStar=surface==='shader/surf/s29/rainbow_star.surf';
  const texemisSource=surface==='shader/surf/standard_char_texemis.surf';
  const tilingAll=surface==='shader/surf/standard_change_color_tiling_all.surf';
  const ugcCrystal=surface==='shader/surf/ugc_crystal.surf',ugcUp=overrides.ugcUp===true;
  const dwgHead=surface==='shader/surf/standard_dwg_head.surf';
  const texemisIssues=texemisSource?texemisGaps(p,macros,overrides):[];
  // Unimplemented active branches must not be reported as a successful adapter.
  let texemis=texemisSource&&!texemisIssues.length;
  const flow2Source=surface==='shader/surf/standard_char_flowmap02.surf';
  const tilingAlbedo=surface==='shader/surf/s24/tiling_albedo.surf';
  const flow2=flow2Source&&overrides.sourceSecondUv===true&&Number(macros.TEXCOORD1_ENABLE)===1;
  const flow=surface==='shader/surf/standard_char_flowmap.surf'||flow2||tilingAlbedo;
  const xyHair=surface==='shader/surf/standard_xy_hair.surf';
  const hairSource=surface==='shader/surf/char_xln_hair.surf'||surface==='shader/surf/s30/djlw_hair.surf';
  const djlwHair=surface==='shader/surf/s30/djlw_hair.surf';
  const sjmgcb=surface==='shader/surf/sjmgcb/sjmgcb.surf';
  const hw=surface==='shader/surf/standard_char_hw.surf';
  const qingsheCloth=surface==='shader/surf/s31/qingshe_cloth.surf';
  const spaceHair=surface==='shader/surf/char_spacehair.surf',lbHair=surface==='shader/surf/2026_spring_festival/standard_lb_hair.surf';
  const glitch01=surface==='shader/surf/standard_char_glitch01.surf';
  const marble=surface==='shader/surf/char_marble.surf',marbleEmissive=surface==='shader/surf/char_marble_emissive.surf';
  const jgyj2=surface==='shader/surf/standard_common_jgyj_2.surf',crystal2=surface==='shader/surf/anglel_wing_crystal_2.surf';
  const elecMusic=surface==='shader/surf/standard_char_elec_music.surf'?0:surface==='shader/surf/standard_char_elec01_music.surf'?1:null;
  const starScreen=surface==='shader/surf/s28/meteor_shower.surf'?'meteor':surface==='shader/surf/s32/hznl_starrysky.surf'?'hznl':null;
  const shenianzuoqiStar=surface==='shader/surf/2024_spring_festival/standard_shenianzuoqi_star.surf';
  const petEspecial=surface==='shader/surf/pet_especial001.surf';
  const pudding=surface==='shader/surf/standard_pudding.surf';
  const u5Lb=surface==='shader/surf/2026_spring_festival/u5_vfx_lb_1.surf';
  const flowsand=surface==='shader/surf/2026_spring_festival/standard_char_flowsand.surf';
  const depthOffset=surface==='shader/surf/standard_char_depthoffset.surf'||surface==='shader/surf/standard_char_depthoffset_ln.surf';
  const mumaxuanzhuan=surface==='shader/surf/char_mumaxuanzhuan_opcity.surf';
  const charLaser=surface==='shader/surf/char_laser01.surf';
  const charLaserSource=surface==='shader/surf/char_laser.surf';
  const mkf=surface==='shader/surf/standard_common_mkf.surf';
  const bsqs=surface==='shader/surf/standard_bsqs_base.surf',qsHair=surface==='shader/surf/standard_qs_hair.surf';
  const djhdj02=surface==='shader/surf/standard_common_djhdj02.surf';
  const djhdj=surface==='shader/surf/standard_common_djhdj01.surf';
  const commonJgyj=surface==='shader/surf/standard_common_jgyj.surf';
  const rrDeco=surface==='shader/surf/standard_rr_deco.surf';
  const rrStar=surface==='shader/surf/standard_rr_star.surf';
  const rampDistort=surface==='shader/particle_surf/u5_rampdistort.surf';
  const addEmissive=surface==='shader/surf/add_emissive.surf';
  const tonefix=surface==='shader/surf/unlit_diffuse_tonefix.surf';
  const unlitDiffuse=surface==='shader/surf/unlit_diffuse.surf',unlitDiffuseChange=surface==='shader/surf/unlit_diffuse_changecol_v.surf';
  const unlitRim=surface==='shader/surf/unlit_diffuse_rim.surf';
  const fried=surface==='shader/surf/s30/fried_chicken.surf'||surface==='shader/surf/s30/fried_chicken_2pass.surf';
  const twosided=surface==='shader/surf/s30/standard_char_twosided.surf';
  const snow=surface==='shader/surf/standard_snow.surf';
  const charGlitch=surface==='shader/surf/standard_char_glitch.surf';
  const musicwing=surface==='shader/surf/standard_common_musicwing.surf';
  const magicCard=surface==='shader/surf/magic_card.surf';
  const mffxbb=surface==='shader/surf/standard_common_mffxbb.surf';
  const mjclip=surface==='shader/surf/mjclip.surf';
  const hair=surface==='shader/surf/char_xln_hair.surf'&&overrides.sourceSecondUv===true&&Number(macros.TEXCOORD1_ENABLE)===1&&Number(macros.NORMAL_MAP_ENABLE)!==0;
  const pearl=surface==='shader/surf/standard_char_pearl.surf'||surface==='shader/surf/unlit_pearl_gets.surf';
  const wingPearl=surface==='shader/surf/anglel_wing_pearl.surf'||surface==='shader/surf/anglel_wing_pearl02.surf';
  const kqbs=surface==='shader/surf/kqbs.surf';
  const diamondMetal=surface==='shader/surf/s25/standard_diamond_metal.surf';
  const sparkle=surface==='shader/surf/char_sparkle03.surf';
  const crystal=surface==='shader/surf/anglel_wing_crystal02.surf';
  const standardCrystalBall=surface==='shader/surf/s24/standard_crystal_ball.surf';
  const catwoman=surface==='shader/surf/s22/standard_char_catwoman.surf';
  const charDiamond=surface==='shader/surf/standard_char_diamond.surf';
  const charOutline=surface==='shader/surf/s30/char_outline_drawing.surf';
  const hdcbCrystal=surface==='shader/surf/s31/hdcb_crystal.surf';
  const hdcbInner=surface==='shader/surf/s31/hdcb_inner.surf',hdcbOpaque=surface==='shader/surf/s31/hdcb_opaque.surf';
  const anisotropic=surface==='shader/surf/s24/standard_char_anisotropic.surf'||surface==='shader/surf/s27/standard_s27_anisotropic.surf';
  const cartoon=surface==='shader/surf/cartoon_char_common.surf';
  const helmet=surface==='shader/surf/standard_char_tkr_helmet.surf';
  const waterHat=surface==='shader/surf/standard_char_water_hat.surf';
  const snzq=surface==='shader/surf/2024_spring_festival/snzq.surf';
  const ninecolor=surface==='shader/surf/pecial_ninecolor.surf';
  const sandHat=surface==='shader/surf/standard_char_sand_hat.surf';
  const fur=surface==='shader/surf/dongdong_fur.surf'||surface==='shader/surf/dongdong_fur1.surf'||surface==='shader/surf/standard_common_fur.surf'||surface==='shader/surf/standard_common_fur_in.surf',furLayer=overrides.furLayer===true;
  const sparkle02=surface==='shader/surf/char_sparkle02.surf';
  const charAnisoSparkle=surface==='shader/surf/2026_spring_festival/char_aniso_sparkle.surf';
  const cyberEyes=surface==='shader/surf/cybereyes/cyber_eyes.surf';
  const jade=surface==='shader/surf/standard_char_jade.surf';
  const rainbow=surface==='shader/surf/rainbow_film.surf';
  const shellCrystal=surface==='shader/surf/unlit_shell_crystal.surf'||surface==='shader/surf/s29/glass_txs.surf',shellUp=overrides.shellUp===true;
  const blend2mc=surface==='shader/surf/standard_char_blend2mc.surf';
  const plantGrowth=surface==='shader/surf/s29/standard_char_plant_growth.surf';
  const laser=surface==='shader/surf/standard_tky_laser.surf',laserLayer=overrides.laserLayer===true;
  const al=surface==='shader/surf/standard_al.surf';
  const face=surface==='shader/surf/cartoon_char_face.surf';
  const fireSource=surface==='shader/surf/standard_char_fire.surf';
  const fire2Source=surface==='shader/surf/standard_char_fire2.surf';
  const carSource=surface==='shader/surf/2025_t0_stage_luckydraw/car.surf';
  const rosesSource=surface==='shader/surf/s25/special_roses.surf';
  const mobaSource=surface==='shader/surf/standard_char_moba.surf';
  const compoundShell=surface==='shader/surf/unlit_compound_shell01.surf';
  const crayon=surface==='shader/surf/s29/char_crayon_drawing.surf';
  const alien=surface==='shader/surf/char_alien.surf';
  const waterPainting=surface==='shader/surf/water_painting.surf';
  const specialScale=surface==='shader/surf/special_scale.surf'||surface==='shader/surf/special_scale_opacity.surf';
  const pbrMatcap=surface==='shader/surf/standard_pbrwithmatcap.surf';
  const qqtbn=(getHandoffServices().runtimePolicy?.qqtbnSurfaces||[]).includes(surface);
  const candle=surface==='shader/surf/standard_candle.surf';
  const znqAudiokey=surface==='shader/theme_znq/znq_pop_audiokey.surf';
  const galaxy=surface==='shader/surf/s27/standard_s27_galaxy.surf';
  const snowglass=surface==='shader/surf/standard_snowglass.surf';
  const iridescent=surface==='shader/surf/plastic_iridescent_t.surf';
  const lineDog=surface==='shader/surf/ip_linedog/line_dog02.surf'||surface==='shader/surf/ip_linedog/line_dog03.surf';
  const glass=surface==='shader/surf/standard_glass.surf';
  const propMetallica=surface==='shader/surf/matcap_prop_metallica.surf';
  const tintWing=surface==='shader/surf/2024_spring_festival/wing_for_tint01.surf';
  const backGlass=surface==='shader/surf/standard_back_glass.surf';
  const nl=surface==='shader/surf/nl.surf';
  const ink=surface==='shader/surf/2024_spring_festival/char_ink01.surf';
  const inkOutline=overrides.inkOutline===true;
  const vertOffsetInterface=surface==='shader/surf/standard_char_vertoffset_interface.surf';
  const flowerQueen=surface==='shader/surf/flower_queen.surf';
  const firenoiseSource=surface==='shader/surf/2025_t0_stage_luckydraw/firenoise.surf';
  let fire=fireSource&&overrides.sourceSecondUv===true&&Boolean(maps.Tex0?.url&&maps.Tex1?.url);
  let fire2=fire2Source&&overrides.sourceSecondUv===true;
  const wingSource=surface==='shader/surf/unlit_wing.surf';
  const specialWingsSource=surface==='shader/surf/special_wings.surf';
  const goldfishWing=surface==='shader/surf/s28/goldfish_wing.surf';
  let wing=wingSource&&(overrides.sourceTangents===true||Number(macros.NORMAL_MAP_ENABLE)===0);
  const standard=!twosided&&!snow&&(char||common||detail||reflection||mult||iceCream||ftwj||surface==='shader/surf/standard_ftwz_stylechar.surf'||surface==='shader/surf/standard_anbs_mask.surf'||surface==='shader/surf/xmbl_surf/xmbl_base.surf'||surface==='shader/surf/parallax.surf'||surface==='shader/surf/standard_char_vertoffset_ln.surf'||surface==='shader/surf/char_skirt_v02.surf'||surface==='shader/surf/standard_tkcz_body.surf'||surface==='shader/surf/standard_char_ftff.surf'||sodaWater||glassCrystal||parallaxSkirt||vertOffset||charXhqp||blackSmoking||xhm||handprint||laserMask||baoshi||gemLn||tulle||xzll||rainbowPearl),rs=renderState(source.renderStates),warnings=[];
  const {mode,...states}=rs;
  // Source SetupMaterial clips opacity_mask - AlphaRef - .005, including
  // AlphaRef==0. Three would otherwise disable alpha testing at zero.
  if(common&&(mode===3||mode===6))states.alphaTest=number(p.AlphaRef,0)+.005;
  const alienMacroValues=['LIGHT_ENABLE','NORMAL_MAP_ENABLE','USE_STANDARD_MATERIAL','TWO_SIDED'].map((k,i)=>Number(macros[k]??[1,1,0,0][i]));
  const alienPermutation=overrides.alienPermutation||{renderQuality:Number(macros.RENDER_QUALITY??0),light:alienMacroValues[0]===1,normalMap:alienMacroValues[1]===1,standardMaterial:alienMacroValues[2]===1,twoSided:alienMacroValues[3]===1};
  const alienUnsupported=(!overrides.alienPermutation&&alienMacroValues.some(v=>![0,1].includes(v)))||['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING','LIGHT_MAP_ENABLE'].some(k=>Number(macros[k]??0)!==0);
  if(alien&&alienUnsupported)warnings.push('ALIEN_ACTIVE_SOURCE_PATH_UNSUPPORTED');
  const specialWingsPermutation=overrides.specialWingsPermutation||{renderQuality:Number(macros.RENDER_QUALITY??0)};
  const specialWingsUnsupported=['INSTANCE_TYPE','ENABLE_VAT','ENABLE_SCALE_9','ENABLE_TILING'].some(key=>Number(macros[key]??0)!==0);
  if(specialWingsSource&&specialWingsUnsupported)warnings.push('SPECIAL_WINGS_ACTIVE_VERTEX_PATH_UNSUPPORTED');
  if(surface==='shader/surf/2026_spring_festival/char_aniso_sparkle.surf')warnings.push('char_aniso_sparkle 使用独立六图和 float3 Parameter；已按源通道接入，活动 AB/溶解与场景 Sun/SSS 仍按证据门控');
  const paopaoSurface=surface==='shader/particle_surf/u5_vfx_common_paopao.surf';
  const paopaoAlias=paopaoSurface?{...source,parameters:{MatcapTex:'white',...source.parameters},technique:{...source.technique,TechName:'shader/splendor/u5_vfx_common_paopao.spx::TShader'}}:source;
  const m=new THREE.MeshStandardMaterial({name:source.name||'',...states});
  const load=async(key,srgb=false,url)=>{const path=url||maps[key]?.url;if(!path){if(maps[key]?.path){warnings.push(`原贴图未发布：${maps[key].path}`);return null;}const authoredDefault=source.parameters?.[key]===undefined?defaults[surface]?.textureDefaults?.[key]:null;const exactSurfaceBuiltin=houyiYifu&&key==='Tex4'&&source.parameters?.Tex4===undefined?'normal':null;const explicitBuiltin=(char||common||addEmissive||propMetallica||unlitDiffuse||unlitDiffuseChange||paopaoSurface||(source.technique?.TechName||'').replaceAll('\\','/').toLowerCase()==='shader/splendor/u5_vfx_common_paopao.spx::tshader'||tintWing||charAnisoSparkle||petEspecial||u5Lb||vertOffsetInterface||extraChange||extraFrenel||uvflow||glass||surface==='shader/surf/unlit_crystal.surf'||surface==='shader/surf/water_wings.surf'||surface==='shader/surf/standard_char_water_hat.surf'||colorVariant==='color-pattern'||colorVariant==='color-object'||colorVariant==='color-object-vtxoffset'||bsqs||qsHair||tonefix)&&['black','green','normal','white','red'].includes(p[key])?p[key]:null;const builtinName=authoredDefault||exactSurfaceBuiltin||explicitBuiltin;const built=builtinName?(propMetallica&&key==='ReflectionProbeCustom'?builtinCubeTexture(builtinName):builtinTexture(builtinName,srgb)):null;if(built){warnings.push(`使用源 Surface 内置纹理：${key}=${builtinName}`);return built;}return null;}try{return await texture(path,srgb,path===maps[key]?.url?maps[key]?.mipmaps:undefined);}catch{warnings.push(`贴图载入失败：${path}`);return null;}};
  const intensity=vec(p.Intensity,[1,1,1,0]),base=vec(p.BaseColor,[1,1,1,1]);
  let fragment='',uniforms={},standardLightingReady=false,detailLightingReady=false;
  const wingObjEffect=(source.technique?.TechName||'').replaceAll('\\','/').toLowerCase()==='shader/nfx_template/nfx_wing_obj.fx::nfx_wing_obj';
  const nfxWingEffect=(source.technique?.TechName||'').replaceAll('\\','/').toLowerCase()==='shader/nfx_template/nfx_wing.fx::nfx_wing';
  const splendorEffect=paopaoSurface||/^shader\/splendor\/(?:u5_vfx_common_(?:[34567]|paopao)|mat_ui_rotation_v01|mat_emissive_v01|mat_light_v12|mat_light_v07|u5_emisedge|u5_rampdistort|u5_vfx_jiguangramp|mat_sequence_pickone_v02|model_cb_v04)\.spx::tshader$/.test((source.technique?.TechName||'').replaceAll('\\','/').toLowerCase());
  const fireUniforms=fire?await configureFire(m,p,macros,load):null;fire=Boolean(fireUniforms);
  const grassEffect=(source.technique?.TechName||'').replaceAll('\\','/').toLowerCase();
  const nfxGrass=['shader/nfx_template/nfx_grass_integrate.fx::nfx_grass_integrate','shader/nfx_template/nfx_grass_integrate_inner.fx::nfx_grass_integrate_inner'].includes(grassEffect),grassInner=grassEffect.endsWith('_inner'),grassPass=Number.isInteger(overrides.grassPass)?overrides.grassPass:0;
  const soulEffect=grassEffect==='shader/nfx_template/outline_soul.fx::outline_soul',soulPass=Number.isInteger(overrides.soulPass)?overrides.soulPass:0;
  if(znqAudiokey){const configured=await configureZnqAudiokey(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-znq-audiokey-channels';}}
  else if(helmet){const configured=await configureHelmet(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-helmet-channels';}}
  else if(lantern){const configured=await configureLantern(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-lantern-channels';}}
  else if(xyStar){const configured=await configureXyStar(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-xy-star-channels';}}
  else if(cloud){const configured=await configureCharCloud(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-char-cloud-channels';}}
  else if(t1erciyuan){const configured=await configureErciyuan(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter=overrides.t1Outline?'source-t1erciyuan-outline-channels':'source-t1erciyuan-channels';}}
  else if(iceChar){const configured=await configureCharIce(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-char-ice-channels';}}
  else if(surface==='shader/surf/standard_char_nos.surf'){const configured=await configureCharNos(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-char-nos-channels';}}
  else if(soulEffect){const configured=await configureOutlineSoul(m,p,macros,load,warnings,soulPass);if(configured){uniforms=configured;m.userData.adapter='source-outline-soul-channels';}}
  else if(nfxGrass){const sourceFog=sourceSceneFogFor(source),configured=await configureNfxGrass(m,p,macros,load,warnings,grassInner,grassPass,{...overrides,sourceFog});if(configured){uniforms=configured;m.userData.adapter='source-nfx-grass-channels';if(sourceFog)m.userData.sourceFogScene=sourceFog.sourceScene;}}
  else if(wingObjEffect){const configured=mode===1?await configureWingObj(m,p,macros,load,warnings,sourcePass):null;if(configured){uniforms=configured;m.userData.adapter='source-wing-obj-channels';}else if(mode!==1)warnings.push('nfx_wing_obj unsupported material render mode');}
  else if(nfxWingEffect){const configured=await configureNfxWing(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-nfx-wing-channels';}}
  else if(boomsugar&&boomsugarPass){const configured=await configureBoomSugarPass(m,p,macros,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-boomsugar-channels';}}
  else if(tonefix){const configured=await configureTonefix(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-tonefix-channels';}}
  else if(wingCrystal){const configured=await configureWingCrystal(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-wing-crystal-channels';}}
  else if(standardCrystalBall){const configured=await configureStandardCrystalBall(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-standard-crystal-ball-channels';}}
  else if(catwoman){const configured=await configureCatwoman(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-catwoman-channels';}}
  else if(charDiamond){const configured=await configureCharDiamond(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-char-diamond-channels';}}
  else if(surface==='shader/surf/2026_carrier/2026_horse_wing.surf'){const configured=await configureHorseWing(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-horse-wing-channels';}}
  else if(['shader/surf/2026_carrier/2026_horse_body.surf','shader/surf/2026_carrier/2026_horse_hair.surf'].includes(surface)){const family=surface.endsWith('_hair.surf')?'hair':'body',configured=await configureHorse(m,p,macros,load,overrides,warnings,family);if(configured){uniforms=configured;m.userData.adapter='source-horse-'+family+'-channels';}}
  else if(surface==='shader/surf/standard_common_normalblend.surf'){const configured=await configureNormalBlend(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-normalblend-channels';}}
  else if(surface==='shader/surf/u5_vfx_ciyuanzhan.surf'){const configured=await configureCiyuanzhan(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-ciyuanzhan-channels';}}
  else if(colorVariant==='color-object-vtxoffset'){const configured=await configureColorObjectVtxOffset(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-color-object-vtxoffset-channels';}}
  else if(colorVariant){const configured=await configureColorVariant(m,p,macros,load,warnings,overrides,colorVariant);if(configured){uniforms=configured;m.userData.adapter='source-'+colorVariant+'-channels';}}
  else if(surface==='shader/surf/unlit_streamer_mask.surf'){const configured=await configureStreamerMask(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-streamer-mask-channels';}}
  else if(surface==='shader/surf/unlit_change_color_streamer_mask.surf'){const configured=await configureChangeColorStreamerMask(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-streamer-mask-channels';}}
  else if(surface==='shader/surf/matcap_prop_metallica.surf'){const configured=await configurePropMetallica(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-prop-metallica-channels';}}
  else if(uvflow){const configured=await configureUvFlow(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-uvflow-channels';}}
  else if(surface==='shader/surf/standard_change_color_mix.surf'){const configured=await configureChangeColorMix(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-change-color-mix-channels';}}
  else if(extraChange||extraFrenel){const family=extraChange?'change-color-new':'common-frenel';const configured=await configureActionExtra(m,p,macros,load,warnings,overrides,family);if(configured){uniforms=configured;m.userData.adapter='source-'+family+'-channels';}}
  else if(snow){const configured=await configureSnow(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-snow-channels';}}
  else if(bgz){const configured=await configureBgz(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-bgz-channels';}}
  else if(houyiYifu){const configured=await configureHouyiYifu(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-houyiyifu-channels';}}
  else if(fireWing){const configured=await configureFireWing(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-fire-wing-channels';}}
  else if(pgy){const configured=await configurePgy(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-pgy-channels';}}
  else if(zmt){const configured=await configureZmt(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-zmt-channels';}}
  else if(angelBody){const configured=await configureAngelBody(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-angel-body-channels';}}
  else if(xmbl2){const configured=await configureXmbl2(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=m.userData.xmblDerivedTangent?'source-xmbl2-derived-tangent-channels':'source-xmbl2-channels';}}
  else if(ryxs){const configured=await configureRyxs(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-ryxs-channels';}}
  else if(charTest){const configured=await configureCharTest(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=m.userData.charTestDerivedTangent?'source-char-test-derived-tangent-channels':'source-char-test-channels';}}
  else if(femaleSkin){const configured=await configureFemaleSkin(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=m.userData.femaleSkinDerivedTangent?'source-female-skin-derived-tangent-channels':'source-female-skin-channels';}}
  else if(slzsCloth){const configured=await configureSlzsCloth(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-slzs-cloth-channels';}}
  else if(slzsSha){const configured=await configureSlzsSha(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=overrides.sourceTangents===true?'source-slzs-sha-channels':'source-slzs-sha-derived-tangent-channels';}}
  else if(ycymvHair){const configured=await configureYcymvHair(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-ycymv-hair-channels';}}
  else if(surface==='shader/surf/tpl_unlit_jelly_obj_gets.surf'){const configured=await configureJellyObject(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-jelly-object-channels';}}
  else if(surface==='shader/surf/unlit_jelly_obj_gets.surf'){const configured=await configureJellyFlakes(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-jelly-flakes-channels';}}
  else if(surface==='shader/surf/water_wings.surf'){const configured=await configureWaterWings(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-water-wings-channels';}}
  else if(surface==='shader/surf/s31/standard_char_silver_jade.surf'){const configured=await configureSilverJade(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-silver-jade-channels';}}
  else if(surface==='shader/surf/unlit_jelly_char_01.surf'){const configured=await configureJellyChar01(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-jelly-char01-channels';}}
  else if(surface==='shader/surf/standard_char_vertoffset.surf'){const configured=await configureVertOffset(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-vertoffset-channels';}}
  else if(djhdj){const configured=await configureDjhdj(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-djhdj01-channels';}}
  else if(commonJgyj){const configured=await configureCommonJgyj(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-common-jgyj-channels';}}
  else if(['shader/surf/standard_jgyj.surf','shader/surf/xiaolanmao_chuchang.surf'].includes(surface)){const family=surface==='shader/surf/standard_jgyj.surf'?'jgyj':'xiaolanmao';const configured=await configureT145(m,p,macros,load,warnings,overrides,family);if(configured){uniforms=configured;m.userData.adapter='source-'+family+'-channels';}}
  else if(houyi){const configured=await configureHouyi(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-houyi-channels';}}
  else if(xiaohei){const configured=await configureXiaohei(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-xiaohei-channels';}}
  else if(charOutline){const configured=await configureCharOutline(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-char-outline-channels';}}
  else if(hackerDissolve){const configured=await configureHackerDissolve(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-hacker-dissolve-channels';}}
  else if(paper||liuma){const configured=await (paper?configurePaper:configureLiuma)(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=paper?'source-paper-channels':'source-liuma-channels';}}
  else if(qingshe){const configured=await configureQingshe(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-qingshe-channels';}}
  else if(laserflash){const configured=await configureLaserflash(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-laserflash-channels';}}
  else if(alien&&!alienUnsupported){const configured=await configureAlien(m,p,load,warnings,alienPermutation);if(configured){uniforms=configured;m.userData.adapter=overrides.alienPermutation?'web-clock-preview-alien':'source-alien-channels';}}
  else if(specialWingsSource&&!specialWingsUnsupported){const configured=await configureSpecialWings(m,p,load,warnings,specialWingsPermutation,overrides.sourceSecondUv);if(configured){uniforms=configured;m.userData.adapter=overrides.specialWingsPermutation?'web-clock-preview-special-wings':'source-special-wings-channels';}}
  else if(twosided){const configured=await configureTwosided(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-twosided-channels';}}
  else if(petEmote){const configured=await configurePetEmote(m,p,{...macros,__sourceEnableSoftBody2:source.macros?.ENABLE_SOFT_BODY2},load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-pet-emote-channels';}}
  else if(surface==='shader/surf/mult_emission_color_xced.surf'){const configured=await configureXced(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-xced-channels';}}
  else if(ink){const configured=await configureInk(m,p,macros,load,warnings,{...overrides,inkOutline});if(configured){uniforms=configured;m.userData.adapter='source-ink-channels';}}
  else if(splendorEffect){const configured=await configureSplendor(m,paopaoAlias,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-splendor-gl-channels';}}
  else if(fire){uniforms=fireUniforms;
  }else if(fire2){const configured=await configureFire2(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-fire2-channels';}else{fire2=false;warnings.push('standard_char_fire2 缺少已验证第二 UV 或 Tex0-Tex3，保持未适配');}
  }else if(carSource){const configured=await configureCar(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-car-channels';}else warnings.push('car.surf 缺少源 Tex0，保持未适配');
  }else if(rosesSource){const configured=await configureRoses(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-special-roses-channels';}else warnings.push('special_roses 缺少源 Tex0/Tex3，保持未适配');
  }else if(mobaSource){const configured=await configureMoba(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-moba-channels';}else warnings.push('standard_char_moba 缺少源 Tex0/Tex3，保持未适配');
  }else if(compoundShell){const configured=await configureCompoundShell(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-compound-shell-channels';}else warnings.push('compound shell 缺少源 Tex0/Tex2，保持未适配');
  }else if(crayon){const configured=await configureCrayon(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-crayon-channels';}else warnings.push('char_crayon_drawing 缺少源 Tex0/Crayon，保持未适配');
  }else if(waterPainting){const configured=await configureWaterPainting(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-water-painting-channels';}else warnings.push('water_painting 缺少源 Tex0，保持未适配');
  }else if(specialScale){const configured=await configureSpecialScale(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-special-scale-channels';}else warnings.push('special_scale 缺少源 Tex0，保持未适配');
  }else if(pbrMatcap){const configured=await configurePbrMatcap(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-pbr-matcap-channels';}else warnings.push('standard_pbrwithmatcap 缺少源 Tex0，保持未适配');
  }else if(qqtbn){const configured=await configurePbrMatcap(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-qqtbn-channels';}else warnings.push('qqtbn 缺少源 Tex0，保持未适配');
  }else if(candle){const candleLoad=async(k,s,u)=>load(k==='Tex0'?'Tex3':k==='Tex2'?'MixTex':k==='Tex3'?'Tex2':k,s,u);const configured=await configurePbrMatcap(m,p,{...p,EmissiveValue:p.EmissiveValue??1},candleLoad,warnings);if(configured){uniforms=configured;m.userData.adapter='source-candle-channels';}else warnings.push('standard_candle 缺少源 Tex3，保持未适配');
  }else if(galaxy){const galaxyLoad=async(k,s,u)=>load(({Tex0:'albedoTex',Tex1:'Tex0',Tex2:'maskTex',Tex3:'Matcap',Tex4:'galaxyTex'}[k]||k),s,u);const configured=await configureSpecialScale(m,p,macros,galaxyLoad,warnings);if(configured){uniforms=configured;m.userData.adapter='source-galaxy-channels';}else warnings.push('standard_s27_galaxy 缺少源 albedoTex，保持未适配');
  }else if(snowglass){const configured=await configurePbrMatcap(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-snowglass-channels';}else warnings.push('standard_snowglass 缺少源 Tex0，保持未适配');
  }else if(iridescent){const configured=await configureIridescent(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-iridescent-channels';}else warnings.push('plastic_iridescent_t 缺少源 Tex0 或 Tex2，保持未适配');
  }else if(lineDog){const configured=await configureLineDog(m,p,macros,load,warnings,{...overrides,lineDogNoisy:surface.endsWith('02.surf')});if(configured){uniforms=configured;m.userData.adapter='source-line-dog-channels';}else warnings.push('LineDog 原两 Pass 输入未齐，保持未适配');
  }else if(glass){const configured=await configureGlass(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-glass-channels';}else warnings.push('standard_glass 缺少源 Tex1 或 Tex2，保持未适配');
  }else if(surface==='shader/surf/standard_common_radialcolor.surf'){const configured=await configureRadialColor(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-radialcolor-channels';}
  }else if(['shader/surf/animal_fur/cat_eye.surf','shader/surf/animal_fur/animal_fur.surf'].includes(surface)){const fur=surface.endsWith('/animal_fur.surf'),configured=await configureAnimal(m,p,macros,load,warnings,overrides,fur);if(configured){uniforms=configured;m.userData.adapter=fur?'source-animal-fur-channels':'source-cat-eye-channels';}
  }else if(['shader/surf/standard_pet.surf','shader/surf/pet02/standard_pet02.surf'].includes(surface)){const pet02=surface.includes('/pet02/');const configured=await configurePet(m,p,macros,load,warnings,overrides,pet02);if(configured){uniforms=configured;m.userData.adapter=pet02?'source-pet02-channels':'source-pet-channels';}
  }else if(surface==='shader/surf/object_icefloor.surf'){const configured=await configureIcefloor(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-icefloor-channels';}
  }else if(surface==='shader/surf/standard_common_ice.surf'){const configured=await configureCommonIce(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-common-ice-channels';}
  }else if(surface==='shader/surf/unlit_crystal.surf'){const configured=await configureUnlitCrystal(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-unlit-crystal-channels';}
  }else if(surface==='shader/surf/object_water_zhucheng.surf'){const configured=await configureBathWater(m,p,macros,load,{...overrides,previewEnvironment:source.sourcePreviewEnvironment},warnings);if(configured){uniforms=configured;m.userData.adapter='source-bath-water-channels';}
  }else if(surface==='shader/surf/s31/standard_common_bubble.surf'){const configured=await configureBathBubble(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-bath-bubble-channels';}
  }else if(surface==='shader/surf/standard_mounts_fish.surf'){const configured=await configureMountsFish(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-mounts-fish-channels';}
  }else if(surface==='shader/surf/mount_spring_festival.surf'){const configured=await configureMountFestival(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-mount-festival-channels';}
  }else if(surface==='shader/surf/wpjs_glass.surf'){const configured=await configureWpjsGlass(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-wpjs-glass-channels';}
  }else if(surface==='shader/surf/s25/standard_car_paint_mix.surf'){const configured=await configureCarPaint(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-car-paint-channels';}
  }else if(surface==='shader/surf/obj_carbody.surf'){const configured=await configureCarbody(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-carbody-channels';}
  }else if(surface==='shader/surf/angel_wing_pearl03.surf'){const configured=await configurePearl03(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-pearl03-channels';}
  }else if(surface==='shader/surf/standard_change_color_laser.surf'){const configured=await configureChangeColorLaser(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-change-color-laser-channels';}
  }else if(surface==='shader/surf/standard_common_firework.surf'){const configured=await configureFireworkText(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-firework-text-channels';}
  }else if(tintWing){const configured=await configureTintWing(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-tint-wing-channels';}
  }else if(backGlass){const configured=await configureBackGlass(m,p,macros,load,overrides,warnings);if(configured){uniforms=configured;m.userData.adapter='source-back-glass-channels';}
  }else if(nl){const configured=await configureNl(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-nl-emoji-channels';}else warnings.push('nl.surf 缺少必需源输入，保持未适配');
  }else if(vertOffsetInterface){const configured=await configureVertOffset(m,p,macros,load,warnings,overrides,true);if(configured){uniforms=configured;m.userData.adapter='source-vertoffset-interface-channels';}else warnings.push('standard_char_vertoffset_interface 缺少源 Tex0-Tex5，保持未适配');
  }else if(flowerQueen){const configured=await configureWingPearl(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-flower-queen-channels';}else warnings.push('flower_queen 缺少源 MatCap，保持未适配');
  }else if(firenoiseSource){const configured=await configureFirenoise(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-firenoise-channels';}else warnings.push('firenoise 缺少源 Tex0/Tex2，保持未适配');
  }else if(face){uniforms=await configureFace(m,p,macros,load,warnings,overrides);m.userData.adapter='face-channels';
  }else if(al){uniforms=await configureAl(m,p,macros,load,warnings,overrides);m.userData.adapter='al-channels';
  }else if(laser){uniforms=await configureLaser(m,p,macros,load,warnings,overrides,laserLayer);m.userData.adapter='laser-channels';
  }else if(plantGrowth){uniforms=await configurePlantGrowth(m,p,macros,load,warnings,overrides);m.userData.adapter='plant-growth-channels';
  }else if(blend2mc){const configured=await configureBlend2Mc(m,p,macros,load,warnings,{...overrides,textureBindings:maps});if(configured){uniforms=configured;m.userData.adapter='blend2mc-channels';}
  }else if(shellCrystal){uniforms=await configureShellCrystal(m,p,macros,load,warnings,overrides,shellUp);m.userData.adapter='shell-crystal-channels';
  }else if(rainbow){const configured=await configureRainbow(m,p,macros,load,warnings,{...overrides,textureBindings:maps});if(configured){uniforms=configured;m.userData.adapter='rainbow-film-channels';}else warnings.push('rainbow_film 源输入未闭合，保持未适配');
  }else if(specialJade){const configured=await configureSpecialJade(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-special-jade-channels';}
  }else if(jade){const configured=await configureJade(m,p,macros,load,warnings,{...overrides,textureBindings:maps});if(configured){uniforms=configured;m.userData.adapter='jade-channels';}
  }else if(sparkle02){const configured=await configureSparkle02(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='sparkle02-channels';}
  }else if(charAnisoSparkle){const configured=await configureCharAnisoSparkle(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-char-aniso-sparkle-channels';}
  }else if(cyberEyes){const configured=await configureCyberEyes(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-cyber-eyes-channels';}
  }else if(fur){uniforms=await configureFur(m,p,macros,load,warnings,{...overrides,sourceSurface:surface},furLayer,overrides.furStep||0);m.userData.adapter='fur-shell-channels';
  }else if(sandHat){const configured=await configureSandHat(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-sand-hat-channels';}
  }else if(waterHat){const configured=await configureWaterHat(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='water-hat-channels';}
  }else if(snzq){const configured=await configureSnzq(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-snzq-channels';}
  }else if(ninecolor){const configured=await configureNinecolor(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-ninecolor-channels';}
  }else if(cartoon){uniforms=await configureCartoon(m,p,macros,load,warnings,overrides);m.userData.adapter='cartoon-channels';
  }else if(anisotropic){uniforms=await configureAnisotropic(m,p,macros,load,warnings,overrides);m.userData.adapter='anisotropic-channels';
  }else if(hdcbCrystal){const configured=await configureHdcbCrystal(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-hdcb-crystal-channels';}else warnings.push('hdcb_crystal 缺少六纹理或源第二 UV，保持未适配');
  }else if(hdcbInner||hdcbOpaque){const configured=await configureHdcbFamily(m,{...p,__surface:hdcbInner?'inner':'opaque'},macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=`source-hdcb-${hdcbInner?'inner':'opaque'}-channels`;}else warnings.push(`hdcb_${hdcbInner?'inner':'opaque'} 缺源输入或第二 UV，保持未适配`);
  }else if(crystal){uniforms=await configureCrystal(m,p,macros,load,warnings,overrides);
  }else if(sparkle){uniforms=await configureSparkle(m,p,macros,load,warnings,overrides);
  }else if(diamondMetal){const configured=await configureDiamondMetal(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-diamond-metal-channels';}
  }else if(kqbs){
    const configured=await configureKqbs(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='kqbs-channels';}
  }else if(wingPearl){
    uniforms=await configureWingPearl(m,p,macros,load,warnings,overrides);
  }else if(pearl){
    uniforms=await configurePearl(m,p,macros,load,warnings,overrides);
  }else if(xyHair){
    const configured=await configureXyHair(m,p,macros,load,warnings);
    if(configured){uniforms=configured;m.userData.adapter='source-xy-hair-channels';}
  }else if(djlwHair){const configured=await configureDjlwHair(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-djlw-hair-channels';}else warnings.push('djlw_hair 缺源 Tex0-Tex4 或第二 UV，保持未适配');
  }else if(sjmgcb){const configured=await configureSjmgcb(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-sjmgcb-channels';}else warnings.push('sjmgcb 缺源 Tex0/BaseNormal/MatCap/DepthNormal/MixTex，保持未适配');
  }else if(hw){const configured=await configureHw(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-hw-channels';}
  }else if(qingsheCloth){const configured=await configureQingsheCloth(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-qingshe-cloth-channels';}
  }else if(spaceHair||lbHair){const configured=await configureT101Hair(m,p,macros,load,warnings,overrides,spaceHair?'space':'lb');if(configured){uniforms=configured;m.userData.adapter=`source-${spaceHair?'spacehair':'lb-hair'}-channels`;}
  }else if(glitch01){const configured=await configureCharLocalEffects(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-glitch01-channels';}
  }else if(marble||marbleEmissive){const configured=await configureMarble(m,p,macros,load,warnings,overrides,marbleEmissive);if(configured){uniforms=configured;m.userData.adapter=`source-marble${marbleEmissive?'-emissive':''}-channels`;}
  }else if(jgyj2){const configured=await configureJgyj2(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-jgyj2-channels';}
  }else if(crystal2){const configured=await configureCrystal2(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-crystal2-channels';}
  }else if(elecMusic!==null){const configured=await configureElecMusic(m,p,macros,load,warnings,overrides,elecMusic);if(configured){uniforms=configured;m.userData.adapter='source-elec-music'+elecMusic+'-channels';}
  }else if(starScreen){const configured=await configureStarScreen(m,p,macros,load,warnings,overrides,starScreen);if(configured){uniforms=configured;m.userData.adapter='source-'+starScreen+'-channels';}
  }else if(shenianzuoqiStar){const configured=await configureShenianzuoqiStar(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-shenianzuoqi-star-channels';}else warnings.push('shenianzuoqi_star lacks original textures or tangents, remaining unsupported');
  }else if(petEspecial){const configured=await configurePetEspecial(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-pet-especial001-channels';}else warnings.push('pet_especial001 lacks original textures or tangents, remaining unsupported');
  }else if(u5Lb){const configured=await configureU5Lb(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-u5-lb-channels';}
  }else if(pudding){const configured=await configurePudding(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-standard-pudding-channels';}else warnings.push('standard_pudding lacks original textures or tangents, remaining unsupported');
  }else if(flowsand){const configured=await configureFlowsand(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-flowsand-channels';}
  }else if(depthOffset){const configured=await configureDepthOffset(m,{...p,__depthLn:surface.endsWith('_ln.surf')},macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=`source-depthoffset${surface.endsWith('_ln.surf')?'_ln':''}-channels`;}else warnings.push('depthoffset 未满足上述源输入条件，保持未适配');
  }else if(mumaxuanzhuan){const configured=await configureMumaxuanzhuan(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-mumaxuanzhuan-channels';}else warnings.push('木马滚动UV未满足原切线或贴图输入，保持未适配');
  }else if(charLaser){const configured=await configureCharLaser(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-char-laser01-channels';}else warnings.push('char_laser01 缺源 Tex0-Tex3，保持未适配');
  }else if(charLaserSource){const configured=await configureCharLaserSource(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-char-laser-channels';}else warnings.push('char_laser 缺源 Tex0-Tex3，保持未适配');
  }else if(mkf){const configured=await configureMkf(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-standard-common-mkf-channels';}else warnings.push('standard_common_mkf 缺源 Tex0-Tex4，保持未适配');
  }else if(bsqs||qsHair){const configured=await configureBsqs(m,p,macros,load,warnings,qsHair?'hair':'base',overrides);if(configured){uniforms=configured;m.userData.adapter=`source-${qsHair?'qs-hair':'bsqs-base'}-channels`;}else warnings.push(`${qsHair?'standard_qs_hair':'standard_bsqs_base'} 缺源贴图，保持未适配`);
  }else if(djhdj02){const configured=await configureDjhdj02(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-djhdj02-channels';}else warnings.push('standard_common_djhdj02 源输入或语义未支持，保持未适配');
  }else if(rrDeco){const configured=await configureRrDeco(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-rr-deco-channels';}else warnings.push('standard_rr_deco 缺源 Tex0-Tex3，保持未适配');
  }else if(rrStar){const configured=await configureRrStar(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-rr-star-channels';}else warnings.push('standard_rr_star 源输入未闭合，保持未适配');
  }else if(rampDistort){const configured=await configureRampDistort(m,p,macros,load,warnings,{...overrides,textureBindings:maps});if(configured){uniforms=configured;m.userData.adapter='source-rampdistort-channels';}else warnings.push('u5_rampdistort 源输入未闭合，保持未适配');
  }else if(addEmissive){const configured=await configureAddEmissive(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-add-emissive-channels';}else warnings.push('add_emissive 源输入或语义未支持，保持未适配');
  }else if(unlitDiffuseChange){const configured=await configureUnlitDiffuseChangeColor(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-unlit-diffuse-changecol-channels';}else warnings.push('unlit_diffuse_changecol_v 缺源 Tex0，保持未适配');
  }else if(unlitDiffuse){const configured=await configureUnlitDiffuse(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-unlit-diffuse-channels';}else warnings.push('unlit_diffuse 缺源 Tex0，保持未适配');
  }else if(unlitRim){const configured=await configureUnlitRim(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-unlit-rim-channels';}else warnings.push('unlit_diffuse_rim 源输入未通过校验，保持未适配');
  }else if(fried){const configured=await configureFriedChicken(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-fried-chicken-channels';}
  }else if(charGlitch){const configured=await configureCharGlitch(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-char-glitch-channels';}else warnings.push('standard_char_glitch 缺源 Tex0-Tex3，保持未适配');
  }else if(musicwing){const configured=await configureMusicwing(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-musicwing-channels';}else warnings.push('standard_common_musicwing 缺源 Tex0-Tex3，保持未适配');
  }else if(magicCard){const configured=await configureMagicCard(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-magic-card-channels';}else warnings.push('magic_card 缺源 Tex0-Tex2，保持未适配');
  }else if(mffxbb){const configured=await configureMffxbb(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-mffxbb-channels';}else warnings.push('standard_common_mffxbb 缺源 Tex0-Tex4，保持未适配');
  }else if(mjclip){const configured=await configureMjclip(m,p,macros,load,warnings);if(configured){uniforms=configured;m.userData.adapter='source-mjclip-channels';}else warnings.push('mjclip 缺源 Tex0-Tex2，保持未适配');
  }else if(hair){
    uniforms=await configureHair(m,p,macros,load,warnings,overrides);
  }else if(flow){
    uniforms=await configureFlowmap(m,p,macros,load,warnings,overrides,flow2);
  }else if(goldfishWing){
    const configured=await configureGoldfish(m,p,macros,load,warnings,overrides);
    if(configured){uniforms=configured;m.userData.adapter='source-goldfish-channels';}
  }else if(wing){
    const configured=await configureWing(m,p,macros,load,warnings);
    wing=Boolean(configured);
    if(configured)uniforms=configured;
    else warnings.push('unlit_wing 源输入未闭合，保持未适配');
  }else if(texemis){
    const configured=await configureTexemis(m,p,macros,load,warnings,{...overrides,textureBindings:maps});
    texemis=Boolean(configured);
    if(configured){uniforms=configured;m.userData.adapter=overrides.sourceTangents===true?'texemis-channels':'texemis-derived-tangent-channels';}
    else{
      m.map=await load('Tex0',true,overrides.baseColor);m.roughness=.72;m.metalness=0;
      warnings.push(`未适配 Surface：${surface}（源贴图输入未闭合）`);
    }
  }else if(tilingAll){const configured=await configureTilingAll(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-tiling-all-channels';}
  }else if(ugcCrystal){const configured=await configureUgcCrystal(m,p,macros,load,warnings,overrides,ugcUp);if(configured){uniforms=configured;m.userData.adapter='source-ugc-crystal-channels';}
  }else if(dwgHead){const configured=await configureDwgHead(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-dwg-head-channels';}
  }else if(tangzhi){const configured=await configureTangzhi(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-tangzhi-channels';}
  }else if(rainbowStar){const configured=await configureRainbowStar(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter=m.userData.rainbowDerivedTangent?'source-rainbow-star-derived-tangent-channels':'source-rainbow-star-channels';}
  }else if(dynlight){const configured=await configureDynlight(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-dynlight-channels';}
  }else if(tpl){const configured=await configureTpl(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-tpl-channels';}
  }else if(commonYp){const configured=await configureCommonYp(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-common-yp-channels';}
  }else if(sdg){const configured=await configureSdg(m,p,macros,load,warnings,overrides);if(configured){uniforms=configured;m.userData.adapter='source-sdg-channels';}else warnings.push('standard_char_sdg 源输入未闭合，保持未适配');
  }else if(breath){
    uniforms=await configureBreath(m,p,macros,load,warnings,overrides);
    m.userData.adapter=uniforms?'source-breath-channels':'unsupported';
    uniforms??={};
  }else if(matcap){
    uniforms=await configureMatcap(m,p,macros,load,warnings,overrides,matcap2);
  }else if(vfx4||vfx5||vfx6||vfx7){
    uniforms=await configureParticle(m,p,macros,load,vfx6,warnings,vfx5,vfx7);
    if(vfx7)warnings.push('u5_vfx_common_7 的 FX_UV_OPT、深度淡化和 DepthBias 尚未接入；DissolveTex 已按源阈值分支接入');
  }else if(jelly||inner){
    if(inner){m.side=sourcePass===0?THREE.BackSide:THREE.FrontSide;if(sourcePass===1){m.transparent=true;m.blending=THREE.NormalBlending;}}
    uniforms=await configureJelly(m,p,macros,load,surface.endsWith('_gradient.surf'),warnings,overrides,inner?sourcePass:null);
  }else if(standard){
    m.map=await load('Tex0',false,overrides.baseColor);m.normalMap=await load('Tex1',false,overrides.normal);
    if(vertOffset)m.vertexColors=true;
    m.normalScale.setScalar(intensity[0]);
    const mix=await load('Tex2',false,overrides.mask);m.aoMap=mix;m.roughnessMap=number(p.UGCKey_R,1)?mix:null;m.metalnessMap=number(p.UGCKey_M,1)?mix:null;
    m.roughness=intensity[1];m.metalness=mix||!number(p.UGCKey_M,1)?intensity[2]:0;if(!char&&!common)m.opacity*=base[3];
    const change=number(macros.CHAR_CHANGE_COLOR,char?1:0)!==0,tint=number(p.TintValue,1);
    const ec=vec(p.EmissiveColor,char?[1,1,1,1]:[0,0,0,0]);
    m.emissive=char?color(ec):new THREE.Color().setRGB(...ec.slice(0,3));
    m.emissiveIntensity=char?number(p.EmissiveValue,1):intensity[3]*tint;
    if(reflection)m.emissiveIntensity=number(p.EmissiveValue,1);
    if(mix){uniforms.neoMix={value:mix};fragment+='uniform sampler2D neoMix;\n';}
    uniforms.neoEmissionScale={value:1};
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      if(vertOffset){
        shader.uniforms.neoVertTime={value:0};
        shader.vertexShader=`float neoVertRandom(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}\nfloat neoVertNoise(vec2 q){vec2 i=floor(q),f=fract(q),u=f*f*(3.0-2.0*f);float a=neoVertRandom(i),b=neoVertRandom(i+vec2(1.0,0.0)),c=neoVertRandom(i+vec2(0.0,1.0)),d=neoVertRandom(i+vec2(1.0,1.0));return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}\n`+'uniform float neoVertTime;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          transformed.y+=neoVertNoise(transformed.xz+vec2(neoVertTime*.5,neoVertTime))*pow(color.x,2.0)*.2;`);
      }
      shader.fragmentShader=fragment+shader.fragmentShader;
      let mapCode=THREE.ShaderChunk.map_fragment+'\nvec4 neoRawColor=diffuseColor;';
      if(char){mapCode+=change?`\ndiffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(0.2125,0.7154,0.0721)))*${glvec(color(base).toArray())}*${scalar(tint)};`:`\ndiffuseColor.rgb*=${scalar(tint)};`;}
      else{mapCode+=`\n${change?'diffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(0.2125,0.7154,0.0721)));':''}\ndiffuseColor.rgb=sRGBTransferEOTF(vec4(diffuseColor.rgb*${glvec(mult&&!change?[1,1,1]:base.slice(0,3))},1.0)).rgb*${scalar(tint)};`;}
      if(!char&&!common)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',mapCode);
      const emission=char?`${mix?'texture2D(neoMix,vAoMapUv).a':'0.0'} * mix(vec3(1.0),diffuseColor.rgb,${scalar(number(p.BaseEmissiveKey,0))})`:
        number(macros.ENABLE_EMISSIVE,0)?'diffuseColor.rgb':mix?'vec3(texture2D(neoMix,vAoMapUv).a)':'vec3(0.0)';
      if(!char&&!common)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`totalEmissiveRadiance *= ${emission};`);
    };
    if(reflection||mult){
      const compile=m.onBeforeCompile;
      m.onBeforeCompile=shader=>{
        compile(shader);
        shader.fragmentShader='uniform float neoEmissionScale;\n'+shader.fragmentShader;
        const sss=`
        vec3 neoView=normalize(vViewPosition);
        float neoFres=clamp(${scalar(number(p.FresnelScale,0))}+(1.0-${scalar(number(p.FresnelScale,0))})*pow(1.0-dot(normal,neoView),5.0),0.0,1.0);
        totalEmissiveRadiance+=neoFres*${glvec(vec(p.RimColor,[0,0,0,0]).slice(0,3))}*${scalar(intensity[3])}*neoEmissionScale;
        #if NUM_DIR_LIGHTS > 0
        vec3 neoSun=-directionalLights[0].direction;
        float neoSSS=clamp(clamp(dot(neoView,-(normal*.1+neoSun)),0.0,1.0)*.5+clamp(dot(neoView,-(normal*.3-neoSun)),0.0,1.0),0.0,1.0);
        totalEmissiveRadiance+=mix(neoRawColor.rgb*vec3(.7,.4,.3),directionalLights[0].color,clamp(pow(neoSSS,5.0),0.0,1.0))*neoSSS*.3*${scalar(mult?1:tint)}*neoEmissionScale;
        #endif
        `;
        shader.fragmentShader=shader.fragmentShader.replace(/totalEmissiveRadiance \*= [^;]+;/,match=>mult?`
        float neoAlpha=${mix?'texture2D(neoMix,vAoMapUv).a':'0.0'};
        float neoMask01=1.0-step(neoAlpha,.55);
        float neoMask02=(1.0-step(neoAlpha,.45))-neoMask01;
        totalEmissiveRadiance=(neoMask01*${glvec(vec(p.EmissiveColor01,[1,1,1,1]).slice(0,3))}+neoMask02*${glvec(vec(p.EmissiveColor02,[1,1,1,1]).slice(0,3))}*1.2)*${scalar(number(p.EmissiveValue,1))}*neoEmissionScale;
        ${sss}
        totalEmissiveRadiance=sRGBTransferEOTF(vec4(totalEmissiveRadiance,1.0)).rgb;
        `:match+'\n'+sss);
      };
      warnings.push('高清反射材质通道、面部 UV 与 SSS 公式已接入；光照环境未与原场景标定');
    }
    if(detail){
      const detailMap=await load('Tex3');uniforms.neoDetail={value:detailMap};uniforms.neoTime={value:0};
      const compile=m.onBeforeCompile;
      m.opacity=rs.opacity;m.normalScale.setScalar(1);
      // standard_char_detail writes source emission in its custom shader. A
      // white Three.js base emissive would otherwise survive when the source
      // material has no emissive map and brighten the whole submesh.
      m.emissive.set(0x000000);m.emissiveIntensity=0;
      m.onBeforeCompile=shader=>{
        compile(shader);Object.assign(shader.uniforms,uniforms);
        shader.fragmentShader='uniform sampler2D neoDetail;\nuniform float neoEmissionScale;\n'+shader.fragmentShader;
        const opacity=`diffuseColor.a=mix(${scalar(base[3])},neoRawColor.a,${scalar(number(p.AlphaKey,0))})*${scalar(rs.opacity)};`;
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',opacity+'\n#include <alphatest_fragment>');
        if(detailMap&&m.normalMap){
          const normalCode=`
          vec4 neoBaseNormal=texture2D(normalMap,vNormalMapUv);
          vec3 neoB=neoBaseNormal.xyz*2.0-1.0;
          vec2 neoUv=vNormalMapUv+vec2(${scalar(number(p.DetailX,0))},${scalar(number(p.DetailY,0))});
          float neoSeam=clamp(ceil(vNormalMapUv.y-.25)+ceil(.25-vNormalMapUv.x),0.0,1.0);
          vec2 neoDetailUv=mix(fract(neoUv*4.0)*${scalar(number(p.DetailNormalUVTiling,5)/4)},neoUv*${scalar(number(p.DetailNormalUVTiling,5))},neoSeam);
          neoDetailUv=mix(neoDetailUv,neoUv*${scalar(number(p.DetailNormalUVTiling,5))},${scalar(number(p.UVSeamKey,0))});
          vec3 neoD=texture2D(neoDetail,neoDetailUv).xyz*2.0-1.0;
          vec3 neoBN=vec3(neoB.xy*.5,neoB.z+1.0);
          vec3 neoAN=vec3(-neoD.xy*${scalar(number(p.DetailNormalIntensity,.2))},neoD.z);
          vec3 neoBlend=neoBN*dot(neoBN,neoAN)-(neoBN.z+1.0)*neoAN;
          vec3 neoLerpNormal=mix(normalize(tbn*normalize(neoB)),normalize(tbn*normalize(neoBlend)),neoBaseNormal.a);
          vec3 neoAddNormal=normalize(tbn*normalize(vec3(neoD.xy*.5,neoD.z)));
          normal=neoLerpNormal;
          ${!number(macros.CHAR_CHANGE_COLOR,1)?`float neoF=pow(clamp(${scalar(number(p.FA,.8))}-dot(neoAddNormal,normalize(vViewPosition)),0.0,1.0),${scalar(number(p.FB,.3))});
          diffuseColor.rgb+=sRGBTransferEOTF(vec4(${glvec(vec(p.FrenelColor,[1,1,1,1]).slice(0,3))}*neoF*neoBaseNormal.a,1.0)).rgb+clamp(.3-dot(nonPerturbedNormal,normalize(vViewPosition)),0.0,1.0)*${scalar(number(p.Mao1Fres,1))};`:''}
          `;
          shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',normalCode);
        }
        shader.fragmentShader=shader.fragmentShader.replace(/totalEmissiveRadiance \*= [^;]+;/,`totalEmissiveRadiance=${mix?'texture2D(neoMix,vAoMapUv).a':'0.0'}*neoRawColor.rgb*${scalar(number(p.BaseColEmissive,0))}*${glvec(vec(p.BaseEmisColor,[1,1,1,1]).slice(0,3))}*neoEmissionScale;`);
      };
      warnings.push(number(p.SimulationSP_Key,0)?'细节法线与透明沿用现有适配；闪粉底色、法线和发光仍待还原':'细节法线与透明沿用现有适配；原底色、边缘发光和完整场景仍待补齐');
    }
    if(detail)detailLightingReady=await configureDetailLighting(m,p,macros,mix,uniforms,load,warnings,overrides);
    if(char||common)standardLightingReady=configureStandardLighting(m,p,macros,mix,char,warnings,overrides);
    warnings.push('源通道已适配；原场景、间接光、皮下散射与边缘光尚未完整还原');
  }else if(special){
    m.map=await load('Tex0',true,overrides.baseColor);m.normalMap=await load('Tex1',false,overrides.normal);
    const packed=await load('Tex2'),detailMap=await load('Tex3'),cap=await load('MatCap',true);
    m.roughnessMap=packed;m.metalnessMap=packed;m.roughness=intensity[1];m.metalness=packed?intensity[2]:0;
    m.normalScale.setScalar(1);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    uniforms={neoMix:{value:packed},neoDetail:{value:detailMap},neoCap:{value:cap},neoTime:{value:0},neoEmissionScale:{value:1}};
    const f=(key,fallback)=>scalar(number(p[key],fallback));
    const v=(key,fallback=[1,1,1,1])=>glvec(vec(p[key],fallback).slice(0,3));
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec2 neoSpecialUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoSpecialUv=uv;');
      shader.fragmentShader='varying vec2 neoSpecialUv;\nuniform sampler2D neoMix;\nuniform sampler2D neoDetail;\nuniform sampler2D neoCap;\nuniform float neoTime;\nuniform float neoEmissionScale;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment+`
        vec3 neoAlbedo=diffuseColor.rgb;
        vec4 neoPacked=${packed?'texture2D(neoMix,neoFaceUv(neoSpecialUv))':'vec4(1.0,1.0,0.0,0.0)'};
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        vec3 neoBaseNormal=normal;
        vec3 neoAddNormal=normal;
        vec3 neoTangent=vec3(0.0);
        vec3 neoSourceBitangent=vec3(0.0);
        #ifdef USE_NORMALMAP_TANGENTSPACE
        vec4 neoTex1=texture2D(normalMap,vNormalMapUv);
        vec3 neoB=neoTex1.xyz*2.0-1.0;
        float neoSeam=clamp(ceil(vNormalMapUv.y-.25)+ceil(.25-vNormalMapUv.x),0.0,1.0);
        vec2 neoDetailUv=mix(fract(vNormalMapUv*4.0)*${f('DetailNormalUVTiling',5)}/4.0,vNormalMapUv*${f('DetailNormalUVTiling',5)},neoSeam);
        vec3 neoD=${detailMap?'texture2D(neoDetail,neoDetailUv).xyz*2.0-1.0':'vec3(0.0,0.0,1.0)'};
        vec3 neoBN=vec3(neoB.xy*.5,neoB.z+1.0);
        vec3 neoAN=vec3(-neoD.xy*${f('DetailNormalIntensity',.2)},neoD.z);
        vec3 neoBlend=neoBN*dot(neoBN,neoAN)-(neoBN.z+1.0)*neoAN;
        neoBaseNormal=normalize(tbn*normalize(neoB));
        normal=mix(neoBaseNormal,normalize(tbn*normalize(neoBlend)),neoTex1.a);
        neoAddNormal=normalize(tbn*normalize(vec3(neoD.xy*.5,neoD.z)));
        neoTangent=tbn[0];neoSourceBitangent=normalize(tbn[1]);
        #endif
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
        vec3 neoView=normalize(vViewPosition);
        float neoDetailMask=${detailMap?'texture2D(neoDetail,neoFaceUv(neoSpecialUv)).a':'1.0'};
        vec3 neoCapColor=${cap?'texture2D(neoCap,vec2(neoBaseNormal.x*.5+.5,-(neoBaseNormal.y*.5+.5))).rgb':'vec3(0.0)'};
        float neoCapBase=max(dot(neoView,nonPerturbedNormal)-${f('FRScale',.8)},0.0);
        // HALF_MIN comes from the verified Android common/constants.hlsl.
        float neoCapMask=step(.000061035,neoCapBase);
        float neoCapFresnel=1.0-clamp(pow(neoCapBase+1.0-neoCapMask,${f('FRPow',.5)})*2.0,0.0,1.0)*neoCapMask;
        vec3 neoCapLight=neoCapColor*neoAlbedo*mix(neoPacked.r,neoPacked.b,${f('MetalnessMaskEnable',0)})*neoCapFresnel;
        vec3 neoBaseCap=mix(neoAlbedo,mix(neoAlbedo*${f('BaseMetalness',1)},vec3(1.0),neoCapLight),neoPacked.r);
        vec3 neoWorldUp=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));
        float neoEdgeDot=dot(cross(neoView,neoWorldUp),normal);
        float neoEdgeBaseA=clamp(-neoEdgeDot-.8,0.0,1.0),neoEdgeBaseB=clamp(neoEdgeDot-.8,0.0,1.0);
        float neoEdgeMaskA=step(.000061035,neoEdgeBaseA),neoEdgeMaskB=step(.000061035,neoEdgeBaseB);
        float neoEdgeA=pow(neoEdgeBaseA+1.0-neoEdgeMaskA,.6)*neoEdgeMaskA*2.0;
        float neoEdgeB=pow(neoEdgeBaseB+1.0-neoEdgeMaskB,.2)*neoEdgeMaskB*2.0;
        neoCapLight+=vec3(.5*neoEdgeA*${f('changeBY',0)});
        neoBaseCap*=mix(1.0,mix(1.0,.8,neoEdgeB),${f('changeBY',0)});
        ${number(macros.CHAR_CHANGE_COLOR,1)?`diffuseColor.rgb=sRGBTransferEOTF(vec4(vec3(dot(neoAlbedo,vec3(.2125,.7154,.0721)))*${v('BaseColor')},1.0)).rgb*${f('TintValue',1)};`:`diffuseColor.rgb=neoBaseCap*${v('BaseColor')}*${f('TintValue',1)};`}
        float neoFresnel=clamp(${f('FresnelScale',0)}+(1.0-${f('FresnelScale',0)})*pow(1.0-dot(normal,neoView),5.0),0.0,1.0);
        float neoPhase=fract(neoTime*${f('TimeValue',2)}*.159155);
        float neoCycle=smoothstep(0.0,1.0,1.0-abs(neoPhase*2.0-1.0));
        vec3 neoColorCycle=mix(neoPacked.b*${v('SSColorA')}*${v('SSColorA')}*${f('SSColorIntensityA',2)},neoPacked.b*${v('SSColor')}*${v('SSColor')}*${f('SSColorIntensity',2)},neoCycle);
        vec3 neoBaseEmis=mix(neoColorCycle,neoPacked.a*neoAlbedo*2.0,neoPacked.a)*${f('BaseEmissiveKey',0)};
        totalEmissiveRadiance=neoFresnel*${v('RimColor',[0,0,0,0])}*${scalar(intensity[3])}+mix(1.0,neoPacked.r,clamp(${f('MatcapStr',1)}-1.0,0.0,1.0))*neoCapLight*${f('MatcapStr',1)}+neoBaseEmis;
        float neoAddBase=clamp(${f('FA',.8)}-dot(neoAddNormal,neoView),0.0,1.0);
        float neoAddMask=step(.000061035,neoAddBase);
        float neoAddFres=clamp(pow(neoAddBase+1.0-neoAddMask,${f('FB',.3)}),0.0,1.0)*neoAddMask;
        totalEmissiveRadiance+=${v('FrenelColor')}*neoAddFres*${f('FrenelEmiStr',0)}*mix(1.0,neoDetailMask,${f('FrenelMaskEnable',0)});
        float neoTriangle=2.0*abs(fract(neoTime*${f('EmissiveBreathSpd',1)})-.5)-1.0;
        totalEmissiveRadiance+=neoPacked.a*neoAlbedo*${f('EmissiveValue',1)}*${f('UseDefaultEmis',0)}*mix(1.0,1.0+${f('EmissiveBreathPercent',1)}*neoTriangle,${f('EmissiveBreathEnable',0)});
        #if NUM_DIR_LIGHTS > 0 && defined(USE_NORMALMAP_TANGENTSPACE)
        vec3 neoHalf=normalize(directionalLights[0].direction+vViewPosition);
        vec3 neoAnisoTangent=mix(neoSourceBitangent,cross(normal,neoTangent),${f('AnisoNormalEnable',0)});
        float neoTdH=dot(neoAnisoTangent,neoHalf);
        float neoAnisoN=mix(120.0,60.0,${f('AnisoNormalEnable',0)})*${f('AnisoPow',1)}*1.4427+1.4427;
        totalEmissiveRadiance+=exp2(-neoTdH*neoTdH*neoAnisoN)*neoDetailMask*${v('AnisoColor',[0,0,0,0])};
        #endif
        totalEmissiveRadiance*=neoEmissionScale;
      `);
    };
    warnings.push('特殊金属已补当前 PPK 的 Matcap 强度、平滑三角变色及极小值保护；原场景光照和低画质仍待标定');
  }else if(plastic){
    const variable=vec(p.Variable,[1,0,0,.5]);
    m.normalMap=await load('Tex0',false,overrides.normal);m.color=color(base);m.roughness=variable[1];m.metalness=variable[2];
    const cap=await load('Tex1'),mask=await load('Tex2');m.emissive.set(0xffffff);m.emissiveIntensity=1;
    uniforms={neoCap:{value:cap},neoMask:{value:mask},neoEmissionScale:{value:1}};
    const fresnel=number(p.FresnelColor_Key,0)!==0;
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec2 neoUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoUv=uv;');
      shader.fragmentShader='varying vec2 neoUv;\nuniform sampler2D neoCap;\nuniform sampler2D neoMask;\nuniform float neoEmissionScale;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','');
      const body=`
        vec4 neoCapSample=${cap?'texture2D(neoCap,vec2(normal.x*.5+.5,-(normal.y*.5+.5)))':'vec4(1.0)'};
        vec4 neoMaskSample=${mask?'texture2D(neoMask,neoUv)':'vec4(0.0,0.0,0.0,1.0)'};
        float neoNoV=dot(normalize(vViewPosition),normal);
        float neoAlpha=neoMaskSample.a*${scalar(number(p.AlphaLepButton,0))};
        diffuseColor.rgb=mix(diffuseColor.rgb,sRGBTransferEOTF(neoMaskSample).rgb,neoAlpha);
        diffuseColor.a=clamp(${scalar(variable[3])}*neoCapSample.a+neoAlpha,0.0,1.0)*${scalar(rs.opacity)};
        roughnessFactor*=1.0-neoMaskSample.a*${scalar(number(p.MaskKey,0))};
        metalnessFactor*=1.0-neoMaskSample.a*${scalar(number(p.MaskKey,0))};
        totalEmissiveRadiance=sRGBTransferEOTF(neoCapSample).rgb*neoEmissionScale;
        ${fresnel?`
        float neoFc=clamp(pow(max(neoNoV-${scalar(number(p.COA,.1))},0.0),${scalar(number(p.COB,1))}),0.0,1.0);
        vec3 neoCol=mix(${glvec(color(vec(p.AColor,[1,1,1,1])).toArray())},${glvec(color(vec(p.BColor,[1,1,1,1])).toArray())},neoFc);
        diffuseColor.rgb=mix(sRGBTransferEOTF(vec4(neoCol,1.0)).rgb,sRGBTransferEOTF(neoMaskSample).rgb,neoMaskSample.a);
        float neoFo=clamp(pow(max(neoNoV-${scalar(number(p.OPA,.3))},0.0),${scalar(number(p.OPB,.6))}),0.0,1.0);
        diffuseColor.a=mix(mix(${scalar(number(p.OPLerpA,.6))},${scalar(number(p.OPLerpB,1))},neoFo),1.0,neoMaskSample.a)*${scalar(rs.opacity)};
        totalEmissiveRadiance=sRGBTransferEOTF(vec4(max(neoCapSample.rgb*${scalar(number(p.MatcapEmissiveIntensity,0))}-neoMaskSample.a,vec3(0.0)),1.0)).rgb*neoEmissionScale;`:''}
      `;
      // Opacity depends on the normal/Matcap result, so test the final value.
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','');
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+body+'\n#include <alphatest_fragment>');
    };
    warnings.push('Plastic 法线、Matcap、遮罩与透明已适配；折射与溶解未还原');
  }else{
    // Keep the old preview only as an explicitly unsupported surface fallback.
    const previewMap=await load('Tex0',true,overrides.baseColor);
    // A source cube cannot be sampled by MeshStandardMaterial's 2D map slot.
    m.map=previewMap?.isCubeTexture?null:previewMap;m.roughness=.72;m.metalness=0;
    if(previewMap?.isCubeTexture)warnings.push('源 Tex0 为立方体纹理；未适配材质的二维预览不绑定此纹理');
    const effect=source.technique?.TechName;
    warnings.push(effect?`未适配 Effect：${effect}`:`未适配 Surface：${surface||'未知'}`);
    if(wingSource)warnings.push('翅膀源压缩切线尚未解码，未启用依赖 TBN 的材质；不会使用重算切线替代');
    warnings.push(...texemisIssues);
    warnings.push(...vfx5Issues);
    if(flow2Source)warnings.push('流动材质需要已验证的源第二 UV 和 TEXCOORD1_ENABLE；未启用 UV 替代');
    if(hairSource)warnings.push('头发材质需要已验证的源第二 UV、TEXCOORD1_ENABLE 及 NORMAL_MAP_ENABLE');
    if(specialCloud)warnings.push('specialcloud unsupported: source UV1 texture displacement, triplanar normal, caustic and negative-base pow semantics unresolved');
    if(fireSource)warnings.push('火焰材质需要已验证的源第二 UV 和成功载入的 Tex0、Tex1；不会使用主 UV 或替代贴图');
    if(fire2Source&&!fire2)warnings.push('standard_char_fire2 需要已验证的源第二 UV 和 Tex0-Tex3；不会使用主 UV 或替代贴图');
  }
  if(boomsugar&&!boomsugarPass&&standardLightingReady)m.userData.adapter='source-boomsugar-channels';
  if(!m.map&&!m.userData.adapter&&!fire&&!carSource&&!rosesSource&&!mobaSource&&!compoundShell&&!firenoiseSource&&!plastic&&!vfx4&&!vfx5&&!vfx6&&!vfx7&&!jelly&&!inner&&!matcap&&!breath&&!texemis&&!flow&&!hair&&!pearl&&!wingPearl&&!kqbs&&!sparkle&&!crystal)m.color.set(0xbcc9c9);
  if(char||detail||reflection||mult||special||jelly||inner||flow||pearl||wingPearl||sparkle||crystal){
    uniforms.neoFaceOffset={value:number(p.FaceUVOffset,0)};
    const compile=m.onBeforeCompile;
    m.onBeforeCompile=shader=>{
      compile(shader);shader.uniforms.neoFaceOffset=uniforms.neoFaceOffset;
      // CustomizeFragmentData changes the sampled UV, not vertex interpolants.
      for(const chunk of ['map_fragment','normal_fragment_maps','roughnessmap_fragment','metalnessmap_fragment','aomap_fragment'])shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>',THREE.ShaderChunk[chunk]);
      shader.fragmentShader=shader.fragmentShader.replace(/\bv(Map|NormalMap|AoMap|RoughnessMap|MetalnessMap)Uv\b/g,uv=>`neoFaceUv(${uv})`);
      shader.fragmentShader=`uniform float neoFaceOffset;\nvec2 neoFaceUv(vec2 uv){uv.x+=uv.y<0.25?neoFaceOffset*${scalar(number(p.CharOffset,1))}:0.0;return uv;}\n`+shader.fragmentShader;
    };
  }
  const configuredAdapter=m.userData.adapter;
  const sourceBuiltinTextures=m.userData.sourceBuiltinTextures;
  const splendorVariant=m.userData.splendorVariant;
  const batchSource=hdcbCrystal||hdcbInner||hdcbOpaque||djlwHair;
  const hdcbMetadata=batchSource?{...m.userData}:{};
  if(flowerQueen&&configuredAdapter){
    // flower_queen's CustomizeFragmentData is empty, unlike the wing adapter.
    const compile=m.onBeforeCompile;
    m.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader='vec2 neoFaceUv(vec2 uv){return uv;}\n'+shader.fragmentShader;};
  }
  const compileKey=JSON.stringify({surface,p,macros,maps,sourceFog:nfxGrass?sourceSceneFogFor(source):null,sourceLightingProfile:char?overrides.sourceLightingProfile??null:null,boomsugar:boomsugar?[boomsugarPass,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]:null,specialJade:specialJade?[overrides.sourceTangents===true,configuredAdapter]:null,sandHat:sandHat?[overrides.sourceTangents===true,configuredAdapter]:null,waterHat:waterHat?[overrides.sourceSecondUv===true,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]:null,snzq:snzq?[overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]:null,ninecolor:ninecolor?[overrides.sourceSecondUv===true,overrides.sourceTangents===true,configuredAdapter]:null,ccl:surface==='shader/surf/standard_change_color_laser.surf'?[overrides.sourceTangents===true,configuredAdapter]:null,t107:mkf||charLaserSource?[overrides.sourceTangents===true,configuredAdapter]:null,pudding:pudding?[overrides.sourceTangents===true,configuredAdapter]:null,alien:alien?{permutation:alienPermutation,adapter:configuredAdapter||null}:null,specialWings:specialWingsSource?{permutation:specialWingsPermutation,secondUv:overrides.sourceSecondUv===true,adapter:configuredAdapter||null}:null,splendor:splendorEffect?[source.technique.TechName,overrides.sourceSecondUv===true,overrides.sourceTangents===true,configuredAdapter]:null,sourcePass:inner||crystal2?sourcePass:null,hw:hw?[overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]:null,jgyj2:jgyj2?[overrides.sourceTangents===true,configuredAdapter]:null,crystal2:crystal2?[overrides.sourceTangents===true,configuredAdapter]:null,texemis:texemis?[overrides.sourceBounds?.half?.[2],configuredAdapter]:null,elecMusic:elecMusic!==null?[overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]:null,starScreen:starScreen?[overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]:null,sourceTangents:colorVariant||extraChange||extraFrenel||uvflow||glass||hw||fire2Source||glitch01||flowsand||texemisSource||depthOffset||goldfishWing||sdg||commonYp||twosided?overrides.sourceTangents===true:null,goldfishInputs:goldfishWing?[overrides.sourceSecondUv===true,configuredAdapter]:null,wing,flow2,hair,pearl,wingPearl,kqbs,sparkle,crystal,fire,depthOffset,sdgAdapter:sdg?configuredAdapter||null:null,commonYpAdapter:commonYp?configuredAdapter||null:null,tangzhi:tangzhi?[configuredAdapter,overrides.sourceTangents===true]:null,rainbowStar:rainbowStar?[configuredAdapter,overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]:null,dynlight:dynlight?[overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]:null,tpl:tpl?[configuredAdapter,overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]:null,charLaser,bsqs,qsHair,bsqsTangents:bsqs||qsHair?overrides.sourceTangents===true:null,djhdj02,rrDeco,rrStar,rampDistort,hdcbAdapter:batchSource?configuredAdapter:null});m.customProgramCacheKey=()=>compileKey;
  if(djhdj||commonJgyj||ugcCrystal||dwgHead)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceBounds,ugcUp]);
  const splendorSpecialization=m.userData.splendorSpecialization;
  m.userData={sourceSurface:surface,sourceLightingProfile:char?overrides.sourceLightingProfile??null:null,sourceBuiltinTextures,adapter:znqAudiokey?(configuredAdapter||'unsupported'):helmet?(configuredAdapter||'unsupported'):snow?'source-snow-channels':twosided?(configuredAdapter||'unsupported'):wing?'source-wing-channels':texemis?(configuredAdapter||'texemis-channels'):breath?(configuredAdapter||'unsupported'):matcap?'matcap-common-channels':inner?'jelly-inner-two-pass':jelly?'jelly-matcap-channels':vfx5?'particle-flipbook-channels':vfx4||vfx6||vfx7?'particle-vfx-channels':special?'special-metal-channels':mult?'multi-emission-channels':reflection?'high-reflection-channels':iceCream?'source-ice-cream-base-channels':iceChar?(configuredAdapter||'unsupported'):ftwj?'source-ftwj-base-channels':sodaWater?'source-sodawater-base-channels':tilingAlbedo?'source-tiling-albedo-channels':xyStar?(configuredAdapter||'unsupported'):t1erciyuan?(configuredAdapter||'unsupported'):snzq?(configuredAdapter||'unsupported'):glassCrystal?'source-glass-crystal-base-channels':parallaxSkirt?'source-parallax-skirt-base-channels':vertOffset?'source-vertoffset-base-channels':lantern?(configuredAdapter||'unsupported'):cloud?(configuredAdapter||'unsupported'):wingCrystal?(configuredAdapter||'unsupported'):charXhqp||blackSmoking||xhm||handprint||laserMask?'source-special-base-channels':baoshi||gemLn||tulle||xzll||rainbowPearl?'source-special-batch-base-channels':detail?(detailLightingReady?'detail-channels':'unsupported'):wingPearl?'source-wing-pearl-channels':standard?((char||common)&&!standardLightingReady?'unsupported':'standard-channels'):plastic?'plastic-channels':'unsupported',
    baseEmission:m.emissiveIntensity,baseTransparent:m.transparent,baseAlphaTest:m.alphaTest,baseDepthWrite:m.depthWrite,baseDepthTest:m.depthTest,baseBlending:m.blending,uniforms};
  if(nfxGrass)m.userData.sourceFogScene=sourceSceneFogFor(source)?.sourceScene||null;
  if(helmet)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.helmetFront===true,configuredAdapter]);
  if(znqAudiokey)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceSecondUv===true,overrides.sourceTangents===true,configuredAdapter]);
  if(lantern)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(xyStar)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(cloud)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.cloudFront===true,configuredAdapter]);
  if(t1erciyuan)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.t1Outline===true,configuredAdapter]);
  if(iceChar)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(surface==='shader/surf/standard_char_nos.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(snzq)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(ninecolor)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceSecondUv===true,overrides.sourceTangents===true,configuredAdapter]);
  if(specialJade)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(surface.startsWith('shader/surf/2026_carrier/2026_horse_'))m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(surface==='shader/surf/object_icefloor.surf'){m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceBounds,overrides.sourceVertexColors===true,overrides.sourceTangents===true,configuredAdapter]);if(configuredAdapter==='source-icefloor-channels'){m.userData.sceneRefraction=number(macros.RENDER_QUALITY,0)<2;m.userData.previewEnvironment={profile:'current-preview-color-depth-and-authored-bag-sun',fullOriginalScene:false};}}
  if(configuredAdapter==='source-ciyuanzhan-channels'){m.userData.sceneRefraction=true;m.userData.previewEnvironment={profile:'current-preview-color-buffer',fullOriginalScene:false};}
  if(surface==='shader/surf/standard_change_color_object_vtxoffset.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceBounds,overrides.sourceTangents===true,configuredAdapter]);
  if(surface==='shader/surf/matcap_prop_metallica.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(diamondMetal||standardCrystalBall||catwoman||charDiamond)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if((catwoman||charDiamond)&&configuredAdapter)m.userData.fidelityGaps=['Original mtl.shColor/LightProbeSHV2 artist fill not connected','Current preview indirect lighting and original PC-to-web float precision differ','Neutral soft-body only; source runtime controller remains pending'];
  if(diamondMetal&&configuredAdapter){m.userData.previewShadowReceiver=number(p.ShadowStrength,0)!==0;m.userData.fidelityGaps=['Current scoped geometry shadow is not original CSM/disk shadow/fading','Original scene lighting and half precision remain pending'];}
  if(standardCrystalBall&&configuredAdapter){m.userData.previewShadowReceiver=true;m.userData.fidelityGaps=['Current scoped geometry shadow is not original CSM/disk shadow/fading','Original scene lighting and half precision remain pending'];}
  if(surface==='shader/surf/s25/standard_car_paint_mix.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceBounds,overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]);
  if(surface==='shader/surf/standard_common_firework.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(boomsugar)m.customProgramCacheKey=()=>JSON.stringify([compileKey,boomsugarPass,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(surface.startsWith('shader/surf/animal_fur/'))m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]);
  if(['shader/surf/standard_common_ice.surf','shader/surf/unlit_crystal.surf','shader/surf/object_water_zhucheng.surf','shader/surf/s31/standard_common_bubble.surf','shader/surf/standard_mounts_fish.surf','shader/surf/obj_carbody.surf','shader/surf/mount_spring_festival.surf','shader/surf/standard_pet.surf','shader/surf/pet02/standard_pet02.surf'].includes(surface))m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(tintWing)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(backGlass)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(tilingAll)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(wingObjEffect)m.customProgramCacheKey=()=>JSON.stringify([compileKey,'nfx_wing_obj',sourcePass,configuredAdapter]);
  if(nfxWingEffect)m.customProgramCacheKey=()=>JSON.stringify([compileKey,'nfx_wing',configuredAdapter]);
  if(djhdj||commonJgyj||texemis||ugcCrystal||dwgHead)m.userData.sourceBounds=overrides.sourceBounds;
  if(configuredAdapter)m.userData.adapter=configuredAdapter;
  if(splendorSpecialization)m.userData.splendorSpecialization=splendorSpecialization;
  if(twosided){const baseKey=m.customProgramCacheKey();m.customProgramCacheKey=()=>JSON.stringify([baseKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);}
  if(surface==='shader/surf/mult_emission_color_xced.surf'){const baseKey=m.customProgramCacheKey();m.customProgramCacheKey=()=>JSON.stringify([baseKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,configuredAdapter]);}
  if(ink){const baseKey=m.customProgramCacheKey();m.customProgramCacheKey=()=>JSON.stringify([baseKey,inkOutline,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]);}
  if(lineDog){const baseKey=m.customProgramCacheKey();m.customProgramCacheKey=()=>JSON.stringify([baseKey,overrides.lineDogOutline===true,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]);}
  if(splendorEffect){m.userData.sourceEffect=(paopaoAlias.technique?.TechName||'').replaceAll('\\','/').toLowerCase();m.userData.splendorVariant=splendorVariant;}
  if(batchSource)Object.assign(m.userData,hdcbMetadata);
  if(angelBody)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(ycymvHair)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(ycymvHair&&configuredAdapter){
    m.userData.previewShadowReceiver=number(p.Shadow,0)!==0;
    m.userData.fidelityGaps=['Current opaque geometry shadow uses authored bag sun direction; original CSM, disk shadow, density and fading remain pending','Original scene and half precision parity remain pending'];
  }
  if(surface==='shader/surf/unlit_jelly_char_01.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(sparkle02)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(surface==='shader/surf/s31/standard_char_silver_jade.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(surface==='shader/surf/tpl_unlit_jelly_obj_gets.surf')m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(['shader/surf/standard_char_vertoffset.surf','shader/surf/standard_char_vertoffset_interface.surf','shader/surf/standard_jgyj.surf','shader/surf/xiaolanmao_chuchang.surf'].includes(surface))m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(houyi)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(xmbl2)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.xmblOutline===true,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(ryxs)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(charTest)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(femaleSkin)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(slzsCloth)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(slzsSha)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(xiaohei)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.xhOutline===true,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(charOutline)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.charOutlinePass===true,overrides.sourceTangents===true,configuredAdapter]);
  if(fireWing)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.sourceSecondUv===true,overrides.sourceVertexColors===true,configuredAdapter]);
  if(pgy&&configuredAdapter==='source-pgy-channels'){
    m.userData.pgyFurStep=overrides.pgyFurStep??null;
    m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.pgyFurStep!==undefined]);
    if(overrides.pgyFurStep===undefined){
      const passes=[m],count=surface.endsWith('pgy_low.surf')?3:11;
      for(let i=0;i<count;i++){
        const next=await sourceMaterial(source,texture,{...overrides,pgyFurStep:(i+2)*.05});
        if(next.material.userData.adapter!=='source-pgy-channels'){passes.forEach(x=>x.dispose());return next;}
        passes.push(next.material);
      }
      return {material:m,passes,warnings:[...new Set(warnings)]};
    }
  }
  if(zmt&&configuredAdapter==='source-zmt-channels'&&!overrides.zmtOutline){const next=await sourceMaterial(source,texture,{...overrides,zmtOutline:true});if(next.material.userData.adapter!=='source-zmt-channels'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(xmbl2&&(configuredAdapter==='source-xmbl2-channels'||configuredAdapter==='source-xmbl2-derived-tangent-channels')&&!overrides.xmblOutline){const next=await sourceMaterial(source,texture,{...overrides,xmblOutline:true});if(!['source-xmbl2-channels','source-xmbl2-derived-tangent-channels'].includes(next.material.userData.adapter)){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(xiaohei&&configuredAdapter==='source-xiaohei-channels'&&!overrides.xhOutline&&surface.endsWith('xiaohei_halftone.surf')){const next=await sourceMaterial(source,texture,{...overrides,xhOutline:true});if(next.material.userData.adapter!=='source-xiaohei-channels'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(charOutline&&configuredAdapter==='source-char-outline-channels'&&!overrides.charOutlinePass){const next=await sourceMaterial(source,texture,{...overrides,charOutlinePass:true});if(next.material.userData.adapter!=='source-char-outline-channels'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(boomsugar&&configuredAdapter==='source-boomsugar-channels'&&!boomsugarPass){
    const next=await sourceMaterial(source,texture,{...overrides,boomsugarPass:true});
    if(next.material.userData.adapter!=='source-boomsugar-channels'){m.dispose();return next;}
    return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};
  }
  if(crystal2&&configuredAdapter==='source-crystal2-channels'){
    m.userData.sourcePass=sourcePass;
    if(sourcePass===0){const second=await sourceMaterial(source,texture,{...overrides,sourcePass:1});if(second.material.userData.adapter!=='source-crystal2-channels'){m.dispose();return second;}return {material:m,passes:[m,second.material],warnings:[...new Set([...warnings,...second.warnings])]};}
  }
  if(ugcCrystal&&m.userData.adapter==='source-ugc-crystal-channels'&&!ugcUp){const next=await sourceMaterial(source,texture,{...overrides,ugcUp:true});if(next.material.userData.adapter!=='source-ugc-crystal-channels'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(soulEffect){
    m.customProgramCacheKey=()=>JSON.stringify([compileKey,grassEffect,soulPass,configuredAdapter]);m.userData.sourceEffect=grassEffect;m.userData.sourcePass=soulPass;
    if(configuredAdapter==='source-outline-soul-channels'&&soulPass===0){const passes=[m];for(let i=1;i<3;i++){const next=await sourceMaterial(source,texture,{...overrides,soulPass:i});if(next.material.userData.adapter!==configuredAdapter){passes.forEach(p=>p.dispose());return next;}passes.push(next.material);}return {material:m,passes,warnings};}
  }
  if(nfxGrass){
    m.customProgramCacheKey=()=>JSON.stringify([compileKey,grassEffect,grassPass,configuredAdapter]);m.userData.sourceEffect=grassEffect;m.userData.sourcePass=grassPass;
    if(configuredAdapter==='source-nfx-grass-channels'&&grassPass===0){const passes=[m];for(let i=1;i<grassPassCount(grassInner);i++){const next=await sourceMaterial(source,texture,{...overrides,grassPass:i});if(next.material.userData.adapter!==configuredAdapter){passes.forEach(p=>p.dispose());return next;}passes.push(next.material);}return {material:m,passes,warnings};}
  }
  if(wingObjEffect&&configuredAdapter==='source-wing-obj-channels'){
    m.userData.sourceEffect='shader/nfx_template/nfx_wing_obj.fx::nfx_wing_obj';m.userData.sourcePass=sourcePass;
    if(sourcePass===0){const next=await sourceMaterial(source,texture,{...overrides,sourcePass:1});if(next.material.userData.adapter!=='source-wing-obj-channels'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  }
  if(nfxWingEffect&&configuredAdapter==='source-nfx-wing-channels')m.userData.sourceEffect='shader/nfx_template/nfx_wing.fx::nfx_wing';
  if(inner){
    m.userData.sourcePass=sourcePass;m.userData.requiresSecondUv=sourcePass===1&&Number(macros.TEXCOORD1_ENABLE)===1;
    if(sourcePass===0){const second=await sourceMaterial(source,texture,{...overrides,sourcePass:1});return {material:m,passes:[m,second.material],warnings:[...new Set([...warnings,...second.warnings])]};}
  }
  if(fried){m.userData.sourcePass=sourcePass;const baseKey=m.customProgramCacheKey();m.customProgramCacheKey=()=>JSON.stringify([baseKey,sourcePass,overrides.sourceTangents===true,overrides.sourceVertexColors===true,configuredAdapter]);}
  if(surface==='shader/surf/s30/fried_chicken_2pass.surf'&&sourcePass===0&&configuredAdapter==='source-fried-chicken-channels'){
    const second=await sourceMaterial(source,texture,{...overrides,sourcePass:1});
    if(second.material.userData.adapter!=='source-fried-chicken-channels'){m.dispose();return {...second,warnings:[...new Set([...warnings,...second.warnings])]};}
    return {material:m,passes:[m,second.material],warnings:[...new Set([...warnings,...second.warnings])]};
  }
  if(ink&&!inkOutline&&configuredAdapter==='source-ink-channels'){
    const second=await sourceMaterial(source,texture,{...overrides,inkOutline:true});
    if(second.material.userData.adapter!=='source-ink-channels'){m.dispose();return {...second,warnings:[...new Set([...warnings,...second.warnings])]};}
    return {material:m,passes:[m,second.material],warnings:[...new Set([...warnings,...second.warnings])]};
  }
  if(lineDog&&!overrides.lineDogOutline&&configuredAdapter==='source-line-dog-channels'){
    const second=await sourceMaterial(source,texture,{...overrides,lineDogOutline:true});
    if(second.material.userData.adapter!=='source-line-dog-channels'){m.dispose();return {...second,warnings:[...new Set([...warnings,...second.warnings])]};}
    return {material:m,passes:[m,second.material],warnings:[...new Set([...warnings,...second.warnings])]};
  }
  if(flow)m.userData.adapter=flow2?'flowmap-second-uv-channels':'flowmap-channels';
  if(hair)m.userData.adapter='source-hair-channels';
  if(pearl)m.userData.adapter='pearl-channels';
  if(wingPearl)m.userData.adapter='wing-pearl-channels';
  if(kqbs)m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,configuredAdapter]);
  if(sparkle)m.userData.adapter='sparkle03-channels';
  if(wingCrystal){
    m.customProgramCacheKey=()=>JSON.stringify([compileKey,overrides.sourceTangents===true,overrides.wingCrystalPass??0,configuredAdapter]);
    if(!overrides.wingCrystalPass&&configuredAdapter==='source-wing-crystal-channels'){
      const second=await sourceMaterial(source,texture,{...overrides,wingCrystalPass:1});
      if(second.material.userData.adapter!==configuredAdapter){m.dispose();return second;}
      return {material:m,passes:[m,second.material],warnings:[...new Set([...warnings,...second.warnings])]};
    }
  }
  if(crystal)m.userData.adapter='crystal02-channels';
  if(anisotropic)m.userData.adapter='anisotropic-channels';
  if(cartoon)m.userData.adapter='cartoon-channels';
  if(sandHat)m.userData.adapter=configuredAdapter||'unsupported';
  if(waterHat)m.userData.adapter=configuredAdapter||'unsupported';
  if(snzq)m.userData.adapter=configuredAdapter||'unsupported';
  if(ninecolor)m.userData.adapter=configuredAdapter||'unsupported';
  if(fur){m.customProgramCacheKey=()=>JSON.stringify([compileKey,furLayer,overrides.furStep||0]);m.userData.adapter='fur-shell-channels';if(!furLayer){const authored=surface==='shader/surf/dongdong_fur.surf'||surface==='shader/surf/dongdong_fur1.surf',count=surface.endsWith('fur1.surf')?3:11;const passes=[m];for(let j=0;j<(authored?count:count-1);j++){const next=await sourceMaterial(source,texture,{...overrides,furLayer:true,furStep:(j+(authored?2:1))*.05});passes.push(next.material)}return {material:m,passes,warnings:[...new Set(warnings)]};}}
  if(shellCrystal){m.userData.adapter='shell-crystal-channels';if(!shellUp){const next=await sourceMaterial(source,texture,{...overrides,shellUp:true});return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}}
  if(plantGrowth)m.userData.adapter='plant-growth-channels';
  if(laser){m.userData.adapter='laser-channels';if(!laserLayer){const next=await sourceMaterial(source,texture,{...overrides,laserLayer:true});return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}}
  if(al)m.userData.adapter='al-channels';
  if(face)m.userData.adapter='face-channels';
  if(fire){m.userData.adapter='source-fire-channels';m.userData.requiresSecondUv=true;}
  if(compoundShell&&!overrides.shellLayer&&m.userData.adapter==='source-compound-shell-channels'){const next=await sourceMaterial(source,texture,{...overrides,shellLayer:true});return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(cloud&&!overrides.cloudFront&&configuredAdapter){const next=await sourceMaterial(source,texture,{...overrides,cloudFront:true});if(next.material.userData.adapter==='unsupported'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(t1erciyuan&&!overrides.t1Outline&&configuredAdapter){const next=await sourceMaterial(source,texture,{...overrides,t1Outline:true});if(next.material.userData.adapter==='unsupported'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(crayon&&!overrides.crayonOutline&&m.userData.adapter==='source-crayon-channels'){const next=await sourceMaterial(source,texture,{...overrides,crayonOutline:true});return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  if(helmet&&!overrides.helmetFront&&configuredAdapter){const next=await sourceMaterial(source,texture,{...overrides,helmetFront:true});if(next.material.userData.adapter==='unsupported'){m.dispose();return next;}return {material:m,passes:[m,next.material],warnings:[...new Set([...warnings,...next.warnings])]};}
  return {material:m,warnings};
}

