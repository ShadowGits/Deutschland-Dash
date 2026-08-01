'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, FileSpreadsheet, Upload, X } from 'lucide-react';

export default function CSVTableWidget() {
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setHeaders(Object.keys(results.data[0] as object));
          setData(results.data as any[]);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
      }
    });
  };

  const clearData = () => {
    setData([]);
    setHeaders([]);
    setFileName(null);
  };

  return (
    <Card className="shadow-sm border-0 rounded-xl overflow-hidden h-full flex flex-col">
      <CardHeader className="border-b bg-white px-6 py-5 flex flex-row items-center justify-between sticky top-0 z-10">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
          <Table className="mr-2 text-indigo-500" size={20} />
          {fileName ? `Data: ${fileName}` : 'CSV Data Viewer'}
        </CardTitle>
        <div className="flex items-center space-x-2">
          {data.length > 0 ? (
            <button 
              onClick={clearData}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Clear Data"
            >
              <X size={18} />
            </button>
          ) : (
            <label className="cursor-pointer bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center">
              <Upload size={16} className="mr-1.5" />
              Upload CSV
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </label>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-auto bg-gray-50/30">
        {data.length > 0 ? (
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 uppercase bg-gray-100 sticky top-0 z-10">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-6 py-3 font-semibold border-b border-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-white transition-colors">
                    {headers.map((h, j) => (
                      <td key={j} className="px-6 py-3 text-gray-700">
                        {row[h] !== undefined && row[h] !== null ? String(row[h]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 p-8">
            <FileSpreadsheet size={48} className="mb-4 text-gray-300 opacity-50" />
            <p className="text-base font-medium text-gray-500">No data loaded</p>
            <p className="text-sm mt-1">Upload a CSV file to view it as an interactive table.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
