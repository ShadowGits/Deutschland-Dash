'use client';

import { useState } from 'react';
import {
  LayoutDashboard, BookOpen, Briefcase, Globe, Languages, GraduationCap, LineChart, Dumbbell, Music,
  BookOpenCheck, Settings, Calendar, Wallet, Crosshair, Folder, Home, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProject {
  id: string | number;
  name: string;
  status?: string;
  track?: string | null;
  open_tasks?: number;
}

interface SidebarProps {
  projects: SidebarProject[];
  activeProjectId?: string;
  onProjectSelect: (projectId: string) => void;
  /** Projects with something to show. The rest fold away behind a toggle. */
  contentful: Set<string>;
}

// Familiar projects keep their icons; anything new gets a folder.
const ICONS: Record<string, React.ElementType> = {
  Study: BookOpen,
  'Internship and Project': Briefcase,
  Germany: Globe,
  Language: Languages,
  Colleges: GraduationCap,
  Finance: LineChart,
  Fitness: Dumbbell,
  Piano: Music,
  Reading: BookOpenCheck,
  'Life other than Germany': Home,
};

const TRACK_LABELS: Record<string, string> = { 'germany-move': 'Germany move' };
const trackLabel = (track?: string | null) =>
  track ? TRACK_LABELS[track] ?? track.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Everything else';

function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group text-left',
        active ? 'bg-[#1e2646] text-white' : 'text-[#aab2c8] hover:bg-[#1e2646] hover:text-white',
      )}
    >
      <Icon
        className={cn(
          'mr-3 flex-shrink-0 h-5 w-5',
          active ? 'text-emerald-400' : 'text-[#64748b] group-hover:text-emerald-400',
        )}
      />
      <span className="min-w-0 flex-1 truncate" title={typeof children === 'string' ? children : undefined}>
        {children}
      </span>
      {badge}
    </button>
  );
}

/**
 * Built from the projects that exist, not a list of names written into the
 * code: that list had drifted, so projects with work in them were missing
 * while projects with nothing in them took up the space.
 */
export default function Sidebar({ projects, activeProjectId, onProjectSelect, contentful }: SidebarProps) {
  const [showQuiet, setShowQuiet] = useState(false);

  const live = projects.filter((p) => p.status !== 'archived');
  const isQuiet = (p: SidebarProject) => !contentful.has(String(p.id)) && String(p.id) !== activeProjectId;
  const quietCount = live.filter(isQuiet).length;
  const shown = live.filter((p) => showQuiet || !isQuiet(p));

  const groups = new Map<string, SidebarProject[]>();
  for (const project of shown) {
    const label = trackLabel(project.track);
    groups.set(label, [...(groups.get(label) || []), project]);
  }
  // Named tracks first, the catch-all last.
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === 'Everything else' ? 1 : b === 'Everything else' ? -1 : a.localeCompare(b),
  );

  return (
    <aside className="w-64 bg-[#12193b] text-[#aab2c8] flex flex-col h-full border-r border-[#1e2646]">
      <div className="h-16 flex items-center px-6 border-b border-[#1e2646]">
        <div className="font-bold text-white text-xl tracking-wide flex items-center">
          <span className="text-emerald-400 mr-2">◓</span>
          Cabinet of Tasks
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-7">
        <nav className="space-y-1">
          <NavButton active={activeProjectId === 'dashboard'} onClick={() => onProjectSelect('dashboard')} icon={Crosshair}>
            Focus
          </NavButton>
          <NavButton active={activeProjectId === 'weekly'} onClick={() => onProjectSelect('weekly')} icon={Calendar}>
            Week View
          </NavButton>
          <NavButton active={activeProjectId === 'overview'} onClick={() => onProjectSelect('overview')} icon={LayoutDashboard}>
            Overview
          </NavButton>
          {/* Money is a view rather than a project, so it is routed by id. */}
          <NavButton active={activeProjectId === 'money'} onClick={() => onProjectSelect('money')} icon={Wallet}>
            Money
          </NavButton>
        </nav>

        {ordered.map(([label, list]) => (
          <div key={label}>
            <p className="px-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">{label}</p>
            <nav className="space-y-1">
              {list
                .sort((a, b) => (b.open_tasks ?? 0) - (a.open_tasks ?? 0) || String(a.name).localeCompare(String(b.name)))
                .map((project) => (
                  <NavButton
                    key={project.id}
                    active={String(project.id) === activeProjectId}
                    onClick={() => onProjectSelect(String(project.id))}
                    icon={ICONS[project.name] || Folder}
                    badge={
                      project.status === 'done' ? (
                        <span className="ml-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">Done</span>
                      ) : (project.open_tasks ?? 0) > 0 ? (
                        <span
                          className="ml-2 rounded-full bg-[#1e2646] px-2 py-0.5 text-[11px] font-semibold text-[#cbd2e4] group-hover:bg-[#2a3460]"
                          title={`${project.open_tasks} open tasks`}
                        >
                          {project.open_tasks}
                        </span>
                      ) : null
                    }
                  >
                    {project.name}
                  </NavButton>
                ))}
            </nav>
          </div>
        ))}

        {quietCount > 0 && (
          <button
            onClick={() => setShowQuiet((v) => !v)}
            className="flex w-full items-center gap-2 px-4 text-xs font-medium text-[#64748b] hover:text-[#aab2c8]"
          >
            {showQuiet ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {showQuiet ? 'Hide' : 'Show'} {quietCount} empty project{quietCount === 1 ? '' : 's'}
          </button>
        )}

        <nav>
          <button className="w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors group text-left text-[#aab2c8] hover:bg-[#1e2646] hover:text-white">
            <Settings className="mr-3 flex-shrink-0 h-5 w-5 text-[#64748b] group-hover:text-emerald-400" />
            Settings
          </button>
        </nav>
      </div>

      <div className="p-4 border-t border-[#1e2646]">
        <div className="flex items-center px-4">
          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
            S
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
