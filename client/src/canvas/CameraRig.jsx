import React, {useRef, useEffect} from 'react'
import {useFrame} from '@react-three/fiber';
import {easing} from 'maath';
import { useSnapshot } from 'valtio';
import state from '../store';

const CameraRig = ({children}) => {
  const group = useRef();
  const snap = useSnapshot(state);
  
  useFrame((state, delta) => {
    // Сохраняем текущий поворот в глобальном состоянии
    if (group.current) {
      const rotation = group.current.rotation
      state.cameraRigRotation = {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z
      }
    }
    
    easing.dampE(
      group.current.rotation,
      [state.pointer.y / 3.5, -state.pointer.x/1.5, 0],
      0.25,
      delta
    )
  })
 
  return <group ref={group}>{children}</group>
}

export default CameraRig