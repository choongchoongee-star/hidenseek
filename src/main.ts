import * as THREE from 'three';
import './style.css';

type RuleId = 'redJump' | 'blueSpin' | 'yellowWave' | 'hatBow' | 'centerClap' | 'edgeJump' | 'bellZoneCheer' | 'lampBow' | 'greetingWave' | 'turnSpin';
type RuleNoteId = RuleId | 'bell';
type ActionName = 'jump' | 'wave' | 'spin' | 'bow' | 'clap' | 'cheer';
type SubjectMark = '?' | '✓' | null;
type RuleNoteMark = '?' | '✓' | 'strike' | null;
type ControlsOrigin = 'start' | 'pause';
type Language = 'ko' | 'en';
type GameSpeed = 1 | 1.5 | 2;

interface LocalizedCopy { ko: string; en: string; }
interface RuleDefinition { id: RuleId; action: ActionName; label: LocalizedCopy; note: LocalizedCopy; stimulus?: 'red'|'blue'|'yellow'|'hat'; }
interface ActivePointer { x: number; y: number; startX: number; startY: number; }
interface Subject {
  id: number;
  name: string;
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  marker: THREE.Sprite;
  markSprite: THREE.Sprite;
  inspectedSprite: THREE.Sprite;
  mark: SubjectMark;
  inspected: boolean;
  hat: boolean;
  red: boolean;
  blue: boolean;
  yellow: boolean;
  bellObeys: boolean;
  obeys: Record<RuleId, boolean>;
  waypoint: THREE.Vector3;
  speed: number;
  action: ActionName | null;
  actionTime: number;
  cooldowns: Record<RuleId, number>;
  lastCenterInside: boolean;
  lastEdgeInside: boolean;
  lastBellZoneInside: boolean;
  lastLampZoneInside: boolean;
 }

const RULES: RuleDefinition[] = [
  { id:'redJump', action:'jump', stimulus:'red', label:{ko:'빨강 점프',en:'RED JUMP'}, note:{ko:'빨간 옷 근처 → 점프',en:'Near a red shirt → JUMP'} },
  { id:'blueSpin', action:'spin', stimulus:'blue', label:{ko:'파랑 회전',en:'BLUE SPIN'}, note:{ko:'파란 옷 근처 → 회전',en:'Near a blue shirt → SPIN'} },
  { id:'yellowWave', action:'wave', stimulus:'yellow', label:{ko:'노랑 인사',en:'YELLOW WAVE'}, note:{ko:'노란 옷 근처 → 손 흔들기',en:'Near a yellow shirt → WAVE'} },
  { id:'hatBow', action:'bow', stimulus:'hat', label:{ko:'모자에게 인사',en:'HAT BOW'}, note:{ko:'모자 쓴 사람 근처 → 허리 숙이기',en:'Near a hat → BOW'} },
  { id:'centerClap', action:'clap', label:{ko:'중앙 박수',en:'CENTER CLAP'}, note:{ko:'중앙 구역 진입 → 박수',en:'Enter the center → CLAP'} },
  { id:'edgeJump', action:'jump', label:{ko:'가장자리 점프',en:'EDGE JUMP'}, note:{ko:'맵 가장자리 진입 → 점프',en:'Enter the map edge → JUMP'} },
  { id:'bellZoneCheer', action:'cheer', label:{ko:'종탑 만세',en:'BELL TOWER CHEER'}, note:{ko:'종탑 근처 진입 → 만세',en:'Approach the bell tower → CHEER'} },
  { id:'lampBow', action:'bow', label:{ko:'조명에게 인사',en:'LAMP BOW'}, note:{ko:'모서리 조명 근처 → 허리 숙이기',en:'Approach a corner lamp → BOW'} },
  { id:'greetingWave', action:'wave', label:{ko:'마주보기 인사',en:'GREETING WAVE'}, note:{ko:'서로 마주봄 → 둘 다 손 흔들기',en:'Face each other → both WAVE'} },
  { id:'turnSpin', action:'spin', label:{ko:'방향 전환 회전',en:'TURN SPIN'}, note:{ko:'이동 목표 도착 → 회전',en:'Reach a waypoint → SPIN'} },
];
const PARTICIPANT_OPTIONS = [6,9,12,24] as const;
const SUBJECT_NAMES = ['영수','영호','영식','영철','광수','상철','민수','준호','태수','성훈','진우','동진','영숙','정숙','순자','영자','옥순','현숙','지영','수진','민지','혜진','은영','보람'];
const ARENA_SIZES:Record<typeof PARTICIPANT_OPTIONS[number],number>={6:30,9:38,12:44,24:58};
let RULE_NOTE_ORDER:RuleNoteId[]=[...RULES.slice(0,4).map(rule=>rule.id),'bell'];
const ruleNoteMarks={} as Record<RuleNoteId,RuleNoteMark>;
[...RULES.map(rule=>rule.id),'bell' as const].forEach(ruleId=>ruleNoteMarks[ruleId]=null);
const ACTION_LABELS:Record<ActionName,LocalizedCopy>={jump:{ko:'점프',en:'JUMP'},wave:{ko:'손 흔들기',en:'WAVE'},spin:{ko:'회전',en:'SPIN'},bow:{ko:'허리 숙이기',en:'BOW'},clap:{ko:'박수',en:'CLAP'},cheer:{ko:'만세',en:'CHEER'}};

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const touchMode = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has('touch');
document.body.classList.toggle('touch-mode', touchMode);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, touchMode ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171713);
scene.fog = new THREE.FogExp2(0x171713, 0.018);
const camera = new THREE.PerspectiveCamera(touchMode&&innerHeight>innerWidth?72:62, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 13, 24);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xdde6d3, 0x31291c, 1.35));
const sun = new THREE.DirectionalLight(0xffe2ae, 3.2);
sun.position.set(-16, 24, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(touchMode ? 1024 : 2048, touchMode ? 1024 : 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -35;
sun.shadow.camera.right = sun.shadow.camera.top = 35;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);
const environment = new THREE.Group();
world.add(environment);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x5b5a4d, roughness: .95, metalness: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(58, 58), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
environment.add(floor);

const grid = new THREE.GridHelper(58, 29, 0x787665, 0x686657);
grid.position.y = .012;
grid.material.transparent = true;
grid.material.opacity = .32;
environment.add(grid);

const centerRing = new THREE.Mesh(
  new THREE.RingGeometry(5.6, 5.85, 64),
  new THREE.MeshBasicMaterial({ color: 0xf4b942, transparent: true, opacity: .52, side: THREE.DoubleSide }),
);
centerRing.rotation.x = -Math.PI / 2;
centerRing.position.y = .03;
environment.add(centerRing);

function box(size: [number, number, number], color: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .85 }));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; environment.add(mesh); return mesh;
}

// Sparse landmarks make NPC paths and distances easy to read from the air.
for (const [x, z] of [[-24,-24],[24,-24],[-24,24],[24,24]] as [number,number][]) {
  box([2.5, 5.5, 2.5], 0x34342f, x, 2.75, z);
  const lamp = new THREE.PointLight(0xf4b942, 17, 12, 2); lamp.position.set(x, 5.7, z); environment.add(lamp);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), new THREE.MeshBasicMaterial({color:0xf4b942})); bulb.position.copy(lamp.position); environment.add(bulb);
}
for (const [x,z,w,d] of [[-18,0,4,10],[18,0,4,10],[0,-18,10,4],[0,18,10,4]] as [number,number,number,number][]) box([w,.38,d],0x45453e,x,.19,z);

const bellRig = new THREE.Group();
const bellPost = new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,6,10), new THREE.MeshStandardMaterial({color:0x232421}));
bellPost.position.y=3; bellRig.add(bellPost);
const bell = new THREE.Mesh(new THREE.CylinderGeometry(.9,.45,1.1,16,1,true),new THREE.MeshStandardMaterial({color:0xc58d24,metalness:.65,roughness:.3,side:THREE.DoubleSide}));
bell.position.y=6.1; bellRig.add(bell); bellRig.position.set(0,0,-25); environment.add(bellRig);

const shirtColors = [0xc94f43,0x325b82,0xc8a642,0x567359,0x703e68,0xd3d0bd];
const pantsColors = [0x222a35,0x4a4037,0x26362e,0x47464d];
const skinColors = [0xf0c6a1,0xc98d62,0x8e573d,0x5e382b];
const hairColors = [0x17130f,0x4a2d1a,0xd0aa65,0x6a6a62];
const subjects: Subject[] = [];
const pickables: THREE.Object3D[] = [];
const questionTexture = makeSymbolTexture('?', '#74b9e8');
const clearTexture = makeSymbolTexture('✓', '#52c6a5');
const inspectedTextures={ko:makeInspectedTexture('확인됨'),en:makeInspectedTexture('INSPECTED')};

function mat(color: number) { return new THREE.MeshStandardMaterial({ color, roughness: .85 }); }
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, y = 0) {
  const value = new THREE.Mesh(geometry, material); value.position.y = y; value.castShadow = true; value.receiveShadow = true; parent.add(value); return value;
}

function makeMarkerTexture(label:string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const ctx = c.getContext('2d')!; ctx.fillStyle='#f4b942'; ctx.beginPath(); ctx.roundRect(4,4,248,88,14); ctx.fill();
  ctx.fillStyle='#171713'; ctx.textAlign='center'; ctx.textBaseline='middle';
  let fontSize=46;
  do { ctx.font=`700 ${fontSize--}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; } while(ctx.measureText(label).width>216&&fontSize>30);
  ctx.fillText(label,128,50);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

function makeInspectedTexture(label:string) {
  const c=document.createElement('canvas');c.width=320;c.height=92;
  const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(17,17,15,.94)';ctx.beginPath();ctx.roundRect(4,4,312,84,16);ctx.fill();
  ctx.strokeStyle='#e65b47';ctx.lineWidth=7;ctx.beginPath();ctx.arc(48,42,18,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(61,55);ctx.lineTo(79,73);ctx.stroke();
  ctx.fillStyle='#ff8c79';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 32px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';ctx.fillText(label,194,48);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function makeSymbolTexture(symbol:string,color:string) {
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const ctx=c.getContext('2d')!;ctx.fillStyle='rgba(17,17,15,.92)';ctx.beginPath();ctx.arc(64,64,58,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=7;ctx.strokeStyle=color;ctx.stroke();
  if(symbol==='✓') {
    ctx.lineWidth=12;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(34,66);ctx.lineTo(54,84);ctx.lineTo(94,42);ctx.stroke();
  } else {
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 82px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';ctx.fillText(symbol,64,66);
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function makeSubject(id: number): Subject {
  const name=SUBJECT_NAMES[id];
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
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({map:makeMarkerTexture(name),transparent:true,depthTest:false,opacity:0}));
  marker.scale.set(3.2,1.2,1); marker.position.y=6.45; root.add(marker);
  const markSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:questionTexture,transparent:true,depthTest:false,opacity:0}));
  markSprite.scale.set(1.45,1.45,1);markSprite.position.y=5.25;root.add(markSprite);
  const inspectedSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:inspectedTextures.ko,transparent:true,depthTest:false,opacity:0}));
  inspectedSprite.scale.set(3.5,1,1);inspectedSprite.position.y=7.55;root.add(inspectedSprite);
  root.position.set((id%4-1.5)*6.5,0,(Math.floor(id/4)-1)*8);
  root.traverse(child=>{ if((child as THREE.Mesh).isMesh){ child.userData.subjectId=id; pickables.push(child); }});
  world.add(root);
  const cooldowns=Object.fromEntries(RULES.map(rule=>[rule.id,0])) as Record<RuleId,number>;
  return { id,name,root,body,leftArm,rightArm,marker,markSprite,inspectedSprite,mark:null,inspected:false,hat,red:shirt===0xc94f43,blue:shirt===0x325b82,yellow:shirt===0xc8a642,bellObeys:false,obeys:{} as Record<RuleId,boolean>,waypoint:new THREE.Vector3(),speed:1.7+Math.random()*.6,action:null,actionTime:0,cooldowns,lastCenterInside:false,lastEdgeInside:false,lastBellZoneInside:false,lastLampZoneInside:false };
}
for(let i=0;i<24;i++) subjects.push(makeSubject(i));

let activeRules=RULES.slice(0,4);
let activeRuleIds=new Set<RuleId>(activeRules.map(rule=>rule.id));
let targetRule = activeRules[0];
let bellSourceRule=activeRules[0];
let bellAction:ActionName=bellSourceRule.action;
let participantCount:typeof PARTICIPANT_OPTIONS[number]=6;
let activeSubjects:Subject[]=[];
let activeSubjectIds=new Set<number>();
let oddId = 0;
let attempts = 3;
let playing = false;
let paused = false;
let soundEnabled = true;
let pointerLockAcquired = false;
let pointerLockRequestId = 0;
let pointerLockReleaseTimers: number[] = [];
let altCursorMode = false;
let language:Language=readLanguage();
let roundResult:'success'|'fail'|null=null;
let arenaSize=ARENA_SIZES[participantCount];
let arenaHalf=arenaSize/2;
let arenaScale=arenaSize/58;
let centerTriggerRadius=5.6*arenaScale;
let suppressAccusationUntil = 0;
let controlsOrigin: ControlsOrigin = 'start';
let controlsAcknowledged = readControlsAcknowledged();
let roundTime = 0;
let bellTimer = 8;
let gameSpeed:GameSpeed = 1;
let yaw = 0;
let pitch = -.28;
let hovered: Subject | null = null;
let selectedSubject: Subject | null = null;
let followedSubject: Subject | null = null;
const keys = new Set<string>();
const raycaster = new THREE.Raycaster();
const activePointers = new Map<number,ActivePointer>();
const mobileTarget = new THREE.Vector3(0,1.8,0);
const mobileSpherical = new THREE.Spherical(35,1.06,0);
const desktopFollowSpherical = new THREE.Spherical(18,1.05,0);
const desktopFreePosition = new THREE.Vector3();
let desktopFreeYaw = 0;
let desktopFreePitch = -.28;
let desktopCameraHeight = 8;
let previousGestureCenter = new THREE.Vector2();
let previousGestureDistance = 0;
let mobileDragged = false;
let lastTouchEndTime = 0;
let lastTouchEndX = Number.NEGATIVE_INFINITY;
let lastTouchEndY = Number.NEGATIVE_INFINITY;
let lastTouchEndTarget:EventTarget|null = null;
let mobileTutorialComplete = false;
let mobileTutorialStep = 0;
const mobileHint = document.querySelector<HTMLElement>('#mobile-hint')!;
const mobileSelection = document.querySelector<HTMLElement>('#mobile-selection')!;
const mobileSubjectLabel = document.querySelector<HTMLElement>('#mobile-subject')!;
const questionButton = document.querySelector<HTMLButtonElement>('#mark-question')!;
const clearButton = document.querySelector<HTMLButtonElement>('#mark-clear')!;
const followButton = document.querySelector<HTMLButtonElement>('#mobile-follow')!;
const controlsScreen = document.querySelector<HTMLElement>('#controls-screen')!;
const controlsCloseButton = document.querySelector<HTMLButtonElement>('#controls-close-button')!;
const participantButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-participant-count]')];
const subjectCountSummary=document.querySelector<HTMLElement>('#subject-count-summary')!;
const ruleNotes=document.querySelector<HTMLElement>('#rule-notes')!;
const ruleNotesToggle=document.querySelector<HTMLButtonElement>('#rule-notes-toggle')!;
const ruleNoteRows=[...document.querySelectorAll<HTMLButtonElement>('[data-rule-note]')];
const languageToggle=document.querySelector<HTMLButtonElement>('#language-toggle')!;
const speedControls=document.querySelector<HTMLElement>('#speed-controls')!;
const speedButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-game-speed]')];

function copy(ko:string,en:string){return language==='ko'?ko:en;}

function readLanguage():Language {
  try { return localStorage.getItem('the-odd-one-language')==='en'?'en':'ko'; }
  catch { return 'ko'; }
}

function applyLanguage() {
  document.documentElement.lang=language;
  document.querySelectorAll<HTMLElement>('[data-ko][data-en]').forEach(element=>{element.textContent=element.dataset[language]??'';});
  languageToggle.textContent=language==='ko'?'KR':'EN';
  languageToggle.setAttribute('aria-label',language==='ko'?'Switch to English':'한국어로 전환');
  speedControls.setAttribute('aria-label',copy('게임 속도','Game speed'));
  subjects.forEach(subject=>{subject.inspectedSprite.material.map=inspectedTextures[language];subject.inspectedSprite.material.needsUpdate=true;});
  setParticipantCount(participantCount);updateSoundButtons();updateAttempts();updateFollowButton();
  renderRuleNotes();
  RULE_NOTE_ORDER.forEach(updateRuleNote);
  if(controlsScreen.classList.contains('open'))updateControlsCloseButton();
  if(roundResult)updateResultCopy();
}

function setGameSpeed(speed:GameSpeed) {
  gameSpeed=speed;
  speedButtons.forEach(button=>{
    const selected=Number(button.dataset.gameSpeed)===speed;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}

function toggleLanguage(){
  language=language==='ko'?'en':'ko';
  try { localStorage.setItem('the-odd-one-language',language); } catch { /* Keep the current session language. */ }
  applyLanguage();
}

function readControlsAcknowledged() {
  try { return localStorage.getItem('the-odd-one-controls-v3')==='seen'; }
  catch { return false; }
}

function rememberControlsAcknowledged() {
  controlsAcknowledged=true;
  try { localStorage.setItem('the-odd-one-controls-v3','seen'); }
  catch { /* The guide still works when storage is unavailable. */ }
}

function openControls(origin:ControlsOrigin) {
  controlsOrigin=origin;
  updateControlsCloseButton();
  controlsScreen.classList.add('open');
  controlsScreen.setAttribute('aria-hidden','false');
  controlsCloseButton.focus();
}

function updateControlsCloseButton() {
  controlsCloseButton.innerHTML=controlsOrigin==='start'?`${copy('관찰 시작','START OBSERVATION')} <b>→</b>`:`${copy('일시정지로 돌아가기','BACK TO PAUSE')} <b>←</b>`;
}

function closeControls() {
  controlsScreen.classList.remove('open');
  controlsScreen.setAttribute('aria-hidden','true');
  if(controlsOrigin==='start'){rememberControlsAcknowledged();startRound();}
}

function requestStartRound() {
  if(controlsAcknowledged)startRound();
  else openControls('start');
}

function subjectFocus(subject:Subject) {
  return subject.root.position.clone().add(new THREE.Vector3(0,2.3,0));
}

function initializeMobileCamera() {
  setFollowSubject(null,false);
  mobileTarget.set(0,1.8,0);
  mobileSpherical.set(THREE.MathUtils.clamp(arenaSize*(innerHeight>innerWidth?.67:.6),18,42),1.06,0);
  applyMobileCamera();
}

function applyMobileCamera() {
  const target=followedSubject?subjectFocus(followedSubject):mobileTarget;
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(mobileSpherical));
  camera.lookAt(target);
}

function setMobileHint(message:string) {
  if(!touchMode||mobileTutorialComplete)return;
  mobileHint.textContent=message;
  mobileHint.classList.add('show');
}

function advanceMobileTutorial(step:'orbit'|'multi'|'select') {
  if(mobileTutorialComplete)return;
  if(step==='orbit'&&mobileTutorialStep===0) { mobileTutorialStep=1; setMobileHint(copy('두 손가락 · 이동과 줌','TWO FINGERS · MOVE & ZOOM')); }
  if(step==='multi'&&mobileTutorialStep<=1) { mobileTutorialStep=2; setMobileHint(copy('참가자를 눌러 선택','TAP AN NPC · SELECT')); }
  if(step==='select') { mobileTutorialStep=3; mobileTutorialComplete=true; mobileHint.classList.remove('show'); }
}

function selectSubject(subject:Subject|null) {
  selectedSubject=subject;
  hovered=subject;
  document.body.classList.toggle('selection-active',!!subject);
  mobileSelection.classList.toggle('open',!!subject);
  if(subject) {
    mobileSubjectLabel.textContent=subject.name;
    advanceMobileTutorial('select');
  }
  updateMarkButtons();
  updateFollowButton();
}

function updateMarkButtons() {
  questionButton.classList.toggle('active',selectedSubject?.mark==='?');
  clearButton.classList.toggle('active',selectedSubject?.mark==='✓');
  questionButton.setAttribute('aria-pressed',String(selectedSubject?.mark==='?'));
  clearButton.setAttribute('aria-pressed',String(selectedSubject?.mark==='✓'));
}

function updateFollowButton() {
  const active=!!selectedSubject&&followedSubject===selectedSubject;
  followButton.classList.toggle('active',active);
  followButton.setAttribute('aria-pressed',String(active));
  followButton.querySelector('small')!.textContent=active?copy('해제','RELEASE'):copy('따라가기','FOLLOW');
}

function applyDesktopFollowCamera() {
  if(!followedSubject)return;
  const target=subjectFocus(followedSubject);
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(desktopFollowSpherical));
  camera.lookAt(target);
}

function setFollowSubject(subject:Subject|null,notify=true) {
  if(subject===followedSubject)return;
  const wasFollowing=followedSubject!==null;
  followedSubject=subject;
  if(subject) {
    const target=subjectFocus(subject);
    if(touchMode)applyMobileCamera();
    else {
      if(!wasFollowing) {
        desktopFreePosition.copy(camera.position);
        desktopFreeYaw=yaw;
        desktopFreePitch=pitch;
      }
      desktopFollowSpherical.setFromVector3(camera.position.clone().sub(target));
      desktopFollowSpherical.radius=THREE.MathUtils.clamp(desktopFollowSpherical.radius,6,45);
      desktopFollowSpherical.phi=THREE.MathUtils.clamp(desktopFollowSpherical.phi,.35,1.4);
      applyDesktopFollowCamera();
    }
    if(notify)showToast(copy(`${subject.name} 따라가는 중`,`FOLLOWING ${subject.name}`),false,1100);
  } else {
    if(touchMode)applyMobileCamera();
    else if(wasFollowing) {
      camera.position.copy(desktopFreePosition);
      yaw=desktopFreeYaw;pitch=desktopFreePitch;
      camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
    }
    if(notify)showToast(copy('따라가기 해제','FOLLOW RELEASED'),false,900);
  }
  updateFollowButton();
}

function toggleFollow(subject:Subject|null) {
  if(!subject&&followedSubject)setFollowSubject(null);
  else if(subject)setFollowSubject(followedSubject===subject?null:subject);
}

function adjustDesktopZoom(direction:number) {
  if(touchMode||!playing||paused)return;
  camera.fov=THREE.MathUtils.clamp(camera.fov+direction*4,32,75);
  camera.updateProjectionMatrix();
}

function setSubjectMark(subject:Subject,mark:SubjectMark) {
  subject.mark=mark;
  if(mark)subject.markSprite.material.map=mark==='?'?questionTexture:clearTexture;
  subject.markSprite.material.opacity=mark?1:0;
  subject.markSprite.material.needsUpdate=true;
  updateMarkButtons();
}

function cycleSubjectMark(subject:Subject) {
  setSubjectMark(subject,subject.mark===null?'?':subject.mark==='?'?'✓':null);
}

function setParticipantCount(count:typeof PARTICIPANT_OPTIONS[number]) {
  participantCount=count;
  subjectCountSummary.textContent=copy(`참가자 ${count}명`,`${count} NPCS`);
  participantButtons.forEach(button=>{
    const active=Number(button.dataset.participantCount)===count;
    button.classList.toggle('active',active);button.setAttribute('aria-checked',String(active));
  });
}

function setRuleNotesOpen(value:boolean) {
  if(!touchMode&&playing)value=true;
  ruleNotes.classList.toggle('open',value);ruleNotes.setAttribute('aria-hidden',String(!value));
  ruleNotesToggle.classList.toggle('show',!value);ruleNotesToggle.setAttribute('aria-expanded',String(value));
}

function renderRuleNotes() {
  RULE_NOTE_ORDER=[...activeRules.map(rule=>rule.id),'bell'];
  ruleNoteRows.forEach((row,index)=>{
    const ruleId=RULE_NOTE_ORDER[index];row.dataset.ruleNote=ruleId;
    const indexLabel=row.querySelector<HTMLElement>('.note-index')!;indexLabel.textContent=ruleId==='bell'?'🔔':String(index+1);
    row.setAttribute('aria-disabled',String(ruleId==='bell'));row.tabIndex=ruleId==='bell'?-1:0;
    const title=row.querySelector<HTMLElement>('.note-copy b')!;
    const detail=row.querySelector<HTMLElement>('.note-copy small')!;
    if(ruleId==='bell') {
      const label={ko:`종 ${ACTION_LABELS[bellAction].ko}`,en:`BELL ${ACTION_LABELS[bellAction].en}`};
      const note={ko:`일부 참가자 강제 ${ACTION_LABELS[bellAction].ko} · 정답 아님`,en:`Forces some NPCs to ${ACTION_LABELS[bellAction].en} · NOT A TARGET`};
      title.dataset.ko=label.ko;title.dataset.en=label.en;detail.dataset.ko=note.ko;detail.dataset.en=note.en;
    } else {
      const rule=RULES.find(candidate=>candidate.id===ruleId)!;
      title.dataset.ko=rule.label.ko;title.dataset.en=rule.label.en;detail.dataset.ko=rule.note.ko;detail.dataset.en=rule.note.en;
    }
    title.textContent=title.dataset[language]??'';detail.textContent=detail.dataset[language]??'';
  });
}

function updateRuleNote(ruleId:RuleNoteId) {
  const row=ruleNoteRows.find(button=>button.dataset.ruleNote===ruleId);if(!row)return;
  if(ruleId==='bell') {
    row.classList.remove('mark-question','mark-check','mark-strike');
    row.setAttribute('aria-label',language==='ko'?'종 교란 이벤트. 체크할 수 없는 참고 정보입니다.':'Bell distraction event. Informational only.');return;
  }
  const mark=ruleNoteMarks[ruleId];row.classList.toggle('mark-question',mark==='?');row.classList.toggle('mark-check',mark==='✓');row.classList.toggle('mark-strike',mark==='strike');
  const label=row.querySelector('.note-copy b')?.textContent??ruleId;
  const state=language==='ko'?(mark==='?'?'의심':mark==='✓'?'확인':mark==='strike'?'제외':'표시 없음'):(mark==='?'?'questioned':mark==='✓'?'checked':mark==='strike'?'ruled out':'unmarked');
  row.setAttribute('aria-label',language==='ko'?`${label}: ${state}. 눌러서 표시 변경.`:`${label}: ${state}. Cycle checklist mark.`);
}

function cycleRuleNote(ruleId:RuleNoteId) {
  if(ruleId==='bell')return;
  const current=ruleNoteMarks[ruleId];ruleNoteMarks[ruleId]=current===null?'?':current==='?'?'✓':current==='✓'?'strike':null;updateRuleNote(ruleId);
}

function resetRuleNotes() {
  RULE_NOTE_ORDER.forEach(ruleId=>{ruleNoteMarks[ruleId]=null;updateRuleNote(ruleId);});setRuleNotesOpen(!touchMode);
}

function randomWaypoint(out: THREE.Vector3) {
  const limit=Math.max(8,arenaHalf-5);
  out.set(THREE.MathUtils.randFloat(-limit,limit),0,THREE.MathUtils.randFloat(-limit,limit));
  if(Math.abs(out.x)<centerTriggerRadius*1.15 && Math.abs(out.z)<centerTriggerRadius*1.15 && Math.random()<.45) out.multiplyScalar(1.5);
}

function configureArena() {
  arenaSize=ARENA_SIZES[participantCount];arenaHalf=arenaSize/2;arenaScale=arenaSize/58;centerTriggerRadius=5.6*arenaScale;
  environment.scale.set(arenaScale,1,arenaScale);
}

function stimulusPoolFor(rule:RuleDefinition) {
  if(rule.stimulus==='red')return subjects.filter(subject=>subject.red);
  if(rule.stimulus==='blue')return subjects.filter(subject=>subject.blue);
  if(rule.stimulus==='yellow')return subjects.filter(subject=>subject.yellow);
  if(rule.stimulus==='hat')return subjects.filter(subject=>subject.hat);
  return [];
}

function chooseParticipants(count:number,rules:RuleDefinition[],target:RuleDefinition) {
  const required:Subject[]=[];
  for(const rule of [target,...shuffle(rules.filter(candidate=>candidate!==target))]) {
    const desired=rule===target?2:1;
    const stimulusPool=stimulusPoolFor(rule);
    for(const subject of shuffle(stimulusPool)) {
      if(required.length>=count||required.filter(candidate=>stimulusPool.includes(candidate)).length>=desired)break;
      if(!required.includes(subject))required.push(subject);
    }
  }
  const remaining=shuffle(subjects.filter(subject=>!required.includes(subject))).slice(0,count-required.length);
  return shuffle([...required,...remaining]);
}

function chooseActiveRules() {
  const rulesByAction=new Map<ActionName,RuleDefinition[]>();
  for(const rule of RULES)rulesByAction.set(rule.action,[...(rulesByAction.get(rule.action)??[]),rule]);
  return shuffle([...rulesByAction.values()]).slice(0,4).map(group=>shuffle(group)[0]);
}

function halfCount(count:number) {
  return count%2===0?count/2:(Math.random()<.5?Math.floor(count/2):Math.ceil(count/2));
}

function assignBalancedNoise(rule:RuleDefinition|null) {
  const selected=new Set(shuffle(activeSubjects).slice(0,halfCount(participantCount)).map(subject=>subject.id));
  activeSubjects.forEach(subject=>{
    if(rule)subject.obeys[rule.id]=selected.has(subject.id);
    else subject.bellObeys=selected.has(subject.id);
  });
}

function configureRound() {
  configureArena();
  activeRules=chooseActiveRules();activeRuleIds=new Set(activeRules.map(rule=>rule.id));
  targetRule=activeRules[Math.floor(Math.random()*activeRules.length)];
  bellSourceRule=activeRules[Math.floor(Math.random()*activeRules.length)];bellAction=bellSourceRule.action;
  activeSubjects=chooseParticipants(participantCount,activeRules,targetRule);activeSubjectIds=new Set(activeSubjects.map(subject=>subject.id));
  oddId=activeSubjects[Math.floor(Math.random()*activeSubjects.length)].id;
  subjects.forEach(subject=>{subject.root.visible=activeSubjectIds.has(subject.id);subject.bellObeys=false;for(const rule of RULES)subject.obeys[rule.id]=false;});
  activeSubjects.forEach(subject=>subject.obeys[targetRule.id]=subject.id!==oddId);
  activeRules.filter(rule=>rule.id!==targetRule.id).forEach(rule=>assignBalancedNoise(rule));
  assignBalancedNoise(null);
  const columns=participantCount<=9?3:participantCount<=12?4:6;const rows=Math.ceil(participantCount/columns);
  subjects.forEach(s=>{
    randomWaypoint(s.waypoint);s.action=null;s.actionTime=0;resetActionPose(s);s.marker.material.opacity=0;s.marker.material.color.set(0xffffff);s.inspected=false;s.inspectedSprite.material.opacity=0;setSubjectMark(s,null);
    Object.keys(s.cooldowns).forEach(k=>s.cooldowns[k as RuleId]=0);s.lastCenterInside=false;s.lastEdgeInside=false;s.lastBellZoneInside=false;s.lastLampZoneInside=false;
  });
  activeSubjects.forEach((subject,index)=>subject.root.position.set((index%columns-(columns-1)/2)*6.5,0,(Math.floor(index/columns)-(rows-1)/2)*7));
  validateRoundConfiguration();
  attempts=3;roundTime=0;bellTimer=THREE.MathUtils.randFloat(7,10);renderRuleNotes();updateAttempts();resetRuleNotes();
}

function validateRoundConfiguration() {
  if(activeRules.length!==4||new Set(activeRules.map(rule=>rule.id)).size!==4)throw new Error('A round must select four distinct behavior rules.');
  if(new Set(activeRules.map(rule=>rule.action)).size!==4)throw new Error('Active behavior rules must use four distinct actions.');
  if(!activeRuleIds.has(targetRule.id))throw new Error('Target rule must be active.');
  if(!activeRuleIds.has(bellSourceRule.id)||bellAction!==bellSourceRule.action)throw new Error('Bell behavior must match one active rule action.');
  for(const rule of activeRules) {
    const obeyCount=activeSubjects.filter(subject=>subject.obeys[rule.id]).length;
    if(rule.id===targetRule.id&&obeyCount!==participantCount-1)throw new Error('Target rule must be N-1:1.');
    if(rule.id!==targetRule.id&&Math.abs(obeyCount-participantCount/2)>.5)throw new Error('Noise rules must split subjects as evenly as possible.');
    const requiredStimuli=rule.stimulus?(rule.id===targetRule.id?2:1):0;
    if(requiredStimuli&&activeSubjects.filter(subject=>stimulusPoolFor(rule).includes(subject)).length<requiredStimuli)throw new Error('Active appearance rules require visible stimulus NPCs.');
  }
  const bellObeyCount=activeSubjects.filter(subject=>subject.bellObeys).length;
  if(Math.abs(bellObeyCount-participantCount/2)>.5)throw new Error('Bell noise must split subjects as evenly as possible.');
}

function shuffle<T>(items:T[]) { return [...items].sort(()=>Math.random()-.5); }

function trigger(subject:Subject, ruleId:RuleId) {
  if(!activeRuleIds.has(ruleId))return;
  if(subject.cooldowns[ruleId]>0 || subject.action) return;
  subject.cooldowns[ruleId]=ruleId==='greetingWave'?5:['centerClap','edgeJump','bellZoneCheer','lampBow','turnSpin'].includes(ruleId)?6:3.5;
  if(subject.obeys[ruleId]) { subject.action=RULES.find(r=>r.id===ruleId)!.action; subject.actionTime=0; }
}

function ringBell() {
  bellTimer=THREE.MathUtils.randFloat(10,14);
  activeSubjects.forEach(subject=>{
    if(!subject.bellObeys)return;
    resetActionPose(subject);
    subject.action=bellAction;subject.actionTime=0;
  });
  bell.scale.set(1.3,.8,1.3);playBellSound();showToast(copy(`종 이벤트 · ${ACTION_LABELS[bellAction].ko}`,`BELL EVENT · ${ACTION_LABELS[bellAction].en}`),false,900);
}

function playBellSound() {
  if(!soundEnabled)return;
  const AudioCtx=window.AudioContext || (window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  const ctx=new AudioCtx(); const gain=ctx.createGain(); gain.connect(ctx.destination); gain.gain.setValueAtTime(.15,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+1.5);
  [523.25,659.25,783.99].forEach((freq,i)=>{const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=freq;osc.connect(gain);osc.start(ctx.currentTime+i*.035);osc.stop(ctx.currentTime+1.5);});
}

function updateSubject(s:Subject,dt:number) {
  (Object.keys(s.cooldowns) as RuleId[]).forEach(id=>s.cooldowns[id]=Math.max(0,s.cooldowns[id]-dt));
  const distance=s.root.position.distanceTo(s.waypoint);
  if(distance<1.2){trigger(s,'turnSpin');randomWaypoint(s.waypoint)}
  const dir=s.waypoint.clone().sub(s.root.position); dir.y=0; dir.normalize();
  const moveFactor=s.action==='spin'?.18:s.action?.42:1;
  s.root.position.addScaledVector(dir,s.speed*dt*moveFactor);
  if(dir.lengthSq()) s.root.rotation.y=THREE.MathUtils.lerp(s.root.rotation.y,Math.atan2(dir.x,dir.z),Math.min(1,dt*4));
  const gait=Math.sin(roundTime*s.speed*5+s.id)*.1*moveFactor;
  s.body.rotation.z=gait; s.leftArm.rotation.x=gait*2; s.rightArm.rotation.x=-gait*2;
  const inCenter=Math.hypot(s.root.position.x,s.root.position.z)<centerTriggerRadius;
  if(inCenter&&!s.lastCenterInside) trigger(s,'centerClap'); s.lastCenterInside=inCenter;
  const inEdge=Math.max(Math.abs(s.root.position.x),Math.abs(s.root.position.z))>arenaHalf*.62;
  if(inEdge&&!s.lastEdgeInside)trigger(s,'edgeJump');s.lastEdgeInside=inEdge;
  const inBellZone=Math.hypot(s.root.position.x,s.root.position.z+25*arenaScale)<Math.max(2.8,5*arenaScale);
  if(inBellZone&&!s.lastBellZoneInside)trigger(s,'bellZoneCheer');s.lastBellZoneInside=inBellZone;
  const lampDistance=Math.min(...([[-24,-24],[24,-24],[-24,24],[24,24]] as [number,number][]).map(([x,z])=>Math.hypot(s.root.position.x-x*arenaScale,s.root.position.z-z*arenaScale)));
  const inLampZone=lampDistance<Math.max(2.8,4.5*arenaScale);
  if(inLampZone&&!s.lastLampZoneInside)trigger(s,'lampBow');s.lastLampZoneInside=inLampZone;
  if(s.action) animateAction(s,dt);
}

function resetActionPose(s:Subject) {
  s.body.position.y=0;s.body.rotation.set(0,0,0);
  s.leftArm.rotation.set(0,0,0);s.rightArm.rotation.set(0,0,0);
}

function animateAction(s:Subject,dt:number) {
  s.actionTime+=dt; const t=s.actionTime;
  if(s.action==='jump') s.body.position.y=Math.max(0,Math.sin(Math.min(t/1.2,1)*Math.PI)*2.25);
  if(s.action==='wave') { s.rightArm.rotation.z=-2.55; s.rightArm.rotation.x=Math.sin(t*13)*.7; }
  if(s.action==='spin') s.body.rotation.y=t*Math.PI*2.1;
  if(s.action==='bow')s.body.rotation.x=Math.sin(Math.min(t/1.2,1)*Math.PI)*.72;
  if(s.action==='clap') {
    const clap=Math.abs(Math.sin(t*12));s.leftArm.rotation.x=s.rightArm.rotation.x=-1.25;
    s.leftArm.rotation.z=-.2-clap*.5;s.rightArm.rotation.z=.2+clap*.5;
  }
  if(s.action==='cheer') {s.leftArm.rotation.z=2.5;s.rightArm.rotation.z=-2.5;s.body.position.y=Math.abs(Math.sin(t*7))*.35;}
  if(t>1.25){s.action=null;s.actionTime=0;resetActionPose(s);}
}

function processProximityRules() {
  for(let i=0;i<activeSubjects.length;i++) for(let j=i+1;j<activeSubjects.length;j++) {
    const a=activeSubjects[i],b=activeSubjects[j]; const d=a.root.position.distanceToSquared(b.root.position);
    if(d<7.8) {
      if(b.red) trigger(a,'redJump'); if(a.red) trigger(b,'redJump');
      if(b.blue) trigger(a,'blueSpin'); if(a.blue) trigger(b,'blueSpin');
      if(b.yellow) trigger(a,'yellowWave'); if(a.yellow) trigger(b,'yellowWave');
      if(b.hat) trigger(a,'hatBow'); if(a.hat) trigger(b,'hatBow');
    }
    if(d<4&&areFacingEachOther(a,b)) { trigger(a,'greetingWave'); trigger(b,'greetingWave'); }
  }
}

function areFacingEachOther(a:Subject,b:Subject) {
  const toB=b.root.position.clone().sub(a.root.position);toB.y=0;if(toB.lengthSq()===0)return false;toB.normalize();
  const forwardA=new THREE.Vector3(0,0,1).applyQuaternion(a.root.quaternion);forwardA.y=0;forwardA.normalize();
  const forwardB=new THREE.Vector3(0,0,1).applyQuaternion(b.root.quaternion);forwardB.y=0;forwardB.normalize();
  return forwardA.dot(toB)>.65&&forwardB.dot(toB.clone().negate())>.65;
}

function pickSubjectAt(clientX:number,clientY:number) {
  const rect=canvas.getBoundingClientRect();
  const pointer=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(pickables,false).find(result=>activeSubjectIds.has(result.object.userData.subjectId as number));
  if(hit&&hit.distance<70) return subjects[hit.object.userData.subjectId as number];
  let nearest:Subject|null=null; let nearestDistance=38*38;
  for(const subject of activeSubjects) {
    const projected=subject.root.position.clone().add(new THREE.Vector3(0,2.7,0)).project(camera);
    if(projected.z<-1||projected.z>1)continue;
    const screenX=rect.left+(projected.x+1)*rect.width/2;
    const screenY=rect.top+(1-projected.y)*rect.height/2;
    const distance=(screenX-clientX)**2+(screenY-clientY)**2;
    if(distance<nearestDistance){nearestDistance=distance;nearest=subject;}
  }
  return nearest;
}

function beginTouchPointer(event:PointerEvent) {
  if(!touchMode||!playing||paused)return;
  event.preventDefault();
  try { canvas.setPointerCapture(event.pointerId); } catch { /* Keep tracking while the pointer remains over the canvas. */ }
  activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY});
  if(activePointers.size===1) mobileDragged=false;
  if(activePointers.size===2) {
    const points=[...activePointers.values()];
    previousGestureCenter.set((points[0].x+points[1].x)/2,(points[0].y+points[1].y)/2);
    previousGestureDistance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
    mobileDragged=true;
  }
}

function moveTouchPointer(event:PointerEvent) {
  const point=activePointers.get(event.pointerId);
  if(!touchMode||paused||!point)return;
  event.preventDefault();
  const previousX=point.x,previousY=point.y;
  point.x=event.clientX;point.y=event.clientY;
  if(activePointers.size===1) {
    const totalDistance=Math.hypot(point.x-point.startX,point.y-point.startY);
    if(totalDistance>6)mobileDragged=true;
    if(mobileDragged) {
      mobileSpherical.theta-=(point.x-previousX)*.007;
      mobileSpherical.phi=THREE.MathUtils.clamp(mobileSpherical.phi+(point.y-previousY)*.005,.45,1.28);
      applyMobileCamera();
      advanceMobileTutorial('orbit');
    }
    return;
  }
  if(activePointers.size===2) {
    const points=[...activePointers.values()];
    const center=new THREE.Vector2((points[0].x+points[1].x)/2,(points[0].y+points[1].y)/2);
    const distance=Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y));
    const delta=center.clone().sub(previousGestureCenter);
    if(!followedSubject) {
      const panScale=mobileSpherical.radius*.0017;
      const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);right.y=0;right.normalize();
      const forward=mobileTarget.clone().sub(camera.position);forward.y=0;forward.normalize();
      mobileTarget.addScaledVector(right,-delta.x*panScale).addScaledVector(forward,delta.y*panScale);
      const panLimit=arenaHalf*.76;mobileTarget.x=THREE.MathUtils.clamp(mobileTarget.x,-panLimit,panLimit);mobileTarget.z=THREE.MathUtils.clamp(mobileTarget.z,-panLimit,panLimit);
    }
    if(previousGestureDistance>0) mobileSpherical.radius=THREE.MathUtils.clamp(mobileSpherical.radius*previousGestureDistance/distance,15,50);
    previousGestureCenter.copy(center);previousGestureDistance=distance;
    applyMobileCamera();
    advanceMobileTutorial('multi');
  }
}

function endTouchPointer(event:PointerEvent) {
  const point=activePointers.get(event.pointerId);
  if(!touchMode||!point)return;
  event.preventDefault();
  try { if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId); } catch { /* Capture may already be released. */ }
  const wasMulti=activePointers.size>1;
  activePointers.delete(event.pointerId);
  if(!wasMulti&&!mobileDragged&&Math.hypot(event.clientX-point.startX,event.clientY-point.startY)<8) selectSubject(pickSubjectAt(event.clientX,event.clientY));
  if(activePointers.size===1) {
    const remaining=[...activePointers.values()][0];remaining.startX=remaining.x;remaining.startY=remaining.y;mobileDragged=true;
  }
  if(activePointers.size<2)previousGestureDistance=0;
}

function cancelTouchPointers(){activePointers.clear();previousGestureDistance=0;mobileDragged=false;}

function preventNativeDoubleTapZoom(event:TouchEvent) {
  if(!touchMode||event.changedTouches.length!==1)return;
  const touch=event.changedTouches[0];
  const now=performance.now();
  const isDoubleTap=event.target===lastTouchEndTarget&&now-lastTouchEndTime<350&&Math.hypot(touch.clientX-lastTouchEndX,touch.clientY-lastTouchEndY)<40;
  if(isDoubleTap) {
    event.preventDefault();
    lastTouchEndTime=0;
    return;
  }
  lastTouchEndTime=now;lastTouchEndX=touch.clientX;lastTouchEndY=touch.clientY;lastTouchEndTarget=event.target;
}

function updateCamera(dt:number) {
  if(document.pointerLockElement!==canvas) return;
  if(followedSubject){applyDesktopFollowCamera();return;}
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); forward.y=0; forward.normalize();
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); right.y=0; right.normalize();
  const move=new THREE.Vector3();
  if(keys.has('KeyW'))move.add(forward);if(keys.has('KeyS'))move.sub(forward);if(keys.has('KeyD'))move.add(right);if(keys.has('KeyA'))move.sub(right);
  if(move.lengthSq()) move.normalize().multiplyScalar((keys.has('ShiftLeft')?18:8.5)*dt);
  camera.position.add(move);camera.position.x=THREE.MathUtils.clamp(camera.position.x,-arenaHalf-2,arenaHalf+2);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-arenaHalf-2,arenaHalf+2);camera.position.y=desktopCameraHeight;
}

function updateTargeting() {
  if(touchMode) {
    activeSubjects.forEach(s=>s.marker.material.opacity=selectedSubject===s?1:0);
    return;
  }
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hit=raycaster.intersectObjects(pickables,false).find(result=>activeSubjectIds.has(result.object.userData.subjectId as number));
  hovered=hit && hit.distance<45 ? subjects[hit.object.userData.subjectId as number] : null;
  activeSubjects.forEach(s=>s.marker.material.opacity=hovered===s?1:0);
  document.querySelector('#crosshair')!.classList.toggle('locked',!!hovered);
  const label=document.querySelector('#target-label')!; label.textContent=hovered?hovered.name:''; label.classList.toggle('show',!!hovered);
}

function accuse(subject=hovered) {
  if(!playing||paused||!subject)return;
  if(subject.inspected){showToast(copy(`${subject.name}은(는) 이미 확인했습니다.`,`${subject.name} WAS ALREADY INSPECTED.`),true,1200);return;}
  if(subject.id===oddId){endRound(true);return;}
  attempts--;subject.inspected=true;subject.inspectedSprite.material.opacity=1;updateAttempts();showToast(copy(`${subject.name} 확인 완료 · 기회 ${attempts}번 남음`,`${subject.name} INSPECTED · ${attempts} CHANCE${attempts===1?'':'S'} LEFT`),true,1600);
  subject.marker.material.color.set(0xe65b47);
  if(touchMode)selectSubject(null);
  if(attempts<=0) endRound(false);
}

function updateAttempts(){const el=document.querySelector('#attempts')!;el.innerHTML='';for(let i=0;i<3;i++){const bar=document.createElement('i');bar.className=`attempt${i>=attempts?' lost':''}`;el.appendChild(bar)}el.setAttribute('aria-label',copy(`고발 기회 ${attempts}번 남음`,`${attempts} attempts remaining`))}
let toastTimeout=0;
function showToast(message:string,bad=false,duration=1200){const el=document.querySelector('#toast')!;el.textContent=message;el.className=`toast show${bad?' bad':''}`;clearTimeout(toastTimeout);toastTimeout=window.setTimeout(()=>el.className='toast',duration)}

function setPaused(value:boolean) {
  if(!playing||paused===value)return;
  paused=value;keys.clear();cancelTouchPointers();
  const screen=document.querySelector<HTMLElement>('#pause-screen')!;screen.classList.toggle('open',paused);screen.setAttribute('aria-hidden',String(!paused));
  document.body.classList.toggle('paused',paused);
  if(paused)restoreSystemCursor();
  if(!paused&&!touchMode)requestGamePointerLock();
}

function updateSoundButtons() {
  const hudButton=document.querySelector<HTMLButtonElement>('#sound-toggle')!;
  const pauseButton=document.querySelector<HTMLButtonElement>('#pause-sound-toggle')!;
  hudButton.textContent=soundEnabled?copy('소리','SOUND'):copy('음소거','MUTED');
  pauseButton.textContent=soundEnabled?copy('소리 켜짐','SOUND ON'):copy('소리 꺼짐','SOUND OFF');
  for(const button of [hudButton,pauseButton]) {button.classList.toggle('muted',!soundEnabled);button.setAttribute('aria-pressed',String(soundEnabled));button.setAttribute('aria-label',soundEnabled?copy('소리 끄기','Turn sound off'):copy('소리 켜기','Turn sound on'));}
}

function toggleSound(){soundEnabled=!soundEnabled;updateSoundButtons()}

function setSystemCursorOverride(visible:boolean) {
  for(const element of [document.documentElement,document.body,canvas]) {
    if(visible)element.style.cursor='auto';
    else element.style.removeProperty('cursor');
  }
}

function pointerLockAllowed() {
  return !touchMode&&playing&&!paused&&!altCursorMode&&!document.hidden&&document.hasFocus();
}

function clearPointerLockReleaseTimers() {
  pointerLockReleaseTimers.forEach(timer=>clearTimeout(timer));
  pointerLockReleaseTimers=[];
}

function releasePointerLockNow() {
  setSystemCursorOverride(true);
  if(document.pointerLockElement) {
    try { document.exitPointerLock(); } catch { /* The document may already be leaving Pointer Lock. */ }
  }
}

function exitGamePointerLock() {
  pointerLockRequestId++;
  pointerLockAcquired=false;
  clearPointerLockReleaseTimers();
  releasePointerLockNow();
  for(const delay of [0,50,150,400,1000]) {
    pointerLockReleaseTimers.push(window.setTimeout(()=>{
      if(!pointerLockAllowed())releasePointerLockNow();
    },delay));
  }
}

function restoreSystemCursor() {
  altCursorMode=false;keys.clear();document.body.classList.remove('cursor-free');
  setSystemCursorOverride(true);exitGamePointerLock();
}

function handleBrowserFocusLoss() {
  if(touchMode)return;
  if(playing&&!paused)setPaused(true);
  else restoreSystemCursor();
}

function requestGamePointerLock() {
  if(!pointerLockAllowed())return;
  clearPointerLockReleaseTimers();
  const requestId=++pointerLockRequestId;
  setSystemCursorOverride(false);
  try {
    const result=canvas.requestPointerLock();
    if(result instanceof Promise)result.then(()=>{
      if(requestId!==pointerLockRequestId||!pointerLockAllowed())exitGamePointerLock();
    }).catch(()=>{
      if(requestId===pointerLockRequestId)setSystemCursorOverride(true);
    });
  } catch {
    if(requestId===pointerLockRequestId)setSystemCursorOverride(true);
  }
}

function setAltCursorMode(value:boolean) {
  if(touchMode||!playing||paused)value=false;
  if(altCursorMode===value)return;
  altCursorMode=value;keys.clear();document.body.classList.toggle('cursor-free',value);
  if(value){setSystemCursorOverride(true);exitGamePointerLock();}
  else if(playing&&!paused)requestGamePointerLock();
}

function startRound(){configureRound();playing=true;paused=false;roundResult=null;pointerLockAcquired=false;altCursorMode=false;setSystemCursorOverride(false);setFollowSubject(null,false);document.body.classList.add('round-active');document.body.classList.remove('paused','cursor-free');selectSubject(null);document.querySelector('#start-screen')!.classList.remove('open');document.querySelector('#end-screen')!.classList.remove('open');document.querySelector('#pause-screen')!.classList.remove('open');if(touchMode){initializeMobileCamera();if(!mobileTutorialComplete)setMobileHint(copy('한 손가락 · 둘러보기','ONE FINGER · LOOK AROUND'))}else{camera.fov=62;camera.updateProjectionMatrix();desktopCameraHeight=Math.max(8,arenaSize*.22);camera.position.set(0,desktopCameraHeight,arenaHalf*.82);yaw=0;pitch=-.28;desktopFreePosition.copy(camera.position);desktopFreeYaw=yaw;desktopFreePitch=pitch;camera.rotation.set(pitch,yaw,0);requestGamePointerLock()}}

function updateResultCopy(){
  const success=roundResult==='success';
  document.querySelector('#result-kicker')!.textContent=success?copy('이상 행동 확인','ANOMALY CONFIRMED'):copy('관찰 종료','OBSERVATION TERMINATED');
  document.querySelector('#result-title')!.textContent=success?copy('찾았습니다.','YOU FOUND IT.'):copy('추리에 실패했습니다.','CASE FAILED.');
  document.querySelector('#reveal-rule')!.textContent=targetRule.label[language];
  document.querySelector('#reveal-npc')!.textContent=subjects[oddId].name;
}

function endRound(success:boolean){playing=false;paused=false;roundResult=success?'success':'fail';restoreSystemCursor();setFollowSubject(null,false);document.body.classList.remove('round-active','paused','cursor-free');setRuleNotesOpen(false);document.querySelector('#pause-screen')!.classList.remove('open');cancelTouchPointers();selectSubject(null);subjects[oddId].marker.material.color.set(0xf4b942);subjects[oddId].marker.material.opacity=1;const screen=document.querySelector('#end-screen')!;screen.className=`screen result-screen open ${success?'success':'fail'}`;updateResultCopy()}

function returnToStartScreen(){
  playing=false;paused=false;roundResult=null;restoreSystemCursor();cancelTouchPointers();setFollowSubject(null,false);selectSubject(null);
  mobileHint.textContent='';mobileHint.classList.remove('show');subjects.forEach(subject=>subject.marker.material.opacity=0);
  document.querySelector('#crosshair')!.classList.remove('locked');const targetLabel=document.querySelector<HTMLElement>('#target-label')!;targetLabel.textContent='';targetLabel.classList.remove('show');
  document.body.classList.remove('round-active','paused','selection-active','cursor-free');
  setRuleNotesOpen(false);
  document.querySelector('#pause-screen')!.classList.remove('open');document.querySelector('#pause-screen')!.setAttribute('aria-hidden','true');
  document.querySelector('#end-screen')!.classList.remove('open');controlsScreen.classList.remove('open');controlsScreen.setAttribute('aria-hidden','true');
  document.querySelector('#start-screen')!.classList.add('open');
  clearTimeout(toastTimeout);document.querySelector('#toast')!.className='toast';
}

document.querySelector('#play-button')!.addEventListener('click',requestStartRound);
document.querySelector('#replay-button')!.addEventListener('click',startRound);
participantButtons.forEach(button=>button.addEventListener('click',()=>{
  const count=Number(button.dataset.participantCount);
  if(count===6||count===9||count===12||count===24)setParticipantCount(count);
}));
ruleNoteRows.forEach(row=>row.addEventListener('click',()=>cycleRuleNote(row.dataset.ruleNote as RuleNoteId)));
document.querySelector('#rule-notes-close')!.addEventListener('click',()=>setRuleNotesOpen(false));
ruleNotesToggle.addEventListener('click',()=>setRuleNotesOpen(true));
canvas.addEventListener('click',event=>{if(event.button!==0||performance.now()<suppressAccusationUntil||touchMode||!playing||altCursorMode)return;if(document.pointerLockElement!==canvas)requestGamePointerLock();else accuse()});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown',event=>{if(!touchMode&&event.button===2){event.preventDefault();suppressAccusationUntil=performance.now()+400;if(playing&&!paused&&hovered)cycleSubjectMark(hovered)}});
canvas.addEventListener('pointerdown',beginTouchPointer);
canvas.addEventListener('pointermove',moveTouchPointer);
canvas.addEventListener('pointerup',endTouchPointer);
canvas.addEventListener('pointercancel',cancelTouchPointers);
document.addEventListener('touchend',preventNativeDoubleTapZoom,{passive:false});
document.addEventListener('dblclick',event=>{if(touchMode)event.preventDefault()},{passive:false});
document.querySelector('#mobile-accuse')!.addEventListener('click',()=>accuse(selectedSubject));
questionButton.addEventListener('click',()=>{if(selectedSubject)setSubjectMark(selectedSubject,selectedSubject.mark==='?'?null:'?')});
clearButton.addEventListener('click',()=>{if(selectedSubject)setSubjectMark(selectedSubject,selectedSubject.mark==='✓'?null:'✓')});
followButton.addEventListener('click',()=>toggleFollow(selectedSubject));
document.querySelector('#resume-button')!.addEventListener('click',()=>setPaused(false));
document.querySelector('#view-controls-button')!.addEventListener('click',()=>openControls('pause'));
document.querySelector('#end-observation-button')!.addEventListener('click',returnToStartScreen);
controlsCloseButton.addEventListener('click',closeControls);
document.querySelectorAll('#sound-toggle,#pause-sound-toggle').forEach(button=>button.addEventListener('click',toggleSound));
languageToggle.addEventListener('click',toggleLanguage);
speedButtons.forEach(button=>button.addEventListener('click',()=>{
  const speed=Number(button.dataset.gameSpeed);
  if(speed===1||speed===1.5||speed===2)setGameSpeed(speed);
}));
addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;if(followedSubject){desktopFollowSpherical.theta-=e.movementX*.0028;desktopFollowSpherical.phi=THREE.MathUtils.clamp(desktopFollowSpherical.phi-e.movementY*.0028,.35,1.4);applyDesktopFollowCamera();return}yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=THREE.MathUtils.clamp(pitch,-1.35,1.35);camera.rotation.set(pitch,yaw,0)});
addEventListener('keydown',e=>{if(controlsScreen.classList.contains('open')){e.preventDefault();if(e.code==='Escape'&&controlsOrigin==='pause')closeControls();return}if((e.code==='AltLeft'||e.code==='AltRight')&&playing&&!paused&&!touchMode){e.preventDefault();if(!e.repeat)setAltCursorMode(!altCursorMode);return}if(e.code==='Escape'&&playing){e.preventDefault();if(paused)setPaused(false);else if(touchMode||document.pointerLockElement!==canvas)setPaused(true);return}const noteIndex=['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code);if(noteIndex>=0&&playing&&!paused&&!e.repeat){e.preventDefault();cycleRuleNote(RULE_NOTE_ORDER[noteIndex]);return}if((e.code==='PageUp'||e.code==='PageDown')&&playing&&!paused&&!touchMode){e.preventDefault();adjustDesktopZoom(e.code==='PageUp'?-1:1);return}if(e.code==='KeyF'&&playing&&!paused&&!touchMode&&!e.repeat){e.preventDefault();toggleFollow(hovered||followedSubject);return}if(!paused)keys.add(e.code)});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('wheel',e=>{if(!touchMode&&playing&&!paused){e.preventDefault();adjustDesktopZoom(Math.sign(e.deltaY))}},{passive:false});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas) {
    if(!pointerLockAllowed()){exitGamePointerLock();return}
    pointerLockAcquired=true;return;
  }
  const lostGamePointerLock=pointerLockAcquired;pointerLockAcquired=false;
  if(playing&&!paused&&!altCursorMode&&lostGamePointerLock)setPaused(true);
});
document.addEventListener('pointerlockerror',()=>{pointerLockAcquired=false;setSystemCursorOverride(true)});
addEventListener('blur',handleBrowserFocusLoss);
document.addEventListener('visibilitychange',()=>{if(document.hidden)handleBrowserFocusLoss()});
addEventListener('pagehide',restoreSystemCursor);
addEventListener('beforeunload',restoreSystemCursor);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;if(touchMode)camera.fov=innerHeight>innerWidth?72:62;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(touchMode)applyMobileCamera()});

applyLanguage();
const clock=new THREE.Clock(); let proximityTimer=0;
function frame(){requestAnimationFrame(frame);if(!pointerLockAllowed()&&document.pointerLockElement)releasePointerLockNow();const realDt=Math.min(clock.getDelta(),.05);if(playing&&!paused){const simulationDt=realDt*gameSpeed;roundTime+=simulationDt;bellTimer-=simulationDt;bell.scale.lerp(new THREE.Vector3(1,1,1),simulationDt*5);if(bellTimer<=0)ringBell();activeSubjects.forEach(s=>updateSubject(s,simulationDt));proximityTimer-=simulationDt;if(proximityTimer<=0){processProximityRules();proximityTimer=.18}if(touchMode&&followedSubject)applyMobileCamera();else if(!touchMode)updateCamera(realDt);updateTargeting();document.querySelector('#timer')!.textContent=`${String(Math.floor(roundTime/60)).padStart(2,'0')}:${String(Math.floor(roundTime%60)).padStart(2,'0')}`;}renderer.render(scene,camera)}
frame();
