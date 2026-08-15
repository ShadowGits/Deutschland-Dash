import { fetchMetrics, fetchStudyTopics, fetchBooks, fetchGermanyDocuments, fetchFinanceGoals, fetchWeekView, fetchProjectWidgets } from '@/lib/api';
import { fetchMoneyMonth } from '@/lib/finance';
import DashboardClient from '@/components/DashboardClient';
import { Suspense } from 'react';

export const revalidate = 300;

export default async function DashboardPage() {
  const [metrics, studyTopics, books, germanyDocs, financeGoals, weekData, money] = await Promise.all([
    fetchMetrics(),
    fetchStudyTopics(),
    fetchBooks(),
    fetchGermanyDocuments(),
    fetchFinanceGoals(),
    fetchWeekView(),
    // Straight to Postgres, so this one is not waiting on a Cloud Run cold start.
    fetchMoneyMonth()
  ]);
  
  const projects = metrics?.projects || [];
  const projectWidgetsMap: Record<string, any[]> = {};
  
  if (projects.length > 0) {
    const widgetsPromises = projects.map((p: any) => fetchProjectWidgets(p.id));
    const widgetsResults = await Promise.all(widgetsPromises);
    projects.forEach((p: any, idx: number) => {
      projectWidgetsMap[p.id] = widgetsResults[idx]?.widgets || [];
    });
  }
  
  if (!metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-red-500">
        Could not connect to Planner-OS API.
      </div>
    );
  }


  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading dashboard...</div>}>
      <DashboardClient 
        metrics={metrics} 
        projects={projects}
        studyTopics={studyTopics}
        books={books}
        germanyDocs={germanyDocs}
        financeGoals={financeGoals}
        weekData={weekData}
        projectWidgets={projectWidgetsMap}
        money={money}
      />
    </Suspense>
  );
}
