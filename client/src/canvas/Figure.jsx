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

  // Разделяем ребра на категории с информацией о позиции
  const { bottomEdges, otherEdges, bottomEdgesData } = useMemo(() => {
    const geometry = new THREE.ConeGeometry(
      pyramidParams.radius,
      pyramidParams.height,
      pyramidParams.radialSegments
    )
    const edges = new THREE.EdgesGeometry(geometry, 15)
    const positions = edges.attributes.position.array
    
    const bottom = []
    const other = []
    const bottomData = []
    
    for (let i = 0; i < positions.length; i += 6) {
      const p1 = new THREE.Vector3(positions[i], positions[i+1], positions[i+2])
      const p2 = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5])
      const center = p1.clone().add(p2).multiplyScalar(0.5)
      
      const verts = [
        positions[i], positions[i+1], positions[i+2],
        positions[i+3], positions[i+4], positions[i+5]
      ]
      
      // Проверяем, является ли ребро нижним
      const isBottom = 
        Math.abs(p1.y + pyramidParams.height/2) < 0.01 && 
        Math.abs(p2.y + pyramidParams.height/2) < 0.01;
      
      if (isBottom) {
        bottom.push(...verts)
        bottomData.push({
          center: center.clone(),
          vertices: verts
        })
      } else {
        other.push(...verts)
      }
    }
    
    // Создаем геометрии
    const bottomGeo = new THREE.BufferGeometry()
    if (bottom.length > 0) {
      bottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(bottom, 3))
    }
    
    const otherGeo = new THREE.BufferGeometry()
    if (other.length > 0) {
      otherGeo.setAttribute('position', new THREE.Float32BufferAttribute(other, 3))
    }
    
    return { 
      bottomEdges: bottomGeo,
      bottomEdgesData: bottomData,
      otherEdges: otherGeo 
    }
  }, [])

  // Состояния для нижних ребер (передние/задние)
  const [visibleBottomEdges, setVisibleBottomEdges] = useState(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  })
  
  const [hiddenBottomEdges, setHiddenBottomEdges] = useState(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  })

  // Состояния для остальных ребер
  const [visibleOtherEdges, setVisibleOtherEdges] = useState(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  })
  
  const [hiddenOtherEdges, setHiddenOtherEdges] = useState(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    return geo
  })

  // Данные для остальных ребер
  const { otherEdgeData } = useMemo(() => {
    if (!otherEdges.attributes?.position) return { otherEdgeData: [] }
    
    const positions = otherEdges.attributes.position.array
    const data = []
    
    for (let i = 0; i < positions.length; i += 6) {
      const p1 = new THREE.Vector3(positions[i], positions[i+1], positions[i+2])
      const p2 = new THREE.Vector3(positions[i+3], positions[i+4], positions[i+5])
      const center = p1.clone().add(p2).multiplyScalar(0.5)
      
      data.push({
        center,
        vertices: [
          positions[i], positions[i+1], positions[i+2],
          positions[i+3], positions[i+4], positions[i+5]
        ]
      })
    }
    
    return { otherEdgeData: data }
  }, [otherEdges])

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
  const isEdgeVisible = (edge, cameraPos, groupMatrix) => {
    const worldCenter = edge.center.clone().applyMatrix4(groupMatrix)
    const dirFromCenter = worldCenter.clone().normalize()
    const dirToCamera = cameraPos.clone().sub(worldCenter).normalize()
    const dot = dirFromCenter.dot(dirToCamera)
    
    return dot > -0.7
  }

  // Функция для определения, является ли нижнее ребро передним относительно камеры
  const isBottomEdgeFront = (edge, cameraPos, groupMatrix) => {
    const worldCenter = edge.center.clone().applyMatrix4(groupMatrix)
    const dirFromCenter = worldCenter.clone().normalize()
    const dirToCamera = cameraPos.clone().sub(worldCenter).normalize()
    const dot = dirFromCenter.dot(dirToCamera)
    
    return dot > -0
  }

  // Обновляем все ребра
  const updateEdges = (cameraPos) => {
    if (!groupRef.current) return

    const groupMatrix = groupRef.current.matrixWorld
    
    // Обновляем нижние ребра
    const visibleBottomVerts = []
    const hiddenBottomVerts = []
    
    bottomEdgesData.forEach(edge => {
      const isFront = isBottomEdgeFront(edge, cameraPos, groupMatrix)
      
      if (isFront) {
        visibleBottomVerts.push(...edge.vertices)
      } else {
        hiddenBottomVerts.push(...edge.vertices)
      }
    })
    
    const newVisibleBottomGeo = new THREE.BufferGeometry()
    if (visibleBottomVerts.length > 0) {
      newVisibleBottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(visibleBottomVerts, 3))
    }
    
    const newHiddenBottomGeo = new THREE.BufferGeometry()
    if (hiddenBottomVerts.length > 0) {
      newHiddenBottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(hiddenBottomVerts, 3))
    }
    
    setVisibleBottomEdges(newVisibleBottomGeo)
    setHiddenBottomEdges(newHiddenBottomGeo)
    
    // Обновляем остальные ребра
    if (otherEdgeData.length) {
      const visibleOtherVerts = []
      const hiddenOtherVerts = []
      
      otherEdgeData.forEach(edge => {
        const visible = isEdgeVisible(edge, cameraPos, groupMatrix)
        
        if (visible) {
          visibleOtherVerts.push(...edge.vertices)
        } else {
          hiddenOtherVerts.push(...edge.vertices)
        }
      })
      
      const newVisibleOtherGeo = new THREE.BufferGeometry()
      if (visibleOtherVerts.length > 0) {
        newVisibleOtherGeo.setAttribute('position', new THREE.Float32BufferAttribute(visibleOtherVerts, 3))
      }
      
      const newHiddenOtherGeo = new THREE.BufferGeometry()
      if (hiddenOtherVerts.length > 0) {
        newHiddenOtherGeo.setAttribute('position', new THREE.Float32BufferAttribute(hiddenOtherVerts, 3))
      }
      
      setVisibleOtherEdges(newVisibleOtherGeo)
      setHiddenOtherEdges(newHiddenOtherGeo)
    }
  }

  useFrame(({ camera }) => {
    if (groupRef.current) {
      updateEdges(camera.position)
    }
  })

  return (
    <group ref={groupRef} position={[1.5, -0.8, 0]}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-3, 2, 4]} intensity={1.0} />
      
      <group ref={meshRef} position={[0, -0.3, 0]}>
        {/* Прозрачный корпус */}
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
        
        {/* НИЖНИЕ РЕБРА - меняются в зависимости от поворота */}
        {visibleBottomEdges.attributes?.position?.count > 0 && (
          <lineSegments
            geometry={visibleBottomEdges}
            material={solidMaterial}
            renderOrder={2}
          />
        )}
        
        {hiddenBottomEdges.attributes?.position?.count > 0 && (
          <lineSegments
            geometry={hiddenBottomEdges}
            material={dashMaterial}
            renderOrder={1}
            onUpdate={self => self.computeLineDistances()}
          />
        )}
        
        {/* ОСТАЛЬНЫЕ РЕБРА - меняются по видимости */}
        {visibleOtherEdges.attributes?.position?.count > 0 && (
          <lineSegments
            geometry={visibleOtherEdges}
            material={solidMaterial}
            renderOrder={2}
          />
        )}
        
        {hiddenOtherEdges.attributes?.position?.count > 0 && (
          <lineSegments
            geometry={hiddenOtherEdges}
            material={dashMaterial}
            renderOrder={1}
            onUpdate={self => self.computeLineDistances()}
          />
        )}
        
        {/* Вершина */}
        <mesh position={[0, pyramidParams.height/2, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={pyramidParams.vertexTopColor} emissive="#330000" />
        </mesh>
        
        {/* Нижние вершины */}
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