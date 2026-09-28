(function () {
  'use strict';

  var canvas = document.getElementById('life-starfield');
  if (!canvas || typeof THREE === 'undefined') return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    });
  } catch (error) {
    document.body.classList.add('life-stars-fallback');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.autoClear = false;
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1800);
  camera.position.z = 18;

  var clock = new THREE.Clock();
  var pointer = new THREE.Vector2();
  var targetPointer = new THREE.Vector2();
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isVisible = true;

  var nebulaScene = new THREE.Scene();
  var nebulaCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var nebulaMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uPointer: { value: new THREE.Vector2() }
    },
    vertexShader: [
      'void main() {',
      '  gl_Position = vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision highp float;',
      'uniform float uTime;',
      'uniform vec2 uResolution;',
      'uniform vec2 uPointer;',
      'float hash(vec2 p) {',
      '  p = fract(p * vec2(123.34, 456.21));',
      '  p += dot(p, p + 45.32);',
      '  return fract(p.x * p.y);',
      '}',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
      '             mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);',
      '}',
      'float fbm(vec2 p) {',
      '  float value = 0.0;',
      '  float amplitude = 0.5;',
      '  mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);',
      '  for (int i = 0; i < 6; i++) {',
      '    value += amplitude * noise(p);',
      '    p = rotation * p * 2.03 + 8.13;',
      '    amplitude *= 0.5;',
      '  }',
      '  return value;',
      '}',
      'void main() {',
      '  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;',
      '  uv += uPointer * 0.025;',
      '  float drift = uTime * 0.004;',
      '  vec2 q = vec2(fbm(uv * 1.35 + vec2(drift, 0.0)), fbm(uv * 1.35 + vec2(4.2, 1.7)));',
      '  float cloud = fbm(uv * 2.15 + q * 1.8);',
      '  float cloudAlt = fbm(uv * 1.55 - q * 1.35 + vec2(-1.8, 2.4));',
      '  float dust = fbm(uv * 5.5 - q * 1.2);',
      '  float band = exp(-pow(abs(uv.y + uv.x * 0.19 + 0.07), 1.25) * 8.0);',
      '  vec3 base = vec3(0.004, 0.003, 0.020);',
      '  vec3 blue = vec3(0.025, 0.105, 0.24);',
      '  vec3 violet = vec3(0.18, 0.045, 0.30);',
      '  vec3 rose = vec3(0.30, 0.035, 0.18);',
      '  vec3 gold = vec3(0.28, 0.135, 0.025);',
      '  vec3 color = base;',
      '  color += blue * smoothstep(0.40, 0.80, cloud) * 0.62;',
      '  color += violet * smoothstep(0.48, 0.84, cloudAlt) * 0.54;',
      '  color += rose * smoothstep(0.58, 0.88, cloud + cloudAlt * 0.34) * 0.43;',
      '  color += gold * band * smoothstep(0.43, 0.80, dust) * 0.36;',
      '  color += vec3(0.07, 0.075, 0.13) * band * smoothstep(0.32, 0.76, cloud) * 0.56;',
      '  color *= 0.76 + 0.24 * smoothstep(0.18, 0.9, length(uv));',
      '  gl_FragColor = vec4(color, 1.0);',
      '}'
    ].join('\n')
  });
  nebulaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaMaterial));

  var starVertexShader = [
    'attribute float aSize;',
    'attribute float aPhase;',
    'attribute float aTwinkle;',
    'attribute float aPulseDepth;',
    'attribute vec3 aColor;',
    'uniform float uTime;',
    'varying vec3 vColor;',
    'varying float vGlow;',
    'void main() {',
    '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
    '  float pulse = 1.0 + aPulseDepth * sin(uTime * aTwinkle + aPhase);',
    '  gl_PointSize = min(12.0, aSize * pulse * (250.0 / -mvPosition.z));',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  vColor = aColor;',
    '  vGlow = pulse;',
    '}'
  ].join('\n');

  var starFragmentShader = [
    'precision highp float;',
    'varying vec3 vColor;',
    'varying float vGlow;',
    'void main() {',
    '  vec2 p = gl_PointCoord - 0.5;',
    '  float radius = length(p);',
    '  if (radius > 0.5) discard;',
    '  float core = smoothstep(0.16, 0.0, radius);',
    '  float halo = pow(max(0.0, 1.0 - radius * 2.0), 3.2);',
    '  float rays = max(0.0, 1.0 - abs(p.x) * 34.0) + max(0.0, 1.0 - abs(p.y) * 34.0);',
    '  float alpha = min(1.0, core + halo * 0.72 + rays * core * 0.16) * vGlow;',
    '  gl_FragColor = vec4(vColor * (1.0 + core * 0.65), alpha);',
    '}'
  ].join('\n');

  function temperatureColor(random) {
    if (random < 0.16) return [0.62, 0.76, 1.0];
    if (random > 0.88) return [1.0, 0.72, 0.46];
    return [0.91, 0.95, 1.0];
  }

  function createStarLayer(count, radius, sizeRange, opacity) {
    var positions = new Float32Array(count * 3);
    var colors = new Float32Array(count * 3);
    var sizes = new Float32Array(count);
    var phases = new Float32Array(count);
    var twinkles = new Float32Array(count);
    var pulseDepths = new Float32Array(count);

    for (var i = 0; i < count; i++) {
      var distance = radius * (0.36 + Math.pow(Math.random(), 0.42) * 0.64);
      var theta = Math.random() * Math.PI * 2;
      var z = (Math.random() * 2 - 1) * radius * 0.62;
      var radial = Math.sqrt(Math.max(0, distance * distance - z * z));
      var index = i * 3;
      positions[index] = Math.cos(theta) * radial;
      positions[index + 1] = Math.sin(theta) * radial;
      positions[index + 2] = z - radius * 0.32;

      var color = temperatureColor(Math.random());
      var intensity = 0.68 + Math.random() * 0.32;
      colors[index] = color[0] * intensity;
      colors[index + 1] = color[1] * intensity;
      colors[index + 2] = color[2] * intensity;
      sizes[i] = sizeRange[0] + Math.pow(Math.random(), 5.0) * (sizeRange[1] - sizeRange[0]);
      phases[i] = Math.random() * Math.PI * 2;
      twinkles[i] = 0.18 + Math.random() * 0.58;
      pulseDepths[i] = Math.random() < 0.16 ? 0.08 + Math.random() * 0.06 : 0.025 + Math.random() * 0.045;
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
    geometry.setAttribute('aPulseDepth', new THREE.BufferAttribute(pulseDepths, 1));

    var material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      opacity: opacity
    });

    var points = new THREE.Points(geometry, material);
    points.userData.speed = 0.0008 + Math.random() * 0.0012;
    scene.add(points);
    return points;
  }

  var layers = [
    createStarLayer(4200, 720, [1.0, 3.1], 0.78),
    createStarLayer(1350, 380, [1.4, 4.8], 0.92),
    createStarLayer(260, 190, [2.2, 7.5], 1.0)
  ];

  function resize() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    nebulaMaterial.uniforms.uResolution.value.set(width, height);
  }

  function onPointerMove(event) {
    targetPointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
    targetPointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  function render() {
    var elapsed = clock.getElapsedTime();
    pointer.lerp(targetPointer, 0.025);
    camera.position.x += (pointer.x * 5.5 - camera.position.x) * 0.018;
    camera.position.y += (-pointer.y * 3.8 - camera.position.y) * 0.018;
    camera.lookAt(0, 0, -80);

    nebulaMaterial.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
    nebulaMaterial.uniforms.uPointer.value.copy(pointer);

    layers.forEach(function (layer, index) {
      layer.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
      if (!reducedMotion) {
        layer.rotation.y = elapsed * layer.userData.speed * (index + 1);
        layer.rotation.z = Math.sin(elapsed * 0.025 + index) * 0.012;
      }
    });

    renderer.clear();
    renderer.render(nebulaScene, nebulaCamera);
    renderer.clearDepth();
    renderer.render(scene, camera);

    if (isVisible && !reducedMotion) requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', function () {
    isVisible = !document.hidden;
    if (isVisible && !reducedMotion) {
      clock.getDelta();
      requestAnimationFrame(render);
    }
  });

  resize();
  render();
})();
