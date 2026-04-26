import React from 'react'
import { SketchPicker } from 'react-color'
import { useSnapshot } from 'valtio'
import state from '../store'

const Colorpicker = ({ onClose }) => {
  const snap = useSnapshot(state);

  // Функция для закрытия
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
  <div
    style={{
      position: window.innerWidth < 768 ? 'fixed' : 'absolute',
      bottom: window.innerWidth < 768 ? 0 : 'auto',
      left: window.innerWidth < 768 ? 0 : '100%',
      width: window.innerWidth < 768 ? '100%' : '320px',
      zIndex: 30
    }}
  >
    <div
      className="border border-gray-700 rounded-t-xl"
      style={{
        maxHeight: window.innerWidth < 768 ? '45vh' : 'auto',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
    >
    <div className="relative flex justify-center items-center h-full">
      
      <button 
        onClick={handleClose}
        className="absolute top-2 right-2 w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold z-10"
      >
        ×
      </button>
      
      <SketchPicker 
        color={snap.color}
        disableAlpha
        onChange={(color) => state.color = color.hex}
      />
      
    </div>
  </div>
  </div>
)
}

export default Colorpicker