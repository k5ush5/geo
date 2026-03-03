import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import state from '../store';

const Filepicker = ({ onClose }) => {
  const snap = useSnapshot(state);
  
  const [selectedType, setSelectedType] = useState('bottom');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputValue, setInputValue] = useState('5');

  // При открытии окна - УБИРАЕМ все выделения сначала
  useEffect(() => {
    // Важно! Сначала сбрасываем выделение
    state.selectedEdge = null;
    
    // Потом через микросекунду устанавливаем выбранное (чтобы точно сбросилось)
    const timer = setTimeout(() => {
      state.selectedEdge = {
        type: selectedType,
        index: selectedIndex
      };
    }, 10);
    
    // Возвращаем функцию очистки при размонтировании
    return () => {
      clearTimeout(timer);
      state.selectedEdge = null;
    };
  }, []);

  // При изменении выбора в окне - обновляем подсветку
  useEffect(() => {
    state.selectedEdge = {
      type: selectedType,
      index: selectedIndex
    };
  }, [selectedType, selectedIndex]);

  const applySize = () => {
    const size = parseFloat(inputValue);
    if (isNaN(size) || size <= 0 || size > 20) return;
    
    if (!snap.edgeSizes) return;
    
    const newEdgeSizes = {
      bottom: [...snap.edgeSizes.bottom],
      side: [...snap.edgeSizes.side]
    };
    newEdgeSizes[selectedType][selectedIndex] = size;
    
    state.edgeSizes = newEdgeSizes;
  };

  // Полное закрытие окна
  const closeWindow = () => {
    state.selectedEdge = null; // убираем подсветку
    onClose(); // закрываем окно
  };

  const currentSize = snap.edgeSizes[selectedType][selectedIndex];

  return (
    <div className="absolute left-full ml-3 w-64 bg-gray-900 rounded-lg shadow-xl border border-gray-700">
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
        {/* Тип ребра */}
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

        {/* Номер ребра */}
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

        {/* Текущий размер */}
        <div className="bg-gray-800 p-2 rounded text-center">
          <p className="text-gray-400 text-xs">Текущий</p>
          <p className="text-xl font-bold text-blue-400">
            {currentSize.toFixed(1)} см
          </p>
        </div>

        {/* Поле ввода */}
        <input 
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          step="0.5"
          min="2"
          max="20"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
          placeholder="Новый размер"
        />

        {/* Кнопка применения */}
        <button
          onClick={applySize}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
        >
          Применить
        </button>
      </div>
    </div>
  );
};

export default Filepicker;