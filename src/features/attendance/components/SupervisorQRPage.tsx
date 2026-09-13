import { useState } from 'react';
import { SupervisorQRDisplay } from './SupervisorQRDisplay';

export function SupervisorQRPage() {
  const [action, setAction] = useState<'time_in' | 'time_out'>('time_in');
  const [expiration, setExpiration] = useState<30 | 60 | 120 | 300>(60);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Generate Attendance QR</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="action-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action
            </label>
            <select
              id="action-select"
              value={action}
              onChange={(e) => setAction(e.target.value as 'time_in' | 'time_out')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="time_in">Time In</option>
              <option value="time_out">Time Out</option>
            </select>
          </div>

          <div>
            <label htmlFor="expiration-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Expiration
            </label>
            <select
              id="expiration-select"
              value={expiration}
              onChange={(e) => setExpiration(Number(e.target.value) as 30 | 60 | 120 | 300)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Show this QR code to trainees. It auto-refreshes 10 seconds before expiry.
          Trainees scan with the mobile app to record their {action === 'time_in' ? 'time in' : 'time out'}.
        </p>
      </div>

      <SupervisorQRDisplay action={action} expirationSeconds={expiration} />
    </div>
  );
}