import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const EARTH_RADIUS = 2.6;
const EARTH_MAP_URL = "/earth-map.jpg";

function latLonToVector3(lat, lon, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export default function App() {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const featuresRef = useRef(null);
  const modelSectionRef = useRef(null);
  const labelRef = useRef(null);
  const mapRef = useRef(null);
  const infoRef = useRef(null);
  const rendererRef = useRef(null);
  const [isPinned, setIsPinned] = useState(false);
  const pinnedRef = useRef(false);
  const canClickRef = useRef(false);

  useEffect(() => {
    pinnedRef.current = isPinned;
  }, [isPinned]);

  useEffect(() => {
    if (!stageRef.current) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x03040b, 14, 44);

    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    camera.position.set(0, 4.8, 8.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    const { clientWidth, clientHeight } = stageRef.current;
    renderer.setSize(clientWidth, clientHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stageRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI * 0.7;

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(6, 4, 8);
    scene.add(sun);

    const texLoader = new THREE.TextureLoader();
    const mapTex = texLoader.load(EARTH_MAP_URL, () => {
      renderer.render(scene, camera);
    });
    mapTex.colorSpace = THREE.SRGBColorSpace;
    mapTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 192, 192);
    const earthMat = new THREE.MeshStandardMaterial({
      map: mapTex,
      roughness: 0.9,
      metalness: 0.05,
      bumpMap: mapTex,
      bumpScale: 0.08,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    const atmosphereGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.04, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float intensity = pow(0.55 - dot(vNormal, vViewDir), 2.0);
          vec3 glow = vec3(0.25, 0.55, 1.0) * intensity;
          gl_FragColor = vec4(glow, intensity);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphere);

    const starsGeo = new THREE.BufferGeometry();
    const starCount = 5200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const r = 30 + Math.random() * 70;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;
    }
    starsGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starsMat = new THREE.PointsMaterial({
      color: 0xdff0ff,
      size: 0.28,
      sizeAttenuation: true,
      opacity: 0.95,
      transparent: true,
      depthWrite: false,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // sparkle lights removed

    const planetGroup = new THREE.Group();
    scene.add(planetGroup);

    const planets = [
      {
        radius: 0.48,
        color: 0xffb06a,
        emissive: 0x3a1c08,
        distance: 8.5,
        speed: 0.06,
        tilt: 0.2,
        y: 2.2,
        stripes: true,
      },
      {
        radius: 0.36,
        color: 0x8fdcff,
        emissive: 0x0b1c2f,
        distance: 10.5,
        speed: 0.04,
        tilt: -0.25,
        y: -1.4,
        crater: true,
      },
      {
        radius: 0.6,
        color: 0xcbb7ff,
        emissive: 0x1a0f33,
        distance: 12.2,
        speed: 0.03,
        tilt: 0.1,
        y: 0.6,
        ring: true,
        bands: true,
      },
    ];

    const planetMeshes = planets.map((data) => {
      const geom = new THREE.SphereGeometry(data.radius, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: data.color,
        emissive: data.emissive,
        emissiveIntensity: 0.35,
        roughness: 0.6,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { ...data, angle: Math.random() * Math.PI * 2 };
      planetGroup.add(mesh);

      if (data.stripes) {
        const stripeTex = (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          for (let y = 0; y < 64; y += 8) {
            const shade = 200 + Math.floor(Math.random() * 40);
            ctx.fillStyle = `rgb(${shade}, ${150 + y}, ${90 + y})`;
            ctx.fillRect(0, y, 128, 6);
          }
          return new THREE.CanvasTexture(canvas);
        })();
        if (stripeTex) {
          stripeTex.wrapS = THREE.RepeatWrapping;
          stripeTex.wrapT = THREE.RepeatWrapping;
          stripeTex.repeat.set(2, 1);
          mesh.material.map = stripeTex;
          mesh.material.needsUpdate = true;
          mesh.userData.stripeTex = stripeTex;
        }
      }

      if (data.crater) {
        const craterTex = (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.fillStyle = "#8fdcff";
          ctx.fillRect(0, 0, 128, 128);
          for (let i = 0; i < 30; i += 1) {
            const x = Math.random() * 128;
            const y = Math.random() * 128;
            const r = 4 + Math.random() * 10;
            ctx.fillStyle = "rgba(20,40,70,0.4)";
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
          return new THREE.CanvasTexture(canvas);
        })();
        if (craterTex) {
          mesh.material.map = craterTex;
          mesh.material.needsUpdate = true;
          mesh.userData.craterTex = craterTex;
        }
      }

      if (data.ring) {
        const ringGeom = new THREE.RingGeometry(
          data.radius * 1.2,
          data.radius * 1.8,
          64,
        );
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x9bb6ff,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI * 0.45;
        mesh.add(ring);
        mesh.userData.ring = ring;
      }

      return mesh;
    });

    // nebula clouds removed

    const rakVector = latLonToVector3(25.79, 55.94, EARTH_RADIUS + 0.02);
    const uaeCenter = latLonToVector3(24.7, 54.6, EARTH_RADIUS);
    const uaeNormal = uaeCenter.clone().normalize();
    const cameraDistance = 4.4;
    camera.position.copy(
      uaeCenter.clone().addScaledVector(uaeNormal, cameraDistance),
    );
    camera.lookAt(uaeCenter);
    controls.target.copy(uaeCenter);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffd24a,
        emissive: 0xffb300,
        emissiveIntensity: 0.8,
      }),
    );
    dot.position.copy(rakVector);
    earth.add(dot);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.16, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffd24a,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.copy(rakVector);
    ring.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      rakVector.clone().normalize(),
    );
    earth.add(ring);

    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    const satGroup = new THREE.Group();
    const satBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        metalness: 0.55,
        roughness: 0.28,
        emissive: 0x0a2342,
        emissiveIntensity: 0.25,
      }),
    );
    satGroup.add(satBody);

    const panelGeo = new THREE.BoxGeometry(0.9, 0.09, 0.28);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0f9fd1,
      emissive: 0x003b6f,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.15,
    });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.x = -0.78;
    const rightPanel = leftPanel.clone();
    rightPanel.position.x = 0.78;
    satGroup.add(leftPanel, rightPanel);

    const coreGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.34, 18);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xbcc8d6,
      metalness: 0.65,
      roughness: 0.32,
      emissive: 0x1b2b42,
      emissiveIntensity: 0.25,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.z = Math.PI * 0.5;
    satGroup.add(core);

    const dishGeo = new THREE.ConeGeometry(0.14, 0.18, 20, 1, true);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xf3e9d2,
      metalness: 0.15,
      roughness: 0.45,
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, -0.03, 0.26);
    dish.rotation.x = Math.PI * 0.5;
    satGroup.add(dish);

    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 12);
    const antennaMat = new THREE.MeshStandardMaterial({
      color: 0xd9e2ef,
      metalness: 0.55,
      roughness: 0.28,
    });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(0, 0.3, -0.05);
    satGroup.add(antenna);

    const antennaTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 14, 14),
      new THREE.MeshStandardMaterial({
        color: 0xffc857,
        emissive: 0xffa24b,
        emissiveIntensity: 0.6,
      }),
    );
    antennaTip.position.set(0, 0.58, -0.05);
    satGroup.add(antennaTip);

    const bodyBoxGeo = new THREE.BoxGeometry(0.28, 0.22, 0.26);
    const bodyBoxMat = new THREE.MeshStandardMaterial({
      color: 0x44576c,
      metalness: 0.4,
      roughness: 0.35,
      emissive: 0x0f2038,
      emissiveIntensity: 0.2,
    });
    const bodyBox = new THREE.Mesh(bodyBoxGeo, bodyBoxMat);
    bodyBox.position.set(0, -0.02, -0.05);
    satGroup.add(bodyBox);

    const thrusterGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.12, 14);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0xa3b6d9,
      metalness: 0.65,
      roughness: 0.22,
    });
    const thrusterLeft = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterLeft.rotation.z = Math.PI * 0.5;
    thrusterLeft.position.set(-0.18, -0.08, -0.16);
    const thrusterRight = thrusterLeft.clone();
    thrusterRight.position.set(0.18, -0.08, -0.16);
    satGroup.add(thrusterLeft, thrusterRight);

    const beaconGeo = new THREE.SphereGeometry(0.04, 14, 14);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x39d1c7,
      emissive: 0x39d1c7,
      emissiveIntensity: 1.0,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0.08, -0.22);
    satGroup.add(beacon);

    satGroup.position.set(0, 0, 0);
    orbitGroup.add(satGroup);

    const orbitNormal = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), rakVector.clone().normalize())
      .normalize();
    if (orbitNormal.lengthSq() > 0.0001) {
      const q1 = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        orbitNormal,
      );
      const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(q1);
      const rakDir = rakVector.clone().normalize();
      const q2 = new THREE.Quaternion().setFromAxisAngle(
        orbitNormal,
        xAxis.angleTo(rakDir) *
          Math.sign(xAxis.clone().cross(rakDir).dot(orbitNormal)),
      );
      orbitGroup.quaternion.copy(q2.multiply(q1));
    }

    const orbitRadius = EARTH_RADIUS + 1.9;
    const orbitPts = [];
    for (let i = 0; i <= 360; i += 1) {
      const t = (i / 360) * Math.PI * 2;
      orbitPts.push(
        new THREE.Vector3(
          Math.cos(t) * orbitRadius,
          0,
          Math.sin(t) * orbitRadius,
        ),
      );
    }
    const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPts);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x66a6ff,
      transparent: true,
      opacity: 0.28,
    });
    const orbitLine = new THREE.Line(orbitGeom, orbitMat);
    orbitGroup.add(orbitLine);

    const trailLength = 110;
    const trailPositions = new Float32Array(trailLength * 3);
    const trailGeom = new THREE.BufferGeometry();
    trailGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(trailPositions, 3),
    );
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x7bd2ff,
      transparent: true,
      opacity: 0.35,
    });
    const trailLine = new THREE.Line(trailGeom, trailMat);
    scene.add(trailLine);

    const beamGeom = new THREE.CylinderGeometry(0.03, 0.18, 1, 18, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x7fd6ff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.visible = false;
    scene.add(beam);

    function worldToScreen(pos) {
      const rect = renderer.domElement.getBoundingClientRect();
      const p = pos.clone().project(camera);
      return {
        x: (p.x * 0.5 + 0.5) * rect.width,
        y: (-p.y * 0.5 + 0.5) * rect.height,
      };
    }

    let showLabel = false;
    let labelHold = 0;

    const clock = new THREE.Clock();
    const satWorld = new THREE.Vector3();
    const rakWorld = new THREE.Vector3();
    const groundPoint = new THREE.Vector3();
    const midPoint = new THREE.Vector3();
    const beamDir = new THREE.Vector3();
    let orbitAngle = 0;
    let animationId = 0;
    let active = true;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const togglePin = () => {
      setIsPinned((prev) => !prev);
    };

    const handleClick = (event) => {
      if (!renderer.domElement) return;
      if (!canClickRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(dot, true);
      if (hits.length) togglePin();
    };

    renderer.domElement.addEventListener("click", handleClick);

    const animate = () => {
      if (!active) return;
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();

      // Keep Earth fixed so the satellite passes the same point each orbit.
      stars.rotation.y -= 0.00008;
      stars.material.opacity = 0.8 + (Math.sin(t * 0.6) + 1) * 0.08;
      planetGroup.rotation.y -= 0.00005;

      const speed = 0.7;
      if (!pinnedRef.current) orbitAngle += speed * delta;
      const a = orbitAngle;
      const sx = Math.cos(a) * orbitRadius;
      const sz = Math.sin(a) * orbitRadius;
      satGroup.position.set(sx, Math.sin(a * 2) * 0.05, sz);

      const dx = -Math.sin(a) * orbitRadius;
      const dz = Math.cos(a) * orbitRadius;
      satGroup.rotation.y = Math.atan2(dx, dz);

      const pulse = (Math.sin(t * 3.2) + 1) * 0.5;
      ring.scale.setScalar(1 + pulse * 0.9);
      ring.material.opacity = 0.15 + (1 - pulse) * 0.55;

      const beaconPulse = (Math.sin(t * 6.5) + 1) * 0.5;
      beacon.scale.setScalar(0.85 + beaconPulse * 0.5);
      beacon.material.emissiveIntensity = 0.6 + beaconPulse * 0.6;

      planetMeshes.forEach((planet, idx) => {
        planet.userData.angle += planet.userData.speed * delta;
        const angle = planet.userData.angle;
        const dist = planet.userData.distance;
        planet.position.set(
          Math.cos(angle) * dist,
          planet.userData.y,
          Math.sin(angle) * dist,
        );
        planet.rotation.y += 0.004;
        planet.rotation.x = planet.userData.tilt;
        if (planet.userData.ring) {
          planet.userData.ring.rotation.z = t * 0.1 + idx;
        }
      });

      // sparkle/nebula removed

      satGroup.getWorldPosition(satWorld);

      dot.getWorldPosition(rakWorld);
      const rakDir = rakWorld.clone().normalize();
      const satDir = satWorld.clone().normalize();
      const angularDistance = satDir.angleTo(rakDir);
      const triggerAngle = THREE.MathUtils.degToRad(6.5);
      if (angularDistance < triggerAngle) {
        showLabel = true;
        labelHold = 1.3;
      } else {
        labelHold -= delta;
        if (labelHold <= 0) showLabel = false;
      }
      canClickRef.current = showLabel;

      for (let i = trailLength - 1; i > 0; i -= 1) {
        trailPositions[i * 3] = trailPositions[(i - 1) * 3];
        trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
        trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
      }
      trailPositions[0] = satWorld.x;
      trailPositions[1] = satWorld.y;
      trailPositions[2] = satWorld.z;
      trailGeom.attributes.position.needsUpdate = true;

      if (showLabel) {
        groundPoint.copy(rakDir).multiplyScalar(EARTH_RADIUS + 0.02);
        const distance = satWorld.distanceTo(groundPoint);
        midPoint.copy(satWorld).add(groundPoint).multiplyScalar(0.5);
        beamDir.copy(groundPoint).sub(satWorld).normalize();
        beam.position.copy(midPoint);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
        beam.scale.set(1, distance, 1);
        beam.visible = true;
      } else {
        beam.visible = false;
      }

      const uiActive = showLabel || pinnedRef.current;
      if (labelRef.current) {
        const screen = worldToScreen(rakWorld.clone().multiplyScalar(1.02));
        labelRef.current.style.left = `${screen.x}px`;
        labelRef.current.style.top = `${screen.y}px`;
        labelRef.current.style.opacity = uiActive ? "1" : "0";
      }
      if (mapRef.current) {
        const screen = worldToScreen(rakWorld.clone().multiplyScalar(1.02));
        mapRef.current.style.left = `${screen.x + 120}px`;
        mapRef.current.style.top = `${screen.y}px`;
        mapRef.current.style.opacity = uiActive ? "1" : "0";
      }
      if (infoRef.current) {
        infoRef.current.style.opacity = pinnedRef.current ? "1" : "0";
        infoRef.current.style.pointerEvents = pinnedRef.current
          ? "auto"
          : "none";
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const { clientWidth, clientHeight } = stageRef.current;
      renderer.setSize(clientWidth, clientHeight);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      mapTex.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      starsGeo.dispose();
      starsMat.dispose();
      // sparkle removed
      planetMeshes.forEach((planet) => {
        planet.geometry.dispose();
        planet.material.dispose();
        if (planet.userData.stripeTex) planet.userData.stripeTex.dispose();
        if (planet.userData.craterTex) planet.userData.craterTex.dispose();
        if (planet.userData.ring) {
          planet.userData.ring.geometry.dispose();
          planet.userData.ring.material.dispose();
        }
      });
      // nebula removed
      orbitGeom.dispose();
      orbitMat.dispose();
      trailGeom.dispose();
      trailMat.dispose();
      beamGeom.dispose();
      beamMat.dispose();
      dot.geometry.dispose();
      dot.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
      satBody.geometry.dispose();
      satBody.material.dispose();
      panelGeo.dispose();
      panelMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      dishGeo.dispose();
      dishMat.dispose();
      antennaGeo.dispose();
      antennaMat.dispose();
      antennaTip.geometry.dispose();
      antennaTip.material.dispose();
      bodyBoxGeo.dispose();
      bodyBoxMat.dispose();
      thrusterGeo.dispose();
      thrusterMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div id="wrap" ref={wrapRef}>
      <div id="page">
        <header className="hero">
          <div className="hero-badge">اسألني عن رأس الخيمة — تجربة تفاعلية</div>
          <h1 className="hero-title">اسألني عن رأس الخيمة</h1>
          <p className="hero-subtitle">
            مشروع بصري تفاعلي يعرض مرور القمر الصناعي فوق الإمارات ويكشف نبذة
            سريعة عن رأس الخيمة في اللحظة المناسبة.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                modelSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              استكشف المدار
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() =>
                featuresRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              تعرّف أكثر
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-value">+120</span>
              <span className="stat-label">لقطة مدار</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">3D</span>
              <span className="stat-label">مشهد تفاعلي</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">RAK</span>
              <span className="stat-label">معلومة سريعة</span>
            </div>
          </div>
        </header>

        <section className="section features" ref={featuresRef}>
          <h2>ماذا يقدّم المشروع؟</h2>
          <div className="feature-grid">
            <article className="timeline-step">
              <h3>لحظة ظهور ذكية</h3>
              <p>
                عند مرور الساتلايت فوق رأس الخيمة تظهر الخريطة والنبذة تلقائيًا.
              </p>
            </article>
            <article className="timeline-step">
              <h3>فضاء غني بالتفاصيل</h3>
              <p>نجوم وكواكب تضيف عمقًا بصريًا لمشهد أكثر واقعية.</p>
            </article>
            <article className="timeline-step">
              <h3>تفاعل بلمسة واحدة</h3>
              <p>
                اضغط على النقطة أثناء المرور لإيقاف المدار وقراءة النبذة.
              </p>
            </article>
          </div>
        </section>

        <section className="section timeline">
          <h2>كيف يعمل “اسألني عن رأس الخيمة”</h2>
          <div className="timeline-grid">
            <div className="timeline-step">
              <span>01</span>
              <h4>تهيئة المشهد</h4>
              <p>تحميل الفضاء وتركيز الكاميرا على الإمارات.</p>
            </div>
            <div className="timeline-step">
              <span>02</span>
              <h4>تتبّع المدار</h4>
              <p>الساتلايت يدور ويقترب من موقع رأس الخيمة.</p>
            </div>
            <div className="timeline-step">
              <span>03</span>
              <h4>سؤال وجواب</h4>
              <p>عند المرور تظهر الخريطة والنبذة ويُمكن التوقّف للقراءة.</p>
            </div>
          </div>
        </section>

        <section className="section highlight">
          <div className="highlight-card">
            <h2>اسألني عن رأس الخيمة</h2>
            <p>
              نافذة معرفية قصيرة عن الإمارة، تظهر عند مرور الساتلايت فوقها لتقدّم
              لمحة سريعة بأسلوب بصري مميّز.
            </p>
            <button className="btn btn-outline" type="button">
              ابدأ الآن
            </button>
          </div>
        </section>

        <section className="section model-section" ref={modelSectionRef}>
          <div className="model-header">
            <div>
              <h2>تجربة “اسألني عن رأس الخيمة”</h2>
              <p>اسحب للتحكّم في المدار، واضغط على النقطة عند المرور.</p>
            </div>
          </div>
          <div id="model-stage" ref={stageRef}>
            <div className="overlay">
              <div id="label" ref={labelRef}>
                <strong>اسألني عن رأس الخيمة</strong>
                <span>RAK</span>
              </div>

              <div id="uae-map" ref={mapRef}>
        <img src="/map.png" alt="United Arab Emirates map with RAK" />
              </div>

              <div id="info" ref={infoRef}>
                <h3>نبذة عن رأس الخيمة</h3>
                <p>
                  رأس الخيمة إمارة تقع في أقصى شمال دولة الإمارات العربية
                  المتحدة، وتشتهر بساحلها على الخليج العربي وجبال الحجر والطبيعة
                  المتنوعة. تُعد من الوجهات السياحية البارزة بما فيها جبل جيس،
                  أعلى قمة في الدولة.
                </p>
                <button
                  className="btn btn-outline info-btn"
                  type="button"
                  onClick={() => setIsPinned(false)}
                >
                  متابعة الرحلة
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <span>اسألني عن رأس الخيمة — مشروع تجريبي 2026</span>
          <span>تصميم وتجربة تفاعلية</span>
        </footer>
      </div>
    </div>
  );
}
