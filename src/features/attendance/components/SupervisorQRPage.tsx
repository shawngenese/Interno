import { useState } from 'react';
import { SupervisorQRDisplay } from './SupervisorQRDisplay';

export function SupervisorQRPage() {
  const [action, setAction] = useState<'time_in' | 'time_out'>('time_in');
  const [expiration, setExpiration] = useState<30 | 60 | 120 | 300>(60);
  const [isActive, setIsActive] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-6">
        <h2 className="text-lg font-semibold text-[#121212] dark:text-white mb-4">Generate Attendance QR</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="action-select" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Action
            </label>
            <select
              id="action-select"
              value={action}
              onChange={(e) => setAction(e.target.value as 'time_in' | 'time_out')}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="time_in">Time In</option>
              <option value="time_out">Time Out</option>
            </select>
          </div>

          <div>
            <label htmlFor="expiration-select" className="block text-sm font-medium text-[#3A3A3A] dark:text-[#BDBDBD] mb-1">
              Expiration
            </label>
            <select
              id="expiration-select"
              value={expiration}
              onChange={(e) => setExpiration(Number(e.target.value) as 30 | 60 | 120 | 300)}
              className="w-full px-4 py-3 border border-[#BDBDBD] dark:border-[#555555] rounded-lg bg-white dark:bg-[#3A3A3A] text-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setIsActive(!isActive)}
            className={`px-6 py-2.5 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isActive
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            }`}
          >
            {isActive ? 'Stop QR' : 'Start QR'}
          </button>
          <span className="text-sm text-[#757575] dark:text-[#9E9E9E]">
            {isActive ? 'QR is active — trainees can scan' : 'QR is stopped — trainees cannot scan'}
          </span>
        </div>

        <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
          Show this QR code to trainees. It auto-refreshes 10 seconds before expiry.
          Trainees scan with the mobile app to record their {action === 'time_in' ? 'time in' : 'time out'}.
        </p>
      </div>

      <SupervisorQRDisplay action={action} expirationSeconds={expiration} isActive={isActive} />
    </div>
  );
}