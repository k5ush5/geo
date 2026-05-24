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
    
    edgeSizes: {
        bottom: [5,5,5,5],
        side: [5,5,5,5],

        cube: {
            width: 5,
            depth: 5,
            height: 5
        }
    },
    
    manuallyChanged: new Set(),
    currentFigure: 'pyramid',
    aipickerMode: false,
    tempPoints: [],
    sectionPlaneData: null,
});

export default state;