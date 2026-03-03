import { proxy } from "valtio";
const state = proxy({
    intro: true,
    color: 'rgb(36, 151, 222)', 
    isLogoTexture: true,
    isFullTexture: false,
    logoDecal: '../public/threejs.png',
    fullDecal: '../public/threejs.png',
    cameraRigRotation: { x: 0, y: 0, z: 0 },
   selectedEdge: null,
  // Выбранное ребро
  selectedEdge: {
    type: 'bottom', // 'bottom' или 'side'
    index: 0,
    isVisible: true
  },
   selectedEdge: null,  // ← ДОЛЖНО БЫТЬ ТОЧНО null
  
  // Реальные размеры ребер в см
   edgeSizes: {
    bottom: [5, 5, 5, 5],
    side: [5, 5, 5, 5]  // ТОЖЕ 5!
  }
});
export default state