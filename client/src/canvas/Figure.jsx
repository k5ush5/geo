import { useRef, useMemo, useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import state from '../store'
import { OrbitControls } from '@react-three/drei';

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
const createEdgeHitbox = (start, end) => {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  const geometry = new THREE.CylinderGeometry(0.08, 0.08, length, 8);
  const material = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false // 🔥 главное
});

  const mesh = new THREE.Mesh(geometry, material);

  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(midpoint);

  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );
  mesh.renderOrder = -1;
  return mesh;
};
// Функция для построения многоугольника сечения
const computeSectionPolygon = (basePoints, apexPoint, p1, p2, p3) => {
  // Создаем плоскость по трем точкам
  const epsilon = 1e-6;
  const v1 = new THREE.Vector3().subVectors(p2, p1);
  const v2 = new THREE.Vector3().subVectors(p3, p1);
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  const planePoint = p1;

  const intersections = [];
  const edges = [];
  // Все ребра пирамиды
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    edges.push([basePoints[i], basePoints[next]]);
    edges.push([basePoints[i], apexPoint]);
  }
  
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
  
  useEffect(() => {
  // если режим активен — оставляем его
  if (snap.aipickerMode) {
    state.aipickerMode = true;
  }
}, [snap.edgeSizes]);
  
  const baseRadius = 1.2
  const baseHeight = 2.2
  const segments = 4

  const bottomSizes = snap.edgeSizes?.bottom || [5, 5, 5, 5]
  const sideSizes = snap.edgeSizes?.side || [5, 5, 5, 5]

  const basePoints = useMemo(() => {
    const points = []
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const radius = baseRadius * (bottomSizes[i] / 5)
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        -baseHeight/2,
        Math.sin(angle) * radius
      ))
    }
    return points
  }, [bottomSizes])

  const apexPoint = useMemo(() => {
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
    const allPoints = [...basePoints, apexPoint]
    let maxCoord = 0
    allPoints.forEach(p => {
      maxCoord = Math.max(maxCoord, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))
    })
    
    const targetMax = 2.5
    return maxCoord > targetMax ? targetMax / maxCoord : 1.0
  }, [basePoints, apexPoint])

  const centerOffset = useMemo(() => {
    const allPoints = [...basePoints, apexPoint]
    
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    
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
  }, [basePoints, apexPoint])

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
  const faces = useMemo(() => {
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
  }, [basePoints, apexPoint])

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
        hitbox: createEdgeHitbox(start, end)
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
        hitbox: createEdgeHitbox(start, end) 
      })
    }
    return edges
  }, [basePoints, apexPoint])
  const isEdgeHiddenPhysical = (edge, camera, facesMeshes) => {
  const direction = camera.position.clone().sub(edge.center).normalize();

  // 🔥 чуть выносим точку, чтобы не попасть в саму грань
  const origin = edge.center.clone().add(direction.clone().multiplyScalar(0.01));

  const raycaster = new THREE.Raycaster(origin, direction);
  const intersects = raycaster.intersectObjects(facesMeshes, false);

  if (intersects.length === 0) return false;

  const distToCamera = origin.distanceTo(camera.position);

  for (let hit of intersects) {
    // ❗ игнорим саму точку (очень важно)
    if (hit.distance < 0.02) continue;

    // ❗ если пересечение ближе камеры → реально перекрыто
    if (hit.distance < distToCamera - 0.01) {
      return true;
    }
  }

  return false;
};
  const allEdges = [...bottomEdges, ...sideEdges]
  const [visibleEdges, setVisibleEdges] = useState({})
  const isEdgeHidden = (edge, camera, facesMeshes) => {
  const direction = camera.position.clone().sub(edge.center).normalize();
  const origin = edge.center.clone().add(direction.clone().multiplyScalar(0.01));

  const raycaster = new THREE.Raycaster(origin, direction);
  const intersects = raycaster.intersectObjects(facesMeshes, false);

  if (intersects.length === 0) return false;

  const distToCamera = origin.distanceTo(camera.position);

  for (let hit of intersects) {
    if (hit.distance < 0.02) continue;

    // 🔥 ключевой фикс
    const hitPoint = hit.point;
    const edgeToHit = hitPoint.clone().sub(edge.center);
    const edgeToCam = camera.position.clone().sub(edge.center);

    // ❗ проверяем, что грань РЕАЛЬНО между ребром и камерой
    if (edgeToHit.length() > edgeToCam.length()) continue;

    if (hit.distance < distToCamera - 0.01) {
      return true;
    }
  }

  return false;
};
  useFrame(({ camera }) => {
  const newVisibleEdges = {};
  const facesMeshes = facesRefs.current.filter(Boolean);

  allEdges.forEach(edge => {
  let hidden;

  if (edge.type === 'bottom') {
    // 🔥 твоя старая идеальная логика
    hidden = isEdgeHidden(edge, camera, facesMeshes);
  } else {
    // 🔥 новая физическая логика
    hidden = isEdgeHiddenPhysical(edge, camera, facesMeshes);
  }

  newVisibleEdges[`${edge.type}-${edge.index}`] = !hidden;
});

  setVisibleEdges(newVisibleEdges);
});
  const isEdgeSelected = (type, index) => {
    return snap.selectedEdge?.type === type && snap.selectedEdge?.index === index
  }

const handleEdgeClick = (event, edge) => {
  if (!snap.aipickerMode) return;
  event.stopPropagation();

  const snapToVertex = (point) => {
    const allVertices = [...basePoints, apexPoint];

    for (let v of allVertices) {
      const displayV = toDisplayCoords(v);

      if (point.distanceTo(displayV) < 0.25) {
        return displayV.clone();
      }
    }

    return point;
  };

  let localPoint = event.point.clone();
  meshRef.current.worldToLocal(localPoint);

  localPoint = snapToVertex(localPoint);

  // 🔥 округление ПОСЛЕ создания
  localPoint.x = Math.round(localPoint.x * 1000) / 1000;
  localPoint.y = Math.round(localPoint.y * 1000) / 1000;
  localPoint.z = Math.round(localPoint.z * 1000) / 1000;

  const edgeVec = new THREE.Vector3().subVectors(edge.end, edge.start);
const pointVec = new THREE.Vector3().subVectors(localPoint, edge.start);

const t = pointVec.dot(edgeVec) / edgeVec.lengthSq();
const clampedT = Math.max(0, Math.min(1, t));

const newPoint = {
  id: Date.now() + Math.random(),
  edgeType: edge.type,
  edgeIndex: edge.index,
  t: clampedT
};

const getPointPos = (p) => {
  const edge = allEdges.find(
    e => e.type === p.edgeType && e.index === p.edgeIndex
  );

  if (!edge) return null;

  return new THREE.Vector3().lerpVectors(
    edge.start.clone(),
    edge.end.clone(),
    p.t
  );
};
  state.tempPoints = [...(snap.tempPoints || []), newPoint];
};

  // СЕЧЕНИЕ - ИСПРАВЛЕНО!
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
  basePoints.map(toDisplayCoords),
  toDisplayCoords(apexPoint),
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
    <group ref={groupRef} position={[1.5, -0.8, 0]}>
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
    <primitive 
      key={`hitbox-${edge.type}-${edge.index}-${edge.start.x}`}
      object={edge.hitbox}
      onClick={(e) => handleEdgeClick(e, edge)}
    />

  </group>
)
          
        })}
        
        {basePoints.map((point, i) => (
          <mesh 
            key={`base-${i}`} 
            position={toDisplayCoords(point)}
          >
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color="#55ff55" emissive="#003300" />
          </mesh>
        ))}
        
        <mesh position={toDisplayCoords(apexPoint)}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#ff5555" emissive="#330000" />
        </mesh>

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