import { useRef, useMemo, useState } from 'react'
import { useSnapshot } from 'valtio'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import state from '../store'

const Figure = () => {
  const snap = useSnapshot(state)
  const meshRef = useRef()
  const groupRef = useRef()
  const params = {
    radius: 1.2, height: 2.2, segments: 4,
    color: "#4a7db5", opacity: 0.3,
    edgeColor: "#000000", edgeBackColor: "#888888",
    dashSize: 0.08, gapSize: 0.06, edgeThickness: 4,
    vertexTop: "#ff5555", vertexBottom: "#55ff55"
  }

  const { bottomEdges, otherEdges } = useMemo(() => {
    const geo = new THREE.ConeGeometry(params.radius, params.height, params.segments)
    const edges = new THREE.EdgesGeometry(geo, 15)
    const pos = edges.attributes.position.array
    const bottom = [], other = []
    
    for (let i = 0; i < pos.length; i += 6) {
      const y1 = pos[i+1], y2 = pos[i+4]
      const isBottom = Math.abs(y1 + params.height/2) < 0.01 && Math.abs(y2 + params.height/2) < 0.01
      const target = isBottom ? bottom : other
      target.push(pos[i], pos[i+1], pos[i+2], pos[i+3], pos[i+4], pos[i+5])
    }
    
    return {
      bottomEdges: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bottom, 3)),
      otherEdges: new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(other, 3))
    }
  }, [])

  const edgesData = useMemo(() => {
    const extract = (geo) => {
      if (!geo.attributes?.position) return []
      const pos = geo.attributes.position.array
      const data = []
      for (let i = 0; i < pos.length; i += 6) {
        const p1 = new THREE.Vector3(pos[i], pos[i+1], pos[i+2])
        const p2 = new THREE.Vector3(pos[i+3], pos[i+4], pos[i+5])
        data.push({
          center: p1.clone().add(p2).multiplyScalar(0.5),
          verts: [pos[i], pos[i+1], pos[i+2], pos[i+3], pos[i+4], pos[i+5]]
        })
      }
      return data
    }
    return { bottom: extract(bottomEdges), other: extract(otherEdges) }
  }, [bottomEdges, otherEdges])

  const [visible, setVisible] = useState({
    bottom: new THREE.BufferGeometry(),
    other: new THREE.BufferGeometry()
  })
  
  const [hidden, setHidden] = useState({
    bottom: new THREE.BufferGeometry(),
    other: new THREE.BufferGeometry()
  })

  const materials = {
    solid: new THREE.LineBasicMaterial({ color: params.edgeColor, linewidth: params.edgeThickness }),
    dash: new THREE.LineDashedMaterial({ 
      color: params.edgeBackColor, dashSize: params.dashSize, gapSize: params.gapSize, linewidth: params.edgeThickness * 0.8 
    })
  }

  useFrame(({ camera }) => {
    if (!groupRef.current) return
    const matrix = groupRef.current.matrixWorld
    const update = (data, isBottom) => {
      const verts = { visible: [], hidden: [] }
      data.forEach(edge => {
        const worldCenter = edge.center.clone().applyMatrix4(matrix)
        const dir = worldCenter.clone().normalize()
        const toCam = camera.position.clone().sub(worldCenter).normalize()
        const isVisible = isBottom ? dir.dot(toCam) > 0 : dir.dot(toCam) > -0.7
        verts[isVisible ? 'visible' : 'hidden'].push(...edge.verts)
      })
      
      Object.entries(verts).forEach(([type, arr]) => {
        const geo = new THREE.BufferGeometry()
        if (arr.length) geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
        if (isBottom) {
          setVisible(prev => ({ ...prev, bottom: type === 'visible' ? geo : prev.bottom }))
          setHidden(prev => ({ ...prev, bottom: type === 'hidden' ? geo : prev.hidden }))
        } else {
          setVisible(prev => ({ ...prev, other: type === 'visible' ? geo : prev.other }))
          setHidden(prev => ({ ...prev, other: type === 'hidden' ? geo : prev.hidden }))
        }
      })
    }
    
    update(edgesData.bottom, true)
    update(edgesData.other, false)
  })

  const renderEdges = (type, geo) => geo.attributes?.position?.count > 0 && (
    <lineSegments geometry={geo} material={materials[type]} renderOrder={type === 'solid' ? 2 : 1} 
      {...type === 'dash' && { onUpdate: self => self.computeLineDistances() }} />
  )

  return (
    <group ref={groupRef} position={[1.5, -0.8, 0]}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-3, 2, 4]} intensity={1.0} />
      
      <group ref={meshRef} position={[0, -0.3, 0]}>
        <mesh castShadow receiveShadow>
          <coneGeometry args={[params.radius, params.height, params.segments]} />
          <meshPhongMaterial color={params.color} transparent opacity={params.opacity} shininess={40} emissive="#102030" side={THREE.DoubleSide} />
        </mesh>
        
        {renderEdges('solid', visible.bottom)}
        {renderEdges('dash', hidden.bottom)}
        {renderEdges('solid', visible.other)}
        {renderEdges('dash', hidden.other)}
        
        <mesh position={[0, params.height/2, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={params.vertexTop} emissive="#330000" />
        </mesh>
        
        {Array(params.segments).fill().map((_, i) => {
          const angle = i * (Math.PI * 2) / params.segments
          return (
            <mesh key={i} position={[Math.cos(angle) * params.radius, -params.height/2, Math.sin(angle) * params.radius]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color={params.vertexBottom} emissive="#003300" />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

export default Figure