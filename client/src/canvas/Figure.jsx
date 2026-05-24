import { useRef, useMemo, useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import state from '../store'
import { OrbitControls } from '@react-three/drei';
const isEdgeHidden = (edge, camera, facesMeshes) => {
  const direction = camera.position.clone().sub(edge.center).normalize();
  const origin = edge.center.clone().add(direction.clone().multiplyScalar(0.01));

  const raycaster = new THREE.Raycaster(origin, direction);
  const intersects = raycaster.intersectObjects(facesMeshes, false);

  if (intersects.length === 0) return false;

  const distToCamera = origin.distanceTo(camera.position);

  for (let hit of intersects) {
    if (hit.distance < 0.04) continue;

    const hitPoint = hit.point;
    const edgeToHit = hitPoint.clone().sub(edge.center);
    const edgeToCam = camera.position.clone().sub(edge.center);

    if (edgeToHit.length() > edgeToCam.length()) continue;

    if (hit.distance < distToCamera - 0.08) {
      return true;
    }
  }

  return false;
};
const createEdgeHitboxData = (start, end) => {

  if (!start || !end) return null

  const direction = new THREE.Vector3()
    .subVectors(end, start)

  const length = direction.length()

  if (!isFinite(length) || length <= 0.0001) {
    return null
  }

  const midpoint = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)

  const quaternion = new THREE.Quaternion()

  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  )

  return {
    midpoint,
    quaternion,
    length
  }
}
// Функция для нахождения пересечения плоскости с ребром
const getEdgePlaneIntersection = (p1, p2, planeNormal, planePoint) => {
  const d1 = planeNormal.dot(p1.clone().sub(planePoint));
  const d2 = planeNormal.dot(p2.clone().sub(planePoint));
  
  if (d1 * d2 <= 0) {
    const t = -d1 / (d2 - d1);
    return new THREE.Vector3().lerpVectors(p1, p2, t);
  }
  return null;
};
// Функция для построения многоугольника сечения
const computeSectionPolygon = (  vertices,
  edges,
  p1,
  p2,
  p3) => {
  // Создаем плоскость по трем точкам
  const epsilon = 1e-6;
  const v1 = new THREE.Vector3().subVectors(p2, p1);
  const v2 = new THREE.Vector3().subVectors(p3, p1);
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  const planePoint = p1;

  const intersections = [];

  // Находим пересечения плоскости с ребрами
  edges.forEach(([start, end]) => {
    const d1 = normal.dot(start.clone().sub(planePoint));
    const d2 = normal.dot(end.clone().sub(planePoint));

    if (Math.abs(d2 - d1) < 0.00001) return;

    if (d1 * d2 <= 0) {
      const t = -d1 / (d2 - d1);
      const point = new THREE.Vector3().lerpVectors(start, end, t);
      point.x = Math.round(point.x * 1000) / 1000;
point.y = Math.round(point.y * 1000) / 1000;
point.z = Math.round(point.z * 1000) / 1000;
      intersections.push(point);
    }
  });
  
  // Убираем дубликаты
  const unique = [];
  intersections.forEach(p => {
    const exists = unique.some(u => u.distanceTo(p) < 0.05);
    if (!exists) unique.push(p);
  });
  
  // Сортируем точки для правильного порядка обхода
  if (unique.length > 2) {
  const center = new THREE.Vector3();
  unique.forEach(p => center.add(p));
  center.divideScalar(unique.length);

  const u = new THREE.Vector3().subVectors(unique[0], center).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  unique.sort((a, b) => {
    const da = new THREE.Vector3().subVectors(a, center);
    const db = new THREE.Vector3().subVectors(b, center);

    const angleA = Math.atan2(da.dot(v), da.dot(u));
    const angleB = Math.atan2(db.dot(v), db.dot(u));

    return angleA - angleB;
  });
}
  
  return unique;
};

// Компонент для отрисовки сечения
const SectionPolygon = ({ points, color = '#ffaa00', baseColor }) => {
  if (!points || points.length < 3) return null;

  const lineGeometry = useMemo(() => {
    const vertices = [];
    points.forEach(p => {
  vertices.push(p.position.x, p.position.y, p.position.z);
});
   vertices.push(
  points[0].position.x,
  points[0].position.y,
  points[0].position.z
);
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    return geom;
  }, [points]);

  const fillGeometry = useMemo(() => {
    const vertices = [];
    for (let i = 1; i < points.length - 1; i++) {
      vertices.push(
        points[0].position.x, points[0].position.y, points[0].position.z,
        points[i].position.x, points[i].position.y, points[i].position.z,
        points[i + 1].position.x, points[i + 1].position.y, points[i + 1].position.z
      );
    }
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }, [points]);

  return (
    <group>
      <mesh geometry={fillGeometry}>
        <meshPhongMaterial 
          color={color}
          transparent 
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <line geometry={lineGeometry}>
        <lineBasicMaterial color={color} />
      </line>

      {points.map((p, i) => (
  <mesh key={i} position={p.position}>
    <sphereGeometry args={[0.06, 8, 8]} />
    <meshBasicMaterial 
      color={p.isUserPoint ? "#ffaa00" : baseColor}
    />
  </mesh>
))}
    </group>
  );
};

const Figure = () => {
  const snap = useSnapshot(state)
  const groupRef = useRef()
  const meshRef = useRef()
  const facesRefs = useRef([]);
  const baseRadius = 1.2
  const baseHeight = 2.2
  const segments = 4
  const isCube = snap.currentFigure === 'cube'
  const bottomSizes = snap.edgeSizes?.bottom || [5, 5, 5, 5]
  const sideSizes = snap.edgeSizes?.side || [5, 5, 5, 5]
  const cubeSizes = {
  width: snap.edgeSizes?.cube?.width ?? 5,
  depth: snap.edgeSizes?.cube?.depth ?? 5,
  height: snap.edgeSizes?.cube?.height ?? 5,
}

  const basePoints = useMemo(() => {

  // 🔥 КУБ / ПАРАЛЛЕЛЕПИПЕД
  if (isCube) {

    const w = cubeSizes.width / 5
    const d = cubeSizes.depth / 5

    return [
      new THREE.Vector3(-w, -1, -d),
      new THREE.Vector3(w, -1, -d),
      new THREE.Vector3(w, -1, d),
      new THREE.Vector3(-w, -1, d),
    ]
  }

  // 🔥 ПИРАМИДА
  const points = []

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const radius = baseRadius * (bottomSizes[i] / 5)

    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        -baseHeight / 2,
        Math.sin(angle) * radius
      )
    )
  }

  return points

}, [bottomSizes, cubeSizes, isCube])
const topPoints = useMemo(() => {

  if (!isCube) return []

  const h = cubeSizes.height / 5 

  return basePoints.map(
    p => new THREE.Vector3(p.x, h, p.z)
  )

}, [basePoints, cubeSizes, isCube])

  const apexPoint = useMemo(() => {
    if (isCube) {
      return new THREE.Vector3(0, 1, 0)
    }
    let point = new THREE.Vector3(0, baseHeight/2, 0)
    
    const iterations = 100
    const learningRate = 0.05
    
    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new THREE.Vector3(0, 0, 0)
      let totalError = 0
      
      for (let i = 0; i < segments; i++) {
        const basePoint = basePoints[i]
        const targetLength = baseHeight * (sideSizes[i] / 5)
        
        const currentVec = new THREE.Vector3().subVectors(point, basePoint)
        const currentLength = currentVec.length()
        
        if (currentLength < 0.001) continue
        
        const error = (currentLength - targetLength) / targetLength
        const dir = currentVec.clone().normalize()
        
        gradients.addScaledVector(dir, -error * learningRate * targetLength)
        totalError += Math.abs(error)
      }
      
      point.add(gradients)
      
      if (totalError < 0.01) break
    }
    
    return point
  }, [basePoints, sideSizes])

  const scale = useMemo(() => {

  const allPoints = isCube
    ? [...basePoints, ...topPoints]
    : [...basePoints, apexPoint]

  let maxCoord = 0

  allPoints.forEach(p => {
    maxCoord = Math.max(
      maxCoord,
      Math.abs(p.x),
      Math.abs(p.y),
      Math.abs(p.z)
    )
  })

  const targetMax = 2.5

  return maxCoord > targetMax
    ? targetMax / maxCoord
    : 1.0

}, [basePoints, topPoints, apexPoint, isCube])

  const centerOffset = useMemo(() => {

    const allPoints = isCube
    ? [...basePoints, ...topPoints]
    : [...basePoints, apexPoint]

  let minX = Infinity
  let maxX = -Infinity

  let minY = Infinity
  let maxY = -Infinity

  let minZ = Infinity
  let maxZ = -Infinity

  allPoints.forEach(p => {

    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)

    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)

    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)

  })

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2
  }

}, [basePoints, topPoints, apexPoint, isCube])

  const toDisplayCoords = (p) => {
    return new THREE.Vector3(
      (p.x - centerOffset.x) * scale,
      (p.y - centerOffset.y) * scale,
      (p.z - centerOffset.z) * scale
    );
  };
  const fromDisplayCoords = (p) => {
  return new THREE.Vector3(
    p.x / scale + centerOffset.x,
    p.y / scale + centerOffset.y,
    p.z / scale + centerOffset.z
  );
};
const basePointsDisplay = useMemo(
  () => basePoints.map(toDisplayCoords),
  [basePoints, scale, centerOffset]
)

const topPointsDisplay = useMemo(
  () => topPoints.map(toDisplayCoords),
  [topPoints, scale, centerOffset]
)
  const faces = useMemo(() => {
      if (isCube) {

  const geometries = []

  const allFaces = [

    // bottom
    [basePointsDisplay[0], basePointsDisplay[1], basePointsDisplay[2]],
    [basePointsDisplay[0], basePointsDisplay[2], basePointsDisplay[3]],

    // top
    [topPointsDisplay[0], topPointsDisplay[1], topPointsDisplay[2]],
    [topPointsDisplay[0], topPointsDisplay[2], topPointsDisplay[3]],

    // front
    [basePointsDisplay[0], basePointsDisplay[1], topPointsDisplay[1]],
    [basePointsDisplay[0], topPointsDisplay[1], topPointsDisplay[0]],

    // right
    [basePointsDisplay[1], basePointsDisplay[2], topPointsDisplay[2]],
    [basePointsDisplay[1], topPointsDisplay[2], topPointsDisplay[1]],

    // back
    [basePointsDisplay[2], basePointsDisplay[3], topPointsDisplay[3]],
    [basePointsDisplay[2], topPointsDisplay[3], topPointsDisplay[2]],

    // left
    [basePointsDisplay[3], basePointsDisplay[0], topPointsDisplay[0]],
    [basePointsDisplay[3], topPointsDisplay[0], topPointsDisplay[3]],
  ]

  allFaces.forEach(face => {

    const geometry = new THREE.BufferGeometry()

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          ...face[0].toArray(),
          ...face[1].toArray(),
          ...face[2].toArray()
        ]),
        3
      )
    )

    geometry.computeVertexNormals()

    geometries.push(geometry)
  })

  return geometries
}
    const geometries = []
    
    for (let i = 0; i < segments; i++) {
      const nextI = (i + 1) % segments
      
      const p1 = toDisplayCoords(basePoints[i])
      const p2 = toDisplayCoords(apexPoint)
      const p3 = toDisplayCoords(basePoints[nextI])
      
      const geometry = new THREE.BufferGeometry()
      const vertices = new Float32Array([
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z
      ])
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      geometries.push(geometry)
    }
    
    const p0 = toDisplayCoords(basePoints[0])
    const p1 = toDisplayCoords(basePoints[1])
    const p2 = toDisplayCoords(basePoints[2])
    const p3 = toDisplayCoords(basePoints[3])
    
    const tri1 = new THREE.BufferGeometry()
    const tri1Verts = new Float32Array([
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z
    ])
    tri1.setAttribute('position', new THREE.BufferAttribute(tri1Verts, 3))
    tri1.computeVertexNormals()
    geometries.push(tri1)
    
    const tri2 = new THREE.BufferGeometry()
    const tri2Verts = new Float32Array([
      p0.x, p0.y, p0.z,
      p2.x, p2.y, p2.z,
      p3.x, p3.y, p3.z
    ])
    tri2.setAttribute('position', new THREE.BufferAttribute(tri2Verts, 3))
    tri2.computeVertexNormals()
    geometries.push(tri2)
    
    return geometries
  },  [
  basePoints,
  topPoints,
  basePointsDisplay,
  topPointsDisplay,
  apexPoint,
  isCube
])

  const bottomEdges = useMemo(() => {
    const edges = []
    for (let i = 0; i < segments; i++) {
      const start = toDisplayCoords(basePoints[i])
      const end = toDisplayCoords(basePoints[(i + 1) % segments])
      
      const geometry = new THREE.BufferGeometry()
      const vertices = new Float32Array([
        start.x, start.y, start.z,
        end.x, end.y, end.z
      ])
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      
      const center = new THREE.Vector3(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        (start.z + end.z) / 2
      )
      
      edges.push({
        geometry,
        index: i,
        type: 'bottom',
        center,
        start: start.clone(),
        end: end.clone(),
        hitbox: createEdgeHitboxData(start, end)
      })
    }
    return edges
  }, [basePoints])

  const sideEdges = useMemo(() => {
    const edges = []
    for (let i = 0; i < segments; i++) {
      const start = toDisplayCoords(basePoints[i])
      const end = toDisplayCoords(apexPoint)
      
      const geometry = new THREE.BufferGeometry()
      const vertices = new Float32Array([
        start.x, start.y, start.z,
        end.x, end.y, end.z
      ])
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      
      const center = new THREE.Vector3(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        (start.z + end.z) / 2
      )
      
      edges.push({
        geometry,
        index: i,
        type: 'side',
        center,
        start: start.clone(),
        end: end.clone(),
        hitbox: createEdgeHitboxData(start, end)
      })
    }
    return edges
  }, [basePoints, apexPoint])
  
  const cubeEdges = useMemo(() => {

  if (!isCube) return []

  const rawEdges = [

    // width
      [basePoints[0], basePoints[1], 'width'],
  [basePoints[2], basePoints[3], 'width'],
  [topPoints[0], topPoints[1], 'width'],
  [topPoints[2], topPoints[3], 'width'],

  [basePoints[1], basePoints[2], 'depth'],
  [basePoints[3], basePoints[0], 'depth'],
  [topPoints[1], topPoints[2], 'depth'],
  [topPoints[3], topPoints[0], 'depth'],

  [basePoints[0], topPoints[0], 'height'],
  [basePoints[1], topPoints[1], 'height'],
  [basePoints[2], topPoints[2], 'height'],
  [basePoints[3], topPoints[3], 'height'],
  ]

  return rawEdges.map(([start, end, type], index) => {

  const displayStart = toDisplayCoords(start)
  const displayEnd = toDisplayCoords(end)

  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        displayStart.x,
        displayStart.y,
        displayStart.z,

        displayEnd.x,
        displayEnd.y,
        displayEnd.z
      ]),
      3
    )
  )

  return {
    type,
    index,

    start: displayStart.clone(),
    end: displayEnd.clone(),

    geometry,

    center: new THREE.Vector3()
      .addVectors(displayStart, displayEnd)
      .multiplyScalar(0.5),

    hitbox: createEdgeHitboxData(
      displayStart,
      displayEnd
    )
  }
})

},  [
  basePointsDisplay,
  topPointsDisplay,
  isCube
])

  const allEdges = isCube
  ? cubeEdges
  : [...bottomEdges, ...sideEdges]
  useEffect(() => {

  const nextEdges = isCube
    ? cubeEdges
    : [...bottomEdges, ...sideEdges]

  const prev = JSON.stringify(
    state.allEdges?.map(e => ({
      t: e.type,
      i: e.index,
      sx: e.start.x,
      sy: e.start.y,
      sz: e.start.z,
      ex: e.end.x,
      ey: e.end.y,
      ez: e.end.z
    }))
  )

  const next = JSON.stringify(
    nextEdges.map(e => ({
      t: e.type,
      i: e.index,
      sx: e.start.x,
      sy: e.start.y,
      sz: e.start.z,
      ex: e.end.x,
      ey: e.end.y,
      ez: e.end.z
    }))
  )

  if (prev !== next) {
    state.allEdges = nextEdges
  }

}, [isCube, cubeEdges, bottomEdges, sideEdges])
  const [visibleEdges, setVisibleEdges] = useState({})

  useFrame(({ camera }) => {

  const newVisibleEdges = {};
  const facesMeshes =
    facesRefs.current.filter(Boolean);

  allEdges.forEach(edge => {

    const hidden = isEdgeHidden(
      edge,
      camera,
      facesMeshes
    );

    newVisibleEdges[
      `${edge.type}-${edge.index}`
    ] = !hidden;

  });

  setVisibleEdges(prev => {

    const prevStr = JSON.stringify(prev);
    const nextStr = JSON.stringify(newVisibleEdges);

    if (prevStr === nextStr) {
      return prev;
    }

    return newVisibleEdges;
  });
});
  const isEdgeSelected = (type, index) => {

  if (isCube) {
  return snap.selectedEdge?.type === type
}

return (
  snap.selectedEdge?.type === type &&
  snap.selectedEdge?.index === index
)
}


const handleEdgeClick = (event, edge) => {

  if (!snap.aipickerMode) return

  event.stopPropagation()

  const point = event.point.clone()

  const edgeVec = new THREE.Vector3()
    .subVectors(edge.end, edge.start)

  const pointVec = new THREE.Vector3()
    .subVectors(point, edge.start)

  const edgeLenSq = edgeVec.lengthSq()

  if (edgeLenSq < 0.000001) return

  const t = pointVec.dot(edgeVec) / edgeLenSq

  const clampedT = Math.max(0, Math.min(1, t))

  if (!isFinite(clampedT)) return

  const newPoint = {
    id: Date.now() + Math.random(),
    edgeType: edge.type,
    edgeIndex: edge.index,
    t: clampedT
  }

  state.tempPoints = [
  ...(state.tempPoints || []),
  newPoint
]
}
  const cubeVertices = useMemo(() => {

  if (!isCube) return []

  return [
  ...basePointsDisplay,
  ...topPointsDisplay
]

}, [basePointsDisplay,
  topPointsDisplay,
  isCube])
  const sectionPolygon = useMemo(() => {
  const data = snap.sectionPlaneData;
  if (!data || !data.points || data.points.length < 3) return null;

  const getPointPos = (p) => {
    const edge = allEdges.find(
      e => e.type === p.edgeType && e.index === p.edgeIndex
    );

    if (!edge) return null;

    return new THREE.Vector3().lerpVectors(edge.start, edge.end, p.t);
  };

  const pts = data.points.map(getPointPos);

  if (pts.some(p => !p)) return null; // ❗ ключ

  const polygon = computeSectionPolygon(
    isCube
  ? cubeVertices
  : basePoints.map(toDisplayCoords),

isCube
  ? cubeEdges.map(e => [e.start, e.end])
  : [
      ...bottomEdges.map(e => [e.start, e.end]),
      ...sideEdges.map(e => [e.start, e.end])
    ],

pts[0],
pts[1],
pts[2]
);

  if (!polygon || polygon.length < 3) return null;

  // помечаем пользовательские точки
  const marked = polygon.map(p => ({
  point: p.clone(),
  isUserPoint: false
}));
  pts.forEach(up => {
    let best = -1;
    let min = Infinity;

    marked.forEach((mp, i) => {
      const d = up.distanceTo(mp.point);
      if (d < min) {
        min = d;
        best = i;
      }
    });

    if (best !== -1) marked[best].isUserPoint = true;
  });

  return marked.map(p => ({
  position: p.point,
  isUserPoint: p.isUserPoint
}));
}, [snap.sectionPlaneData, allEdges, basePoints, apexPoint]);

  return (
    <group  ref={groupRef} position={[1.5, -0.3, 0]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2]} intensity={0.8} />
      
      <group ref={meshRef} position={[0, -0.3, 0]}>
        {faces.map((geometry, i) => (
          <mesh key={`face-${i}`} geometry={geometry} ref={el => facesRefs.current[i] = el} userData={{ edgeIndex: i }}>
            <meshBasicMaterial 
              color={snap.color} 
              transparent 
              opacity={0.25} 
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
        
        {allEdges.map((edge) => {
          const isVisible = visibleEdges[`${edge.type}-${edge.index}`]
          const isSelected = isEdgeSelected(edge.type, edge.index)
          
          let material
          
          if (isSelected) {
            material = new THREE.LineBasicMaterial({ color: '#ffaa00', linewidth: 3 })
          } else {
            if (isVisible) {
              material = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 2 })
            } else {
              material = new THREE.LineDashedMaterial({
                color: '#888888',
                dashSize: 0.08,
                gapSize: 0.06,
                linewidth: 1.5
              })
            }
          }
          // facesRefs.current = [];
          return (
  <group key={`${edge.type}-${edge.index}`}>

    {/* видимое ребро */}
    <lineSegments
      geometry={edge.geometry}
      material={material}
      onPointerOver={() => {
        if (snap.aipickerMode) document.body.style.cursor = 'crosshair';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
      {...(material instanceof THREE.LineDashedMaterial && {
        onUpdate: self => self?.computeLineDistances?.()
      })}
    />
    {edge.hitbox && (
  <mesh
    position={edge.hitbox.midpoint}
    quaternion={edge.hitbox.quaternion}
    onClick={(e) => handleEdgeClick(e, edge)}
    onPointerOver={() => {
      if (snap.aipickerMode) {
        document.body.style.cursor = 'crosshair'
      }
    }}
    onPointerOut={() => {
      document.body.style.cursor = 'default'
    }}
  >
    <cylinderGeometry args={[0.12, 0.12, edge.hitbox.length, 8]} />
    
    <meshBasicMaterial
      transparent
      opacity={0}
      depthWrite={false}
      colorWrite={false}
    />
  </mesh>
)}

  </group>
)
          
        })}
        
        {!isCube && (
  <>
    {basePoints.map((point, i) => (
          <mesh
            key={`base-${i}`}
            position={toDisplayCoords(point)}
          >
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial
              color="#55ff55"
              emissive="#003300"
            />
          </mesh>
        ))}

        <mesh position={toDisplayCoords(apexPoint)}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial
            color="#ff5555"
            emissive="#330000"
          />
        </mesh>
      </>
    )}
    {isCube && (
  <>
    {[...basePoints, ...topPoints].map((point, i) => (
      <mesh
        key={`cube-point-${i}`}
        position={toDisplayCoords(point)}
      >
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial
          color="#55ff55"
          emissive="#003300"
        />
      </mesh>
    ))}
  </>
)}

        {snap.aipickerMode && snap.tempPoints?.map((point) => {
  const edge = allEdges.find(
    e => e.type === point.edgeType && e.index === point.edgeIndex
  );
  
  if (!edge) return null;

  const pos = new THREE.Vector3().lerpVectors(
    edge.start,
    edge.end,
    point.t
  );

  return (
    <mesh key={point.id} position={pos}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color="#ffaa00" emissive="#442200" />
    </mesh>
  );
})}

        {sectionPolygon && (
          <SectionPolygon points={sectionPolygon} color="#ffaa00" baseColor={snap.color}/>
        )}
      </group>
    </group>
  )
}

export default Figure