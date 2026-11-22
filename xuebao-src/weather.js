/* 天气：雨、雪（只在屋外，屋里看得到门外在下）。
 * 雨丝、雪花都在着色器里自己落、跟着镜头焦点平移，不用每帧改顶点；
 * 地上溅起小水花，下雪时屋外朝上的表面慢慢积一层白（给所有标准材质注入一小段着色器）。
 */
export function buildWeather(THREE, scene, { Z0, mobile, heightAt }) {
  const center = new THREE.Vector3(), timeU = { value: 0 }, centerU = { value: center }, z0U = { value: Z0 };
  // ---------- 雨丝 ----------
  const RN = mobile ? 1400 : 2600, BOX = 18, H = 9;
  const rSeed = new Float32Array(RN * 2 * 3), rEnd = new Float32Array(RN * 2);
  for (let i = 0; i < RN; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); rSeed.set([a, b, c, a, b, c], i * 6); rEnd[i * 2 + 1] = 1; }
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RN * 6), 3)); rGeo.setAttribute("aSeed", new THREE.BufferAttribute(rSeed, 3)); rGeo.setAttribute("aEnd", new THREE.BufferAttribute(rEnd, 1));
  const rainOp = { value: 0 };
  const wrap = `vec2 wrapXZ(vec2 s, float box) { vec2 p = s * box; return uCenter.xz + mod(p - uCenter.xz + box * 0.5, box) - box * 0.5; }`;
  const rain = new THREE.LineSegments(rGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: timeU, uCenter: centerU, uZ0: z0U, uOp: rainOp },
    vertexShader: `uniform float uTime; uniform vec3 uCenter; attribute vec3 aSeed; attribute float aEnd; varying float vEnd; varying float vZ; varying float vFade;
      ${wrap}
      void main() { vec2 xz = wrapXZ(aSeed.xz, ${BOX.toFixed(1)}); float sp = 9.0 + aSeed.x * 3.0; float y = mod(aSeed.y * ${H.toFixed(1)} - uTime * sp, ${H.toFixed(1)}) - 1.5;
        vec3 p = vec3(xz.x + aEnd * 0.035, y + aEnd * (0.22 + aSeed.z * 0.12), xz.y);
        vEnd = aEnd; vZ = p.z; vFade = 1.0 - smoothstep(${(BOX * 0.32).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, distance(p.xz, uCenter.xz));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uOp; uniform float uZ0; varying float vEnd; varying float vZ; varying float vFade;
      void main() { if (vZ > uZ0) discard; gl_FragColor = vec4(0.86, 0.9, 0.97, uOp * vFade * (0.15 + 0.6 * vEnd)); }`,
    transparent: true, depthWrite: false
  }));
  rain.frustumCulled = false; rain.renderOrder = 5; scene.add(rain);
  // ---------- 溅起的小水花（地面上一圈圈小白环） ----------
  const SN = mobile ? 70 : 130, sPos = new Float32Array(SN * 3), sLife = new Float32Array(SN).map(() => Math.random());
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute("aLife", new THREE.BufferAttribute(sLife, 1));
  const splash = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    uniforms: { uOp: rainOp, uScale: { value: 300 } },
    vertexShader: `attribute float aLife; varying float vL; uniform float uScale; void main() { vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uScale * (0.03 + aLife * 0.09) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOp; varying float vL; void main() { vec2 d = gl_PointCoord - 0.5; d.y *= 2.2; float r = length(d) * 2.0; if (r > 1.0) discard; float ring = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r)); gl_FragColor = vec4(0.92, 0.95, 1.0, ring * uOp * (1.0 - vL) * 1.2); }`,
    transparent: true, depthWrite: false
  }));
  splash.frustumCulled = false; splash.renderOrder = 5; scene.add(splash);
  // ---------- 雪花 ----------
  const NN = mobile ? 1600 : 3200, nSeed = new Float32Array(NN * 3).map(() => Math.random());
  const nGeo = new THREE.BufferGeometry(); nGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NN * 3), 3)); nGeo.setAttribute("aSeed", new THREE.BufferAttribute(nSeed, 3));
  const snowOp = { value: 0 }, scaleU = { value: 300 };
  const snow = new THREE.Points(nGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: timeU, uCenter: centerU, uZ0: z0U, uOp: snowOp, uScale: scaleU },
    vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uScale; attribute vec3 aSeed; varying float vZ; varying float vFade;
      ${wrap}
      void main() { float t = uTime; vec2 s = aSeed.xz + vec2(sin(t * 0.25 + aSeed.y * 30.0) * 0.012 + t * 0.004, cos(t * 0.21 + aSeed.x * 20.0) * 0.01);
        vec2 xz = wrapXZ(s, ${BOX.toFixed(1)}); float y = mod(aSeed.y * ${H.toFixed(1)} - t * (0.45 + aSeed.z * 0.45), ${H.toFixed(1)}) - 1.2;
        vec3 p = vec3(xz.x, y, xz.y); vZ = p.z; vFade = 1.0 - smoothstep(${(BOX * 0.3).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, distance(p.xz, uCenter.xz));
        vec4 mv = viewMatrix * vec4(p, 1.0); gl_PointSize = uScale * (0.035 + aSeed.z * 0.03) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOp; uniform float uZ0; varying float vZ; varying float vFade;
      void main() { if (vZ > uZ0) discard; float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, uOp * vFade * (1.0 - smoothstep(0.35, 1.0, r))); }`,
    transparent: true, depthWrite: false
  }));
  snow.frustumCulled = false; snow.renderOrder = 5; scene.add(snow);

  // ---------- 积雪：给屋外的标准材质注入一小段着色器（朝上的面慢慢变白） ----------
  const snowU = { value: 0 };
  function snowify(mat) {
    if (!mat || mat.userData.snowy || !mat.isMeshStandardMaterial || mat.transparent) return;
    mat.userData.snowy = true;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, r) => {
      prev?.call(mat, sh, r);
      sh.uniforms.uSnow = snowU; sh.uniforms.uSnowZ = z0U;
      sh.vertexShader = "varying vec3 vSnowW;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n{ vec4 sp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n sp = instanceMatrix * sp;\n#endif\n vSnowW = (modelMatrix * sp).xyz; }");
      sh.fragmentShader = "uniform float uSnow; uniform float uSnowZ; varying vec3 vSnowW;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n{ vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz); float sk = uSnow * smoothstep(0.3, 0.75, wn.y) * step(vSnowW.z, uSnowZ - 0.2) * (0.78 + 0.22 * fract(sin(dot(floor(vSnowW.xz * 18.0), vec2(12.9898, 78.233))) * 43758.5453)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 1.0), sk * 0.9); roughnessFactor = mix(roughnessFactor, 0.95, sk); }");
    };
    mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : "") + "|snow";
    mat.needsUpdate = true;
  }
  function snowifyTree(obj, skip) { const walk = (o) => { if (skip && skip(o)) return; if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(snowify); o.children.forEach(walk); }; walk(obj); }

  // ---------- 下雪天草坪上的小雪人 ----------
  const snowman = new THREE.Group(); const SM = { x: 2.78, z: -9.1 }; snowman.position.set(SM.x, heightAt(SM.x, SM.z), SM.z); snowman.rotation.y = -0.5; scene.add(snowman);
  {
    const white = new THREE.MeshStandardMaterial({ color: "#f8fbff", roughness: 0.95 }), black = new THREE.MeshStandardMaterial({ color: "#2b2430", roughness: 0.3 });
    const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; snowman.add(m); return m; };
    add(new THREE.SphereGeometry(0.2, 24, 18), white, 0, 0.17, 0).scale.y = 0.92;
    add(new THREE.SphereGeometry(0.14, 24, 18), white, 0, 0.44, 0);
    add(new THREE.SphereGeometry(0.105, 24, 18), white, 0, 0.64, 0);
    [-1, 1].forEach((k) => { add(new THREE.SphereGeometry(0.014, 10, 8), black, k * 0.036, 0.67, 0.093, { cast: false }); add(new THREE.CylinderGeometry(0.006, 0.004, 0.2, 5), new THREE.MeshStandardMaterial({ color: "#7b5a43" }), k * 0.18, 0.5, 0, { rz: -k * 1.0 }); });
    const nose = add(new THREE.ConeGeometry(0.018, 0.09, 10), new THREE.MeshStandardMaterial({ color: "#f39a4a", roughness: 0.5 }), 0, 0.635, 0.14, { rx: Math.PI / 2, cast: false });
    for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.012, 8, 6), black, 0, 0.36 + i * 0.07, 0.132 - Math.abs(i - 1) * 0.008, { cast: false });
    const scarf = new THREE.MeshStandardMaterial({ color: "#f08fa6", roughness: 0.85 });
    add(new THREE.TorusGeometry(0.1, 0.026, 8, 24), scarf, 0, 0.55, 0, { rx: Math.PI / 2 });
    add(new THREE.BoxGeometry(0.05, 0.13, 0.02), scarf, 0.06, 0.48, 0.1, { rz: 0.2 });
    add(new THREE.CylinderGeometry(0.075, 0.08, 0.1, 18), new THREE.MeshStandardMaterial({ color: "#c94f6a", roughness: 0.8 }), 0, 0.75, 0, { rz: 0.15 });
    add(new THREE.SphereGeometry(0.03, 10, 8), white, -0.012, 0.815, 0, { rz: 0.15 });
    void nose;
  }
  snowman.visible = false; snowman.scale.setScalar(0.001);

  // ---------- 雪宝的小伞（下雨在屋外时撑起来） ----------
  const umbrella = new THREE.Group(); scene.add(umbrella); umbrella.visible = false;
  {
    const tex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 64; const g = c.getContext("2d"); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#fff5f7" : "#f6a9bd"; g.fillRect(i * 64, 0, 64, 64); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const can = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 10, 0, Math.PI * 2, 0, 1.05), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.6 }));
    can.scale.y = 0.6; can.position.y = 0.58 - 0.42 * 0.6; can.castShadow = true; umbrella.add(can);
    const pos = can.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x); if (y < 0.25) { pos.setY(i, y - 0.025 * (1 - Math.abs(Math.cos(a * 4)))); } } can.geometry.computeVertexNormals();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 8).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: "#f4e9dc", metalness: 0.4, roughness: 0.4 })); umbrella.add(shaft);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: "#e3bf76", metalness: 0.9, roughness: 0.3 })); tip.position.y = 0.62; umbrella.add(tip);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 14, Math.PI), shaft.material); hook.rotation.z = Math.PI; umbrella.add(hook);
  }
  let umbK = 0;

  let k = { rain: 0, snow: 0, acc: 0, sm: 0 };
  function update(dt, t, { rain: wantRain, snow: wantSnow, focus, camera, height, hand, xb, xbOut, ripple }) {
    timeU.value = t; center.set(focus.x, 0, focus.z);
    k.rain += ((wantRain ? 1 : 0) - k.rain) * Math.min(1, dt * 1.2);
    k.snow += ((wantSnow ? 1 : 0) - k.snow) * Math.min(1, dt * 1.0);
    k.acc += ((wantSnow ? 1 : 0) - k.acc) * Math.min(1, dt * (wantSnow ? 0.12 : 0.35)); // 积雪慢慢积起来，雪停了化得快一点
    rainOp.value = k.rain * 0.55; snowOp.value = k.snow * 0.95; snowU.value = k.acc;
    rain.visible = splash.visible = k.rain > 0.01; snow.visible = k.snow > 0.01;
    const sc = height * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2); scaleU.value = sc; splash.material.uniforms.uScale.value = sc;
    if (splash.visible) {
      for (let i = 0; i < SN; i++) {
        sLife[i] += dt * 2.6;
        if (sLife[i] >= 1) { sLife[i] = 0; let x = 0, z = 0; for (let tries = 0; tries < 4; tries++) { x = focus.x + (Math.random() - 0.5) * 9; z = focus.z + (Math.random() - 0.5) * 9; if (z < Z0 - 0.3) break; } if (z >= Z0 - 0.3) { sPos[i * 3 + 1] = -50; continue; } sPos.set([x, heightAt(x, z) + 0.015, z], i * 3); }
      }
      sGeo.attributes.position.needsUpdate = sGeo.attributes.aLife.needsUpdate = true;
      if (ripple && Math.random() < dt * 5 * k.rain) ripple();
    }
    // 雪人：积雪多了才冒出来
    k.sm += ((k.acc > 0.55 ? 1 : 0) - k.sm) * Math.min(1, dt * 2.5); snowman.visible = k.sm > 0.01; if (snowman.visible) snowman.scale.setScalar(Math.max(0.001, k.sm));
    // 伞：跟着右手，伞杆始终竖着
    umbK += (((wantRain && xbOut) ? 1 : 0) - umbK) * Math.min(1, dt * 5);
    umbrella.visible = umbK > 0.02 && !!hand;
    if (umbrella.visible) { hand.getWorldPosition(umbrella.position); if (xb) { umbrella.position.x += (xb.position.x - umbrella.position.x) * 0.55; umbrella.position.z += (xb.position.z - umbrella.position.z) * 0.55; } umbrella.position.y += 0.26; umbrella.scale.setScalar(umbK * (xb ? xb.scale.y / 0.9 : 1)); umbrella.rotation.set(0, xb ? xb.rotation.y : 0, -0.12); }
  }
  return { update, snowifyTree, snowman: SM, umbrellaOn: () => umbK > 0.5 };
}
