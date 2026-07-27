import { fetchMetrics } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle2, TrendingUp, AlertCircle, LayoutDashboard } from 'lucide-react';
import MonthlyGoalsTable from '@/components/MonthlyGoalsTable';
import Sidebar from '@/components/Sidebar';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const metrics = await fetchMetrics();
  
  if (!metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-red-500">
        Could not connect to Planner-OS API.
      </div>
    );
  }

  const projects = metrics.projects || [];
  const selectedProjectId = (await searchParams).projectId as string | undefined;
  
  // Default to first project if none selected
  const activeProject = selectedProjectId 
    ? projects.find((p: any) => p.id === selectedProjectId)
    : projects[0];

  return (
    <div className="flex h-screen bg-[#f4f6fa] overflow-hidden font-sans">
      <Sidebar projects={projects} activeProjectId={activeProject?.id} />
      
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">
            {activeProject ? activeProject.name : 'Dashboard'}
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">Summary for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </header>

        <main className="p-8">
          {activeProject ? (
            <div className="space-y-6">
              
              {/* Top KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="shadow-sm border-0 rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                        <h3 className="text-2xl font-bold text-gray-800 capitalize">{activeProject.status || 'Active'}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                        <ActivityIcon />
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

              {/* Monthly Goals Section */}
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

            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              Select a project from the sidebar to view its dashboard.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ActivityIcon() {
  return <TrendingUp size={24} />;
}
