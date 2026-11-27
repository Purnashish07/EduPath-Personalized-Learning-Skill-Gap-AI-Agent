import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  Route,
  Target,
  CalendarDays,
  ListChecks,
  Dumbbell,
  FolderKanban,
  BarChart3,
  MessageCircle,
  UserRound,
  Upload,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './index.css';
import { api, uploadDocument } from './lib/api';
import { supabase, supabaseConfigured } from './lib/auth';
import type {
  AppState,
  ChatMessage,
  DocumentRecord,
  LearningPathPhase,
  LearningTask,
  PracticeQuestion,
  PracticeSubmissionResult,
  Profile,
  ProgressReport,
  ProgressSummary,
  ProjectIdea,
  SkillGap,
  WeeklyPlanItem,
} from './types';

type TabName =
  | 'Dashboard'
  | 'Learning Path'
  | 'Skill Gaps'
  | 'Weekly Plan'
  | 'Tasks'
  | 'Practice'
  | 'Projects'
  | 'Progress'
  | 'AI Assistant'
  | 'Profile';

const NAV_ITEMS: Array<[TabName, LucideIcon]> = [
  ['Dashboard', LayoutDashboard],
  ['Learning Path', Route],
  ['Skill Gaps', Target],
  ['Weekly Plan', CalendarDays],
  ['Tasks', ListChecks],
  ['Practice', Dumbbell],
  ['Projects', FolderKanban],
  ['Progress', BarChart3],
  ['AI Assistant', MessageCircle],
  ['Profile', UserRound],
];

const INITIAL_PROGRESS: ProgressSummary = {
  completed: 0,
  totalTasks: 0,
  hours: 0,
  practiceScore: 0,
  attemptsCount: 0,
  masteredCount: 0,
  gapReduction: 0,
  struggleSkills: [],
  overall: 0,
};

const INITIAL_STATE: AppState = {
  profile: null,
  gaps: [],
  path: [],
  plan: [],
  tasks: [],
  progress: INITIAL_PROGRESS,
  practice: [],
  projects: [],
  report: null,
  messages: [],
  document: null,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function App() {
  const [tab, setTab] = useState<TabName>('Dashboard');
  const [data, setData] = useState<AppState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        profile,
        gaps,
        path,
        plan,
        tasks,
        progress,
        practice,
        projects,
        report,
        messages,
        document,
      ] = await Promise.all([
        api<Profile | null>('/profile'),
        api<SkillGap[]>('/skill-gap'),
        api<LearningPathPhase[]>('/learning-path'),
        api<WeeklyPlanItem[]>('/weekly-plan'),
        api<LearningTask[]>('/tasks'),
        api<ProgressSummary>('/progress'),
        api<PracticeQuestion[]>('/practice'),
        api<ProjectIdea[]>('/projects'),
        api<ProgressReport | null>('/reports'),
        api<ChatMessage[]>('/chat'),
        api<DocumentRecord | null>('/documents'),
      ]);

      setData({
        profile,
        gaps,
        path,
        plan,
        tasks,
        progress,
        practice,
        projects,
        report,
        messages,
        document,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured || !supabase) {
      api('/auth/demo', { method: 'POST', body: '{}' })
        .then(() => {
          if (!active) return;
          setAuthReady(true);
          setNeedsLogin(false);
          return load();
        })
        .catch((err) => {
          if (!active) return;
          setAuthReady(true);
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to reach EduPath backend API'
          );
        });
      return () => {
        active = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setNeedsLogin(!session);
      setAuthReady(true);
      if (session) void load();
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setNeedsLogin(!data.session);
      setAuthReady(true);
      if (data.session) void load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [load]);

  const runAction = async (endpoint: string) => {
    setLoading(true);
    setError(null);
    try {
      await api(endpoint, { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (
    taskId: string,
    status: LearningTask['status'] = 'completed'
  ) => {
    setError(null);
    try {
      await api(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task');
    }
  };

  return (
    <div className="min-h-screen gridbg">
      {!authReady ? (
        <main className="p-8 muted">Checking sign-in…</main>
      ) : needsLogin ? (
        <AuthGate />
      ) : (
      <>
      <aside className="fixed left-0 top-0 bottom-0 w-64 p-5 hidden lg:block">
        <div className="glass rounded-3xl h-full p-4 flex flex-col">
          <div className="px-3 py-3 mb-5">
            <div className="flex items-center gap-2 font-bold text-xl">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Sparkles size={19} />
              </div>
              EduPath
            </div>
            <div className="text-xs muted mt-1">AI Career Navigator</div>
          </div>
          <nav className="flex-1 overflow-y-auto">
            {NAV_ITEMS.map(([name, Icon]) => (
              <button
                key={name}
                onClick={() => setTab(name)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm mb-1 transition ${
                  tab === name
                    ? 'bg-white/10 text-white font-medium'
                    : 'muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={17} />
                {name}
              </button>
            ))}
          </nav>
          <div className="mt-4 p-3 rounded-2xl bg-blue-500/10 border border-blue-400/15">
            <div className="text-xs accent font-medium">DEMO MODE</div>
            <div className="text-xs muted mt-1">
              Real AI connects when LLM_API_KEY is configured.
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-20 p-3 backdrop-blur-md bg-[#070b12]/80 border-b border-white/10">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Sparkles size={17} className="text-blue-400" />
            EduPath
          </div>
          <span className="text-[11px] accent px-2 py-0.5 rounded-full bg-blue-500/10">
            DEMO MODE
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {NAV_ITEMS.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs ${
                tab === name
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/5 muted'
              }`}
            >
              <Icon size={14} />
              {name}
            </button>
          ))}
        </div>
      </div>

      <main className="lg:ml-64 p-4 sm:p-6 lg:p-9 max-w-[1500px]">
        {supabaseConfigured && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => void supabase?.auth.signOut()}
              className="px-3 py-2 rounded-xl bg-white/10 text-sm muted hover:text-white"
            >
              Sign out
            </button>
          </div>
        )}
        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-400/30 text-red-200 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="p-1 hover:bg-white/10 rounded-lg"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {tab === 'Dashboard' && (
          <Dashboard
            d={data}
            run={runAction}
            complete={toggleTask}
            onNavigate={setTab}
            loading={loading}
          />
        )}
        {tab === 'Skill Gaps' && (
          <SkillGapsView d={data} run={runAction} loading={loading} />
        )}
        {tab === 'Learning Path' && (
          <LearningPathView d={data} run={runAction} loading={loading} />
        )}
        {tab === 'Weekly Plan' && (
          <WeeklyPlanView d={data} run={runAction} loading={loading} />
        )}
        {tab === 'Tasks' && (
          <TasksView
            d={data}
            toggleTask={toggleTask}
            run={runAction}
            loading={loading}
          />
        )}
        {tab === 'Practice' && (
          <PracticeView
            d={data}
            onRefresh={load}
            setError={setError}
            loading={loading}
          />
        )}
        {tab === 'Projects' && (
          <ProjectsView d={data} run={runAction} loading={loading} />
        )}
        {tab === 'Progress' && (
          <ProgressView d={data} run={runAction} loading={loading} />
        )}
        {tab === 'AI Assistant' && (
          <AssistantView d={data} onRefresh={load} setError={setError} />
        )}
        {tab === 'Profile' && (
          <ProfileView d={data} onRefresh={load} setError={setError} />
        )}
      </main>
      </>
      )}
    </div>
  );
}

function AuthGate() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (creatingAccount) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage('Check your email to confirm the new account, then sign in.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to authenticate'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <form
        onSubmit={submit}
        className="glass rounded-3xl p-7 w-full max-w-md space-y-4"
      >
        <div className="flex items-center gap-2 font-bold text-xl">
          <Sparkles size={20} className="accent" />
          EduPath
        </div>
        <h1 className="text-2xl font-semibold">
          {creatingAccount ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="muted text-sm">
          Use your EduPath account to securely access your personal learning data.
        </p>
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={creatingAccount ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {message && <p className="text-sm accent">{message}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-blue-500 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Please wait…' : creatingAccount ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCreatingAccount((value) => !value);
            setError(null);
            setMessage(null);
          }}
          className="w-full text-sm muted hover:text-white"
        >
          {creatingAccount
            ? 'Already have an account? Sign in'
            : 'New to EduPath? Create an account'}
        </button>
      </form>
    </main>
  );
}

function Header({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
      <div>
        <div className="text-xs uppercase tracking-[.2em] accent mb-2">
          EduPath / {title}
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="muted mt-2">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function Dashboard({
  d,
  run,
  complete,
  onNavigate,
  loading,
}: {
  d: AppState;
  run: (endpoint: string) => Promise<void>;
  complete: (id: string, status?: LearningTask['status']) => Promise<void>;
  onNavigate: (tab: TabName) => void;
  loading: boolean;
}) {
  const p = d.profile;
  const next = d.tasks.find((x) => x.status !== 'completed');
  const firstName = p?.name?.split(' ')[0] || 'Learner';
  const chartData =
    d.plan.length > 0
      ? d.plan.map((item) => ({
          d: item.day.slice(0, 3),
          h: Number((item.minutes / 60).toFixed(2)),
        }))
      : [
          { d: 'Mon', h: 1 },
          { d: 'Tue', h: 1.5 },
          { d: 'Wed', h: 0.7 },
          { d: 'Thu', h: 2 },
          { d: 'Fri', h: 1.2 },
          { d: 'Sat', h: 2.5 },
          { d: 'Sun', h: 1.7 },
        ];

  const strugglingGaps = d.gaps
    .filter(
      (x) =>
        x.priority === 'High' || d.progress.struggleSkills.includes(x.skill)
    )
    .slice(0, 3);

  return (
    <>
      <Header
        title={`${getGreeting()}, ${firstName}.`}
        sub="Your path changes as you learn, practice and improve."
        action={
          <button
            onClick={() => run('/skill-gap/analyze')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold flex gap-2 items-center disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh path
          </button>
        }
      />

      <div className="grid xl:grid-cols-4 md:grid-cols-2 gap-4 mb-5">
        {[
          ['Target role', p?.target_role || 'AI Engineer'],
          ['Overall progress', `${d.progress.overall}%`],
          [
            'Tasks completed',
            `${d.progress.completed}/${d.progress.totalTasks || d.tasks.length}`,
          ],
          ['Learning hours', `${d.progress.hours.toFixed(1)}h`],
        ].map(([label, value]) => (
          <div className="glass rounded-2xl p-5" key={label}>
            <div className="muted text-sm">{label}</div>
            <div className="text-2xl font-semibold mt-2">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        <div className="glass rounded-3xl p-6 xl:col-span-2">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="flex gap-2 items-center text-sm accent">
                <Sparkles size={16} /> NEXT BEST ACTION
              </div>
              <h2 className="text-2xl font-semibold mt-3">
                {next?.title || 'All active tasks completed!'}
              </h2>
              <p className="muted mt-2">
                {next
                  ? `${next.remedial ? 'Adaptive prerequisite intervention' : 'Highest-priority gap'} (${next.skill}) for your ${p?.target_role || 'AI Engineer'} goal.`
                  : 'Generate a practice quiz or new projects to keep advancing.'}
              </p>
            </div>
            {next && (
              <div className="px-3 py-1 rounded-full bg-white/10 text-xs shrink-0">
                {next.minutes} min
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {next ? (
              <button
                onClick={() => complete(next.id, 'completed')}
                className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold flex gap-2 items-center"
              >
                <CheckCircle2 size={17} />
                Start &amp; complete
              </button>
            ) : (
              <button
                onClick={() => onNavigate('Practice')}
                className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold flex gap-2 items-center"
              >
                <Dumbbell size={17} />
                Open Practice Lab
              </button>
            )}
            <button
              onClick={() => onNavigate('Skill Gaps')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm"
            >
              View skill gap
            </button>
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="muted text-sm">Skill-gap closure</div>
          <div className="text-3xl font-semibold mt-2">
            {d.progress.gapReduction}%
          </div>
          <div className="h-2 bg-white/10 rounded-full mt-5 overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${d.progress.gapReduction}%` }}
            />
          </div>
          <p className="muted text-xs mt-3">
            Readiness across {d.gaps.length} analyzed target skills
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5 mt-5">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold">Weekly activity (planned hrs)</h3>
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <AreaChart data={chartData}>
                <XAxis dataKey="d" stroke="#718096" />
                <YAxis stroke="#718096" />
                <Tooltip
                  contentStyle={{
                    background: '#111827',
                    border: '1px solid #273449',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="h"
                  stroke="#8fb7ff"
                  fill="#8fb7ff"
                  fillOpacity={0.14}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold">Areas needing attention</h3>
          <div className="space-y-3 mt-4">
            {strugglingGaps.length > 0 ? (
              strugglingGaps.map((g) => (
                <div
                  className="p-4 rounded-2xl bg-white/[.03] border border-white/10"
                  key={g.skill}
                >
                  <div className="flex justify-between gap-2">
                    <b>{g.skill}</b>
                    <span className="text-xs text-amber-300">
                      {g.currentLevel}/5 → {g.requiredLevel}/5
                    </span>
                  </div>
                  <p className="muted text-sm mt-1">{g.reason}</p>
                </div>
              ))
            ) : (
              <Empty text="No high-priority gaps detected yet." />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SkillGapsView({
  d,
  run,
  loading,
}: {
  d: AppState;
  run: (endpoint: string) => Promise<void>;
  loading: boolean;
}) {
  return (
    <>
      <Header
        title="Skill Gap Analysis"
        sub="A living comparison between your demonstrated capabilities and your target role."
        action={
          <button
            onClick={() => run('/skill-gap/analyze')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        }
      />
      <div className="grid gap-3">
        {d.gaps.map((g) => (
          <div className="glass rounded-2xl p-5" key={g.skill}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold text-lg">{g.skill}</h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/10">
                    {g.status}
                  </span>
                  <span className="text-xs accent">{g.priority} priority</span>
                </div>
                <p className="muted text-sm mt-2">{g.reason}</p>
              </div>
              <div className="w-full md:w-52">
                <div className="flex justify-between text-xs muted">
                  <span>Current {g.currentLevel}/5</span>
                  <span>Required {g.requiredLevel}/5</span>
                </div>
                <div className="h-2 bg-white/10 rounded mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded"
                    style={{ width: `${(g.currentLevel / 5) * 100}%` }}
                  />
                </div>
              </div>
              <div className="md:w-80 text-sm">
                <b>Recommended:</b> <span className="muted">{g.action}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function LearningPathView({
  d,
  run,
  loading,
}: {
  d: AppState;
  run: (endpoint: string) => Promise<void>;
  loading: boolean;
}) {
  return (
    <>
      <Header
        title="Personalized Learning Path"
        sub="Your sequence is generated from your gaps, not a generic curriculum."
        action={
          <button
            onClick={() => run('/learning-path/generate')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Regenerate'}
          </button>
        }
      />
      <div className="grid md:grid-cols-2 gap-4">
        {d.path.map((x, i) => (
          <div className="glass rounded-3xl p-6" key={x.phase}>
            <div className="text-xs accent">
              PHASE {i + 1} · {x.weeks} WEEKS
            </div>
            <h2 className="text-xl font-semibold mt-2">{x.phase}</h2>
            <ul className="mt-4 space-y-3">
              {x.objectives.map((o) => (
                <li className="flex gap-2 text-sm muted" key={o}>
                  <CheckCircle2 size={16} className="text-blue-300 shrink-0" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function WeeklyPlanView({
  d,
  run,
  loading,
}: {
  d: AppState;
  run: (endpoint: string) => Promise<void>;
  loading: boolean;
}) {
  return (
    <>
      <Header
        title="Weekly Plan"
        sub="A schedule shaped around your available time and current gaps."
        action={
          <button
            onClick={() => run('/weekly-plan/generate')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Planning...' : 'Generate week'}
          </button>
        }
      />
      <div className="grid gap-3">
        {d.plan.length > 0 ? (
          d.plan.map((x) => (
            <div
              className="glass rounded-2xl p-5 flex items-center gap-4"
              key={x.day}
            >
              <div className="w-24 font-semibold">{x.day}</div>
              <div className="flex-1">
                <div>{x.title}</div>
                <div className="muted text-xs mt-1">{x.type}</div>
              </div>
              <div className="muted text-sm flex items-center gap-1">
                <Clock3 size={15} />
                {x.minutes} min
              </div>
            </div>
          ))
        ) : (
          <Empty text="Generate your first adaptive week." />
        )}
      </div>
    </>
  );
}

function TasksView({
  d,
  toggleTask,
  run,
  loading,
}: {
  d: AppState;
  toggleTask: (id: string, status: LearningTask['status']) => Promise<void>;
  run: (endpoint: string) => Promise<void>;
  loading: boolean;
}) {
  return (
    <>
      <Header
        title="Learning Tasks"
        sub="Turn your learning path into small, finishable actions."
        action={
          <button
            onClick={() => run('/tasks/seed')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium"
          >
            Reset demo tasks
          </button>
        }
      />
      <div className="grid gap-3">
        {d.tasks.length > 0 ? (
          d.tasks.map((t) => (
            <div
              className="glass rounded-2xl p-5 flex flex-wrap gap-4 items-center"
              key={t.id}
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Dumbbell size={18} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <b>{t.title}</b>
                  {t.remedial && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200">
                      Adaptive review
                    </span>
                  )}
                </div>
                <div className="muted text-sm mt-1">
                  {t.skill} · {t.minutes} min · {t.difficulty}
                </div>
              </div>
              {t.status === 'completed' ? (
                <button
                  onClick={() => toggleTask(t.id, 'todo')}
                  className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 text-sm"
                >
                  ✓ Completed (undo)
                </button>
              ) : (
                <button
                  onClick={() => toggleTask(t.id, 'completed')}
                  className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium"
                >
                  Mark complete
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty text="No learning tasks yet. Click 'Reset demo tasks' to populate your queue." />
        )}
      </div>
    </>
  );
}

function PracticeView({
  d,
  onRefresh,
  setError,
  loading,
}: {
  d: AppState;
  onRefresh: () => Promise<void>;
  setError: (msg: string | null) => void;
  loading: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [results, setResults] = useState<
    Record<string, PracticeSubmissionResult>
  >({});

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api<PracticeQuestion[]>('/practice/generate', {
        method: 'POST',
        body: '{}',
      });
      setSelected({});
      setResults({});
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate practice'
      );
    } finally {
      setGenerating(false);
    }
  };

  const submitAnswer = async (q: PracticeQuestion, option: string) => {
    const qId = q.id || q.question;
    setSelected((prev) => ({ ...prev, [qId]: option }));
    const score = option === q.answer ? 100 : 0;

    try {
      const res = await api<PracticeSubmissionResult>(
        `/practice/${encodeURIComponent(qId)}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ skill: q.skill, score }),
        }
      );
      setResults((prev) => ({ ...prev, [qId]: res }));
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit practice answer'
      );
    }
  };

  return (
    <>
      <Header
        title="Practice Lab"
        sub="Adaptive questions generated around your current gaps."
        action={
          <button
            onClick={generate}
            disabled={generating || loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
          >
            {generating ? 'Generating...' : 'Generate practice'}
          </button>
        }
      />
      <div className="space-y-4">
        {d.practice.length === 0 ? (
          <Empty text='Click "Generate practice" to create targeted questions for your skill gaps.' />
        ) : (
          d.practice.map((q, i) => {
            const qId = q.id || `q-${i}`;
            const chosen = selected[qId];
            const res = results[qId];
            return (
              <div className="glass rounded-2xl p-5" key={qId}>
                <div className="text-xs accent">
                  {q.skill} · {q.difficulty}
                </div>
                <h3 className="font-semibold mt-2">{q.question}</h3>
                <div className="grid sm:grid-cols-2 gap-2 mt-4">
                  {q.options?.map((option) => {
                    const isChosen = chosen === option;
                    const isCorrect = option === q.answer;
                    let cls = 'bg-white/5 hover:bg-white/10';
                    if (chosen) {
                      if (isCorrect) {
                        cls = 'bg-emerald-500/20 border border-emerald-400/40';
                      } else if (isChosen) {
                        cls = 'bg-red-500/20 border border-red-400/40';
                      }
                    }
                    return (
                      <button
                        onClick={() => submitAnswer(q, option)}
                        className={`text-left p-3 rounded-xl text-sm transition ${cls}`}
                        key={option}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {res && (
                  <div className="mt-3 p-3 rounded-xl bg-white/5 text-sm space-y-1">
                    <div
                      className={
                        res.score === 100
                          ? 'text-emerald-300 font-medium'
                          : 'text-amber-300 font-medium'
                      }
                    >
                      {res.score === 100
                        ? '✓ Correct'
                        : 'Not quite — review the explanation below'}
                    </div>
                    {q.explanation && (
                      <p className="muted text-xs">{q.explanation}</p>
                    )}
                    <p className="text-xs accent">{res.feedback}</p>
                    {res.intervention && (
                      <p className="text-xs text-amber-200">
                        Adaptive intervention: {res.intervention}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function ProjectsView({
  d,
  run,
  loading,
}: {
  d: AppState;
  run: (endpoint: string) => Promise<void>;
  loading: boolean;
}) {
  return (
    <>
      <Header
        title="Projects"
        sub="Portfolio work selected to close your most valuable skill gaps."
        action={
          <button
            onClick={() => run('/projects/generate')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Generate projects'}
          </button>
        }
      />
      {d.projects.length === 0 ? (
        <Empty text='Click "Generate projects" to get tailored portfolio ideas.' />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {d.projects.map((x) => (
            <div className="glass rounded-3xl p-6" key={x.title}>
              <div className="text-xs accent">
                {x.difficulty} · {x.duration}
              </div>
              <h2 className="text-xl font-semibold mt-2">{x.title}</h2>
              <p className="muted text-sm mt-2">{x.problem}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {x.skills?.map((s) => (
                  <span
                    className="text-xs bg-white/10 px-2.5 py-1 rounded-full"
                    key={s}
                  >
                    {s}
                  </span>
                ))}
              </div>
              {x.techStack?.length > 0 && (
                <div className="mt-4 text-sm">
                  <b>Stack:</b>{' '}
                  <span className="muted">{x.techStack.join(' · ')}</span>
                </div>
              )}
              {x.features?.length > 0 && (
                <div className="mt-2 text-sm">
                  <b>Features:</b>{' '}
                  <span className="muted">{x.features.join(' · ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ProgressView({
  d,
  run,
  loading,
}: {
  d: AppState;
  run: (endpoint: string) => Promise<void>;
  loading: boolean;
}) {
  const r = d.report;

  return (
    <>
      <Header
        title="Progress & Reports"
        sub="See whether your gaps are shrinking — and where the agent should intervene."
        action={
          <button
            onClick={() => run('/reports/generate')}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Generating...' : 'Generate report'}
          </button>
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="muted">Overall readiness</div>
          <div className="text-3xl font-semibold mt-2">
            {d.progress.overall}%
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="muted">Practice score</div>
          <div className="text-3xl font-semibold mt-2">
            {d.progress.practiceScore}%
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="muted">Learning hours</div>
          <div className="text-3xl font-semibold mt-2">
            {d.progress.hours.toFixed(1)}h
          </div>
        </div>
      </div>

      {d.progress.struggleSkills.length > 0 && (
        <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-400/25 text-amber-200 text-sm">
          <b>Struggle detector active:</b> Low recent practice scores in{' '}
          {d.progress.struggleSkills.join(', ')}. Prerequisite review tasks have
          been added to your queue.
        </div>
      )}

      <div className="glass rounded-3xl p-6 mt-5">
        <h2 className="font-semibold">Adaptive loop</h2>
        <div className="grid md:grid-cols-4 gap-3 mt-5">
          {['Measure', 'Detect struggle', 'Intervene', 'Re-plan'].map(
            (x, i) => (
              <div className="p-4 rounded-2xl bg-white/5" key={x}>
                <div className="text-xs accent">0{i + 1}</div>
                <div className="font-medium mt-2">{x}</div>
                <div className="muted text-xs mt-1">
                  {
                    [
                      'Scores and task completion feed the learner state.',
                      'Repeated low performance is surfaced automatically.',
                      'Prerequisites and extra practice are added to Tasks.',
                      'The next-best action updates in real time.',
                    ][i]
                  }
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {r && (
        <div className="glass rounded-3xl p-6 mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Progress Report</h2>
            <span className="text-xs muted">
              {r.learningConsistency} · Generated{' '}
              {new Date(r.generatedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-2xl bg-white/5">
              <div className="text-xs uppercase tracking-wider accent mb-2">
                Strong Areas
              </div>
              <div className="flex flex-wrap gap-2">
                {(r.strongAreas.length ? r.strongAreas : r.skillsAcquired).map(
                  (s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-200 text-xs"
                    >
                      {s}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5">
              <div className="text-xs uppercase tracking-wider accent mb-2">
                Focus / Weak Areas
              </div>
              <div className="flex flex-wrap gap-2">
                {r.weakAreas.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-200 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5">
              <div className="text-xs uppercase tracking-wider accent mb-2">
                Achievements
              </div>
              <ul className="space-y-1 muted">
                {r.achievements.map((a) => (
                  <li key={a}>• {a}</li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-2xl bg-white/5">
              <div className="text-xs uppercase tracking-wider accent mb-2">
                Recommended Next Steps
              </div>
              <ul className="space-y-1 muted">
                {r.nextSteps.map((s) => (
                  <li key={s}>→ {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AssistantView({
  d,
  onRefresh,
  setError,
}: {
  d: AppState;
  onRefresh: () => Promise<void>;
  setError: (msg: string | null) => void;
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const query = input.trim();
    if (!query || sending) return;
    setInput('');
    setSending(true);
    setError(null);
    try {
      await api('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: query }),
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Header
        title="AI Learning Assistant"
        sub="A context-aware coach that uses your profile, gaps, plan and progress."
      />
      <div className="glass rounded-3xl p-5 max-w-4xl">
        <div className="space-y-3 min-h-80 max-h-[500px] overflow-y-auto pr-1">
          {d.messages.length === 0 && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-400/15">
              <Sparkles size={18} />
              <p className="mt-2 text-sm">
                Ask me what to learn today, what to revise, or whether you are
                ready for an {d.profile?.target_role || 'AI Engineer'} interview.
              </p>
            </div>
          )}
          {d.messages.map((m) => (
            <div
              key={m.id}
              className={`p-4 rounded-2xl max-w-[85%] text-sm ${
                m.role === 'user' ? 'ml-auto bg-white/10' : 'bg-blue-500/10'
              }`}
            >
              <div>{m.content}</div>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                  {m.actions.map((a) => (
                    <span
                      key={a}
                      className="text-xs px-2 py-1 rounded-lg bg-white/5 accent"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="p-4 rounded-2xl max-w-[60%] bg-blue-500/10 text-sm muted">
              Thinking with your learner context...
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="What should I learn next?"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none"
          />
          <button
            onClick={send}
            disabled={sending}
            aria-label="Send message"
            className="px-4 rounded-xl bg-white text-black disabled:opacity-60"
          >
            <ArrowRight />
          </button>
        </div>
      </div>
    </>
  );
}

function ProfileView({
  d,
  onRefresh,
  setError,
}: {
  d: AppState;
  onRefresh: () => Promise<void>;
  setError: (msg: string | null) => void;
}) {
  const p = d.profile;
  const [name, setName] = useState(p?.name || '');
  const [targetRole, setTargetRole] = useState(p?.target_role || '');
  const [experience, setExperience] = useState(p?.experience_level || '');
  const [studyMinutes, setStudyMinutes] = useState(
    String(p?.study_minutes ?? 120)
  );
  const [learningStyle, setLearningStyle] = useState(p?.learning_style || '');
  const [careerGoal, setCareerGoal] = useState(p?.career_goal || '');
  const [skillsText, setSkillsText] = useState((p?.skills || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!p) return;
    setName(p.name);
    setTargetRole(p.target_role);
    setExperience(p.experience_level);
    setStudyMinutes(String(p.study_minutes));
    setLearningStyle(p.learning_style);
    setCareerGoal(p.career_goal);
    setSkillsText(p.skills.join(', '));
  }, [p]);

  const saveProfile = async () => {
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      await api('/profile', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || 'Learner',
          education_status: p?.education_status || 'Student / Professional',
          experience_level: experience.trim() || 'Intermediate',
          target_role: targetRole.trim() || 'AI Engineer',
          career_goal: careerGoal.trim() || '',
          study_minutes: Math.max(15, Number(studyMinutes) || 120),
          learning_style: learningStyle.trim() || 'Project-based',
          areas_to_improve: p?.areas_to_improve || [],
          skills: skillsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setSavedMsg('Profile saved.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      setFile(null);
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to upload document'
      );
    } finally {
      setUploading(false);
    }
  };

  const analysis = d.document?.analysis;

  return (
    <>
      <Header
        title="Learner Profile & Evidence"
        sub="Customize your goal or upload a resume/CV (PDF, DOCX, TXT) as skill evidence."
      />
      <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
        <div className="glass rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Profile Settings</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="muted text-xs uppercase">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="muted text-xs uppercase">Target role</span>
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="muted text-xs uppercase">Experience</span>
              <input
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="muted text-xs uppercase">
                Study minutes / day
              </span>
              <input
                type="number"
                min={15}
                max={720}
                value={studyMinutes}
                onChange={(e) => setStudyMinutes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="muted text-xs uppercase">Learning style</span>
              <input
                value={learningStyle}
                onChange={(e) => setLearningStyle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="muted text-xs uppercase">Career goal</span>
              <input
                value={careerGoal}
                onChange={(e) => setCareerGoal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="muted text-xs uppercase">
                Current skills (comma-separated)
              </span>
              <input
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
            {savedMsg && (
              <span className="text-xs text-emerald-300">{savedMsg}</span>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Resume / Evidence Upload</h2>
          <p className="muted text-sm">
            Upload a PDF, DOCX, or TXT file (max 8 MB) so EduPath extracts your
            demonstrated skills before analyzing skill gaps.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-white/10 file:text-white"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <Upload size={16} />
              {uploading ? 'Analyzing...' : 'Upload & analyze'}
            </button>
          </div>

          {d.document && (
            <div className="p-4 rounded-2xl bg-white/5 space-y-2 text-sm">
              <div className="text-xs accent">
                Analyzed: {d.document.filename}
              </div>
              {analysis?.technicalSkills?.length ? (
                <div>
                  <b>Technical skills:</b>{' '}
                  <span className="muted">
                    {analysis.technicalSkills.join(', ')}
                  </span>
                </div>
              ) : null}
              {analysis?.projects?.length ? (
                <div>
                  <b>Projects:</b>{' '}
                  <span className="muted">{analysis.projects.join(', ')}</span>
                </div>
              ) : null}
              {analysis?.education ? (
                <div>
                  <b>Education:</b>{' '}
                  <span className="muted">{analysis.education}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-10 text-center muted">{text}</div>;
}

createRoot(document.getElementById('root')!).render(<App />);
