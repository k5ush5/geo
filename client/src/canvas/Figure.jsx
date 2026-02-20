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

  // Разделяем ребра на три категории
  const { frontBottomEdges, rearBottomEdges, otherEdges } = useMemo(() => {
    const geometry = new THREE.ConeGeometry(
      pyramidParams.radius,
      pyramidParams.height,
      pyramidParams.radialSegments
    )
    const edges = new THREE.EdgesGeometry(geometry, 15)
    const positions = edges.attributes.position.array
    
    const frontBottom = []
    const rearBottom = []
    const other = []
    
    // Определяем направление "вперед" (например, по Z)
    const frontDir = new THREE.Vector3(0, 0, 1)
    
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
        // Определяем, переднее или заднее нижнее ребро
        if (center.z > 0) {
          frontBottom.push(...verts)
        } else {
          rearBottom.push(...verts)
        }
      } else {
        other.push(...verts)
      }
    }
    
    // Создаем геометрии
    const frontBottomGeo = new THREE.BufferGeometry()
    if (frontBottom.length > 0) {
      frontBottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(frontBottom, 3))
    }
    
    const rearBottomGeo = new THREE.BufferGeometry()
    if (rearBottom.length > 0) {
      rearBottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(rearBottom, 3))
    }
    
    const otherGeo = new THREE.BufferGeometry()
    if (other.length > 0) {
      otherGeo.setAttribute('position', new THREE.Float32BufferAttribute(other, 3))
    }
    
    return { 
      frontBottomEdges: frontBottomGeo, 
      rearBottomEdges: rearBottomGeo, 
      otherEdges: otherGeo 
    }
  }, [])

  // Состояния для остальных ребер (которые меняются)
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

  // Функция для определения видимости остальных ребер
  const isOtherEdgeVisible = (edge, cameraPos, groupMatrix) => {
    const worldCenter = edge.center.clone().applyMatrix4(groupMatrix)
    const dirFromCenter = worldCenter.clone().normalize()
    const dirToCamera = cameraPos.clone().sub(worldCenter).normalize()
    const dot = dirFromCenter.dot(dirToCamera)
    
    return dot > -0.7
  }

  // Обновляем только остальные ребра
  const updateOtherEdges = (cameraPos) => {
    if (!groupRef.current || !otherEdgeData.length) return

    const groupMatrix = groupRef.current.matrixWorld
    
    const visibleVerts = []
    const hiddenVerts = []
    
    otherEdgeData.forEach(edge => {
      const visible = isOtherEdgeVisible(edge, cameraPos, groupMatrix)
      
      if (visible) {
        visibleVerts.push(...edge.vertices)
      } else {
        hiddenVerts.push(...edge.vertices)
      }
    })
    
    const newVisibleGeo = new THREE.BufferGeometry()
    if (visibleVerts.length > 0) {
      newVisibleGeo.setAttribute('position', new THREE.Float32BufferAttribute(visibleVerts, 3))
    }
    
    const newHiddenGeo = new THREE.BufferGeometry()
    if (hiddenVerts.length > 0) {
      newHiddenGeo.setAttribute('position', new THREE.Float32BufferAttribute(hiddenVerts, 3))
    }
    
    setVisibleOtherEdges(newVisibleGeo)
    setHiddenOtherEdges(newHiddenGeo)
  }

  useFrame(({ camera }) => {
    if (groupRef.current) {
      updateOtherEdges(camera.position)
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
        
        {/* ПЕРЕДНИЕ НИЖНИЕ РЕБРА - сплошные */}
        {frontBottomEdges.attributes?.position?.count > 0 && (
          <lineSegments
            geometry={frontBottomEdges}
            material={solidMaterial}
            renderOrder={2}
          />
        )}
        
        {/* ЗАДНИЕ НИЖНИЕ РЕБРА - ВСЕГДА ПУНКТИРНЫЕ */}
        {rearBottomEdges.attributes?.position?.count > 0 && (
          <lineSegments
            geometry={rearBottomEdges}
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