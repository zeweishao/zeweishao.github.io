import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * A local, real-model viewer. No placeholder geometry represents a character.
 *
 * onStatus({ state, message, progress? })
 * onAnimations([{ name, duration, index }])
 * onAnimationEnd({ name, state, time, duration, playing, paused, ended })
 * onError(Error)
 * doubleSided: true opts into two-sided rendering for converted thin surfaces.
 *
 * load(url) and loadFile(file) resolve to the current model's metadata.
 * Loading prepares a still pose. play() starts from the beginning; resume()
 * continues a manually paused action. setVisible(false) suspends rendering.
 */
export class FigureViewer {
  constructor(container, options = {}) {
    if (!container || typeof container.appendChild !== 'function') {
      throw new TypeError('FigureViewer 需要一个有效的页面容器。');
    }

    this.container = container;
    this.options = options;
    this.disposed = false;
    this.model = null;
    this.modelRoot = null;
    this.mixer = null;
    this.activeAction = null;
    this.activeAnimation = null;
    this.animations = [];
    this.clips = new Map();
    this.paused = true;
    this.playbackState = 'empty';
    this.visible = true;
    this.metadata = null;
    this.modelBounds = null;
    this.frameDistance = null;
    this.loadId = 0;
    this.elapsedAt = null;
    this.animationFrame = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    this.camera.position.set(0, 1.7, 7);

    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (cause) {
      const error = new Error('无法启用 WebGL，3D 查看器未能启动。请检查浏览器的硬件加速设置。', { cause });
      this._emit('onError', error);
      throw error;
    }

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral keeps the painted anime colours; ACES pushed skin towards grey.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'figure-viewer-canvas';
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    this.renderer.domElement.setAttribute('aria-label', '3D 手办查看器，拖动旋转，滚轮或双指缩放');
    this.renderer.domElement.setAttribute('role', 'img');
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = Math.PI * 0.13;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 15;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.target.set(0, 1.65, 0);
    this.controls.update();
    this.controls.saveState();

    this.scene.add(new THREE.HemisphereLight(0xe8f3ff, 0x4d3930, 1.05));
    const key = new THREE.DirectionalLight(0xffe6c6, 1.6);
    key.position.set(-3.4, 6.8, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
    key.target.position.set(0, 1.4, 0);
    this.scene.add(key, key.target);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0xaec5f5, 0.75);
    fill.position.set(4, 3.2, -2.5);
    this.scene.add(fill);

    // Environment lighting leaves the user's original PBR materials intact.
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(room, 0.06);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.7;
    room.dispose();
    pmrem.dispose();

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ color: 0x171018, opacity: 0.3 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.012;
    this.ground.receiveShadow = true;
    this.ground.visible = false;
    this.scene.add(this.ground);

    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this._tick = this._tick.bind(this);
    this.onVisibilityChange = () => {
      this.elapsedAt = null;
      if (document.hidden) this._cancelFrame();
      else this._scheduleFrame();
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
    this._scheduleFrame();
    this._status('empty', '等待导入 3D 模型');
  }

  /** Load a GLB or a GLTF URL. Linked GLTF resources resolve beside that URL. */
  /**
   * The game draws these figures with Unity toon shaders: shading is painted into the
   * base colour and the "_m" masks are not physical metal/roughness maps. Read as PBR,
   * skin turns metallic and grey. For skin, face, hair and body materials we drop the
   * metal reading and let a share of the painted colour show unlit; other parts
   * (weapons, mechs, accessories) keep their original material.
   */
  _applyAnimeLook(mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material?.isMeshStandardMaterial || material.userData.animeLook) continue;
      const name = (material.name || '') + ' ' + (mesh.name || '');
      if (!/face|skin|hair|hiar|body|head|eye|brow|cloth/i.test(name)) continue;
      material.metalness = 0;
      material.metalnessMap = null;
      material.roughness = 0.9;
      material.roughnessMap = null;
      if (material.map) {
        material.emissiveMap = material.map;
        material.emissive.setRGB(1, 1, 1);
        material.emissiveIntensity = 0.45;
        material.color.multiplyScalar(0.7);
      }
      material.userData.animeLook = true;
      material.needsUpdate = true;
    }
  }

  async load(url) {
    this._assertActive();
    if (typeof url !== 'string' || !url.trim()) {
      return this._reject(new Error('请选择有效的 .glb 或 .gltf 模型地址。'));
    }

    const requestId = ++this.loadId;
    this._status('loading', '正在加载 3D 模型…', 0);
    try {
      const gltf = await this.loader.loadAsync(url, (event) => {
        if (requestId !== this.loadId || this.disposed) return;
        const progress = event.total > 0 ? Math.min(event.loaded / event.total, 1) : undefined;
        this._status('loading', '正在加载 3D 模型…', progress);
      });

      if (requestId !== this.loadId || this.disposed) {
        this._disposeObject(gltf.scene);
        const error = new Error('本次模型加载已取消。');
        error.name = 'AbortError';
        throw error;
      }

      const root = gltf.scene;
      if (!root) throw new Error('文件中没有可展示的 3D 场景。');
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      if (box.isEmpty() || !Number.isFinite(size.length()) || size.length() < 0.000001) {
        this._disposeObject(root);
        throw new Error('模型没有可见的网格，或模型尺寸无效。');
      }

      this._clearModel();
      const center = box.getCenter(new THREE.Vector3());
      const scale = 3.6 / Math.max(size.y, size.x * 0.7, size.z * 0.7, 0.000001);
      const wrapper = new THREE.Group();
      wrapper.name = 'FigureViewerModel';
      wrapper.scale.setScalar(scale);
      wrapper.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      wrapper.add(root);
      root.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          // Prepared-pose bounds must not clip limbs during a later action.
          if (object.isSkinnedMesh) object.frustumCulled = false;
          this._applyAnimeLook(object);
          // Some Unity exports omit the culling flag on hair and cloth cards.
          // This is an explicit import adaptation; the default honors GLTF.
          if (this.options.doubleSided === true) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (material && material.side !== THREE.DoubleSide) {
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
              }
            }
          }
        }
      });
      this.scene.add(wrapper);
      this.model = wrapper;
      this.modelRoot = root;
      wrapper.updateMatrixWorld(true);
      this.modelBounds = new THREE.Box3().setFromObject(wrapper);
      this.ground.visible = true;
      this.mixer = new THREE.AnimationMixer(root);
      this.mixer.addEventListener('finished', ({ action }) => {
        if (action !== this.activeAction) return;
        this.paused = true;
        this.playbackState = 'ended';
        this._emit('onAnimationEnd', this.getPlaybackState());
      });
      this.paused = true;
      this.playbackState = 'static';

      const usedNames = new Set();
      this.animations = (gltf.animations || []).flatMap((clip, index) => {
        if (!clip.tracks.length || !Number.isFinite(clip.duration) || clip.duration <= 0) return [];
        const baseName = clip.name || `动作 ${index + 1}`;
        let name = baseName;
        let suffix = 2;
        while (usedNames.has(name)) name = `${baseName} (${suffix++})`;
        usedNames.add(name);
        this.clips.set(name, clip);
        return [{ name, duration: clip.duration, index, loop: clip.userData?.loop !== false }];
      });

      this.metadata = {
        name: root.name || '导入的手办',
        animations: this.animations.map((entry) => ({ ...entry })),
        dimensions: { x: size.x, y: size.y, z: size.z },
        hasAnimations: this.animations.length > 0,
      };
      if (this.animations.length) {
        const entrance = this.animations.find((entry) => /show_?fall|appear|entrance|登场/i.test(entry.name));
        const initial = entrance || this.animations.find((entry) => /idle|待机/i.test(entry.name)) || this.animations[0];
        this.metadata.initialPose = this.preparePose(initial.name, entrance ? 'end' : 0);
        // A skinned model must be framed and grounded in its prepared pose,
        // rather than the unanimated bind pose used to validate the file.
        this._refreshModelBounds(true);
      }
      this._frameModel();
      this._emit('onAnimations', this.metadata.animations);
      this._status('ready', this.animations.length
        ? `3D 模型已就绪 · ${this.animations.length} 个动作，点击播放`
        : '3D 模型已就绪 · 此文件未包含动作');
      return this.metadata;
    } catch (cause) {
      if (cause.name === 'AbortError' || requestId !== this.loadId || this.disposed) throw cause;
      let detail = cause.message || String(cause);
      if (/DRACO|KTX2|Meshopt/i.test(detail)) {
        detail = '模型使用了当前原型未配置的压缩格式，请导出为未使用 Draco、Meshopt 或 KTX2 压缩的 GLB。';
      } else if (/fetch|404|Failed to load|NetworkError/i.test(detail)) {
        detail = '无法读取模型或它的关联资源，请检查文件地址及访问权限。';
      }
      const error = new Error(`3D 模型加载失败：${detail}`, { cause });
      this._status('error', error.message);
      this._emit('onError', error);
      throw error;
    }
  }

  /** A single GLB keeps local models and textures entirely in this browser. */
  async loadFile(file) {
    this._assertActive();
    if (!(file instanceof Blob) || !/\.glb$/i.test(file.name || '')) {
      return this._reject(new Error('本地导入请使用 .glb 文件，并将贴图嵌入文件。'));
    }
    const url = URL.createObjectURL(file);
    try {
      const metadata = await this.load(url);
      this.metadata = { ...metadata, name: file.name.replace(/\.glb$/i, '') };
      return this.metadata;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Invalidate an in-flight load when switching to another skin or 2D art. */
  cancelLoad() {
    this._assertActive();
    ++this.loadId;
  }

  /** Start an embedded clip from its first frame after an explicit user action. */
  play(name = this.activeAnimation || this.animations[0]?.name) {
    this._assertActive();
    const clip = this.clips.get(name);
    if (!this.mixer || !clip) {
      return this._reject(new Error(this.model
        ? '这个模型没有所选动作，请选择文件自带的动作。'
        : '请先导入带动作的 3D 模型。'));
    }

    const next = this.mixer.clipAction(clip);
    if (this.activeAction) {
      // Stop old clips explicitly: switching cannot accumulate running actions.
      this.activeAction.stop();
    }
    next.reset();
    next.enabled = true;
    next.paused = false;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    const shouldLoop = clip.userData?.loop !== false;
    next.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, shouldLoop ? Infinity : 1);
    next.clampWhenFinished = !shouldLoop;
    next.play();
    this.activeAction = next;
    this.activeAnimation = name;
    this.paused = false;
    this.playbackState = 'playing';
    this.elapsedAt = null;
    this.mixer.update(0);
    return this.getPlaybackState();
  }

  /** Evaluate one genuine animation frame without advancing or emitting end. */
  preparePose(name = this.activeAnimation || this.animations[0]?.name, time = 'end') {
    this._assertActive();
    const clip = this.clips.get(name);
    if (!this.mixer || !clip) {
      return this._reject(new Error('请为静置姿态选择模型包含的真实动作。'));
    }
    if (time !== 'end' && (typeof time !== 'number' || !Number.isFinite(time))) {
      return this._reject(new Error('姿态时间须为秒数或 end。'));
    }
    if (this.activeAction) this.activeAction.stop();
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.time = time === 'end' ? clip.duration : THREE.MathUtils.clamp(time, 0, clip.duration);
    action.paused = true;
    this.activeAction = action;
    this.activeAnimation = name;
    this.paused = true;
    this.playbackState = 'posed';
    this.elapsedAt = null;
    this.mixer.update(0);
    this.model?.updateMatrixWorld(true);
    return this.getPlaybackState();
  }

  pose(name, time = 'end') {
    return this.preparePose(name, time);
  }

  pause() {
    this._assertActive();
    if (this.activeAction && this.playbackState === 'playing') {
      this.paused = true;
      this.activeAction.paused = true;
      this.playbackState = 'paused';
    }
    return this.getPlaybackState();
  }

  /** Resume only a manually paused action; an ended/posed action stays still. */
  resume() {
    this._assertActive();
    if (this.activeAction && this.playbackState === 'paused') {
      this.activeAction.paused = false;
      this.paused = false;
      this.playbackState = 'playing';
      this.elapsedAt = null;
    }
    return this.getPlaybackState();
  }

  getPlaybackState() {
    const clip = this.clips.get(this.activeAnimation);
    return {
      name: this.activeAnimation,
      state: this.playbackState,
      time: this.activeAction?.time || 0,
      duration: clip?.duration || 0,
      loop: clip ? clip.userData?.loop !== false : false,
      playing: this.playbackState === 'playing',
      paused: this.playbackState === 'paused',
      ended: this.playbackState === 'ended',
    };
  }

  /** Suspend GPU work in 2D mode, preserving the exact pose and playback time. */
  setVisible(visible) {
    this._assertActive();
    this.visible = Boolean(visible);
    this.renderer.domElement.hidden = !this.visible;
    this.renderer.domElement.style.display = this.visible ? 'block' : 'none';
    this.controls.enabled = this.visible;
    this.elapsedAt = null;
    if (this.visible) {
      this.resize();
      this._scheduleFrame();
    } else {
      this._cancelFrame();
    }
    return { visible: this.visible, ...this.getPlaybackState() };
  }

  /** Restore the camera framing without changing the selected animation. */
  reset() {
    this._assertActive();
    this.controls.reset();
    this.controls.update();
    return { hasModel: Boolean(this.model), autoRotate: this.controls.autoRotate };
  }

  setAutoRotate(enabled) {
    this._assertActive();
    this.controls.autoRotate = Boolean(enabled);
    return this.controls.autoRotate;
  }

  resize() {
    if (this.disposed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!this.visible) return { width, height };
    // A hidden panel must not replace useful framing with a 1 px viewport.
    if (width < 1 || height < 1) return { width, height };
    const oldAspect = this.camera.aspect;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    // CSS transitions resize in small steps; preserve the orbit and zoom while
    // adapting every aspect-ratio change instead of missing those small steps.
    if (this.model && Math.abs(oldAspect - this.camera.aspect) > 0.0001) this._frameModel(true);
    return { width, height };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.loadId;
    this._cancelFrame();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.controls.dispose();
    this._clearModel();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.keyLight.shadow.map?.dispose();
    this.environmentTarget.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  _frameModel(preserveView = false) {
    if (!this.model) return;
    // Stable imported bounds avoid moving the camera with animated limbs.
    const box = this.modelBounds;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const previousOffset = this.camera.position.clone().sub(this.controls.target);
    const zoomRatio = this.frameDistance ? previousOffset.length() / this.frameDistance : 1;
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const fitHeight = size.y / (2 * Math.tan(verticalFov / 2));
    const fitWidth = Math.max(size.x, size.z) / (2 * Math.tan(horizontalFov / 2));
    const distance = Math.max(fitHeight, fitWidth, 2.2) * 1.18 + size.z / 2;
    this.camera.near = 0.01;
    this.camera.far = Math.max(100, distance * 15);
    this.camera.position.set(center.x, center.y + distance * 0.07, center.z + distance);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.minDistance = Math.max(size.length() * 0.38, 0.8);
    this.controls.maxDistance = distance * 2.5;
    this.frameDistance = this.camera.position.distanceTo(center);
    // Save a front-facing reset view even when preserving a user's orbit.
    this.controls.saveState();
    if (preserveView && previousOffset.lengthSq() > 0) {
      const targetDistance = THREE.MathUtils.clamp(
        this.frameDistance * zoomRatio,
        this.controls.minDistance,
        this.controls.maxDistance,
      );
      this.camera.position.copy(center).add(previousOffset.normalize().multiplyScalar(targetDistance));
    }
    this.controls.update();
  }

  _refreshModelBounds(groundModel = false) {
    if (!this.model) return;
    this.model.updateMatrixWorld(true);
    this.model.traverse((object) => {
      if (object.isSkinnedMesh) {
        object.computeBoundingBox();
        object.computeBoundingSphere();
      }
    });
    const bounds = new THREE.Box3().setFromObject(this.model);
    if (groundModel) {
      const center = bounds.getCenter(new THREE.Vector3());
      const offset = new THREE.Vector3(-center.x, -bounds.min.y, -center.z);
      this.model.position.add(offset);
      this.model.updateMatrixWorld(true);
      bounds.translate(offset);
    }
    this.modelBounds = bounds;
  }

  _clearModel() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.modelRoot) this.mixer.uncacheRoot(this.modelRoot);
    }
    if (this.model) {
      this.scene.remove(this.model);
      this._disposeObject(this.model);
    }
    this.model = null;
    this.modelRoot = null;
    this.mixer = null;
    this.activeAction = null;
    this.activeAnimation = null;
    this.paused = true;
    this.playbackState = 'empty';
    this.clips.clear();
    this.animations = [];
    this.metadata = null;
    this.modelBounds = null;
    this.frameDistance = null;
    this.ground.visible = false;
  }

  _disposeObject(root) {
    if (!root) return;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const images = new Set();
    const skeletons = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of entries) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    });
    textures.forEach((texture) => {
      const source = texture.source?.data || texture.image;
      for (const bitmap of Array.isArray(source) ? source : [source]) {
        if (bitmap && typeof bitmap.close === 'function') images.add(bitmap);
      }
      texture.dispose();
    });
    // GLTFLoader can decode textures as ImageBitmap; disposing the GPU texture
    // does not release those CPU-side images when browsing many characters.
    images.forEach((bitmap) => bitmap.close());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    skeletons.forEach((skeleton) => skeleton.dispose());
  }

  _tick(timestamp) {
    this.animationFrame = 0;
    if (this.disposed || !this.visible || document.hidden) return;
    const delta = this.elapsedAt === null ? 0 : Math.min((timestamp - this.elapsedAt) / 1000, 0.08);
    this.elapsedAt = timestamp;
    if (this.mixer && !this.paused) this.mixer.update(delta);
    this.controls.update(delta);
    this.renderer.render(this.scene, this.camera);
    this._scheduleFrame();
  }

  _scheduleFrame() {
    if (!this.animationFrame && !this.disposed && this.visible && !document.hidden) {
      this.animationFrame = requestAnimationFrame(this._tick);
    }
  }

  _cancelFrame() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.elapsedAt = null;
  }

  _emit(callback, value) {
    if (typeof this.options[callback] === 'function') this.options[callback](value);
  }

  _status(state, message, progress) {
    this._emit('onStatus', { state, message, ...(progress === undefined ? {} : { progress }) });
  }

  _reject(error) {
    this._emit('onError', error);
    throw error;
  }

  _assertActive() {
    if (this.disposed) throw new Error('3D 查看器已关闭，请重新创建。');
  }
}

export default FigureViewer;
