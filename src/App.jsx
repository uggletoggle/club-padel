import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Plus, Trash2, RotateCw, Maximize, MousePointer2,
  Square, Calendar, Clock, User, DollarSign,
  Check, X, LayoutTemplate, Armchair, Lock, AlertCircle, CheckCircle2,
  List, CalendarDays, Search, SearchCheck, ZoomIn, ZoomOut, AlertTriangle
} from 'lucide-react';

// --- CONSTANTS & CONFIG ---
const SCALE = 15;
const COURT_WIDTH_M = 10;
const COURT_HEIGHT_M = 20;
const COURT_WIDTH_PX = COURT_WIDTH_M * SCALE;
const COURT_HEIGHT_PX = COURT_HEIGHT_M * SCALE;
const MIN_SIZE_PX = 30; // Min size for zones

const COLORS = {
  turf: {
    blue: '#2563EB',
    green: '#10B981',
    terracotta: '#EA580C',
    pink: '#EC4899',
  },
  glass: 'rgba(255, 255, 255, 0.3)',
  wall: '#1e293b',
  lines: 'rgba(255, 255, 255, 0.9)',
  zone: '#475569',
  occupiedOverlay: 'rgba(185, 28, 28, 0.85)',
  freeOverlay: 'rgba(6, 78, 59, 0.2)',
};

// --- HELPER FUNCTIONS ---
const getLocalYYYYMMDD = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().split('T')[0];
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTime = (date) => new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const getCourtStatus = (courtId, reservations, viewDate) => {
  const viewTime = new Date(viewDate).getTime();
  return reservations.find(res => {
    const start = new Date(res.start).getTime();
    const end = new Date(res.end).getTime();
    return res.courtId === courtId && viewTime >= start && viewTime < end;
  });
};

// --- COMPONENTS ---

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`fixed top-20 right-6 z-[120] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md pointer-events-none ${type === 'error'
          ? 'bg-red-500/10 border-red-500/50 text-red-200'
          : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200'
        }`}
    >
      <div className={`p-1 rounded-full ${type === 'error' ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
        {type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      </div>
      <span className="font-medium text-sm shadow-black drop-shadow-md">{message}</span>
    </motion.div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onPointerDown={(e) => e.stopPropagation()}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-400">{message}</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- HANDLES FOR RESIZING ---
const Handle = ({ cursor, className, onPointerDown }) => (
  <div
    className={`absolute bg-white border border-blue-600 z-50 hover:scale-125 transition-transform shadow-sm ${className}`}
    style={{ cursor }}
    onPointerDown={(e) => {
      e.stopPropagation();
      onPointerDown(e);
    }}
  />
);

const PadelCourt = ({
  data, isSelected, onSelect, onUpdate, onRotate, onDelete,
  mode, activeReservation, onManage, zoom
}) => {
  const isOccupied = mode === 'manage' && activeReservation;

  const getBorderClass = () => {
    if (mode === 'design') return 'border-slate-800';
    if (isOccupied) return 'border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.5)] ring-2 ring-red-500 ring-offset-2 ring-offset-black';
    return 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
  };

  // MANUAL DRAG LOGIC FOR COURTS
  const handleDragStart = (e) => {
    if (mode !== 'design') return;
    e.stopPropagation();
    onSelect(data.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPos = { x: data.x, y: data.y };

    const onPointerMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      onUpdate(data.id, { x: initialPos.x + dx, y: initialPos.y + dy });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1, opacity: 1, x: data.x, y: data.y, zIndex: isSelected ? 50 : 10, rotate: data.rotation
      }}
      onPointerDown={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        if (mode === 'manage') onManage(data);
      }}
      className={`absolute top-0 left-0 ${mode === 'design' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{ width: COURT_WIDTH_PX, height: COURT_HEIGHT_PX }}
    >
      <div className={`w-full h-full relative transition-all duration-300 ${isSelected && mode === 'design' ? 'ring-4 ring-yellow-400 shadow-2xl' : 'shadow-lg hover:shadow-xl'}`}>
        <div className={`w-full h-full relative overflow-hidden border-4 bg-opacity-90 backdrop-blur-sm transition-all duration-500 ${getBorderClass()}`} style={{ backgroundColor: data.color }}>
          {/* Internal Markings */}
          <div className="absolute inset-0 flex flex-col justify-between p-[2px] pointer-events-none">
            <div className="h-[3px] bg-slate-800 w-full opacity-50" />
            <div className="absolute top-[30%] w-full h-[2px]" style={{ backgroundColor: COLORS.lines }} />
            <div className="absolute top-[30%] bottom-[30%] left-1/2 w-[2px] -translate-x-1/2" style={{ backgroundColor: COLORS.lines }} />
            <div className="absolute top-1/2 left-0 right-0 h-[4px] bg-white shadow-sm flex items-center justify-center -translate-y-1/2 z-20">
              <div className="w-full h-[1px] bg-gray-300" />
            </div>
            <div className="absolute bottom-[30%] w-full h-[2px]" style={{ backgroundColor: COLORS.lines }} />
            <div className="h-[3px] bg-slate-800 w-full opacity-50" />
          </div>

          <AnimatePresence>
            {mode === 'manage' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center transition-colors duration-300"
                style={{ backgroundColor: isOccupied ? COLORS.occupiedOverlay : COLORS.freeOverlay }}
              >
                {isOccupied ? (
                  <div className="text-center w-full px-2">
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-2 mx-auto shadow-xl">
                      <div className="flex flex-col items-center">
                        <div className="bg-red-600 text-white rounded-full p-2 mb-1 shadow-lg"><Lock size={16} /></div>
                        <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-0.5">Reservada</h3>
                        <div className="bg-white text-red-900 px-3 py-1 rounded-md font-bold text-xs shadow-sm w-full truncate mb-1">{activeReservation.clientName}</div>
                        <div className="flex items-center gap-1 text-[10px] text-white/90 font-mono bg-black/40 px-2 py-0.5 rounded-full"><Clock size={10} />{formatTime(activeReservation.start)} - {formatTime(activeReservation.end)}</div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center backdrop-blur text-emerald-300 mb-1 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"><Plus size={20} /></div>
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/30">Disponible</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {(!isOccupied) && (
            <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none z-10">
              <span className="text-white font-black text-4xl drop-shadow-md transform -rotate-90 md:rotate-0 select-none">{data.label}</span>
            </div>
          )}
        </div>
        <AnimatePresence>
          {mode === 'design' && isSelected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-1 rounded-full shadow-xl flex gap-1 z-50 border border-slate-700"
              onPointerDown={e => e.stopPropagation()}
            >
              <button onClick={(e) => { e.stopPropagation(); onRotate(data.id); }} className="p-2 hover:bg-blue-600 rounded-full"><RotateCw size={18} /></button>
              <div className="w-[1px] bg-slate-700 mx-1 my-1"></div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(data.id); }} className="p-2 hover:bg-red-500 rounded-full"><Trash2 size={18} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const GenericZone = ({ data, isSelected, onSelect, onUpdate, onRotate, onDelete, mode, zoom }) => {
  const handleDragStart = (e) => {
    if (mode !== 'design') return;
    e.stopPropagation();
    onSelect(data.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialPos = { x: data.x, y: data.y };

    const onPointerMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      onUpdate(data.id, { x: initialPos.x + dx, y: initialPos.y + dy });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = data.width;
    const startH = data.height;
    const startXPos = data.x;
    const startYPos = data.y;
    const angleRad = (data.rotation * Math.PI) / 180;
    const ux = Math.cos(angleRad);
    const uy = Math.sin(angleRad);
    const vx = -Math.sin(angleRad);
    const vy = Math.cos(angleRad);

    const onPointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const localDx = dx * ux + dy * uy;
      const localDy = dx * vx + dy * vy;

      let newW = startW;
      let newH = startH;
      let changeX = 0;
      let changeY = 0;

      if (direction.includes('e')) {
        newW = Math.max(MIN_SIZE_PX, startW + localDx);
        changeX = (newW - startW) / 2;
      } else if (direction.includes('w')) {
        newW = Math.max(MIN_SIZE_PX, startW - localDx);
        changeX = -(newW - startW) / 2;
      }

      if (direction.includes('s')) {
        newH = Math.max(MIN_SIZE_PX, startH + localDy);
        changeY = (newH - startH) / 2;
      } else if (direction.includes('n')) {
        newH = Math.max(MIN_SIZE_PX, startH - localDy);
        changeY = -(newH - startH) / 2;
      }

      const worldShiftX = changeX * ux + changeY * vx;
      const worldShiftY = changeX * uy + changeY * vy;

      onUpdate(data.id, {
        width: newW,
        height: newH,
        x: startXPos + worldShiftX,
        y: startYPos + worldShiftY
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <motion.div
      animate={{
        x: data.x, y: data.y, width: data.width, height: data.height, rotate: data.rotation,
        zIndex: isSelected ? 40 : 5
      }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-0 left-0 flex items-center justify-center"
    >
      <div className={`w-full h-full relative transition-all rounded-md ${isSelected && mode === 'design' ? 'ring-2 ring-blue-500' : ''}`}>
        <div
          className={`w-full h-full bg-slate-700/80 backdrop-blur-sm border-2 border-slate-500 border-dashed flex items-center justify-center overflow-hidden ${mode === 'design' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
          onPointerDown={handleDragStart}
        >
          <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJub25lIiBzdHJva2U9IiZmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjUiLz48L3N2Zz4=')] pointer-events-none"></div>
          <span className="text-slate-400 font-bold text-xs uppercase tracking-widest pointer-events-none select-none z-10">Zona</span>
        </div>

        {mode === 'design' && isSelected && (
          <>
            {/* Corners */}
            <Handle cursor="nw-resize" className="w-3 h-3 rounded-full -top-1.5 -left-1.5" onPointerDown={(e) => handleResizeStart(e, 'nw')} />
            <Handle cursor="ne-resize" className="w-3 h-3 rounded-full -top-1.5 -right-1.5" onPointerDown={(e) => handleResizeStart(e, 'ne')} />
            <Handle cursor="sw-resize" className="w-3 h-3 rounded-full -bottom-1.5 -left-1.5" onPointerDown={(e) => handleResizeStart(e, 'sw')} />
            <Handle cursor="se-resize" className="w-3 h-3 rounded-full -bottom-1.5 -right-1.5" onPointerDown={(e) => handleResizeStart(e, 'se')} />
            {/* Edges */}
            <Handle cursor="n-resize" className="h-1.5 w-8 rounded-full -top-2 left-1/2 -translate-x-1/2 bg-blue-400 border-none" onPointerDown={(e) => handleResizeStart(e, 'n')} />
            <Handle cursor="s-resize" className="h-1.5 w-8 rounded-full -bottom-2 left-1/2 -translate-x-1/2 bg-blue-400 border-none" onPointerDown={(e) => handleResizeStart(e, 's')} />
            <Handle cursor="w-resize" className="w-1.5 h-8 rounded-full top-1/2 -translate-y-1/2 -left-2 bg-blue-400 border-none" onPointerDown={(e) => handleResizeStart(e, 'w')} />
            <Handle cursor="e-resize" className="w-1.5 h-8 rounded-full top-1/2 -translate-y-1/2 -right-2 bg-blue-400 border-none" onPointerDown={(e) => handleResizeStart(e, 'e')} />

            <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-1 rounded-full shadow-xl flex gap-1 z-50 border border-slate-700 pointer-events-auto cursor-default" onPointerDown={e => e.stopPropagation()}>
              <button onClick={(e) => { e.stopPropagation(); onRotate(data.id); }} className="p-2 hover:bg-blue-600 rounded-full"><RotateCw size={18} /></button>
              <div className="w-[1px] bg-slate-700 mx-1 my-1"></div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(data.id); }} className="p-2 hover:bg-red-500 rounded-full"><Trash2 size={18} /></button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

const ReservationModal = ({ court, isOpen, onClose, onSave, existingReservations, onDeleteRes, showToast, initialValues }) => {
  const [activeTab, setActiveTab] = useState('form');
  const [name, setName] = useState('');

  const [date, setDate] = useState(() => initialValues?.date || getLocalYYYYMMDD(new Date()));
  const [startTime, setStartTime] = useState(() => {
    if (initialValues?.time) return initialValues.time;
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  const [duration, setDuration] = useState(initialValues?.duration || 90);
  const [deposit, setDeposit] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !startTime) {
      showToast("Por favor completa la fecha y la hora.", 'error');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    if (isNaN(startDateTime.getTime())) {
      showToast("La fecha u hora seleccionada no es válida.", 'error');
      return;
    }

    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const hasOverlap = existingReservations.some(res => {
      const rStart = new Date(res.start).getTime();
      const rEnd = new Date(res.end).getTime();
      const nStart = startDateTime.getTime();
      const nEnd = endDateTime.getTime();
      return (nStart < rEnd && nEnd > rStart);
    });

    if (hasOverlap) {
      showToast("¡Conflicto! La cancha ya está reservada en ese horario.", 'error');
      return;
    }

    onSave({
      id: Date.now(),
      courtId: court.id,
      clientName: name,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      deposit: deposit || '0'
    });

    showToast("Reserva agendada correctamente", 'success');
    setName('');
    setDeposit('');
    onClose();
  };

  const renderWeekView = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = getLocalYYYYMMDD(d);
      const dayReservations = existingReservations
        .filter(r => getLocalYYYYMMDD(new Date(r.start)) === dateStr)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      days.push({ date: d, dateStr, reservations: dayReservations });
    }

    return (
      <div className="space-y-4">
        {days.map((day) => (
          <div key={day.dateStr} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <h4 className={`text-sm font-bold mb-2 flex items-center gap-2 ${day.dateStr === getLocalYYYYMMDD(new Date()) ? 'text-blue-400' : 'text-slate-300'}`}>
              <CalendarDays size={14} />
              {formatDate(day.dateStr)}
              {day.dateStr === getLocalYYYYMMDD(new Date()) && <span className="text-[10px] bg-blue-600/20 text-blue-300 px-1.5 py-0.5 rounded">Hoy</span>}
            </h4>
            {day.reservations.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-6">Sin reservas</p>
            ) : (
              <div className="space-y-2 pl-2">
                {day.reservations.map(res => (
                  <div key={res.id} className="bg-slate-800 border border-slate-600 p-2 rounded flex justify-between items-center group hover:border-slate-500 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="text-center bg-slate-900 px-2 py-1 rounded">
                        <div className="text-xs font-bold text-white">{formatTime(res.start)}</div>
                        <div className="text-[10px] text-slate-400">{Math.round((new Date(res.end) - new Date(res.start)) / 60000)}m</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{res.clientName}</div>
                        {Number(res.deposit) > 0 && <div className="text-[10px] text-emerald-400 flex items-center gap-0.5"><DollarSign size={10} /> Seña: ${res.deposit}</div>}
                      </div>
                    </div>
                    <button onClick={() => onDeleteRes(res.id)} className="text-slate-500 hover:text-red-400 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Cancelar Reserva">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const selectedDateReservations = existingReservations
    .filter(r => getLocalYYYYMMDD(new Date(r.start)) === date)
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPointerDown={(e) => e.stopPropagation()}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="bg-slate-800 border-b border-slate-700 p-4 pb-0">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Cancha {court.label}</h2>
              <p className="text-sm text-slate-400">Gestión de Turnos</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setActiveTab('form')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'form' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
              <Plus size={16} /> Nueva Reserva
            </button>
            <button onClick={() => setActiveTab('week')} className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'week' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
              <CalendarDays size={16} /> Agenda Semanal
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'form' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4 mb-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">Cliente</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 text-slate-500" size={16} />
                      <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del jugador" className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                    <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Hora Inicio</label>
                    <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Duración (min)</label>
                    <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={120}>120 min</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Seña ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 text-slate-500" size={16} />
                      <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0" className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                  <Check size={18} /> Confirmar Reserva
                </button>
              </form>

              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2 border-t border-slate-700 pt-4">
                  <List size={14} /> Reservas del {formatDate(date)}
                </h3>
                {selectedDateReservations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-4">No hay reservas para esta fecha.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDateReservations.map(res => (
                      <div key={res.id} className="bg-slate-800 border border-slate-700 p-3 rounded-lg flex justify-between items-center group">
                        <div>
                          <div className="text-white font-medium text-sm">{res.clientName}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                            <Clock size={12} /> {formatTime(res.start)} - {formatTime(res.end)}
                            {Number(res.deposit) > 0 && <span className="text-emerald-400 flex items-center gap-1"><DollarSign size={10} /> {res.deposit}</span>}
                          </div>
                        </div>
                        <button onClick={() => onDeleteRes(res.id)} className="text-slate-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            renderWeekView()
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- AVAILABILITY FINDER VIEW ---
const AvailabilityView = ({ elements, reservations, onReserve }) => {
  const [searchDate, setSearchDate] = useState(() => getLocalYYYYMMDD(new Date()));
  const [searchTime, setSearchTime] = useState(() => {
    const now = new Date();
    // Default to next full hour
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const [duration, setDuration] = useState(90);

  const getAvailableCourts = () => {
    const courts = elements.filter(el => el.type === 'court');
    if (!searchDate || !searchTime) return [];

    const searchStart = new Date(`${searchDate}T${searchTime}`).getTime();
    const searchEnd = searchStart + duration * 60000;

    return courts.filter(court => {
      // Find any overlap
      const hasConflict = reservations.some(res => {
        if (res.courtId !== court.id) return false;
        const resStart = new Date(res.start).getTime();
        const resEnd = new Date(res.end).getTime();

        // Simple overlap logic: (StartA < EndB) and (EndA > StartB)
        return (searchStart < resEnd && searchEnd > resStart);
      });
      return !hasConflict;
    });
  };

  const availableCourts = getAvailableCourts();

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <SearchCheck className="text-blue-500" size={32} /> Buscador de Disponibilidad
          </h2>
          <p className="text-slate-400">Encuentra rápidamente canchas libres para un horario específico.</p>
        </div>

        {/* Search Controls */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
            <input
              type="date"
              value={searchDate}
              onChange={e => setSearchDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hora Inicio</label>
            <input
              type="time"
              value={searchTime}
              onChange={e => setSearchTime(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Duración</label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            Resultados
            <span className="text-sm font-normal bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{availableCourts.length} canchas libres</span>
          </h3>

          {availableCourts.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500">
              <AlertCircle className="mx-auto mb-3 opacity-50" size={48} />
              <p className="text-lg">No hay canchas disponibles para este horario.</p>
              <p className="text-sm opacity-60">Intenta cambiar la hora o reducir la duración.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableCourts.map(court => (
                <motion.div
                  key={court.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800 border border-slate-700 p-5 rounded-xl flex flex-col justify-between hover:border-blue-500/50 transition-colors group"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-blue-900/30 text-blue-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Cancha</span>
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    </div>
                    <h4 className="text-2xl font-black text-white">{court.label}</h4>
                    <p className="text-slate-400 text-xs mt-1">Superficie {court.color === COLORS.turf.blue ? 'Azul' : court.color === COLORS.turf.green ? 'Verde' : court.color === COLORS.turf.pink ? 'WPT' : 'Estándar'}</p>
                  </div>

                  <button
                    onClick={() => onReserve(court, { date: searchDate, time: searchTime, duration })}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-emerald-900/20"
                  >
                    <CheckCircle2 size={18} /> Reservar Ahora
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TimeController = ({ currentDate, onChange }) => {
  const toInputString = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50">
      <div className="flex flex-col items-start">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Vista Actual</span>
        <div className="flex items-center gap-2 text-blue-400"><Clock size={16} /><span className="font-mono font-bold text-lg">{formatTime(currentDate)}</span></div>
      </div>
      <div className="h-8 w-[1px] bg-slate-700"></div>
      <div className="flex items-center gap-2">
        <input type="datetime-local" value={toInputString(currentDate)} onChange={(e) => onChange(new Date(e.target.value))} className="bg-slate-800 border border-slate-600 rounded-lg text-sm px-3 py-1.5 text-white outline-none focus:border-blue-500" />
        <button onClick={() => onChange(new Date())} className="text-[10px] bg-blue-600 px-2 py-1 rounded hover:bg-blue-500 transition-colors">Ahora</button>
      </div>
    </div>
  );
};

const DesignToolbar = ({ onAddCourt, onAddZone, onClear }) => (
  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50">
    <span className="text-xs text-slate-500 font-bold uppercase mr-2">Diseño</span>
    <button onClick={() => onAddCourt(COLORS.turf.blue)} className="bg-blue-600 p-2 rounded-lg hover:bg-blue-500"><Plus size={20} /></button>
    <button onClick={() => onAddCourt(COLORS.turf.green)} className="bg-emerald-600 p-2 rounded-lg hover:bg-emerald-500"><Plus size={20} /></button>
    <div className="w-[1px] h-6 bg-slate-700"></div>
    <button onClick={onAddZone} className="bg-slate-700 p-2 rounded-lg hover:bg-slate-600"><Square size={20} /></button>
    <div className="w-[1px] h-6 bg-slate-700"></div>
    <button onClick={onClear} className="text-slate-400 hover:text-red-400"><Trash2 size={20} /></button>
  </div>
);

export default function PadelClubPlanner() {
  const [elements, setElements] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [mode, setMode] = useState('design');
  const [viewDate, setViewDate] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [managingState, setManagingState] = useState(null);
  const [confirmation, setConfirmation] = useState({ isOpen: false, message: '', onConfirm: null }); // NEW STATE FOR CONFIRMATION

  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (containerRef.current) setContainerSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
  }, []);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const updateElement = (id, changes) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
  };

  const addCourt = (color) => {
    const newCourt = {
      id: Date.now(),
      type: 'court',
      x: containerSize.w / 2 - COURT_WIDTH_PX / 2 + (Math.random() * 40 - 20),
      y: containerSize.h / 2 - COURT_HEIGHT_PX / 2 + (Math.random() * 40 - 20),
      rotation: 0,
      color,
      label: elements.filter(e => e.type === 'court').length + 1
    };
    setElements([...elements, newCourt]);
  };

  const addZone = () => {
    const newZone = {
      id: Date.now(),
      type: 'zone',
      x: containerSize.w / 2 - 50,
      y: containerSize.h / 2 - 25,
      rotation: 0,
      width: 10 * SCALE,
      height: 5 * SCALE,
    };
    setElements([...elements, newZone]);
  };

  const rotateElement = (id) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, rotation: el.rotation === 0 ? 90 : 0 } : el));
  };

  const deleteElement = (id) => {
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedId(null);
  };

  const handleSaveReservation = (newRes) => {
    setReservations([...reservations, newRes]);
  };

  // UPDATED: No more window.confirm
  const handleDeleteReservation = (resId) => {
    setConfirmation({
      isOpen: true,
      message: "¿Estás seguro de cancelar esta reserva? El horario quedará disponible.",
      onConfirm: () => {
        setReservations(prev => prev.filter(r => r.id !== resId));
        showToast("Reserva cancelada exitosamente", 'success');
        setConfirmation({ isOpen: false, message: '', onConfirm: null });
      }
    });
  };

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setZoom(1);

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden flex flex-col font-sans select-none text-slate-200">

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shadow-md z-40 relative">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-500 to-cyan-400 p-2 rounded-lg">
            <Maximize size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">Padel Architect <span className="text-blue-400">Manager</span></h1>
          </div>
        </div>

        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex gap-1">
          <button onClick={() => setMode('design')} className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition-all ${mode === 'design' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutTemplate size={16} /> <span className="hidden md:inline">Arquitecto</span></button>
          <button onClick={() => setMode('manage')} className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition-all ${mode === 'manage' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Armchair size={16} /> <span className="hidden md:inline">Gestión</span></button>
          <button onClick={() => setMode('search')} className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium flex items-center gap-2 transition-all ${mode === 'search' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Search size={16} /> <span className="hidden md:inline">Disponibilidad</span></button>
        </div>
      </header>

      <div className="flex-1 relative bg-slate-950 overflow-hidden" onClick={() => setSelectedId(null)}>
        {mode === 'search' ? (
          <AvailabilityView elements={elements} reservations={reservations} onReserve={(court, values) => setManagingState({ court, initialValues: values })} />
        ) : (
          <>
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
              <button onClick={zoomIn} className="p-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 shadow-lg"><ZoomIn size={20} /></button>
              <button onClick={resetZoom} className="p-2 bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-700 shadow-lg w-10 h-10 flex items-center justify-center">{Math.round(zoom * 100)}%</button>
              <button onClick={zoomOut} className="p-2 bg-slate-800 border border-slate-700 text-white rounded-lg hover:bg-slate-700 shadow-lg"><ZoomOut size={20} /></button>
            </div>

            <motion.div className="absolute inset-0 origin-center" animate={{ scale: zoom }} transition={{ type: false }} style={{ touchAction: 'none' }}>
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `linear-gradient(#475569 1px, transparent 1px), linear-gradient(90deg, #475569 1px, transparent 1px)`, backgroundSize: `${SCALE}px ${SCALE}px` }}></div>
              <div ref={containerRef} className="absolute inset-0 m-0">
                {elements.map(el => {
                  if (el.type === 'court') {
                    const activeRes = getCourtStatus(el.id, reservations, viewDate);
                    return (
                      <PadelCourt
                        key={el.id}
                        data={el}
                        isSelected={selectedId === el.id}
                        onSelect={setSelectedId}
                        onUpdate={updateElement}
                        onRotate={() => rotateElement(el.id)}
                        onDelete={() => deleteElement(el.id)}
                        containerRef={containerRef}
                        mode={mode}
                        activeReservation={activeRes}
                        onManage={() => setManagingState({ court: el })}
                        zoom={zoom}
                      />
                    );
                  } else {
                    return (
                      <GenericZone
                        key={el.id}
                        data={el}
                        isSelected={selectedId === el.id}
                        onSelect={setSelectedId}
                        onUpdate={updateElement}
                        onRotate={() => rotateElement(el.id)}
                        onDelete={() => deleteElement(el.id)}
                        containerRef={containerRef}
                        mode={mode}
                        zoom={zoom}
                      />
                    );
                  }
                })}
              </div>
            </motion.div>
          </>
        )}
      </div>

      {mode === 'design' && <DesignToolbar onAddCourt={addCourt} onAddZone={addZone} onClear={() => setElements([])} />}
      {mode === 'manage' && <TimeController currentDate={viewDate} onChange={setViewDate} />}

      {managingState && (
        <ReservationModal
          court={managingState.court}
          initialValues={managingState.initialValues}
          isOpen={!!managingState}
          onClose={() => setManagingState(null)}
          onSave={handleSaveReservation}
          existingReservations={reservations.filter(r => r.courtId === managingState.court.id)}
          onDeleteRes={handleDeleteReservation}
          showToast={showToast}
        />
      )}

      {/* CONFIRM MODAL */}
      <ConfirmModal
        isOpen={confirmation.isOpen}
        title="Cancelar Reserva"
        message={confirmation.message}
        onConfirm={confirmation.onConfirm}
        onCancel={() => setConfirmation({ ...confirmation, isOpen: false })}
      />
    </div>
  );
}