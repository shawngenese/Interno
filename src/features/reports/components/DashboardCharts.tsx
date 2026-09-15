import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface ChartData {
  attendanceByDate: { date: string; present: number; late: number; absent: number }[];
  taskByStatus: { status: string; count: number }[];
  hoursByWeek: { week: string; regular: number; overtime: number }[];
  summary: {
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    tasksCompleted: number;
    tasksPending: number;
  };
}

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

interface DashboardChartsProps {
  traineeId: string;
  startDate: number;
  endDate: number;
}

export function DashboardCharts({ traineeId, startDate, endDate }: DashboardChartsProps) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();

      // Fetch attendance records
      const attendanceSnap = await getDocs(
        query(
          collection(db, 'attendance_records'),
          where('traineeId', '==', traineeId),
          where('timestamp', '>=', startDate),
          where('timestamp', '<=', endDate),
          orderBy('timestamp', 'asc'),
        ),
      );

      // Fetch DTR records
      const dtrSnap = await getDocs(
        query(
          collection(db, 'dtrs'),
          where('traineeId', '==', traineeId),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc'),
        ),
      );

      // Fetch task records
      const taskSnap = await getDocs(
        query(
          collection(db, 'tasks'),
          where('traineeId', '==', traineeId),
        ),
      );

      // Process attendance by date
      const attendanceByDateMap = new Map<string, { present: number; late: number; absent: number }>();
      const dtrMap = new Map<string, Record<string, unknown>>();

      dtrSnap.docs.forEach((doc) => {
        const d = doc.data();
        const dateKey = new Date(d.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        dtrMap.set(dateKey, d);
      });

      attendanceSnap.docs.forEach((doc) => {
        const d = doc.data();
        const dateKey = new Date(d.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        const existing = attendanceByDateMap.get(dateKey) || { present: 0, late: 0, absent: 0 };
        if (d.type === 'time_in') {
          existing.present++;
        }
        attendanceByDateMap.set(dateKey, existing);
      });

      // Enrich with DTR data (late/absent)
      const attendanceByDate: ChartData['attendanceByDate'] = [];
      const sortedDates = Array.from(attendanceByDateMap.keys()).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
      });

      sortedDates.forEach((dateKey) => {
        const att = attendanceByDateMap.get(dateKey)!;
        const dtr = dtrMap.get(dateKey);
        attendanceByDate.push({
          date: dateKey,
          present: att.present > 0 ? 1 : 0,
          late: dtr && (dtr.lateMinutes as number) > 0 ? 1 : 0,
          absent: att.present === 0 ? 1 : 0,
        });
      });

      // Task by status
      const taskStatusMap = new Map<string, number>();
      taskSnap.docs.forEach((doc) => {
        const status = doc.data().status || 'pending';
        taskStatusMap.set(status, (taskStatusMap.get(status) || 0) + 1);
      });
      const taskByStatus: ChartData['taskByStatus'] = Array.from(taskStatusMap.entries()).map(([status, count]) => ({
        status,
        count,
      }));

      // Hours by week
      const hoursByWeekMap = new Map<string, { regular: number; overtime: number }>();
      dtrSnap.docs.forEach((doc) => {
        const d = doc.data();
        const date = new Date(d.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        const existing = hoursByWeekMap.get(weekKey) || { regular: 0, overtime: 0 };
        existing.regular += (d.regularMinutes || 0) / 60;
        existing.overtime += (d.overtimeMinutes || 0) / 60;
        hoursByWeekMap.set(weekKey, existing);
      });
      const hoursByWeek: ChartData['hoursByWeek'] = Array.from(hoursByWeekMap.entries()).map(([week, hours]) => ({
        week,
        regular: Number(hours.regular.toFixed(1)),
        overtime: Number(hours.overtime.toFixed(1)),
      }));

      // Summary
      let totalRegular = 0;
      let totalOvertime = 0;
      let totalLate = 0;
      dtrSnap.docs.forEach((doc) => {
        const d = doc.data();
        totalRegular += (d.regularMinutes || 0) / 60;
        totalOvertime += (d.overtimeMinutes || 0) / 60;
        totalLate += d.lateMinutes || 0;
      });

      let tasksCompleted = 0;
      let tasksPending = 0;
      taskSnap.docs.forEach((doc) => {
        const status = doc.data().status;
        if (status === 'approved') tasksCompleted++;
        else if (status !== 'approved') tasksPending++;
      });

      setData({
        attendanceByDate,
        taskByStatus,
        hoursByWeek,
        summary: {
          totalPresent: attendanceByDate.filter((d) => d.present > 0).length,
          totalLate: attendanceByDate.filter((d) => d.late > 0).length,
          totalAbsent: attendanceByDate.filter((d) => d.absent > 0).length,
          totalRegularHours: Number(totalRegular.toFixed(1)),
          totalOvertimeHours: Number(totalOvertime.toFixed(1)),
          tasksCompleted,
          tasksPending,
        },
      });
    } catch (err) {
      console.error('Failed to load chart data:', err);
    } finally {
      setLoading(false);
    }
  }, [traineeId, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading charts...</div>;
  }

  if (!data) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Present Days</p>
          <p className="text-2xl font-bold text-green-600">{data.summary.totalPresent}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Late Days</p>
          <p className="text-2xl font-bold text-yellow-600">{data.summary.totalLate}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Regular Hours</p>
          <p className="text-2xl font-bold text-blue-600">{data.summary.totalRegularHours}h</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Overtime Hours</p>
          <p className="text-2xl font-bold text-purple-600">{data.summary.totalOvertimeHours}h</p>
        </div>
      </div>

      {/* Attendance Trend */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Attendance Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.attendanceByDate}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="present" fill="#22c55e" name="Present" />
            <Bar dataKey="late" fill="#eab308" name="Late" />
            <Bar dataKey="absent" fill="#ef4444" name="Absent" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Task Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Task Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.taskByStatus}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="count"
                nameKey="status"
              >
                {data.taskByStatus.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Hours by Week</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.hoursByWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="regular" stroke="#3b82f6" name="Regular" />
              <Line type="monotone" dataKey="overtime" stroke="#8b5cf6" name="Overtime" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
