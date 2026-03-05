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
  
  // Базовые параметры при всех ребрах = 5
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
      // Радиус прямо пропорционален размеру нижнего ребра
      const radius = baseRadius * (bottomSizes[i] / 5)
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        -baseHeight/2,
        Math.sin(angle) * radius
      ))
    }
    return points
  }, [bottomSizes])

  // ВЕРШИНА - теперь ищем точное решение для всех боковых ребер
  const apexPoint = useMemo(() => {
    // Начальное приближение
    let point = new THREE.Vector3(0, baseHeight/2, 0)
    
    // Точный итеративный поиск позиции вершины
    const iterations = 100
    const learningRate = 0.05
    
    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new THREE.Vector3(0, 0, 0)
      let totalError = 0
      
      for (let i = 0; i < segments; i++) {
        const basePoint = basePoints[i]
        // Целевая длина бокового ребра (прямая пропорция)
        const targetLength = baseHeight * (sideSizes[i] / 5)
        
        const currentVec = new THREE.Vector3().subVectors(point, basePoint)
        const currentLength = currentVec.length()
        
        if (currentLength < 0.001) continue
        
        // Ошибка: насколько текущая длина отличается от целевой
        const error = (currentLength - targetLength) / targetLength
        
        // Направление от основания к вершине
        const dir = currentVec.clone().normalize()
        
        // Добавляем градиент
        gradients.addScaledVector(dir, -error * learningRate * targetLength)
        totalError += Math.abs(error)
      }
      
      // Обновляем точку
      point.add(gradients)
      
      // Если ошибка маленькая - выходим
      if (totalError < 0.01) break
    }
    
    return point
  }, [basePoints, sideSizes])

  // Вычисляем реальные длины боковых ребер для проверки
  const actualSideLengths = useMemo(() => {
    return basePoints.map(basePoint => 
      new THREE.Vector3().subVectors(apexPoint, basePoint).length()
    )
  }, [basePoints, apexPoint])

  // Для отладки (можно посмотреть в консоли)
  useEffect(() => {
    console.log('Заданные размеры боковых:', sideSizes)
    console.log('Фактические длины:', actualSideLengths.map(l => (l / baseHeight * 5).toFixed(2)))
  }, [sideSizes, actualSideLengths])

  // Вычисляем масштаб для помещаемости на экран
  const scale = useMemo(() => {
    // Находим максимальный размер среди всех точек
    const allPoints = [...basePoints, apexPoint]
    let maxCoord = 0
    allPoints.forEach(p => {
      maxCoord = Math.max(maxCoord, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))
    })
    
    // Целевой максимальный размер на экране (чтобы не уезжало)
    const targetMax = 2.5
    
    // Если фигура слишком большая - уменьшаем, иначе оставляем как есть
    return maxCoord > targetMax ? targetMax / maxCoord : 1.0
  }, [basePoints, apexPoint])

  // Смещение центра (чтобы фигура была по центру)
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

  // ГРАНИ (с центрированием и масштабированием)
  const faces = useMemo(() => {
    const geometries = []
    
    for (let i = 0; i < segments; i++) {
      const nextI = (i + 1) % segments
      
      const p1 = new THREE.Vector3(
        (basePoints[i].x - centerOffset.x) * scale,
        (basePoints[i].y - centerOffset.y) * scale,
        (basePoints[i].z - centerOffset.z) * scale
      )
      const p2 = new THREE.Vector3(
        (apexPoint.x - centerOffset.x) * scale,
        (apexPoint.y - centerOffset.y) * scale,
        (apexPoint.z - centerOffset.z) * scale
      )
      const p3 = new THREE.Vector3(
        (basePoints[nextI].x - centerOffset.x) * scale,
        (basePoints[nextI].y - centerOffset.y) * scale,
        (basePoints[nextI].z - centerOffset.z) * scale
      )
      
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
    const p0 = new THREE.Vector3(
      (basePoints[0].x - centerOffset.x) * scale,
      (basePoints[0].y - centerOffset.y) * scale,
      (basePoints[0].z - centerOffset.z) * scale
    )
    const p1 = new THREE.Vector3(
      (basePoints[1].x - centerOffset.x) * scale,
      (basePoints[1].y - centerOffset.y) * scale,
      (basePoints[1].z - centerOffset.z) * scale
    )
    const p2 = new THREE.Vector3(
      (basePoints[2].x - centerOffset.x) * scale,
      (basePoints[2].y - centerOffset.y) * scale,
      (basePoints[2].z - centerOffset.z) * scale
    )
    const p3 = new THREE.Vector3(
      (basePoints[3].x - centerOffset.x) * scale,
      (basePoints[3].y - centerOffset.y) * scale,
      (basePoints[3].z - centerOffset.z) * scale
    )
    
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
  }, [basePoints, apexPoint, centerOffset, scale])

  // НИЖНИЕ РЕБРА
  const bottomEdges = useMemo(() => {
    const edges = []
    for (let i = 0; i < segments; i++) {
      const start = new THREE.Vector3(
        (basePoints[i].x - centerOffset.x) * scale,
        (basePoints[i].y - centerOffset.y) * scale,
        (basePoints[i].z - centerOffset.z) * scale
      )
      const end = new THREE.Vector3(
        (basePoints[(i + 1) % segments].x - centerOffset.x) * scale,
        (basePoints[(i + 1) % segments].y - centerOffset.y) * scale,
        (basePoints[(i + 1) % segments].z - centerOffset.z) * scale
      )
      
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
  }, [basePoints, centerOffset, scale])

  // БОКОВЫЕ РЕБРА
  const sideEdges = useMemo(() => {
    const edges = []
    for (let i = 0; i < segments; i++) {
      const start = new THREE.Vector3(
        (basePoints[i].x - centerOffset.x) * scale,
        (basePoints[i].y - centerOffset.y) * scale,
        (basePoints[i].z - centerOffset.z) * scale
      )
      const end = new THREE.Vector3(
        (apexPoint.x - centerOffset.x) * scale,
        (apexPoint.y - centerOffset.y) * scale,
        (apexPoint.z - centerOffset.z) * scale
      )
      
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
  }, [basePoints, apexPoint, centerOffset, scale])

  const allEdges = [...bottomEdges, ...sideEdges]

  // Состояние для видимости ребер
  const [visibleEdges, setVisibleEdges] = useState({})

  // Логика пунктиров
  useFrame(({ camera }) => {
    if (!groupRef.current) return
    
    const matrix = groupRef.current.matrixWorld
    const newVisibleEdges = {}
    
    allEdges.forEach(edge => {
      if (!edge.center) return
      
      const worldCenter = edge.center.clone().applyMatrix4(matrix)
      const toCam = camera.position.clone().sub(worldCenter).normalize()
      const dir = worldCenter.clone().normalize()
      
      const isVisible = dir.dot(toCam) > 0
      newVisibleEdges[`${edge.type}-${edge.index}`] = isVisible
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
            // Боковые ребра - все сплошные черные (кроме 4-го для теста)
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
          <mesh 
            key={`base-${i}`} 
            position={[
              (point.x - centerOffset.x) * scale,
              (point.y - centerOffset.y) * scale,
              (point.z - centerOffset.z) * scale
            ]}
          >
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color="#55ff55" emissive="#003300" />
          </mesh>
        ))}
        
        {/* ВЕРШИНА */}
        <mesh 
          position={[
            (apexPoint.x - centerOffset.x) * scale,
            (apexPoint.y - centerOffset.y) * scale,
            (apexPoint.z - centerOffset.z) * scale
          ]}
        >
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#ff5555" emissive="#330000" />
        </mesh>
      </group>
    </group>
  )
}

export default Figure