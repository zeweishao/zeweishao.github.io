import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function buildRoomProps(THREE) {
  const material = (color, roughness = 0.65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const gold = material("#c9a26b", 0.35, 0.64);
  const walnut = material("#9d6145"), rose = material("#c38683");
  const paper = material("#fff1d8"), porcelain = material("#f4c1bb", 0.26);
  const dark = material("#4a3e32", 0.86), pale = material("#eee0bc");
  const ink = material("#998277");
  function piece(g, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m);
    return m;
  }
  function box(g, w, h, d, r, mat, x, y, z) {
    return piece(g, new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z);
  }
  function dial(g, r, d, mat, x, y, z) {
    return piece(g, new THREE.CylinderGeometry(r, r, d, 18).rotateX(Math.PI / 2), mat, x, y, z);
  }
  function radio() {
    const g = new THREE.Group(); g.name = "radioModel";
    box(g, 0.255, 0.146, 0.132, 0.018, walnut, 0, 0.081, 0);
    box(g, 0.225, 0.112, 0.014, 0.008, pale, 0, 0.083, 0.068);
    box(g, 0.104, 0.078, 0.006, 0.004, dark, -0.048, 0.082, 0.077);
    for (let i = 0; i < 7; i++) {
      box(g, 0.092, 0.0038, 0.003, 0.001, gold, -0.048, 0.055 + i * 0.009, 0.081);
    }
    box(g, 0.071, 0.026, 0.008, 0.004, dark, 0.061, 0.108, 0.078);
    box(g, 0.059, 0.003, 0.002, 0.001, gold, 0.061, 0.107, 0.084);
    box(g, 0.003, 0.014, 0.002, 0.001, rose, 0.073, 0.11, 0.086);
    dial(g, 0.015, 0.012, gold, 0.045, 0.062, 0.084);
    dial(g, 0.009, 0.012, walnut, 0.081, 0.062, 0.084);
    for (const x of [-0.088, 0.088]) box(g, 0.031, 0.012, 0.092, 0.003, dark, x, 0.006, 0);
    return g;
  }
  function cardbox() {
    const g = new THREE.Group(); g.name = "postcardBoxModel";
    box(g, 0.208, 0.024, 0.115, 0.005, walnut, 0, 0.013, 0);
    box(g, 0.209, 0.087, 0.015, 0.005, rose, 0, 0.053, 0.05);
    box(g, 0.209, 0.109, 0.014, 0.004, walnut, 0, 0.061, -0.05);
    for (const side of [-1, 1]) {
      box(g, 0.014, 0.089, 0.109, 0.005, walnut, 0.099 * side, 0.053, 0);
      dial(g, 0.007, 0.004, gold, 0.084 * side, 0.04, 0.061);
    }
    for (let i = 0; i < 4; i++) {
      const card = box(g, 0.146, 0.092, 0.004, 0.0018, i % 2 ? paper : pale, 0.012 * Math.sin(i), 0.093 + i * 0.011, 0.021 - i * 0.018);
      card.rotation.set(-0.15, 0, (i - 1) * 0.066);
    }
    box(g, 0.066, 0.026, 0.005, 0.002, gold, 0, 0.055, 0.061);
    box(g, 0.048, 0.015, 0.003, 0.001, paper, 0, 0.055, 0.065);
    return g;
  }
  function table(g, z) {
    const set = new THREE.Group(); set.name = "teaTableDetails"; set.position.set(0, 0.305, z); g.add(set);
    const cup = new THREE.Group(); cup.position.set(0.164, 0, -0.17); set.add(cup);
    const lathe = (points) => new THREE.LatheGeometry(points.map(([x,y]) => new THREE.Vector2(x,y)), 28);
    piece(cup, lathe([[0,0],[0.053,0],[0.069,0.01],[0.067,0.017],[0.024,0.013],[0,0.013]]), porcelain, 0, 0, 0);
    piece(cup, lathe([[0,0],[0.027,0],[0.034,0.03],[0.041,0.079],[0.035,0.079],[0.033,0.052],[0.023,0.018],[0,0.018]]), porcelain, 0, 0.013, 0);
    piece(cup, new THREE.TorusGeometry(0.021, 0.0048, 7, 18), porcelain, 0.035, 0.06, 0);
    piece(cup, new THREE.CircleGeometry(0.034, 24).rotateX(-Math.PI / 2), material("#be875e", 0.34), 0, 0.081, 0);

    const book = new THREE.Group(); book.position.set(-0.105, 0.003, 0.147); book.rotation.y = -0.25; set.add(book);
    box(book, 0.175, 0.009, 0.113, 0.003, rose, 0, 0.005, 0);
    for (const side of [-1, 1]) {
      const page = new THREE.Group(); page.position.set(side * 0.04, 0.012 + (side > 0 ? 0.004 : 0), 0);
      page.rotation.z = side === 1 ? 0.16 : -0.04; book.add(page);
      box(page, 0.08, 0.01, 0.104, 0.002, paper, 0, 0, 0);
      for (let i = 0; i < 5; i++) box(page, 0.05 - (i % 2) * 0.008, 0.0013, 0.0023, 0.0004, ink, 0, 0.0055, -0.036 + i * 0.014);
    }
    const postcard = new THREE.Group(); postcard.position.set(0.13, 0.004, 0.079); postcard.rotation.y = -0.45; set.add(postcard);
    box(postcard, 0.081, 0.004, 0.054, 0.001, paper, 0, 0, 0);
    box(postcard, 0.022, 0.0015, 0.019, 0.0005, rose, 0.023, 0.0023, -0.013);
    for (let i = 0; i < 3; i++) box(postcard, 0.034, 0.0015, 0.0017, 0.0004, ink, -0.014, 0.0023, -0.01 + i * 0.008);
  }
  return { radio, cardbox, table };
}
