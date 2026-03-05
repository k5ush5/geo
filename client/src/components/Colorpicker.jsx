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
    <div className="absolute left-full ml-3">
      <div className="relative">
        {/* Крестик для закрытия */}
        <button 
          onClick={handleClose}
          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10 transition-colors"
          aria-label="Закрыть"
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
  )
}

export default Colorpicker