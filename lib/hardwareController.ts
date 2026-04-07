import { HardwareControllerClientSDK } from 'hardware-controller-sdk/client';

const mockLocker = {
  openDoor: async (doorIds: string[]) => {
    console.log(`[MOCK] Opening door(s): ${doorIds.join(', ')}`);
    await new Promise((r) => setTimeout(r, 500));
    return { completed: true, data: { operations: doorIds.map((id) => ({ doorId: id, success: true })), successCount: doorIds.length, failureCount: 0 } };
  },
  getDoors: async () => ({ completed: true, data: { doors: {}, totalDoors: 0 } }),
  getDoorStates: async () => ({ success: true, data: { doors: {}, timestamp: new Date() } }),
};

let sdk: HardwareControllerClientSDK | null = null;

export function getHardwareController(): HardwareControllerClientSDK {
  if (process.env.HARDWARE_MOCK === 'true') {
    return { locker: mockLocker } as unknown as HardwareControllerClientSDK;
  }

  if (sdk) return sdk;

  const serverUrl = process.env.NEXT_PUBLIC_HARDWARE_SOCKET_URL || 'http://localhost:3001';
  const key = process.env.NEXT_PUBLIC_HARDWARE_SOCKET_KEY || 'secret kuno';

  sdk = new HardwareControllerClientSDK(serverUrl, key);
  return sdk;
}
