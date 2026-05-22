import {Canvas} from '@react-three/fiber'
import Figure from './Figure'
import { useSnapshot } from 'valtio'
import state from '../store'
import { Environment, Center, OrbitControls } from '@react-three/drei'
const CanvasModel = () => {
  const snap = useSnapshot(state)
  return (
    <Canvas  style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.5} />
      {/* <Environment preset='city'/> */}
        <Center>
          <Figure />
        </Center>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          zoomSpeed={0.6}
          rotateSpeed={0.8}
        />
    </Canvas>
  )
}

export default CanvasModel