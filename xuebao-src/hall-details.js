// 固定建筑线脚按材质实例化，薄饰件沿用原有墙体的碰撞轮廓。
export function addHallDetails(THREE, scene, { W, D, H, T, FRONT, WIN, M, add }) {
  const inset = new THREE.MeshStandardMaterial({ color: "#f7ede2", roughness: 0.7 });
  const batches = new Map();
  function trim(mat, x, y, z, w, h, d) {
    const pieces = batches.get(mat) ?? [];
    if (!batches.has(mat)) batches.set(mat, pieces);
    pieces.push([x, y, z, w, h, d]);
  }

  const back = -D - T;
  for (const depth of [back, -D]) {
    const side = depth === back ? -1 : 1;
    const at = (offset) => depth + side * offset;
    for (const [y, h, d, mat] of [
      [H - 0.062, 0.124, 0.17, M.white],
      [H - 0.139, 0.036, 0.13, M.gold],
      [H - 0.178, 0.044, 0.096, inset]
    ]) {
      trim(mat, 0, y, at(d / 3), W, h, d);
    }

    // 壁柱布置在三扇拱之间，柱脚与柱头使用不同截面。
    for (const x of [-2.49, -1.0, 1.0, 2.49]) {
      trim(inset, x, 1.63, at(0.034), 0.19, 2.98, 0.068);
      for (const dx of [-0.055, 0, 0.055]) {
        trim(M.white, x + dx, 1.65, at(0.071), 0.024, 2.75, 0.021);
      }
      for (const [y, w, h, d, mat] of [
        [0.055, 0.29, 0.11, 0.15, M.white], [0.14, 0.25, 0.06, 0.12, inset],
        [0.187, 0.215, 0.028, 0.098, M.gold], [3.105, 0.22, 0.052, 0.105, M.gold],
        [3.163, 0.27, 0.065, 0.14, M.white], [3.222, 0.32, 0.054, 0.18, M.white]
      ]) {
        trim(mat, x, y, at(d / 2), w, h, d);
      }
    }

    for (const win of WIN) {
      // 拱冠的楔石和窗楣端面在庭院角度也能看见。
      const key = new THREE.Shape();
      key.moveTo(-0.049, 0); key.lineTo(0.049, 0);
      key.lineTo(0.082, 0.154); key.lineTo(-0.082, 0.154); key.closePath();
      const geo = new THREE.ExtrudeGeometry(key, {
        depth: 0.045, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.007, bevelThickness: 0.007
      });
      add(geo, M.white, win.cx, win.top + 0.04, at(0.042) - (side < 0 ? 0.045 : 0), { cast: false }).userData.noHit = true;
      if (side < 0) {
        // 外侧门窗嵌套双层拱框，露出墙洞的厚度。
        for (const [r, tube, mat] of [[win.r + 0.034, 0.032, M.white], [win.r + 0.085, 0.013, M.gold]]) {
          add(new THREE.TorusGeometry(r, tube, 8, 32, Math.PI), mat, win.cx, win.ys, at(0.035), { cast: false }).userData.noHit = true;
          for (const sign of [-1, 1]) {
            trim(mat, win.cx + sign * r, (win.y0 + win.ys) / 2, at(0.035), tube * 2, win.ys - win.y0, tube * 2);
          }
        }
        if (win.cx) trim(M.white, win.cx, win.y0 + 0.005, at(0.052), win.w + 0.25, 0.062, 0.13);
      }
    }
  }

  const length = D + FRONT;
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.055);
    trim(inset, x, 0.149, (FRONT - D) / 2, 0.07, 0.035, length);
    trim(M.white, x, 0.869, (FRONT - D) / 2, 0.066, 0.035, length);
    trim(M.gold, x, H - 0.275, (FRONT - D) / 2, 0.046, 0.024, length);
  }

  const transform = new THREE.Object3D();
  for (const [mat, pieces] of batches) {
    const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, pieces.length);
    pieces.forEach(([x, y, z, w, h, d], i) => {
      transform.position.set(x, y, z);
      transform.scale.set(w, h, d);
      transform.updateMatrix();
      batch.setMatrixAt(i, transform.matrix);
    });
    batch.receiveShadow = true;
    batch.userData.noHit = true;
    scene.add(batch);
  }
}
