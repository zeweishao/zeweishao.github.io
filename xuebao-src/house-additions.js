import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const material = (THREE, color, extras) => new THREE.MeshStandardMaterial({color, roughness:.7, ...extras});
function mesh(THREE, parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x,y,z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function beam(THREE, parent, from, to, r0, r1, mat) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const center = a.clone().add(b).multiplyScalar(.5);
  const m = mesh(THREE,parent,new THREE.CylinderGeometry(r1,r0,a.distanceTo(b),10),mat,...center);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
  return m;
}

export function buildZe(THREE) {
  const root = new THREE.Group(); root.name = "泽泽";
  const figure = new THREE.Group(); root.add(figure);
  const skin = material(THREE,"#ffd8bc"), ink = material(THREE,"#372e38");
  const hair = material(THREE,"#3a3136",{roughness:.76}), strand = material(THREE,"#51434a");
  const coat = material(THREE,"#586d8d"), seam = material(THREE,"#43546f");
  const cream = material(THREE,"#f4e8d4"), shoe = material(THREE,"#55403d");
  const gold = material(THREE,"#dcb071",{metalness:.42,roughness:.4});
  const coral = material(THREE,"#d88783"), white = material(THREE,"#fff9ea");
  function ell(parent, mat, x,y,z, a,b,c) {
    const m = mesh(THREE,parent,new THREE.SphereGeometry(1,16,12),mat,x,y,z);
    m.scale.set(a,b,c);return m;
  }
  function joint(parent,x,y,z) { const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g; }
  ell(figure,coat,0,.473,0,.138,.158,.086);
  ell(figure,cream,0,.563,.061,.065,.068,.035);
  for (const side of [-1,1]) {
    const lapel=ell(figure,seam,side*.055,.531,.077,.024,.068,.011);
    lapel.rotation.z=side*.38;
  }
  ell(figure,coral,0,.535,.095,.024,.021,.009);
  for (const y of [.44,.48]) ell(figure,gold,.026,y,.085,.008,.008,.005);
  const head=joint(figure,0,.705,.005);
  ell(head,skin,0,.012,0,.169,.162,.128);
  for(const side of [-1,1]){
    ell(head,skin,side*.156,-.012,.002,.031,.043,.025);
    ell(head,ink,side*.054,-.011,.115,.018,.023,.009);
    ell(head,white,side*.054-.005,-.005,.123,.005,.007,.003);
    ell(head,coral,side*.091,-.044,.099,.023,.007,.004);
  }
  const smile=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-.023,-.055,.119),
    new THREE.Vector3(0,-.078,.124),new THREE.Vector3(.025,-.053,.119));
  mesh(THREE,head,new THREE.TubeGeometry(smile,12,.003,6,false),ink,0,0,0);
  mesh(THREE,head,new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI*.58),hair,0,.05,-.018).scale.set(.178,.159,.137);
  for(let i=0;i<6;i++){
    const lock=ell(head,i%2?hair:strand,-.125+i*.045,.116+.025*Math.sin(i*.6),.076,.047,.077,.049);
    lock.rotation.z=-.52+i*.09;
  }
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=joint(figure,side*.133,.555,0);
    ell(arm,coat,side*.02,-.066,0,.042,.083,.039);
    ell(arm,cream,side*.023,-.132,.002,.033,.028,.03);
    ell(arm,skin,side*.025,-.159,.004,.032,.033,.03);
    arms.push(arm);
    const leg=joint(figure,side*.063,.36,0);
    ell(leg,seam,0,-.142,0,.051,.149,.048);
    ell(leg,shoe,0,-.313,.025,.059,.047,.081);
    legs.push(leg);
  }
  function animate(t, walking=false, cue="", seated=false) {
    const wave = cue === "wave", clap = cue === "high-five";
    const stride = walking ? Math.sin(t*10) : 0;
    figure.position.y=seated ? -.06 : .013*Math.abs(stride)+.008*Math.sin(t*2.3);
    head.rotation.z=(cue==="talk"?.09:0)+.025*Math.sin(t*1.7);
    legs.forEach((leg,i)=>{leg.rotation.x=seated?-1.36:stride*(i?-.55:.55);});
    arms.forEach((arm,i)=>{
      arm.rotation.x = i===1&&clap ? -2.16 : stride*(i?.44:-.44);
      arm.rotation.z = i===1&&wave ? 2.15+.28*Math.sin(t*11) : i===1&&clap ? .18 : (i?.12:-.12);
    });
  }
  return {root,animate};
}

export function buildFireplace(THREE, scene, front) {
  const root = new THREE.Group(); root.name="洛可可壁炉";
  root.position.set(.2,0,front-.05);root.rotation.y=Math.PI;scene.add(root);
  const stone=material(THREE,"#f1e2d3",{roughness:.43}), white=material(THREE,"#fff1df",{roughness:.38});
  const gold=material(THREE,"#c1a071",{metalness:.56,roughness:.43});
  const brick=material(THREE,"#73493c"), voidMat=material(THREE,"#362c30");
  const wood=material(THREE,"#53372c"), end=material(THREE,"#b48159");
  const box=(w,h,d,mat,x,y,z,r=.013)=>mesh(THREE,root,new RoundedBoxGeometry(w,h,d,2,r),mat,x,y,z);
  box(1.71,.092,.61,stone,0,.046,.28);
  box(1.59,.048,.52,white,0,.095,.247);
  box(1.50,1.16,.19,stone,0,.654,.08);
  const opening=new THREE.Shape();
  opening.moveTo(-.385,.137);opening.lineTo(.385,.137);opening.lineTo(.385,.61);
  opening.absarc(0,.61,.385,0,Math.PI,false);opening.closePath();
  // Perimeter surrounds a recessed firebox.
  const surround=new THREE.Shape();
  surround.moveTo(-.7,.122);surround.lineTo(.7,.122);surround.lineTo(.7,1.125);
  surround.lineTo(-.7,1.125);surround.closePath();
  surround.holes.push(opening);
  mesh(THREE,root,new THREE.ExtrudeGeometry(surround,{depth:.16,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:24}),stone,0,0,.17);
  mesh(THREE,root,new THREE.ShapeGeometry(opening,24),voidMat,0,0,.182);
  for(let row=0;row<5;row++){
    const y=.173+row*.095;
    for(let j=0;j<4;j++) box(.174,.074,.012,brick,-.286+j*.184+(row%2?.025:0),y,.187,.004);
  }
  const frame=new THREE.TorusGeometry(.393,.025,9,36,Math.PI);
  mesh(THREE,root,frame,white,0,.61,.333);
  for(const side of [-1,1]){
    box(.049,.474,.05,white,side*.391,.373,.334);
    box(.183,.852,.097,white,side*.558,.625,.384);
    box(.224,.081,.126,stone,side*.558,.244,.384);
    box(.222,.082,.122,white,side*.558,1.035,.388);
    for(let k=-1;k<=1;k++)box(.016,.61,.023,stone,side*.558+k*.044,.625,.439,.006);
  }
  box(1.58,.083,.46,stone,0,1.129,.20);
  box(1.655,.027,.48,gold,0,1.173,.20);
  box(1.75,.075,.55,white,0,1.223,.23);
  const ornament=mesh(THREE,root,new THREE.SphereGeometry(1,20,12),gold,0,1.044,.362);
  ornament.scale.set(.089,.034,.023);
  for(const side of [-1,1]){
    const scroll=mesh(THREE,root,new THREE.TorusGeometry(.042,.009,8,20,Math.PI*1.45),gold,side*.112,1.045,.372);
    scroll.rotation.z=side*.7;
  }
  for(const [i,a] of [[0,-.22],[1,.21],[2,.09]]){
    const y=.176+i*.032, z=.285+i*.027;
    const log=mesh(THREE,root,new THREE.CylinderGeometry(.042,.043,.43,9),wood,0,y,z);
    log.rotation.z=Math.PI/2+a;log.rotation.y=a;
    for(const side of [-1,1]){
      const ring=mesh(THREE,log,new THREE.CircleGeometry(.033,12),end,0,side*.216,0);
      ring.rotation.x=-side*Math.PI/2;
    }
  }
  const flames=[];
  const flameShape = new THREE.LatheGeometry([
    [0,0],[.63,.05],[1,.24],[.85,.48],[.51,.71],[.24,.89],[0,1]
  ].map(([x,y])=>new THREE.Vector2(x,y)),15);
  const pos=flameShape.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setX(i,pos.getX(i)+.62*pos.getY(i)**2);
  flameShape.computeVertexNormals();
  for(let i=0;i<7;i++){
    const m=material(THREE,i%2?"#df642f":"#ffbb5d",{emissive:i%2?"#eb5318":"#ff9237",emissiveIntensity:i%2?.44:.56,transparent:true,opacity:.82,depthWrite:false});
    const f=mesh(THREE,root,flameShape,m,(i-3)*.058,.251,.33+(i%3)*.02);
    f.castShadow=false;f.userData.noHit=true;flames.push(f);
  }
  const glow=new THREE.PointLight("#ff9455",0,2.25,2);glow.position.set(0,.47,.465);root.add(glow);
  function update(t,night){
    flames.forEach((f,i)=>{
      const h=.143+(1-Math.abs(i-3)/4)*.128+Math.sin(t*7+i*2)*.054;
      f.scale.set(.039,h,.039);f.position.y=.239+(i%3)*.013;f.rotation.z=.26*Math.sin(t*4+i);
    });
    glow.intensity=(night?.72:.47)+Math.sin(t*11)*.064+Math.sin(t*4.4)*.079;
  }
  return {root,update};
}

export function buildWishTree(THREE, scene, heightAt, cards, mobile) {
  const root = new THREE.Group();root.name="樱花许愿树";
  const x=1.42,z=-16.83,y=heightAt(x,z);
  root.position.set(x,y,z);scene.add(root);
  const bark=material(THREE,"#705044"), pink=material(THREE,"#ffffff",{ roughness:.91 });
  beam(THREE,root,[0,-.08,0],[-.17,1.37,.01],.22,.122,bark);
  beam(THREE,root,[-.17,1.37,.01],[-.05,2.23,-.09],.126,.063,bark);
  const branches=[[-1.04,2.28,.15],[-.55,2.64,-.20],[.43,2.73,.0],[1.03,2.22,.23],[.41,2.23,-.62]];
  branches.forEach((p,i)=>{
    const elbow=[p[0]*.52,1.74+i%3*.16,p[2]*.58];
    beam(THREE,root,[-.15,1.26+i%2*.23,0],elbow,.084,.058,bark);
    beam(THREE,root,elbow,p,.060,.023,bark);
  });
  const num=mobile?88:138, blooms=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),pink,num);
  const dummy=new THREE.Object3D(),tmp=new THREE.Color(), palette=["#f0b5c5","#f3c4d0","#e89ab1","#f8dde2"];
  for(let i=0;i<num;i++){
    const [bx,by,bz]=branches[i%branches.length], a=i*2.39996, u=(i%19)/19;
    const r=.15+u*.48, k=.15+(i%7)*.019;
    dummy.position.set(bx+Math.cos(a)*r,by+.13+Math.sin(i*1.37)*.29,bz+Math.sin(a)*r*.84);
    dummy.scale.set(k*1.48,k*.78,k);dummy.rotation.set(a*.3,a,a*.2);dummy.updateMatrix();
    blooms.setMatrixAt(i,dummy.matrix);
    blooms.setColorAt(i,tmp.set(palette[i%4]));
  }
  blooms.castShadow=blooms.receiveShadow=true;root.add(blooms);
  const cardPivots=[],spots=[];
  const positions=[[-.88,1.76,.32],[-.56,1.97,.43],[-.19,1.64,.4],[.24,1.96,.47],[.56,1.62,.52],[.92,1.81,.39]];
  const line=material(THREE,"#ac655d"), guide=material(THREE,"#ca8a6a",{metalness:.3});
  beam(THREE,root,[-1.15,2.09,.36],[1.1,2.09,.38],.008,.008,guide);
  cards.forEach((w,i)=>{
    const [cx,cy,cz]=positions[i];
    const pivot=new THREE.Group();pivot.position.set(cx,2.09,.38);root.add(pivot);
    const long=2.09-cy;
    beam(THREE,pivot,[0,0,0],[0,-long,cz-.38],.004,.004,line);
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=152;
    const ctx=canvas.getContext("2d");ctx.fillStyle=i%2?"#f8dce5":"#fff1db";ctx.fillRect(0,0,128,152);
    ctx.strokeStyle="#a36776";ctx.lineWidth=4;ctx.strokeRect(9,9,110,134);
    ctx.fillStyle="#844a5c";ctx.textAlign="center";ctx.font="bold 37px 'PingFang SC', sans-serif";
    ctx.fillText(w.title,64,88);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const plaque=mesh(THREE,pivot,new THREE.PlaneGeometry(.169,.207),material(THREE,"#ffffff",{map,side:THREE.DoubleSide}),0,-long-.101,cz-.38);
    plaque.castShadow=false;cardPivots.push(pivot);
    spots.push({id:"wish-"+w.id, name:w.title, noMarker:true, action:"wish-card", card:w.id,
      pick:[plaque],at:[x+cx,y+cy,z+cz]});
  });
  spots.push({id:"wish-tree",name:"樱花许愿树",icon:"🌸",cta:"读愿望",action:"wish-card",
    at:[x,y+2.62,z],pick:[blooms]});
  const count=mobile?40:70;
  const petalGeo=new THREE.BufferGeometry(),p=new Float32Array(count*3);
  petalGeo.setAttribute("position",new THREE.BufferAttribute(p,3));
  const petal=document.createElement("canvas");petal.width=32;petal.height=32;
  const g=petal.getContext("2d");g.fillStyle="#ffd6e4";g.beginPath();
  g.moveTo(16,28);g.bezierCurveTo(1,18,7,2,15,10);g.bezierCurveTo(28,0,32,18,16,28);g.fill();
  const tex=new THREE.CanvasTexture(petal);tex.colorSpace=THREE.SRGBColorSpace;
  const drift=new THREE.Points(petalGeo,new THREE.PointsMaterial({map:tex,transparent:true,alphaTest:.05,depthWrite:false,size:.072}));
  drift.frustumCulled=false;drift.userData.noHit=true;root.add(drift);
  function update(t){
    cardPivots.forEach((pivot,i)=>{
      pivot.rotation.x=.13*Math.sin(t*1.6+i*1.31);
      pivot.rotation.z=.12*Math.sin(t*1.2+i);
    });
    for(let i=0;i<count;i++){
      const a=i*2.39996,r=.22+(i%12)*.092;
      const h=1-(t*(.085+i%5*.01)+i*.618034)%1;
      p[i*3]=Math.cos(a)*r+.27*Math.sin(t*.51+i)+.34*(1-h);
      p[i*3+1]=.035+h*2.65;
      p[i*3+2]=Math.sin(a)*r*.72+.18*Math.sin(t*.62+i*.7);
    }
    petalGeo.attributes.position.needsUpdate=true;
  }
  return {root,spots,update,walk(map){map.circle(x,z,.46);}};
}
