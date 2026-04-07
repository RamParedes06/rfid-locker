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
  selectedDoorId?: string;
  onSelect?: (door: Door) => void;
  registeredDoorIds?: Set<string>;
}

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-100 border-green-400 hover:bg-green-200',
  occupied: 'bg-red-100 border-red-400 cursor-not-allowed opacity-60',
  disabled: 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-40',
  penciled: 'bg-yellow-100 border-yellow-400 cursor-not-allowed opacity-60',
};

export default function DoorMatrix({ doors, selectedDoorId, onSelect, registeredDoorIds }: Props) {
  if (!doors.length) {
    return <p className="text-gray-400 text-sm">No doors found.</p>;
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {doors.map((door) => {
        if (door.isScreen) return null;
        const isSelected = selectedDoorId === door._id;
        const isRegistered = registeredDoorIds?.has(door._id);
        const colorClass = STATUS_COLOR[door.status] ?? 'bg-gray-100 border-gray-300';
        const canSelect = door.status === 'available' && !isRegistered;

        return (
          <button
            key={door._id}
            disabled={!canSelect}
            onClick={() => canSelect && onSelect?.(door)}
            className={[
              'border-2 rounded-lg p-2 text-center text-xs font-medium transition-all',
              colorClass,
              isSelected ? 'ring-2 ring-blue-500 border-blue-500' : '',
              isRegistered ? 'ring-2 ring-purple-400 border-purple-400 bg-purple-50' : '',
            ].join(' ')}
          >
            <div className="font-bold text-sm">#{door.number}</div>
            <div className="text-gray-500 capitalize">{door.size}</div>
            {isRegistered && <div className="text-purple-600 text-[10px] mt-0.5">RFID</div>}
            {!isRegistered && (
              <div className="text-gray-400 text-[10px] mt-0.5 capitalize">{door.status}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
