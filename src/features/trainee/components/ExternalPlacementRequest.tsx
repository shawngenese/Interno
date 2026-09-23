import { useState, useEffect } from 'react';
import { placementService } from '@/features/coordinator/services/placementService';
import { useAuth } from '@/features/auth';
import type { PlacementRequest } from '@/features/admin/types';

export function ExternalPlacementRequest() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PlacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await placementService.getTraineePlacementRequests(user.uid);
      setRequests(data);
    } catch (err) {
      setError('Failed to load your placement requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-[#EFEFEF] text-[#1E1E1E] dark:bg-[#3A3A3A] dark:text-[#9E9E9E]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'approved':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'rejected':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A] p-8">
        <div className="flex items-center justify-center">
          <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-[#757575] dark:text-[#9E9E9E]">Loading your placement requests...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-sm border border-[#D5D5D5] dark:border-[#3A3A3A]">
      <div className="p-4 border-b border-[#D5D5D5] dark:border-[#3A3A3A]">
        <h3 className="text-lg font-semibold text-[#121212] dark:text-white">
          My Placement Requests
        </h3>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {!error && (
      <div className="p-4">
        {requests.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-[#9E9E9E] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-[#757575] dark:text-[#9E9E9E]">You haven't submitted any placement requests yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="border border-[#D5D5D5] dark:border-[#3A3A3A] rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(request.status)}
                    <div>
                      <h4 className="font-medium text-[#121212] dark:text-white">
                        {request.externalCompanyName}
                      </h4>
                      <p className="text-sm text-[#757575] dark:text-[#9E9E9E]">
                        Requested on {request.createdAt?.seconds
                          ? new Date(request.createdAt.seconds * 1000).toLocaleDateString()
                          : '-'}
                      </p>
                      {request.requestNotes && (
                        <p className="mt-2 text-sm text-[#555555] dark:text-[#BDBDBD]">
                          {request.requestNotes}
                        </p>
                      )}
                      {request.reviewerNotes && (
                        <div className="mt-2 p-2 bg-[#F5F5F5] dark:bg-[#3A3A3A]/50 rounded text-sm">
                          <span className="font-medium text-[#3A3A3A] dark:text-[#BDBDBD]">Coordinator Notes: </span>
                          <span className="text-[#555555] dark:text-[#9E9E9E]">{request.reviewerNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
