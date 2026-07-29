'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, CheckCircle2, TrendingUp, AlertCircle, Folder } from 'lucide-react';
import MonthlyGoalsTable from '@/components/MonthlyGoalsTable';
import Sidebar from '@/components/Sidebar';
import ProjectFilesWidget from '@/components/ProjectFilesWidget';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import StudyWidget from '@/components/widgets/StudyWidget';
import BooksWidget from '@/components/widgets/BooksWidget';
import GermanyDocsWidget from '@/components/widgets/GermanyDocsWidget';
import FinanceGoalsWidget from '@/components/widgets/FinanceGoalsWidget';
import { useSearchParams } from 'next/navigation';

interface DashboardClientProps {
  metrics: any;
  projects: any[];
  studyTopics?: any[];
  books?: any[];
  germanyDocs?: any[];
  financeGoals?: any[];
}

export default function DashboardClient({
  metrics,
  projects,
  studyTopics = [],
  books = [],
  germanyDocs = [],
  financeGoals = []
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || (projects.length > 0 ? projects[0].id : undefined);
  
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(initialProjectId);
  const [selectedViewFile, setSelectedViewFile] = useState<any | null>(null);

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

              {/* Project Files & Google Drive Documents Section */}
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
                      key={activeProject.id}
                      projectId={activeProject.id}
                      files={activeProject.files || []}
                      onViewFile={setSelectedViewFile}
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

      {/* Embedded Document Viewer Modal */}
      <DocumentViewerModal
        file={selectedViewFile}
        onClose={() => setSelectedViewFile(null)}
      />
    </div>
  );
}
