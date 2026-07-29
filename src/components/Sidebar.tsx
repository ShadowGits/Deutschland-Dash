'use client';

import { LayoutDashboard, BookOpen, Briefcase, Globe, Languages, GraduationCap, LineChart, Dumbbell, Music, BookOpenCheck, Settings, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  projects: any[];
  activeProjectId?: string;
  onProjectSelect: (projectId: string) => void;
}

export default function Sidebar({ projects, activeProjectId, onProjectSelect }: SidebarProps) {
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

  const deutschlandDashNames = ['Study', 'Internship and Project', 'Germany', 'Language', 'Colleges', 'Finance'];
  const personalNames = ['Fitness', 'Piano', 'Reading'];

  const getProjectByName = (name: string) => projects.find(p => p.name === name || p.name === `${name} (Non-Dash)`);

  const renderProjectLink = (name: string, Icon: React.ElementType) => {
    const project = getProjectByName(name);
    if (!project) return null;
    
    const isActive = project.id === activeProjectId;
    
    return (
      <button
        key={project.id}
        onClick={() => onProjectSelect(project.id)}
        className={cn(
          "w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group text-left",
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
        {name}
        {project.status === 'done' && (
          <span className="ml-auto bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">
            Done
          </span>
        )}
      </button>
    );
  };

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
            Deutschland-Dash
          </p>
          <nav className="space-y-1">
            {/* We will add real Dashboard and Week View routing later. For now, they are static UI elements */}
            <button className="w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group text-left text-[#aab2c8] hover:bg-[#1e2646] hover:text-white">
              <LayoutDashboard className="mr-3 flex-shrink-0 h-5 w-5 text-[#64748b] group-hover:text-emerald-400" />
              Dashboard
            </button>
            
            {deutschlandDashNames.map(name => renderProjectLink(name, iconMap[name] || LayoutDashboard))}

            <button className="w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group text-left text-[#aab2c8] hover:bg-[#1e2646] hover:text-white mt-4">
              <Calendar className="mr-3 flex-shrink-0 h-5 w-5 text-[#64748b] group-hover:text-emerald-400" />
              Week View
            </button>
            <button className="w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group text-left text-[#aab2c8] hover:bg-[#1e2646] hover:text-white">
              <Settings className="mr-3 flex-shrink-0 h-5 w-5 text-[#64748b] group-hover:text-emerald-400" />
              Settings
            </button>
          </nav>
        </div>

        <div>
          <p className="px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">
            Non-Dash (Persona)
          </p>
          <nav className="space-y-1">
            {personalNames.map(name => renderProjectLink(name, iconMap[name] || LayoutDashboard))}
          </nav>
        </div>
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
