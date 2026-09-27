import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth';
import { useNavigate } from 'react-router-dom';
import { resolveDocName } from '@/shared/utils/resolveDocName';
import { getFirestoreInstancePublic } from '@/config/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { evaluationService } from '@/features/evaluations/services/evaluationService';
import type { Evaluation } from '@/features/evaluations/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { ChartTooltip } from '@/shared/components/ChartTooltip';
import { Skeleton } from '@/shared/components/Skeleton';
import {
  CalendarCheck,
  ListTodo,
  FileClock,
  FileText,
  Building2,
  UserCheck,
  Calendar,
  Megaphone,
  Star,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award,
} from 'lucide-react';

interface DailyHoursData {
  day: string;
  dateStr: string;
  regular: number;
  overtime: number;
  total: number;
}

interface TaskStatusCount {
  name: string;
  value: number;
  color: string;
}

interface CompetencyData {
  subject: string;
  score: number;
  fullMark: number;
}

export function TraineeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>(() => user?.displayName || '');
  const [loading, setLoading] = useState(true);

  // Trainee stats & chart states
  const [requiredHours, setRequiredHours] = useState<number>(300);
  const [totalRenderedHours, setTotalRenderedHours] = useState<number>(0);
  const [totalOvertimeHours, setTotalOvertimeHours] = useState<number>(0);
  const [weeklyHours, setWeeklyHours] = useState<DailyHoursData[]>([]);
  const [taskDistribution, setTaskDistribution] = useState<TaskStatusCount[]>([]);
  const [taskSummary, setTaskSummary] = useState({ total: 0, completed: 0 });
  const [competencyScores, setCompetencyScores] = useState<CompetencyData[]>([]);
  const [latestEvaluation, setLatestEvaluation] = useState<Evaluation | null>(null);

  useEffect(() => {
    if (user?.uid) {
      if (user.displayName) {
        setUserName(user.displayName);
      } else {
        resolveDocName('users', user.uid, 'displayName').then((name) => {
          if (name) setUserName(name);
          else if (user.email) setUserName(user.email.split('@')[0]);
        });
      }
    }
  }, [user]);

  const fetchTraineeData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const db = getFirestoreInstancePublic();

      // 1. Resolve trainee profile
      const traineeSnap = await getDocs(
        query(collection(db, 'trainees'), where('userId', '==', user.uid), limit(1))
      );

      if (traineeSnap.empty) {
        setLoading(false);
        return;
      }

      const traineeDoc = traineeSnap.docs[0];
      const resolvedTraineeId = traineeDoc.id;
      const tData = traineeDoc.data();
      const reqHours = (tData.requiredHours as number) || 300;
      setRequiredHours(reqHours);

      // 2. Fetch DTR entries for OJT hours & weekly chart
      const dtrSnap = await getDocs(
        query(
          collection(db, 'dtrs'),
          where('traineeId', '==', resolvedTraineeId),
          orderBy('date', 'desc'),
          limit(60)
        )
      );

      let regMins = 0;
      let otMins = 0;
      const dtrMap = new Map<string, { regular: number; overtime: number }>();

      dtrSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const regular = (d.regularMinutes as number) || 0;
        const overtime = (d.overtimeMinutes as number) || 0;
        regMins += regular;
        otMins += overtime;

        const dateObj = new Date(d.date as number);
        const dateKey = dateObj.toISOString().split('T')[0];
        const existing = dtrMap.get(dateKey) || { regular: 0, overtime: 0 };
        existing.regular += regular / 60;
        existing.overtime += overtime / 60;
        dtrMap.set(dateKey, existing);
      });

      const totalRendered = Math.round(((regMins + otMins) / 60) * 10) / 10;
      setTotalRenderedHours(totalRendered);
      setTotalOvertimeHours(Math.round((otMins / 60) * 10) / 10);

      // Generate last 7 days series for weekly bar chart
      const daysData: DailyHoursData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const logged = dtrMap.get(dateStr) || { regular: 0, overtime: 0 };
        const reg = Math.round(logged.regular * 10) / 10;
        const ot = Math.round(logged.overtime * 10) / 10;
        daysData.push({
          day: dayName,
          dateStr,
          regular: reg,
          overtime: ot,
          total: Math.round((reg + ot) * 10) / 10,
        });
      }
      setWeeklyHours(daysData);

      // 3. Fetch Tasks distribution
      const taskSnap = await getDocs(
        query(collection(db, 'tasks'), where('traineeId', '==', resolvedTraineeId))
      );

      let approvedCount = 0;
      let inProgressCount = 0;
      let pendingCount = 0;
      let returnedCount = 0;

      taskSnap.docs.forEach((docSnap) => {
        const status = docSnap.data().status;
        if (status === 'approved' || status === 'completed') approvedCount++;
        else if (status === 'in_progress') inProgressCount++;
        else if (status === 'submitted' || status === 'pending') pendingCount++;
        else if (status === 'returned') returnedCount++;
      });

      const totalTasksCount = taskSnap.docs.length;
      setTaskSummary({ total: totalTasksCount, completed: approvedCount });

      const distribution: TaskStatusCount[] = [
        { name: 'Completed', value: approvedCount, color: 'var(--color-success)' },
        { name: 'In Progress', value: inProgressCount, color: 'var(--color-primary)' },
        { name: 'Pending Review', value: pendingCount, color: 'var(--color-warning)' },
        { name: 'Returned', value: returnedCount, color: 'var(--color-destructive)' },
      ].filter((item) => item.value > 0);

      setTaskDistribution(distribution);

      // 4. Fetch Evaluations (Competency scores)
      const evals = await evaluationService.getTraineeEvaluations(resolvedTraineeId);
      if (evals && evals.length > 0) {
        const latest = evals[0];
        setLatestEvaluation(latest);
        if (latest.ratings && latest.ratings.length > 0) {
          const competencyChartData: CompetencyData[] = latest.ratings.map((r) => ({
            subject: r.category.length > 12 ? `${r.category.substring(0, 10)}..` : r.category,
            score: r.rating,
            fullMark: 5,
          }));
          setCompetencyScores(competencyChartData);
        }
      }
    } catch (err) {
      console.error('Failed to load trainee analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchTraineeData();
  }, [fetchTraineeData]);

  const progressPercent = useMemo(() => {
    if (!requiredHours || requiredHours <= 0) return 0;
    return Math.min(100, Math.round((totalRenderedHours / requiredHours) * 100));
  }, [totalRenderedHours, requiredHours]);

  const remainingHours = useMemo(() => {
    return Math.max(0, Math.round((requiredHours - totalRenderedHours) * 10) / 10);
  }, [requiredHours, totalRenderedHours]);

  const cards = [
    {
      title: 'Attendance',
      description: 'Scan QR code and view attendance history',
      route: '/trainee/attendance',
      icon: <CalendarCheck className="h-5 w-5 text-primary" />,
      badge: 'QR Punch',
    },
    {
      title: 'My Tasks',
      description: 'View assigned tasks and submit deliverables',
      route: '/trainee/tasks',
      icon: <ListTodo className="h-5 w-5 text-success" />,
      badge: 'Tasks',
    },
    {
      title: 'Daily Time Record',
      description: 'Review calculated hours, OT, and corrections',
      route: '/trainee/dtr',
      icon: <FileClock className="h-5 w-5 text-warning" />,
      badge: 'DTR',
    },
    {
      title: 'Documents',
      description: 'Upload onboarding requirements and certs',
      route: '/trainee/documents',
      icon: <FileText className="h-5 w-5 text-primary" />,
      badge: 'Files',
    },
    {
      title: 'Leave',
      description: 'Request time off and track approvals',
      route: '/trainee/leave',
      icon: <Calendar className="h-5 w-5 text-info" />,
      badge: 'Time Off',
    },
    {
      title: 'Announcements',
      description: 'Read updates from your coordinators',
      route: '/trainee/announcements',
      icon: <Megaphone className="h-5 w-5 text-primary" />,
      badge: 'News',
    },
    {
      title: 'Evaluations',
      description: 'View supervisor feedback and ratings',
      route: '/trainee/evaluations',
      icon: <Star className="h-5 w-5 text-warning" />,
      badge: 'Reviews',
    },
    {
      title: 'Browse Companies',
      description: 'Explore verified host companies',
      route: '/trainee/companies',
      icon: <Building2 className="h-5 w-5 text-accent" />,
      badge: 'Directory',
    },
    {
      title: 'My Placement',
      description: 'Check external placement request status',
      route: '/trainee/placement',
      icon: <UserCheck className="h-5 w-5 text-primary" />,
      badge: 'Status',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome & OJT Progress Banner */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              Welcome back{userName ? `, ${userName}` : ''}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Track your OJT hours, tasks, attendance trend, and performance ratings in real time.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl border border-border self-start md:self-auto">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">OJT Completion</p>
              <p className="text-sm font-bold text-foreground">
                {progressPercent}% <span className="text-xs font-normal text-muted-foreground">({totalRenderedHours} / {requiredHours} hrs)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 space-y-2">
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{totalRenderedHours} hrs rendered</span>
            <span>{remainingHours} hrs remaining</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={96} className="rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-xl border border-border space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Logged Hours</span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{totalRenderedHours}h</p>
            <p className="text-[11px] text-muted-foreground">
              {totalOvertimeHours > 0 ? `Includes ${totalOvertimeHours}h OT` : 'Regular time logs'}
            </p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Hours Remaining</span>
              <FileClock className="w-4 h-4 text-warning" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{remainingHours}h</p>
            <p className="text-[11px] text-muted-foreground">Target: {requiredHours} total hours</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Tasks Completed</span>
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {taskSummary.completed} / {taskSummary.total}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {taskSummary.total > 0
                ? `${Math.round((taskSummary.completed / taskSummary.total) * 100)}% completion rate`
                : 'No tasks assigned yet'}
            </p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Latest Evaluation</span>
              <Award className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-1.5">
              {latestEvaluation?.overallRating ? (
                <>
                  <Star className="w-5 h-5 text-warning fill-warning" />
                  {latestEvaluation.overallRating}
                  <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">Pending</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {latestEvaluation ? `${latestEvaluation.type} review` : 'Cycle in progress'}
            </p>
          </div>
        </div>
      )}

      {/* Visual Analytics & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Hours Rendered Bar Chart */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Daily Hours Logged (Last 7 Days)</h3>
              <p className="text-xs text-muted-foreground">Hours verified through DTR records</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Regular
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" /> Overtime
              </span>
            </div>
          </div>

          {loading ? (
            <Skeleton variant="rectangular" height={220} className="rounded-xl" />
          ) : (
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'currentColor' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="regular" name="Regular Hours" stackId="a" fill="var(--color-primary)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overtime" name="Overtime Hours" stackId="a" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Task Breakdown Donut / Competency Radar */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {competencyScores.length > 0 ? 'Competency Assessment' : 'Task Status Breakdown'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {competencyScores.length > 0
                  ? 'Performance scores from your latest evaluation'
                  : 'Current deliverables and assignments progress'}
              </p>
            </div>
          </div>

          {loading ? (
            <Skeleton variant="rectangular" height={220} className="rounded-xl" />
          ) : competencyScores.length > 0 ? (
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={competencyScores}>
                  <PolarGrid opacity={0.2} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'currentColor' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 9 }} />
                  <Radar
                    name="Competency Score"
                    dataKey="score"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.45}
                  />
                  <Tooltip content={<ChartTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : taskDistribution.length > 0 ? (
            <div className="h-[230px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {taskDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 pr-4 text-xs">
                {taskDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}:</span>
                    <span className="font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[230px] flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                <ListTodo className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No Task or Evaluation Records</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                As your supervisor assigns tasks and submits periodic evaluations, interactive metrics will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Quick Actions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Direct shortcuts to all trainee tools and records</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.title}
              onClick={() => navigate(card.route)}
              className="flex items-start gap-4 p-5 bg-muted/30 border border-border rounded-xl hover:border-primary/50 hover:bg-muted/60 transition-all text-left cursor-pointer group"
            >
              <div className="p-3 bg-card border border-border rounded-xl group-hover:border-primary/30 transition-colors">
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-foreground text-sm">{card.title}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                    {card.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
