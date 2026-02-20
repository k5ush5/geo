import React, { useRef, useState, useMemo } from 'react'
import { useSnapshot } from 'valtio'
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import state from '../store';

const Figure = () => {
  const snap = useSnapshot(state)
  const meshRef = useRef()
  const groupRef = useRef()
  
  const logoTexture = useTexture(snap.logoDecal)
  const fullTexture = useTexture(snap.fullDecal)

  // Параметры пирамиды
  const pyramidParams = {
    radius: 1.2,
    height: 2.2,
    radialSegments: 4,
    color: "#4a7db5",
    opacity: 0.3,
    edgeColor: "#000000",
    edgeBackColor: "#888888",
    dashSize: 0.08,
    gapSize: 0.06,
    edgeThickness: 4,
    vertexTopColor: "#ff5555",
    vertexBottomColor: "#55ff55"
  }

  // Получаем все ребра с дополнительной информацией
  const { edgeData, bottomEdges } = useMemo(() => {
    const geometry = new THREE.ConeGeometry(
      pyramidParams.radius,
      pyramidParams.height,
      pyramidParams.radialSegments
    )
    const edges = new THREE.EdgesGeometry(geometry, 15)
    const positions = edges.attributes.position.array
    
    // Собираем данные о каждом ребре
    const data = []
    const bottomEdgesIndices = []
    
    for (let i = 0; i < positions.length; i += 6) {
      const p1 = new THREE.Vector3(positions[i], positions[i+1], positions[i+2])
      const p2 = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5])
      const center = p1.clone().add(p2).multiplyScalar(0.5)
      
      // Определяем, является ли ребро нижним (оба конца внизу)
      const isBottom = 
        Math.abs(p1.y + pyramidParams.height/2) < 0.01 && 
        Math.abs(p2.y + pyramidParams.height/2) < 0.01;
      
      if (isBottom) {
        bottomEdgesIndices.push(data.length);
      }
      
      data.push({
        p1, p2,
        center,
        isBottom,
        vertices: [
          positions[i], positions[i+1], positions[i+2],
          positions[i+3], positions[i+4], positions[i+5]
        ]
      })
    }
    
    return { edgeData: data, bottomEdges: bottomEdgesIndices }
  }, [])

  // Состояния для геометрии
  const [visibleEdges, setVisibleEdges] = useState(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  })
  
  const [hiddenEdges, setHiddenEdges] = useState(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  })

  // Материалы
  const solidMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: pyramidParams.edgeColor,
      linewidth: pyramidParams.edgeThickness
    })
  }, [])

  const dashMaterial = useMemo(() => {
    const material = new THREE.LineDashedMaterial({
      color: pyramidParams.edgeBackColor,
      dashSize: pyramidParams.dashSize,
      gapSize: pyramidParams.gapSize,
      linewidth: pyramidParams.edgeThickness * 0.8
    })
    return material
  }, [])

  // Функция для определения видимости ребра
  const isEdgeVisible = (edge, cameraPos, groupMatrix, cameraHeight) => {
    // Получаем центр ребра в мировых координатах
    const worldCenter = edge.center.clone().applyMatrix4(groupMatrix)
    
    // Направление от центра пирамиды к ребру
    const dirFromCenter = worldCenter.clone().normalize()
    
    // Направление от ребра к камере
    const dirToCamera = cameraPos.clone().sub(worldCenter).normalize()
    
    // Скалярное произведение
    const dot = dirFromCenter.dot(dirToCamera)
    
    // Базовое условие видимости
    const isBasicallyVisible = dot > -0.7
    
    // Если это нижнее ребро, применяем специальную логику
    if (edge.isBottom) {
      // Порог высоты камеры (относительно нижней точки пирамиды)
      // Чем меньше значение, тем ниже должна быть камера
      const LOW_CAMERA_THRESHOLD = -0.5; // Подберите это значение под вашу сцену
      
      // Получаем высоту камеры в локальных координатах пирамиды
      const localCameraPos = cameraPos.clone().applyMatrix4(groupMatrix.clone().invert());
      const cameraY = localCameraPos.y;
      
      // Камера считается "в самом низу", если она ниже определенного порога
      const isCameraVeryLow = cameraY < LOW_CAMERA_THRESHOLD;
      
      // Если камера низко, то дальние нижние ребра становятся сплошными
      if (isCameraVeryLow) {
        // Для нижних ребер используем другую логику видимости
        // Теперь они видны, если dot > -0.2 (более строгое условие)
        // или если они находятся с противоположной стороны
        return dot > -0.2;
      }
    }
    
    // Для всех остальных случаев используем стандартную логику
    return isBasicallyVisible
  }

  // Обновляем видимость ребер
  const updateEdges = (cameraPos) => {
    if (!groupRef.current || !edgeData) return

    const groupMatrix = groupRef.current.matrixWorld
    
    // Получаем высоту камеры в локальных координатах
    const localCameraPos = cameraPos.clone().applyMatrix4(groupMatrix.clone().invert());
    const cameraY = localCameraPos.y;
    
    const visibleVerts = []
    const hiddenVerts = []
    
    edgeData.forEach(edge => {
      const visible = isEdgeVisible(edge, cameraPos, groupMatrix, cameraY)
      
      if (visible) {
        visibleVerts.push(...edge.vertices)
      } else {
        hiddenVerts.push(...edge.vertices)
      }
    })
    
    // Обновляем геометрии
    const newVisibleGeo = new THREE.BufferGeometry()
    if (visibleVerts.length > 0) {
      newVisibleGeo.setAttribute('position', new THREE.Float32BufferAttribute(visibleVerts, 3))
    } else {
      newVisibleGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    }
    
    const newHiddenGeo = new THREE.BufferGeometry()
    if (hiddenVerts.length > 0) {
      newHiddenGeo.setAttribute('position', new THREE.Float32BufferAttribute(hiddenVerts, 3))
    } else {
      newHiddenGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    }
    
    setVisibleEdges(newVisibleGeo)
    setHiddenEdges(newHiddenGeo)
  }

  // Обновляем при каждом кадре
  useFrame(({ camera }) => {
    if (groupRef.current) {
      updateEdges(camera.position)
    }
  })

  return (
    <group ref={groupRef} position={[1.5, -0.8, 0]}>
      {/* Освещение */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-3, 2, 4]} intensity={1.0} />
      
      {/* Основная пирамида */}
      <group ref={meshRef} position={[0, -0.3, 0]}>
        {/* Прозрачный корпус - синий */}
        <mesh castShadow receiveShadow>
          <coneGeometry 
            args={[
              pyramidParams.radius, 
              pyramidParams.height, 
              pyramidParams.radialSegments
            ]} 
          />
          <meshPhongMaterial
            color={pyramidParams.color}
            transparent={true}
            opacity={pyramidParams.opacity}
            shininess={40}
            emissive="#102030"
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* ВИДИМЫЕ РЕБРА - сплошные черные */}
        {visibleEdges.attributes.position.count > 0 && (
          <lineSegments
            geometry={visibleEdges}
            material={solidMaterial}
            renderOrder={2}
          />
        )}
        
        {/* НЕВИДИМЫЕ РЕБРА - пунктирные серые */}
        {hiddenEdges.attributes.position.count > 0 && (
          <lineSegments
            geometry={hiddenEdges}
            material={dashMaterial}
            renderOrder={1}
            onUpdate={self => self.computeLineDistances()}
          />
        )}
        
        {/* Вершина - красная */}
        <mesh position={[0, pyramidParams.height/2, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={pyramidParams.vertexTopColor} emissive="#330000" />
        </mesh>
        
        {/* Нижние вершины - зеленые */}
        {(() => {
          const points = []
          const angleStep = (Math.PI * 2) / pyramidParams.radialSegments
          for (let i = 0; i < pyramidParams.radialSegments; i++) {
            const angle = i * angleStep
            const x = Math.cos(angle) * pyramidParams.radius
            const z = Math.sin(angle) * pyramidParams.radius
            points.push([x, -pyramidParams.height/2, z])
          }
          return points.map((pos, i) => (
            <mesh key={i} position={pos}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color={pyramidParams.vertexBottomColor} emissive="#003300" />
            </mesh>
          ))
        })()}
      </group>
    </group>
  )
}

export default Figure