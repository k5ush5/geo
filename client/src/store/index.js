import { proxy } from "valtio";
const state = proxy({
    intro: true,
    color: 'rgb(36, 151, 222)', 
    isLogoTexture: true,
    isFullTexture: false,
    logoDecal: '../public/threejs.png',
    fullDecal: '../public/threejs.png',
    cameraRigRotation: { x: 0, y: 0, z: 0 }
});
export default state