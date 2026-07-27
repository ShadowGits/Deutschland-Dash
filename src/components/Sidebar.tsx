'use client';

import Link from 'next/link';
import { LayoutDashboard, BookOpen, Briefcase, Globe, Languages, GraduationCap, LineChart, Dumbbell, Music, BookOpenCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  projects: any[];
  activeProjectId?: string;
}

export default function Sidebar({ projects, activeProjectId }: SidebarProps) {
  // Map standard project names to icons
  const iconMap: Record<string, React.ElementType> = {
    'Study': BookOpen,
    'Internship and Project': Briefcase,
    'Germany': Globe,
    'Language': Languages,
    'Colleges': GraduationCap,
    'Finance': LineChart,
    'Fitness': Dumbbell,
    'Piano': Music,
    'Reading': BookOpenCheck,
  };

  const dashboardProjects = projects.filter(p => !p.name.endsWith('(Non-Dash)'));
  const nonDashProjects = projects.filter(p => p.name.endsWith('(Non-Dash)'));

  return (
    <aside className="w-64 bg-[#12193b] text-[#aab2c8] flex flex-col h-full border-r border-[#1e2646]">
      <div className="h-16 flex items-center px-6 border-b border-[#1e2646]">
        <div className="font-bold text-white text-xl tracking-wide flex items-center">
          <span className="text-emerald-400 mr-2">◓</span>
          Planner OS
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="mb-8">
          <p className="px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">
            Dashboard
          </p>
          <nav className="space-y-1">
            {dashboardProjects.map(project => {
              const Icon = iconMap[project.name] || LayoutDashboard;
              const isActive = project.id === activeProjectId;
              return (
                <Link
                  key={project.id}
                  href={`/?projectId=${project.id}`}
                  className={cn(
                    "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group",
                    isActive 
                      ? "bg-[#1e2646] text-white" 
                      : "text-[#aab2c8] hover:bg-[#1e2646] hover:text-white"
                  )}
                >
                  <Icon 
                    className={cn(
                      "mr-3 flex-shrink-0 h-5 w-5",
                      isActive ? "text-emerald-400" : "text-[#64748b] group-hover:text-emerald-400"
                    )} 
                  />
                  {project.name}
                  {project.status === 'done' && (
                    <span className="ml-auto bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                      Done
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {nonDashProjects.length > 0 && (
          <div>
            <p className="px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">
              Other Projects
            </p>
            <nav className="space-y-1">
              {nonDashProjects.map(project => {
                const Icon = LayoutDashboard;
                const isActive = project.id === activeProjectId;
                return (
                  <Link
                    key={project.id}
                    href={`/?projectId=${project.id}`}
                    className={cn(
                      "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group",
                      isActive 
                        ? "bg-[#1e2646] text-white" 
                        : "text-[#aab2c8] hover:bg-[#1e2646] hover:text-white"
                    )}
                  >
                    <Icon 
                      className={cn(
                        "mr-3 flex-shrink-0 h-5 w-5",
                        isActive ? "text-emerald-400" : "text-[#64748b] group-hover:text-emerald-400"
                      )} 
                    />
                    {project.name.replace(' (Non-Dash)', '')}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-[#1e2646]">
        <div className="flex items-center px-4">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
            P
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">Admin</p>
            <p className="text-xs text-[#aab2c8]">Personal Dashboard</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
