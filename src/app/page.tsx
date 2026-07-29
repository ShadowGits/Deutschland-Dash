import { fetchMetrics, fetchStudyTopics, fetchBooks, fetchGermanyDocuments, fetchFinanceGoals } from '@/lib/api';
import DashboardClient from '@/components/DashboardClient';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [metrics, studyTopics, books, germanyDocs, financeGoals] = await Promise.all([
    fetchMetrics(),
    fetchStudyTopics(),
    fetchBooks(),
    fetchGermanyDocuments(),
    fetchFinanceGoals()
  ]);
  
  if (!metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-red-500">
        Could not connect to Planner-OS API.
      </div>
    );
  }

  const projects = metrics.projects || [];

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading dashboard...</div>}>
      <DashboardClient 
        metrics={metrics} 
        projects={projects}
        studyTopics={studyTopics}
        books={books}
        germanyDocs={germanyDocs}
        financeGoals={financeGoals}
      />
    </Suspense>
  );
}
