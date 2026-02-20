import React, {useRef, useEffect} from 'react'
import {useFrame} from '@react-three/fiber';
import {easing} from 'maath';
import { useSnapshot } from 'valtio';
import state from '../store';

const CameraRig = ({children}) => {
  const group = useRef();
  const snap = useSnapshot(state);
  
  useFrame((state, delta) => {
    if (!group.current) return;
    
    // Сохраняем текущий поворот
    const rotation = group.current.rotation
    state.cameraRigRotation = {
      x: rotation.x,
      y: rotation.y,
      z: rotation.z
    }
    
    // МЕНЯЕМ ТОЛЬКО Y (горизонтальный поворот), X ЗАКРЕПЛЕН НА 0
    easing.dampE(
      group.current.rotation,
      [0, -state.pointer.x/1.27, 0], // X всегда 0, меняется только Y
      0.25,
      delta
    )
  })
 
  return <group ref={group}>{children}</group>
}

export default CameraRig