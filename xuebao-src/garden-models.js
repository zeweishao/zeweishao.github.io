export function buildWishingFountain(THREE, parent, marble, water) {
  const stone = new THREE.MeshStandardMaterial({ color: "#dac5b5", roughness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: "#cbad73", metalness: 0.62, roughness: 0.36 });
  const petalMats = ["#e8a5ac", "#f3c8cb"].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.52 }));
  function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = mat !== water; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function profile(points, mat, lobes = 0, depth = 0, y = 0) {
    const geo = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), 96);
    const p = geo.attributes.position;
    if (lobes) {
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i), a = Math.atan2(x, z);
        const k = 1 + depth * Math.cos(a * lobes);
        p.setXYZ(i, x * k, p.getY(i), z * k);
      }
      geo.computeVertexNormals();
      // 焊合闭环处的法线，避免花形石沿出现一条竖缝。
      const n = geo.attributes.normal, loop = points.length * 96;
      for (let i = 0; i < points.length; i++) {
        const a = new THREE.Vector3().fromBufferAttribute(n, i).add(new THREE.Vector3().fromBufferAttribute(n, loop + i)).normalize();
        n.setXYZ(i, a.x, a.y, a.z); n.setXYZ(loop + i, a.x, a.y, a.z);
      }
    }
    return mesh(geo, mat, 0, y, 0);
  }
  profile([[0,0],[1.02,0],[1.06,0.04],[1.06,0.09],[1.02,0.13],[0,0.13]], stone, 8, 0.1);
  profile([[0,0.065],[1.012,0.065],[1.02,0.14],[0.986,0.18],[1.015,0.31],[1.04,0.335],[1.04,0.37],[0.99,0.405],[0.894,0.405],[0.864,0.363],[0.865,0.14],[0,0.14]], marble, 8, 0.1);
  profile([[0.889,0.375],[0.911,0.382],[0.923,0.392],[0.937,0.395]], brass, 8, 0.1);
  profile([[0.875,0.292],[0,0.292]], water, 8, 0.1);

  profile([[0,0],[0.2,0],[0.215,0.05],[0.16,0.11],[0.12,0.28],[0.17,0.5],[0.23,0.59],[0.22,0.67],[0,0.69]], marble, 10, 0.14, 0.16);
  profile([[0,0],[0.18,0],[0.21,0.037],[0.41,0.09],[0.515,0.18],[0.535,0.23],[0.519,0.25],[0.468,0.238],[0.433,0.171],[0.24,0.09],[0,0.09]], marble, 12, 0.065, 0.78);
  profile([[0.464,0.207],[0,0.207]], water, 12, 0.065, 0.78);
  profile([[0,0],[0.11,0],[0.113,0.03],[0.074,0.095],[0.07,0.28],[0.13,0.43],[0,0.45]], stone, 7, 0.08, 0.94);

  const petal = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 16; i++) {
    const inner = i >= 9, a = i * 2.39996, r = inner ? 0.072 : 0.138;
    const m = mesh(petal, petalMats[Number(inner)], Math.sin(a) * r, inner ? 1.487 : 1.427, Math.cos(a) * r);
    m.scale.set(inner ? 0.054 : 0.078, inner ? 0.107 : 0.091, 0.036);
    m.rotation.set(inner ? 0.34 : 0.74, a, 0, "YXZ");
  }
  mesh(new THREE.SphereGeometry(0.043, 16, 10), brass, 0, 1.506, 0);
  const wishRing = mesh(new THREE.RingGeometry(0.965, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#ffe6ad", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.3);
  wishRing.castShadow = false; wishRing.visible = false; wishRing.renderOrder = 3;
  return wishRing;
}

export function buildBranchingTree(THREE, root, { x, z, scale, oak, heightAt, canopy, leaves, mobile }) {
  const tree = new THREE.Group();
  tree.name = oak ? "swingOak" : "flowerTree";
  const y = heightAt(x, z);
  tree.position.set(x, y, z); tree.scale.setScalar(scale); root.add(tree);
  const bark = new THREE.MeshStandardMaterial({ color: oak ? "#76543d" : "#8e6651", roughness: 0.93, vertexColors: true });
  const vector = (v) => new THREE.Vector3(...v);
  function branch(points, startR, endR) {
    const curve = new THREE.CatmullRomCurve3(points.map(vector));
    const segments = mobile ? 10 : 15, sides = mobile ? 7 : 10;
    const geo = new THREE.TubeGeometry(curve, segments, 1, sides);
    const p = geo.attributes.position, rgb = [];
    const v = new THREE.Vector3(), c = new THREE.Color();
    for (let s = 0; s <= segments; s++) {
      const t = s / segments, mid = curve.getPointAt(t);
      for (let k = 0; k <= sides; k++) {
        const i = s * (sides + 1) + k, a = (k % sides) / sides * Math.PI * 2;
        const grain = 1 + 0.12 * Math.cos(5 * a + t * 1.8) + 0.035 * Math.sin(a * 3 - t * 12);
        const r = THREE.MathUtils.lerp(startR, endR, t) * grain;
        v.fromBufferAttribute(p, i).sub(mid).multiplyScalar(r).add(mid);
        p.setXYZ(i, v.x, v.y, v.z);
        c.setScalar(0.79 + 0.18 * grain);
        rgb.push(c.r, c.g, c.b);
      }
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, bark); m.castShadow = m.receiveShadow = true; tree.add(m);
  }
  const h = oak ? 3.14 : 2.12;
  branch([[0,-0.16,0],[-0.03,0.59,-0.035],[oak ? 0 : -0.11,1.1,oak ? 0 : 0.05],[-0.19,h * 0.71,0.03],[0.07,h,0.13],oak ? [-0.18,3.68,0.34] : [-0.07,2.55,0.06]], oak ? 0.37 : 0.155, 0.012);
  const forks = oak ? [[-1.13,2.94,-0.28],[0.5,3.44,-0.82],[-0.44,3.62,0.53],[1.64,2.88,0.48],[0.93,3.38,0.1]]
    : [[-0.74,1.98,0.21],[0.52,2.15,-0.56],[-0.06,2.57,0.06],[0.71,1.92,0.41],[-0.43,2.18,-0.49]];
  forks.forEach(([dx, dy, dz], i) => {
    const from = oak ? [-0.12, i === 3 ? 1.91 : 2.22, 0.06] : [-0.10, 1.17 + i * 0.07, 0.04];
    const middle = oak && i === 3 ? [0.94, 2.61, 0.4] : [dx * 0.58, dy - 0.31, dz * 0.54];
    const supportsSwing = oak && i === 3;
    branch(supportsSwing ? [from, [0.56, 2.53, 0.378], middle, [1.27, 2.645, 0.414], [dx, dy, dz]] : [from, middle, [dx, dy, dz]],
      oak ? 0.143 : 0.071, 0.006);
  });
  for (let i = 0; i < (oak ? 6 : 4); i++) {
    const a = i * 2.39996 + 0.45, r = oak ? 0.72 + (i % 3) * 0.11 : 0.41 + (i % 3) * 0.061;
    const ex = Math.sin(a) * r, ez = Math.cos(a) * r;
    const endY = (heightAt(x + ex * scale, z + ez * scale) - y) / scale - 0.04;
    branch([[ex * 0.13, 0.24, ez * 0.13], [ex * 0.51, endY + 0.09, ez * 0.51], [ex, endY, ez]], oak ? 0.117 : 0.052, 0.006);
  }

  const crowns = new THREE.InstancedMesh(canopy, new THREE.MeshStandardMaterial({ roughness: 0.91, vertexColors: true }), forks.length * 3);
  const blossomCount = oak ? 0 : forks.length * (mobile ? 5 : 9);
  const blooms = blossomCount && new THREE.InstancedMesh(leaves, new THREE.MeshStandardMaterial({ roughness: 0.78 }), blossomCount);
  const part = new THREE.Object3D(), color = new THREE.Color(), greens = ["#527954","#6b9161","#83a66c"];
  const pinks = ["#e9a2b0","#f8cdd2","#fce1df","#f4b6c5"];
  function place(mesh, i, p, size, shade, angle) {
    part.position.set(...p); part.scale.set(...size); part.rotation.y = angle; part.updateMatrix();
    mesh.setMatrixAt(i, part.matrix); mesh.setColorAt(i, color.set(shade));
  }
  forks.forEach(([dx, dy, dz], i) => {
    const r = oak ? [0.88,0.97,1.02,0.72,0.65][i] : [0.54,0.57,0.65,0.53,0.46][i];
    for (let j = 0; j < 3; j++) {
      const a = i * 1.3 + j * 2.4, s = r * (1 - j * 0.24);
      place(crowns, i * 3 + j, [dx + Math.cos(a) * j * r * 0.25, dy + 0.16 + s * 0.21, dz + Math.sin(a) * j * r * 0.25],
        [s * 1.15, s * 0.72, s], greens[(i + j) % 3], a);
    }
    if (!blooms) return;
    const n = blossomCount / forks.length;
    for (let j = 0; j < n; j++) {
      const a = i + j * 2.39996, outer = r * (0.71 + 0.09 * (j % 3)), s = 0.12 + (j % 3) * 0.026;
      place(blooms, i * n + j, [dx + Math.cos(a) * outer, dy + 0.27 + s + Math.sin(j * 1.8) * 0.14, dz + Math.sin(a) * outer],
        [s * 1.2,s * 0.78,s], pinks[(i + j) % pinks.length], a);
    }
  });
  crowns.castShadow = crowns.receiveShadow = true; tree.add(crowns);
  if (blooms) { blooms.receiveShadow = true; tree.add(blooms); }
}

export function buildTopiaryCrown(THREE, parent, radius, signature) {
  const crown = new THREE.Group();
  crown.name = "topiaryCrown";
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.87, 3),
    new THREE.MeshStandardMaterial({ color: "#66834f", roughness: 0.94 }));
  inner.castShadow = inner.receiveShadow = true;
  crown.add(inner);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.52,0,0, 0,0.16,0.16, 0,0.78,0, 0.52,0,0, 0,-0.13,0.08, 0,-0.66,0
  ],3));
  geo.setIndex([0,1,2, 1,3,2, 0,4,1, 1,4,3, 0,5,4, 4,5,3]);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.84 });
  const count = 360, foliage = new THREE.InstancedMesh(geo, mat, count);
  const transform = new THREE.Object3D(), tone = new THREE.Color(), direction = new THREE.Vector3(), roll = new THREE.Quaternion();
  const axis = new THREE.Vector3(0,0,1), colors = ["#819d5a","#6f8c55","#91a867","#577749","#749657"];
  for (let i=0; i<count; i++) {
    const y = 1 - 2 * (i + 0.5) / count, a = i * 2.399963 + signature;
    const r = Math.sqrt(1 - y*y);
    direction.set(Math.cos(a)*r,y,Math.sin(a)*r);
    const puff = 1 + 0.046 * Math.sin(direction.x*13+signature)*Math.cos(direction.y*14)*Math.cos(direction.z*15);
    const size = radius * (0.16 + 0.075 * (0.5 + 0.5*Math.sin(i*12.83+signature)));
    transform.position.copy(direction).multiplyScalar(radius*puff*.96);
    transform.quaternion.setFromUnitVectors(axis,direction).multiply(roll.setFromAxisAngle(axis, a));
    transform.scale.set(size*.69,size, size*.84);
    transform.updateMatrix();
    foliage.setMatrixAt(i,transform.matrix);
    foliage.setColorAt(i,tone.set(colors[i%colors.length]).offsetHSL(0,0,0.04*y));
  }
  foliage.receiveShadow = true; crown.add(foliage); parent.add(crown);
  return crown;
}
