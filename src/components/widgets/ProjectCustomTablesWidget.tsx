"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, Loader2 } from 'lucide-react';
import { fetchProjectTable } from '@/lib/api';

const CUSTOM_TABLES = [
  { name: 'germany_tests', label: 'Tests' },
  { name: 'colleges', label: 'Colleges' },
  { name: 'applications', label: 'Applications' },
  { name: 'professors', label: 'Professors' },
  { name: 'research_papers', label: 'Research Papers' }
];

export default function ProjectCustomTablesWidget({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const results = await Promise.all(
          CUSTOM_TABLES.map(t => fetchProjectTable(projectId, t.name))
        );
        
        if (!mounted) return;

        const newData: { [key: string]: any[] } = {};
        let firstPopulatedTab = null;

        results.forEach((rows, i) => {
          if (rows && rows.length > 0) {
            newData[CUSTOM_TABLES[i].name] = rows;
            if (!firstPopulatedTab) firstPopulatedTab = CUSTOM_TABLES[i].name;
          }
        });

        setData(newData);
        if (firstPopulatedTab) setActiveTab(firstPopulatedTab);
      } catch (e) {
        console.error("Failed to load custom tables:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <Card className="shadow-sm border-0 rounded-xl overflow-hidden mt-6">
        <CardContent className="p-8 flex justify-center text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </CardContent>
      </Card>
    );
  }

  const populatedTables = CUSTOM_TABLES.filter(t => data[t.name]?.length > 0);
  
  if (populatedTables.length === 0) return null; // Invisible if no data

  const activeData = activeTab ? data[activeTab] : [];
  const headers = activeData.length > 0 ? Object.keys(activeData[0]).filter(k => !['id', 'user_id', 'workspace_id', 'project_id', 'created_at', 'updated_at'].includes(k)) : [];

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden flex flex-col mt-6">
      <CardHeader className="border-b bg-white px-6 py-4">
        <div className="flex items-center space-x-4 overflow-x-auto pb-1">
          {populatedTables.map(t => (
            <button
              key={t.name}
              onClick={() => setActiveTab(t.name)}
              className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === t.name 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-0 overflow-auto max-h-[500px]">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
            <tr>
              {headers.map(h => (
                <th key={h} className="px-6 py-3 font-semibold border-b border-gray-200">
                  {h.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeData.map((row, i) => (
              <tr key={row.id || i} className="hover:bg-gray-50 transition-colors">
                {headers.map(h => (
                  <td key={h} className="px-6 py-3 text-gray-700">
                    {row[h] !== null && row[h] !== undefined ? String(row[h]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
