import * as THREE from 'three';
import './style.css';

type RuleId = 'redJump' | 'hatWave' | 'centerSpin' | 'bellJump' | 'greetingWave';
type ActionName = 'jump' | 'wave' | 'spin';

interface RuleDefinition { id: RuleId; label: string; action: ActionName; }
interface Subject {
  id: number;
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  marker: THREE.Sprite;
  hat: boolean;
  red: boolean;
  obeys: Record<RuleId, boolean>;
  waypoint: THREE.Vector3;
  speed: number;
  action: ActionName | null;
  actionTime: number;
  cooldowns: Record<RuleId, number>;
  lastCenterInside: boolean;
 }

const RULES: RuleDefinition[] = [
  { id: 'redJump', label: 'RED JUMP', action: 'jump' },
  { id: 'hatWave', label: 'HAT WAVE', action: 'wave' },
  { id: 'centerSpin', label: 'CENTER SPIN', action: 'spin' },
  { id: 'bellJump', label: 'BELL JUMP', action: 'jump' },
  { id: 'greetingWave', label: 'GREETING WAVE', action: 'wave' },
];

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171713);
scene.fog = new THREE.FogExp2(0x171713, 0.018);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 13, 24);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xdde6d3, 0x31291c, 1.35));
const sun = new THREE.DirectionalLight(0xffe2ae, 3.2);
sun.position.set(-16, 24, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -35;
sun.shadow.camera.right = sun.shadow.camera.top = 35;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x5b5a4d, roughness: .95, metalness: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(58, 58), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
world.add(floor);

const grid = new THREE.GridHelper(58, 29, 0x787665, 0x686657);
grid.position.y = .012;
grid.material.transparent = true;
grid.material.opacity = .32;
world.add(grid);

const centerRing = new THREE.Mesh(
  new THREE.RingGeometry(5.6, 5.85, 64),
  new THREE.MeshBasicMaterial({ color: 0xf4b942, transparent: true, opacity: .52, side: THREE.DoubleSide }),
);
centerRing.rotation.x = -Math.PI / 2;
centerRing.position.y = .03;
world.add(centerRing);

function box(size: [number, number, number], color: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .85 }));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh); return mesh;
}

// Sparse landmarks make NPC paths and distances easy to read from the air.
for (const [x, z] of [[-24,-24],[24,-24],[-24,24],[24,24]] as [number,number][]) {
  box([2.5, 5.5, 2.5], 0x34342f, x, 2.75, z);
  const lamp = new THREE.PointLight(0xf4b942, 17, 12, 2); lamp.position.set(x, 5.7, z); world.add(lamp);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), new THREE.MeshBasicMaterial({color:0xf4b942})); bulb.position.copy(lamp.position); world.add(bulb);
}
for (const [x,z,w,d] of [[-18,0,4,10],[18,0,4,10],[0,-18,10,4],[0,18,10,4]] as [number,number,number,number][]) box([w,.38,d],0x45453e,x,.19,z);

const bellRig = new THREE.Group();
const bellPost = new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,6,10), new THREE.MeshStandardMaterial({color:0x232421}));
bellPost.position.y=3; bellRig.add(bellPost);
const bell = new THREE.Mesh(new THREE.CylinderGeometry(.9,.45,1.1,16,1,true),new THREE.MeshStandardMaterial({color:0xc58d24,metalness:.65,roughness:.3,side:THREE.DoubleSide}));
bell.position.y=6.1; bellRig.add(bell); bellRig.position.set(0,0,-25); world.add(bellRig);

const shirtColors = [0xc94f43,0x325b82,0xc8a642,0x567359,0x703e68,0xd3d0bd];
const pantsColors = [0x222a35,0x4a4037,0x26362e,0x47464d];
const skinColors = [0xf0c6a1,0xc98d62,0x8e573d,0x5e382b];
const hairColors = [0x17130f,0x4a2d1a,0xd0aa65,0x6a6a62];
const subjects: Subject[] = [];
const pickables: THREE.Object3D[] = [];
const markerTexture = makeMarkerTexture();

function mat(color: number) { return new THREE.MeshStandardMaterial({ color, roughness: .85 }); }
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, y = 0) {
  const value = new THREE.Mesh(geometry, material); value.position.y = y; value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
}

function makeMarkerTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d')!; ctx.fillStyle='#f4b942'; ctx.beginPath(); ctx.roundRect(2,2,124,60,10); ctx.fill();
  ctx.fillStyle='#171713'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='700 30px Space Grotesk'; ctx.fillText('SUBJECT',64,32);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

function makeSubject(id: number): Subject {
  const root = new THREE.Group(); root.userData.subjectId = id;
  const body = new THREE.Group(); root.add(body);
  const shirt = id < 3 ? 0xc94f43 : shirtColors[id % shirtColors.length];
  const hat = id % 3 === 1 || id === 10;
  const skin = skinColors[id % skinColors.length];
  const torso = mesh(new THREE.BoxGeometry(1.18,1.55,.72),mat(shirt),body,2.55); torso.userData.subjectId=id;
  const head = mesh(new THREE.BoxGeometry(.88,.9,.78),mat(skin),body,3.78); head.userData.subjectId=id;
  const hair = mesh(new THREE.BoxGeometry(.92,.25,.82),mat(hairColors[id%hairColors.length]),body,4.2); hair.userData.subjectId=id;
  const leftArm = new THREE.Group(); leftArm.position.set(-.76,3.08,0); body.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(.76,3.08,0); body.add(rightArm);
  mesh(new THREE.BoxGeometry(.32,1.45,.36),mat(skin),leftArm,-.67);
  mesh(new THREE.BoxGeometry(.32,1.45,.36),mat(skin),rightArm,-.67);
  for (const side of [-1,1]) {
    const leg = new THREE.Group(); leg.position.set(side*.34,1.75,0); body.add(leg);
    mesh(new THREE.BoxGeometry(.48,1.7,.52),mat(pantsColors[id%pantsColors.length]),leg,-.8);
  }
  if (hat) {
    const brim=mesh(new THREE.CylinderGeometry(.65,.65,.12,12),mat(0x272722),body,4.43); brim.userData.subjectId=id;
    const cap=mesh(new THREE.CylinderGeometry(.44,.52,.42,12),mat(id%2?0xd3ac3b:0x454c3f),body,4.67); cap.userData.subjectId=id;
  }
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({map:markerTexture,transparent:true,depthTest:false,opacity:0}));
  marker.scale.set(2.8,1.4,1); marker.position.y=5.5; root.add(marker);
  root.position.set((id%4-1.5)*6.5,0,(Math.floor(id/4)-1)*8);
  root.traverse(child=>{ if((child as THREE.Mesh).isMesh){ child.userData.subjectId=id; pickables.push(child); }});
  world.add(root);
  return { id,root,body,leftArm,rightArm,marker,hat,red:shirt===0xc94f43,obeys:{} as Record<RuleId,boolean>,waypoint:new THREE.Vector3(),speed:1.7+Math.random()*.6,action:null,actionTime:0,cooldowns:{redJump:0,hatWave:0,centerSpin:0,bellJump:0,greetingWave:0},lastCenterInside:false };
}
for(let i=0;i<12;i++) subjects.push(makeSubject(i));

let targetRule = RULES[0];
let oddId = 0;
let attempts = 3;
let playing = false;
let roundTime = 0;
let bellTimer = 8;
let yaw = 0;
let pitch = -.28;
let hovered: Subject | null = null;
const keys = new Set<string>();
const raycaster = new THREE.Raycaster();

function randomWaypoint(out: THREE.Vector3) {
  out.set(THREE.MathUtils.randFloat(-24,24),0,THREE.MathUtils.randFloat(-24,24));
  if(Math.abs(out.x)<6.5 && Math.abs(out.z)<6.5 && Math.random()<.45) out.multiplyScalar(1.8);
}

function configureRound() {
  targetRule = RULES[Math.floor(Math.random()*RULES.length)];
  oddId = Math.floor(Math.random()*subjects.length);
  const balancedCounts = shuffle([5,6,6,7]);
  let noiseIndex=0;
  for(const rule of RULES) {
    if(rule.id===targetRule.id) {
      subjects.forEach(s=>s.obeys[rule.id]=s.id!==oddId);
    } else {
      const desired=balancedCounts[noiseIndex++];
      // Odd obeys exactly two noise rules, preventing it from becoming globally unusual.
      const oddObeys = noiseIndex % 2 === 0;
      const others=shuffle(subjects.filter(s=>s.id!==oddId));
      subjects.forEach(s=>s.obeys[rule.id]=false);
      subjects[oddId].obeys[rule.id]=oddObeys;
      others.slice(0,desired-(oddObeys?1:0)).forEach(s=>s.obeys[rule.id]=true);
    }
  }
  subjects.forEach((s,i)=>{
    s.root.position.set((i%4-1.5)*6.5,0,(Math.floor(i/4)-1)*8);
    randomWaypoint(s.waypoint); s.action=null; s.actionTime=0; s.body.position.y=0; s.body.rotation.set(0,0,0); s.marker.material.opacity=0;
    Object.keys(s.cooldowns).forEach(k=>s.cooldowns[k as RuleId]=0); s.lastCenterInside=false;
  });
  attempts=3; roundTime=0; bellTimer=THREE.MathUtils.randFloat(7,10); updateAttempts();
}

function shuffle<T>(items:T[]) { return [...items].sort(()=>Math.random()-.5); }

function trigger(subject:Subject, ruleId:RuleId) {
  if(subject.cooldowns[ruleId]>0 || subject.action) return;
  subject.cooldowns[ruleId]=ruleId==='greetingWave'?5:ruleId==='centerSpin'?6:3.5;
  if(subject.obeys[ruleId]) { subject.action=RULES.find(r=>r.id===ruleId)!.action; subject.actionTime=0; }
}

function ringBell() {
  bellTimer=THREE.MathUtils.randFloat(10,14);
  subjects.forEach(s=>trigger(s,'bellJump'));
  bell.scale.set(1.3,.8,1.3); playBellSound(); showToast('BELL EVENT',false,900);
}

function playBellSound() {
  const AudioCtx=window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  const ctx=new AudioCtx(); const gain=ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(.15,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+1.5);
  [523.25,659.25,783.99].forEach((freq,i)=>{const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=freq;osc.connect(gain);osc.start(ctx.currentTime+i*.035);osc.stop(ctx.currentTime+1.5);});
}

function updateSubject(s:Subject,dt:number) {
  (Object.keys(s.cooldowns) as RuleId[]).forEach(id=>s.cooldowns[id]=Math.max(0,s.cooldowns[id]-dt));
  const distance=s.root.position.distanceTo(s.waypoint);
  if(distance<1.2) randomWaypoint(s.waypoint);
  const dir=s.waypoint.clone().sub(s.root.position); dir.y=0; dir.normalize();
  const moveFactor=s.action==='spin'?.18:s.action?.42:1;
  s.root.position.addScaledVector(dir,s.speed*dt*moveFactor);
  if(dir.lengthSq()) s.root.rotation.y=THREE.MathUtils.lerp(s.root.rotation.y,Math.atan2(dir.x,dir.z),Math.min(1,dt*4));
  const gait=Math.sin(roundTime*s.speed*5+s.id)*.1*moveFactor;
  s.body.rotation.z=gait; s.leftArm.rotation.x=gait*2; s.rightArm.rotation.x=-gait*2;
  const inCenter=Math.hypot(s.root.position.x,s.root.position.z)<5.6;
  if(inCenter&&!s.lastCenterInside) trigger(s,'centerSpin'); s.lastCenterInside=inCenter;
  if(s.action) animateAction(s,dt);
}

function animateAction(s:Subject,dt:number) {
  s.actionTime+=dt; const t=s.actionTime;
  if(s.action==='jump') s.body.position.y=Math.max(0,Math.sin(Math.min(t/1.2,1)*Math.PI)*2.25);
  if(s.action==='wave') { s.rightArm.rotation.z=-2.55; s.rightArm.rotation.x=Math.sin(t*13)*.7; }
  if(s.action==='spin') s.body.rotation.y=t*Math.PI*2.1;
  if(t>1.25){s.action=null;s.actionTime=0;s.body.position.y=0;s.body.rotation.y=0;s.rightArm.rotation.z=0;}
}

function processProximityRules() {
  for(let i=0;i<subjects.length;i++) for(let j=i+1;j<subjects.length;j++) {
    const a=subjects[i],b=subjects[j]; const d=a.root.position.distanceToSquared(b.root.position);
    if(d<7.8) {
      if(b.red) trigger(a,'redJump'); if(a.red) trigger(b,'redJump');
      if(b.hat) trigger(a,'hatWave'); if(a.hat) trigger(b,'hatWave');
    }
    if(d<4) { trigger(a,'greetingWave'); trigger(b,'greetingWave'); }
  }
}

function updateCamera(dt:number) {
  if(document.pointerLockElement!==canvas) return;
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); forward.y=0; forward.normalize();
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); right.y=0; right.normalize();
  const move=new THREE.Vector3();
  if(keys.has('KeyW'))move.add(forward);if(keys.has('KeyS'))move.sub(forward);if(keys.has('KeyD'))move.add(right);if(keys.has('KeyA'))move.sub(right);
  if(keys.has('KeyE'))move.y++;if(keys.has('KeyQ'))move.y--;
  if(move.lengthSq()) move.normalize().multiplyScalar((keys.has('ShiftLeft')?18:8.5)*dt);
  camera.position.add(move); camera.position.x=THREE.MathUtils.clamp(camera.position.x,-31,31); camera.position.z=THREE.MathUtils.clamp(camera.position.z,-31,31); camera.position.y=THREE.MathUtils.clamp(camera.position.y,3,28);
}

function updateTargeting() {
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hit=raycaster.intersectObjects(pickables,false)[0];
  hovered=hit && hit.distance<45 ? subjects[hit.object.userData.subjectId as number] : null;
  subjects.forEach(s=>s.marker.material.opacity=hovered===s?1:0);
  document.querySelector('#crosshair')!.classList.toggle('locked',!!hovered);
  const label=document.querySelector('#target-label')!; label.textContent=hovered?`SUBJECT ${String(hovered.id+1).padStart(2,'0')}`:''; label.classList.toggle('show',!!hovered);
}

function accuse() {
  if(!playing||!hovered)return;
  if(hovered.id===oddId){endRound(true);return;}
  attempts--; updateAttempts(); showToast(`SUBJECT ${String(hovered.id+1).padStart(2,'0')} CLEARED · ${attempts} CHANCE${attempts===1?'':'S'} LEFT`,true,1600);
  hovered.marker.material.color.set(0xe65b47);
  if(attempts<=0) endRound(false);
}

function updateAttempts(){const el=document.querySelector('#attempts')!;el.innerHTML='';for(let i=0;i<3;i++){const bar=document.createElement('i');bar.className=`attempt${i>=attempts?' lost':''}`;el.appendChild(bar)}el.setAttribute('aria-label',`${attempts} attempts remaining`)}
let toastTimeout=0;
function showToast(message:string,bad=false,duration=1200){const el=document.querySelector('#toast')!;el.textContent=message;el.className=`toast show${bad?' bad':''}`;clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>el.className='toast',duration)}

function startRound(){configureRound();playing=true;camera.position.set(0,13,24);yaw=0;pitch=-.28;camera.rotation.set(pitch,yaw,0);document.querySelector('#start-screen')!.classList.remove('open');document.querySelector('#end-screen')!.classList.remove('open');canvas.requestPointerLock()}
function endRound(success:boolean){playing=false;document.exitPointerLock();subjects[oddId].marker.material.color.set(0xf4b942);subjects[oddId].marker.material.opacity=1;const screen=document.querySelector('#end-screen')!;screen.className=`screen result-screen open ${success?'success':'fail'}`;document.querySelector('#result-kicker')!.textContent=success?'ANOMALY CONFIRMED':'OBSERVATION TERMINATED';document.querySelector('#result-title')!.textContent=success?'YOU FOUND IT.':'CASE FAILED.';document.querySelector('#reveal-rule')!.textContent=targetRule.label;document.querySelector('#reveal-npc')!.textContent=`SUBJECT ${String(oddId+1).padStart(2,'0')}`}

document.querySelector('#play-button')!.addEventListener('click',startRound);
document.querySelector('#replay-button')!.addEventListener('click',startRound);
canvas.addEventListener('click',()=>{if(!playing)return;if(document.pointerLockElement!==canvas)canvas.requestPointerLock();else accuse()});
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=THREE.MathUtils.clamp(pitch,-1.35,1.35);camera.rotation.set(pitch,yaw,0)});
addEventListener('keydown',e=>keys.add(e.code));addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

const clock=new THREE.Clock(); let proximityTimer=0;
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);if(playing){roundTime+=dt;bellTimer-=dt;bell.scale.lerp(new THREE.Vector3(1,1,1),dt*5);if(bellTimer<=0)ringBell();subjects.forEach(s=>updateSubject(s,dt));proximityTimer-=dt;if(proximityTimer<=0){processProximityRules();proximityTimer=.18}updateCamera(dt);updateTargeting();document.querySelector('#timer')!.textContent=`${String(Math.floor(roundTime/60)).padStart(2,'0')}:${String(Math.floor(roundTime%60)).padStart(2,'0')}`;}renderer.render(scene,camera)}
frame();
