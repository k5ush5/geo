import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import state from '../store';

const Filepicker = ({ onClose }) => {
  const snap = useSnapshot(state);
  
  const [selectedType, setSelectedType] = useState('bottom');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputValue, setInputValue] = useState('5');

  useEffect(() => {
    state.selectedEdge = null;
    const timer = setTimeout(() => {
      state.selectedEdge = {
        type: selectedType,
        index: selectedIndex
      };
    }, 10);
    return () => {
      clearTimeout(timer);
      state.selectedEdge = null;
    };
  }, []);

  useEffect(() => {
    state.selectedEdge = {
      type: selectedType,
      index: selectedIndex
    };
  }, [selectedType, selectedIndex]);

  // Проверка неравенства треугольника с запасом
  const isValidTriangle = (a, b, c) => {
    return (a + b > c + 0.1) && (a + c > b + 0.1) && (b + c > a + 0.1);
  };

  const applySize = () => {
    const newSize = parseFloat(inputValue);
    if (isNaN(newSize) || newSize <= 0 || newSize > 20) return;

    const newBottom = [...snap.edgeSizes.bottom];
    const newSide = [...snap.edgeSizes.side];

    // Определяем, какое ребро меняем сейчас
    const currentKey = `${selectedType}-${selectedIndex}`;
    
    // Применяем новое значение — оно НЕ ДОЛЖНО меняться алгоритмом
    if (selectedType === 'side') {
      newSide[selectedIndex] = newSize;
    } else {
      newBottom[selectedIndex] = newSize;
    }

    // Множество вручную изменённых (из стора или новое)
    const manuallyChanged = new Set(snap.manuallyChanged || []);
    manuallyChanged.add(currentKey);

    // Подгоняем, пока все грани не станут валидными
    let changed = true;
    let iterations = 0;
    const maxIterations = 50;

    while (changed && iterations < maxIterations) {
      changed = false;

      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const a = newSide[i];
        const b = newBottom[i];
        const c = newSide[next];

        if (isValidTriangle(a, b, c)) continue;

        // Какая сторона слишком большая?
        if (a >= b + c) {
          // Сторона a слишком большая — увеличиваем b или c
          const needed = a - (b + c) + 1.0;
          
          // Проверяем, можно ли увеличить b (bottom[i])
          if (!manuallyChanged.has(`bottom-${i}`)) {
            newBottom[i] = Math.min(20, b + needed);
            changed = true;
          }
          // Проверяем, можно ли увеличить c (side[next])
          else if (!manuallyChanged.has(`side-${next}`)) {
            newSide[next] = Math.min(20, c + needed);
            changed = true;
          }
        }
        else if (b >= a + c) {
          const needed = b - (a + c) + 1.0;
          
          // Увеличиваем a или c
          if (!manuallyChanged.has(`side-${i}`)) {
            newSide[i] = Math.min(20, a + needed);
            changed = true;
          }
          else if (!manuallyChanged.has(`side-${next}`)) {
            newSide[next] = Math.min(20, c + needed);
            changed = true;
          }
        }
        else if (c >= a + b) {
          const needed = c - (a + b) + 1.0;
          
          // Увеличиваем a или b
          if (!manuallyChanged.has(`side-${i}`)) {
            newSide[i] = Math.min(20, a + needed);
            changed = true;
          }
          else if (!manuallyChanged.has(`bottom-${i}`)) {
            newBottom[i] = Math.min(20, b + needed);
            changed = true;
          }
        }
      }

      iterations++;
    }
    state.edgeSizes = { bottom: newBottom, side: newSide };
    state.manuallyChanged = manuallyChanged;
    state.tempPoints = [];
  };

  const closeWindow = () => {
    state.selectedEdge = null;
    onClose();
  };

  const currentSize = snap.edgeSizes[selectedType][selectedIndex];

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
      className="bg-gray-900 border border-gray-700 rounded-t-xl"
      style={{
        maxHeight: window.innerWidth < 768 ? '45vh' : 'auto',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-white font-bold">Размер ребра</h3>
        <button 
          onClick={closeWindow}
          className="text-gray-400 hover:text-white text-xl font-bold"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedType('bottom')}
            className={`flex-1 px-2 py-1 rounded text-sm ${
              selectedType === 'bottom' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            Нижние
          </button>
          <button
            onClick={() => setSelectedType('side')}
            className={`flex-1 px-2 py-1 rounded text-sm ${
              selectedType === 'side' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-300'
            }`}
          >
            Боковые
          </button>
        </div>

        <div>
          <p className="text-gray-400 text-xs mb-2">Номер:</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setSelectedIndex(num)}
                className={`w-8 h-8 rounded text-sm ${
                  selectedIndex === num 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {num + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 p-2 rounded text-center">
          <p className="text-gray-400 text-xs">Текущий</p>
          <p className="text-xl font-bold text-blue-400">
            {currentSize.toFixed(1)} см
          </p>
        </div>

        <input 
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          step="0.5"
          min="1"
          max="20"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
          placeholder="Новый размер"
        />

        <button
          onClick={applySize}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
        >
          Применить
        </button>
      </div>
    </div>
    </div>
  );
};

export default Filepicker;