import { useRef, useMemo, useState, useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import state from '../store'

const Figure = () => {
  const snap = useSnapshot(state)
  const groupRef = useRef()
  const meshRef = useRef()
  
  // Принудительный сброс при загрузке
  useEffect(() => {
    state.selectedEdge = null;
  }, []);
  
  // Базовые параметры
  const baseRadius = 1.2
  const baseHeight = 2.2
  const segments = 4

  // Получаем размеры ребер
  const bottomSizes = snap.edgeSizes?.bottom || [5, 5, 5, 5]
  const sideSizes = snap.edgeSizes?.side || [5, 5, 5, 5]

  // ТОЧКИ ОСНОВАНИЯ
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

  // ВЕРШИНА
  const apexPoint = useMemo(() => {
    let point = new THREE.Vector3(0, baseHeight/2, 0)
    
    const iterations = 50
    const learningRate = 0.1
    
    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new THREE.Vector3(0, 0, 0)
      
      for (let i = 0; i < segments; i++) {
        const basePoint = basePoints[i]
        const targetLength = baseHeight * (sideSizes[i] / 5)
        
        const currentVec = new THREE.Vector3().subVectors(point, basePoint)
        const currentLength = currentVec.length()
        
        if (currentLength < 0.001) continue
        
        const error = currentLength - targetLength
        const dir = currentVec.clone().normalize()
        
        gradients.addScaledVector(dir, -error * learningRate)
      }
      
      point.add(gradients)
      point.y = Math.max(0.3, Math.min(3.0, point.y))
    }
    
    return point
  }, [basePoints, sideSizes])

  // ГРАНИ
  const faces = useMemo(() => {
    const geometries = []
    
    for (let i = 0; i < segments; i++) {
      const nextI = (i + 1) % segments
      
      const p1 = basePoints[i]
      const p2 = apexPoint
      const p3 = basePoints[nextI]
      
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
    
    // Нижняя грань
    const tri1 = new THREE.BufferGeometry()
    const tri1Verts = new Float32Array([
      basePoints[0].x, basePoints[0].y, basePoints[0].z,
      basePoints[1].x, basePoints[1].y, basePoints[1].z,
      basePoints[2].x, basePoints[2].y, basePoints[2].z
    ])
    tri1.setAttribute('position', new THREE.BufferAttribute(tri1Verts, 3))
    tri1.computeVertexNormals()
    geometries.push(tri1)
    
    const tri2 = new THREE.BufferGeometry()
    const tri2Verts = new Float32Array([
      basePoints[0].x, basePoints[0].y, basePoints[0].z,
      basePoints[2].x, basePoints[2].y, basePoints[2].z,
      basePoints[3].x, basePoints[3].y, basePoints[3].z
    ])
    tri2.setAttribute('position', new THREE.BufferAttribute(tri2Verts, 3))
    tri2.computeVertexNormals()
    geometries.push(tri2)
    
    return geometries
  }, [basePoints, apexPoint])

  // НИЖНИЕ РЕБРА
  const bottomEdges = useMemo(() => {
    const edges = []
    for (let i = 0; i < segments; i++) {
      const start = basePoints[i]
      const end = basePoints[(i + 1) % segments]
      
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
        center
      })
    }
    return edges
  }, [basePoints])

  // БОКОВЫЕ РЕБРА
  const sideEdges = useMemo(() => {
    const edges = []
    for (let i = 0; i < segments; i++) {
      const start = basePoints[i]
      const end = apexPoint
      
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
        center
      })
    }
    return edges
  }, [basePoints, apexPoint])

  const allEdges = [...bottomEdges, ...sideEdges]

  // Состояние для видимости ребер (только для нижних)
  const [visibleEdges, setVisibleEdges] = useState({})

  // Логика пунктиров только для нижних ребер
  useFrame(({ camera }) => {
    if (!groupRef.current) return
    
    const matrix = groupRef.current.matrixWorld
    const newVisibleEdges = {}
    
    // Обновляем только для нижних ребер
    bottomEdges.forEach(edge => {
      if (!edge.center) return
      
      const worldCenter = edge.center.clone().applyMatrix4(matrix)
      const toCam = camera.position.clone().sub(worldCenter).normalize()
      const dir = worldCenter.clone().normalize()
      
      const isVisible = dir.dot(toCam) > 0
      newVisibleEdges[`bottom-${edge.index}`] = isVisible
    })
    
    setVisibleEdges(newVisibleEdges)
  })

  // Проверка выделения
  const isEdgeSelected = (type, index) => {
    return snap.selectedEdge?.type === type && snap.selectedEdge?.index === index
  }

  return (
    <group ref={groupRef} position={[1.5, -0.8, 0]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2]} intensity={0.8} />
      
      <group ref={meshRef} position={[0, -0.3, 0]}>
        {/* ГРАНИ */}
        {faces.map((geometry, i) => (
          <mesh key={`face-${i}`} geometry={geometry}>
            <meshBasicMaterial 
              color={snap.color} 
              transparent 
              opacity={0.25} 
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
        
        {/* РЕБРА */}
        {allEdges.map((edge) => {
          const isVisible = visibleEdges[`${edge.type}-${edge.index}`]
          const isSelected = isEdgeSelected(edge.type, edge.index)
          
          let material
          
          if (isSelected) {
            material = new THREE.LineBasicMaterial({ color: '#ffaa00', linewidth: 3 })
          } 
          else if (edge.type === 'side') {
            // Боковые ребра - все сплошные, кроме 4-го (индекс 3)
            if (edge.index === 3) {
              material = new THREE.LineDashedMaterial({ 
                color: '#888888', 
                dashSize: 0.08, 
                gapSize: 0.06, 
                linewidth: 1.5 
              })
            } else {
              material = new THREE.LineBasicMaterial({ color: '#000000', linewidth: 2 })
            }
          }
          else {
            // Нижние ребра - по видимости
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
          
          return (
            <lineSegments
              key={`${edge.type}-${edge.index}`}
              geometry={edge.geometry}
              material={material}
              {...(material instanceof THREE.LineDashedMaterial && { onUpdate: self => self?.computeLineDistances?.() })}
            />
          )
        })}
        
        {/* ТОЧКИ ОСНОВАНИЯ */}
        {basePoints.map((point, i) => (
          <mesh key={`base-${i}`} position={[point.x, point.y, point.z]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color="#55ff55" emissive="#003300" />
          </mesh>
        ))}
        
        {/* ВЕРШИНА */}
        <mesh position={[apexPoint.x, apexPoint.y, apexPoint.z]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#ff5555" emissive="#330000" />
        </mesh>
      </group>
    </group>
  )
}

export default Figure