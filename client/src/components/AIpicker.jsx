import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import state from '../store';
import * as THREE from 'three'
const AIpicker = ({ onClose }) => {
  const snap = useSnapshot(state);
  const [points, setPoints] = useState([]);
  const [mode, setMode] = useState('inactive');

  useEffect(() => {
    if (snap.tempPoints) {
      setPoints(snap.tempPoints);
    }
  }, [snap.tempPoints]);

  useEffect(() => {
    state.aipickerMode = false;
    state.tempPoints = [];
    setMode('inactive');
    
    return () => {
      state.aipickerMode = false;
    };
  }, []);

  const handleClose = () => {
    state.aipickerMode = false;
    state.tempPoints = [];
    setMode('inactive');
    setPoints([]);
    onClose?.();
  };

  const handleStart = () => {
  state.tempPoints = [];
  state.sectionPlaneData = null;

  state.aipickerMode = true;

  setMode('placing');
  setPoints([]);
};

  const getPointPosition = (p) => {
  const edge = state.allEdges?.find(
    e => e.type === p.edgeType && e.index === p.edgeIndex
  );

  if (!edge) return null;

  return new THREE.Vector3().lerpVectors(
    edge.start,
    edge.end,
    p.t
  );
};

const handleConfirm = () => {
  if (points.length < 3) return;

  const valid = points.slice(0, 3).every(p =>
    p.edgeType !== undefined && p.edgeIndex !== undefined
  );

  if (!valid) {
    alert("Точки сломались, выбери заново");
    return;
  }

  state.sectionPlaneData = {
    points: points.slice(0, 3)
  };

  setMode('completed');
  state.aipickerMode = false;
};
  const handleReset = () => {
    state.aipickerMode = true;
    state.tempPoints = [];
    state.sectionPlaneData = null;
    setMode('placing');
    setPoints([]);
  };

  const deletePoint = (index) => {
    const newPoints = points.filter((_, i) => i !== index);
    setPoints(newPoints);
    state.tempPoints = newPoints;
  };

  return (
    <div className="absolute left-full ml-3 w-80 bg-gray-900 rounded-lg shadow-xl border border-gray-700">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-white font-bold text-lg">Построение сечения</h3>
        <button onClick={handleClose} className="text-gray-400 hover:text-white text-xl font-bold">×</button>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-300">
            {mode === 'inactive' && 'Нажмите "Начать" для выбора точек'}
            {mode === 'placing' && `Выбрано точек: ${points.length} (нужно минимум 3)`}
            {mode === 'completed' && `Сечение построено`}
          </p>
        </div>

        {mode === 'placing' && points.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">Точки на ребрах:</p>
            {points.map((point, idx) => (
              <div key={point.id || idx} className="bg-gray-800 p-2 rounded flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  Точка {idx + 1}
                </span>
                <button
                  onClick={() => deletePoint(idx)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {mode === 'inactive' && (
            <button onClick={handleStart} className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">
              Начать
            </button>
          )}
          
          {mode === 'placing' && (
            <>
              {points.length >= 3 && (
                <button onClick={handleConfirm} className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold">
                  Построить сечение
                </button>
              )}
              {points.length > 0 && (
                <button onClick={handleReset} className="w-full px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-semibold">
                  Очистить все
                </button>
              )}
            </>
          )}
          
          {mode === 'completed' && (
            <button onClick={handleReset} className="w-full px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-semibold">
              Новое сечение
            </button>
          )}
          
          <button onClick={handleClose} className="w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 font-semibold">
            Закрыть
          </button>
        </div>

        <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-700">
          {mode === 'placing' && (
            <>Кликните на любое ребро пирамиды — точка появится на середине ребра</>
          )}
          {mode === 'completed' && (
            <>Сечение построено. Можно создать новое или закрыть окно</>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIpicker;