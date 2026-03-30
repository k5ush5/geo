import {Canvas} from '@react-three/fiber'
import Figure from './Figure'
import { useSnapshot } from 'valtio'
import state from '../store'
import { Environment, Center, OrbitControls } from '@react-three/drei'
const CanvasModel = () => {
  const snap = useSnapshot(state)
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <Environment preset='city'/>
        <Center>
          <Figure />
        </Center>
        <OrbitControls
          enabled={!snap.aipickerMode}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={0.8}
        />
    </Canvas>
  )
}

export default CanvasModel