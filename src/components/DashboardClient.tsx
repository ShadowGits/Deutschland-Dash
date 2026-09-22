'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, CheckCircle2, TrendingUp, AlertCircle, Folder, Calendar, RotateCw, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Columns2, Maximize2 } from 'lucide-react';
import MonthlyGoalsTable from '@/components/MonthlyGoalsTable';
import Sidebar from '@/components/Sidebar';
import ProjectFilesWidget from '@/components/ProjectFilesWidget';
import CSVTableWidget from '@/components/widgets/CSVTableWidget';
import ProjectCustomTablesWidget from '@/components/widgets/ProjectCustomTablesWidget';
import ProjectQnaWidget from '@/components/widgets/ProjectQnaWidget';
import ProjectTasksWidget from '@/components/widgets/ProjectTasksWidget';
import AddWidgetModal from '@/components/widgets/AddWidgetModal';
import TextWidget from '@/components/widgets/TextWidget';
import { getProjectFiles, connectGoogleCalendar } from '@/app/actions';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import StudyWidget from '@/components/widgets/StudyWidget';
import BooksWidget from '@/components/widgets/BooksWidget';
import GermanyDocsWidget from '@/components/widgets/GermanyDocsWidget';
import FinanceGoalsWidget from '@/components/widgets/FinanceGoalsWidget';
import GlobalDashboard from '@/components/GlobalDashboard';
import WeeklyView from '@/components/WeeklyView';
import { useSearchParams, useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import MoneyView from '@/components/MoneyView';
import FundingPlanWidget from '@/components/widgets/FundingPlanWidget';
import type { MoneyMonth } from '@/lib/finance';
import type { FundingData } from '@/lib/funding';

interface DashboardClientProps {
  metrics: any;
  projects: any[];
  studyTopics?: any[];
  books?: any[];
  germanyDocs?: any[];
  financeGoals?: any[];
  weekData?: any;
  projectWidgets?: Record<string, any[]>;
  money?: MoneyMonth | null;
  funding?: FundingData | null;
}

export default function DashboardClient({
  metrics,
  projects,
  studyTopics = [],
  books = [],
  germanyDocs = [],
  financeGoals = [],
  weekData = null,
  projectWidgets = {},
  money = null,
  funding = null
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || 'dashboard';
  
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(initialProjectId);
  const [selectedViewFile, setSelectedViewFile] = useState<any | null>(null);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  // Documents/Drive files section is collapsed by default — it's bulky and
  // rarely the first thing you need when opening a project.
  const [docsCollapsed, setDocsCollapsed] = useState(true);

  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  // Widgets fetch their own data when they mount. Bumping this remounts them,
  // which is what makes a refresh reach them as well as the server data.
  const [refreshNonce, setRefreshNonce] = useState(0);
  // The widget list arrives as a server prop, so a deleted widget stays on
  // screen until the page is re-rendered. Hide it straight away and let the
  // refresh catch up.
  const [removedWidgets, setRemovedWidgets] = useState<Set<string>>(new Set());
  // Widget layout (half/full width and ordering) is persisted on the widget
  // itself — width in config, position in order_index. These local overrides
  // let a change show instantly instead of waiting for the server round-trip.
  const [layout, setLayout] = useState<Record<string, { width?: 'half' | 'full'; order?: number }>>({});

  // The project's widgets in display order, each carrying its resolved width.
  const orderedWidgets = (projectId: string) =>
    (projectWidgets[projectId] || [])
      .filter((w: any) => !removedWidgets.has(w.id))
      .map((w: any, i: number) => ({
        ...w,
        _order: layout[w.id]?.order ?? w.order_index ?? i,
        _width: layout[w.id]?.width ?? w.config?.width ?? 'full',
      }))
      .sort((a: any, b: any) => a._order - b._order);

  const setWidgetWidth = async (widget: any, width: 'half' | 'full') => {
    setLayout(prev => ({ ...prev, [widget.id]: { ...prev[widget.id], width } }));
    try {
      const { updateWidgetAction } = await import('@/app/actions');
      await updateWidgetAction(widget.id, { config: { ...(widget.config || {}), width } });
    } catch (e) {
      console.error('Failed to save widget width', e);
    }
  };

  // Swap a widget with its neighbour, then renumber the whole list so the
  // positions stay distinct and sequential however they started out.
  const moveWidget = async (list: any[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setLayout(prev => {
      const out = { ...prev };
      next.forEach((w: any, i: number) => { out[w.id] = { ...out[w.id], order: i }; });
      return out;
    });
    try {
      const { updateWidgetAction } = await import('@/app/actions');
      await Promise.all(next.map((w: any, i: number) => updateWidgetAction(w.id, { order_index: i })));
    } catch (e) {
      console.error('Failed to reorder widgets', e);
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    setRemovedWidgets(prev => new Set(prev).add(widgetId));
    try {
      const { deleteWidgetAction } = await import('@/app/actions');
      await deleteWidgetAction(widgetId);
      startRefresh(() => router.refresh());
    } catch (e) {
      console.error('Failed to remove widget', e);
      setRemovedWidgets(prev => {
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
    }
  };

  const handleRefresh = () => {
    setRefreshNonce((n) => n + 1);
    startRefresh(() => router.refresh());
  };

  useEffect(() => {
    if (activeProjectId && !['dashboard', 'weekly', 'money'].includes(activeProjectId)) {
      getProjectFiles(activeProjectId).then(files => {
        setProjectFiles(files || []);
      });
    }
  }, [activeProjectId, refreshNonce]);

  // Update URL without triggering a Next.js navigation (which would cause a server re-render)
  useEffect(() => {
    if (activeProjectId) {
      const url = new URL(window.location.href);
      url.searchParams.set('projectId', activeProjectId);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeProjectId]);

  const activeProject = activeProjectId 
    ? projects.find((p: any) => p.id === activeProjectId)
    : projects[0];

  const projectName = activeProject?.name || '';
  // Finance is the funding plan and nothing else. Task counters, monthly goals
  // and the Drive folder all read zero there — it has no tasks and no
  // documents — so they were noise wrapped around the one thing on the page.
  const isFinance = projectName === 'Finance';

  return (
    <div className="flex h-screen bg-[#f4f6fa] overflow-hidden font-sans">
      <Sidebar 
        projects={projects} 
        activeProjectId={activeProject?.id} 
        onProjectSelect={setActiveProjectId}
      />
      
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">
            {activeProjectId === 'dashboard' ? 'Global Dashboard' :
             activeProjectId === 'weekly' ? 'Week View' :
             activeProjectId === 'money' ? 'Money' :
             activeProject ? activeProject.name : 'Dashboard'}
          </h1>
          <div className="flex items-center space-x-4">
            <button 
              onClick={async () => {
                try {
                  const res = await connectGoogleCalendar();
                  if (res?.authorization_url) {
                    window.location.href = res.authorization_url;
                  } else {
                    alert("Failed to get Google Calendar connection link.");
                  }
                } catch (e) {
                  alert("Error connecting Google Calendar");
                }
              }}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 flex items-center border border-blue-200 transition-colors"
            >
              <Calendar size={14} className="mr-2" />
              Connect Google Calendar
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Reload this view without reloading the page"
              className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors disabled:opacity-60"
            >
              <RotateCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <span className="text-sm text-gray-500">Summary for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <NotificationBell />
          </div>
        </header>

        {/* Keyed on the refresh counter so every widget below remounts and
            refetches — the server data alone would leave them showing stale
            rows they fetched themselves. */}
        <main className="p-8" key={refreshNonce}>
          {activeProjectId === 'dashboard' ? (
            <div className="space-y-6">
              <GlobalDashboard metrics={metrics} projects={projects} monthlyGoals={weekData?.monthly_goals || []} />
              
              {/* Project Files & Google Drive Documents Section (Main Project) */}
              {projects.length > 0 && (
                <div className="grid grid-cols-1 gap-6">
                  <Card className="shadow-sm border-0 rounded-xl">
                    <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
                      <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                        <Folder className="mr-2 text-emerald-600" size={20} />
                        Project Documents & Google Drive Files
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <ProjectFilesWidget
                        key={projects[0].id}
                        projectId={projects[0].id}
                        files={projects[0].files || []}
                        onViewFile={setSelectedViewFile}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : activeProjectId === 'weekly' ? (
            <WeeklyView weekData={weekData} projects={projects} />
          ) : activeProjectId === 'money' ? (
            money ? (
              <MoneyView initial={money} />
            ) : (
              <div className="text-center py-20 text-gray-500">
                Could not load your money data.
              </div>
            )
          ) : activeProject ? (
            <div className="space-y-6">

              {/* The funding plan is what the Finance project is for, so it
                  opens the view rather than sitting under the generic task
                  counters. */}
              {projectName === 'Finance' && funding && (
                <FundingPlanWidget initial={funding} />
              )}

              {/* Top KPIs */}
              {!isFinance && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="shadow-sm border-0 rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                        <h3 className="text-2xl font-bold text-gray-800 capitalize">{activeProject.status || 'Active'}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                        <TrendingUp size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="shadow-sm border-0 rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Tasks Completed</p>
                        <h3 className="text-2xl font-bold text-gray-800">{activeProject.completed_tasks_count || 0}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Milestones</p>
                        <h3 className="text-2xl font-bold text-gray-800">{activeProject.milestone_count || 0}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                        <Target size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-0 rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Upcoming Deadlines</p>
                        <h3 className="text-2xl font-bold text-gray-800">{metrics.upcoming_deadlines?.filter((d:any) => d.project_id === activeProject.id).length || 0}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                        <AlertCircle size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Dedicated Domain Widgets */}
              {projectName === 'Study' && studyTopics.length > 0 && (
                <StudyWidget topics={studyTopics} />
              )}

              {projectName === 'Reading' && books.length > 0 && (
                <BooksWidget books={books} />
              )}

              {projectName === 'Germany' && germanyDocs.length > 0 && (
                <GermanyDocsWidget documents={germanyDocs} />
              )}

              {projectName === 'Finance' && financeGoals.length > 0 && (
                <FinanceGoalsWidget goals={financeGoals} />
              )}

              {/* Monthly Goals Section */}
              {!isFinance && (
              <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-sm border-0 rounded-xl">
                  <CardHeader className="border-b bg-white rounded-t-xl px-6 py-5">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                      <Target className="mr-2 text-primary" size={20} />
                      Monthly Goals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <MonthlyGoalsTable
                      projectId={activeProject.id}
                      goals={activeProject.monthly_goals || []}
                    />
                  </CardContent>
                </Card>
              </div>
              )}

              {/* Custom Project Tables */}
              <ProjectCustomTablesWidget
                key={activeProject.id + "_custom"}
                projectId={activeProject.id}
              />

              {/* Dynamic Widgets Loop — a two-column grid so widgets set to
                  half width sit side by side. Everything collapses to a single
                  column on narrow screens. */}
              {(() => {
                const widgets = orderedWidgets(activeProject.id);
                const renderWidget = (widget: any) => {
                  if (widget.widget_type === 'qna') {
                    return <ProjectQnaWidget projectId={activeProject.id} />;
                  }
                  if (widget.widget_type === 'csv') {
                    return (
                      <CSVTableWidget
                        widget={widget}
                        projectId={activeProject.id}
                        projectFiles={projectFiles}
                        onDelete={() => handleDeleteWidget(widget.id)}
                      />
                    );
                  }
                  if (widget.widget_type === 'tasks') {
                    return (
                      <ProjectTasksWidget
                        projectId={activeProject.id}
                        widget={widget}
                        onDelete={() => handleDeleteWidget(widget.id)}
                      />
                    );
                  }
                  if (widget.widget_type === 'text') {
                    return (
                      <TextWidget
                        projectId={activeProject.id}
                        widget={widget}
                        fileInfo={projectFiles.find(f => f.id === widget.file_id)}
                        onDelete={() => handleDeleteWidget(widget.id)}
                      />
                    );
                  }
                  return null;
                };

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {widgets.map((widget: any, index: number) => {
                      const body = renderWidget(widget);
                      if (!body) return null;
                      const half = widget._width === 'half';
                      return (
                        <div
                          key={widget.id}
                          className={`min-w-0 ${half ? 'md:col-span-1' : 'md:col-span-2'}`}
                        >
                          <div className="flex items-center justify-end gap-1 mb-1 opacity-60 hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => moveWidget(widgets, index, -1)}
                              disabled={index === 0}
                              title="Move up"
                              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              onClick={() => moveWidget(widgets, index, 1)}
                              disabled={index === widgets.length - 1}
                              title="Move down"
                              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              onClick={() => setWidgetWidth(widget, half ? 'full' : 'half')}
                              title={half ? 'Make full width' : 'Make half width (side by side)'}
                              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            >
                              {half ? <Maximize2 size={16} /> : <Columns2 size={16} />}
                            </button>
                          </div>
                          {body}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Project Files & Google Drive Documents Section — collapsible,
                  parked at the end so it doesn't crowd the top of the view. */}
              {!isFinance && (
              <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-sm border-0 rounded-xl">
                  <CardHeader
                    className="border-b bg-white rounded-t-xl px-6 py-5 cursor-pointer select-none"
                    onClick={() => setDocsCollapsed((v) => !v)}
                  >
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center justify-between">
                      <span className="flex items-center">
                        <Folder className="mr-2 text-emerald-600" size={20} />
                        Project Documents & Google Drive Files
                      </span>
                      {docsCollapsed ? (
                        <ChevronRight className="text-gray-400" size={20} />
                      ) : (
                        <ChevronDown className="text-gray-400" size={20} />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {!docsCollapsed && (
                    <CardContent className="p-6">
                      <ProjectFilesWidget
                        key={activeProject.id}
                        projectId={activeProject.id}
                        files={activeProject.files || []}
                        onViewFile={setSelectedViewFile}
                      />
                    </CardContent>
                  )}
                </Card>
              </div>
              )}

              {/* Add Widget Button */}
              <div className="flex justify-center mt-8 pb-8">
                <AddWidgetModal 
                  projectId={activeProject.id}
                  projectFiles={projectFiles}
                  onWidgetAdded={() => {
                    // It relies on server action revalidating path, so we can just let it refresh
                    window.location.reload();
                  }}
                />
              </div>


            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              Select a project from the sidebar to view its dashboard.
            </div>
          )}
        </main>
      </div>

      {/* Embedded Document Viewer Modal */}
      <DocumentViewerModal
        file={selectedViewFile}
        onClose={() => setSelectedViewFile(null)}
      />
    </div>
  );
}
