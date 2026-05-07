'use client';

export interface Door {
  _id: string;
  number: number;
  size: string;
  status: 'available' | 'occupied' | 'disabled' | 'penciled' | string;
  reserved: boolean;
  services: string[];
  isScreen: boolean;
}

interface Props {
  doors: Door[];
  /** Multi-select: set of selected door IDs */
  selectedDoorIds?: Set<string>;
  /** Legacy single-select (still supported) */
  selectedDoorId?: string;
  onSelect?: (door: Door) => void;
  registeredDoorIds?: Set<string>;
  /** Disable selecting more when max is reached */
  maxReached?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-teal-50 border-teal-300 hover:bg-teal-100 text-teal-800',
  occupied:  'bg-red-50 border-red-200 cursor-not-allowed opacity-60 text-red-700',
  disabled:  'bg-slate-100 border-slate-200 cursor-not-allowed opacity-40 text-slate-600',
  penciled:  'bg-yellow-50 border-yellow-300 cursor-not-allowed opacity-60 text-yellow-700',
};

export default function DoorMatrix({ doors, selectedDoorIds, selectedDoorId, onSelect, registeredDoorIds, maxReached }: Props) {
  if (!doors.length) {
    return <p className="text-slate-400 text-sm">No doors found.</p>;
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {doors.map((door) => {
        if (door.isScreen) return null;

        const isSelected =
          selectedDoorIds?.has(door._id) || selectedDoorId === door._id;
        const isRegistered = registeredDoorIds?.has(door._id);
        const colorClass = STATUS_COLOR[door.status] ?? 'bg-slate-100 border-slate-200 text-slate-400';
        const canSelect = door.status === 'available' && !isRegistered && (!maxReached || isSelected);

        return (
          <button
            key={door._id}
            disabled={!canSelect}
            onClick={() => canSelect && onSelect?.(door)}
            className={[
              'border-2 rounded-lg p-2 text-center text-xs font-medium transition-all',
              isSelected
                ? 'ring-2 ring-teal-500 border-teal-500 bg-teal-50 text-teal-900'
                : isRegistered
                  ? 'ring-2 ring-cyan-400 border-cyan-400 bg-cyan-50 text-cyan-800'
                  : colorClass,
              !canSelect && !isSelected ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <div className="font-bold text-sm">#{door.number}</div>
            <div className="text-slate-600 capitalize">{door.size}</div>
            {isSelected && <div className="text-teal-700 text-[10px] mt-0.5">✓ Selected</div>}
            {!isSelected && isRegistered && <div className="text-cyan-700 text-[10px] mt-0.5">RFID</div>}
            {!isSelected && !isRegistered && (
              <div className="text-slate-500 text-[10px] mt-0.5 capitalize">{door.status}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
