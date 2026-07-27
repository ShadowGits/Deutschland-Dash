'use client';

import { useState, useTransition } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonthlyGoal, updateMonthlyGoal, deleteMonthlyGoal } from '@/app/actions';
import { Trash2, Save, Loader2, Plus } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Goal {
  id: string;
  month: string;
  description: string;
  status: string;
}

export default function MonthlyGoalsTable({ 
  projectId, 
  goals: initialGoals 
}: { 
  projectId: string, 
  goals: Goal[] 
}) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  
  // New goal state
  const [newMonth, setNewMonth] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Generate month options
  const monthOptions = [];
  const today = new Date();
  for (let i = -2; i <= 6; i++) {
    const d = startOfMonth(addMonths(today, i));
    monthOptions.push({
      value: format(d, 'yyyy-MM-dd'),
      label: format(d, 'MMMM yyyy')
    });
  }

  const handleSaveEdit = (goalId: string) => {
    if (!editDesc.trim()) return;
    startTransition(async () => {
      await updateMonthlyGoal(goalId, editDesc);
      setEditingId(null);
    });
  };

  const handleAdd = () => {
    if (!newMonth || !newDesc.trim()) return;
    startTransition(async () => {
      await addMonthlyGoal(projectId, newMonth, newDesc);
      setNewMonth('');
      setNewDesc('');
    });
  };

  const handleDelete = (goalId: string) => {
    startTransition(async () => {
      await deleteMonthlyGoal(goalId);
    });
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
            <TableHead className="w-[200px]">Month</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialGoals.map((goal) => (
            <TableRow key={goal.id} className="group">
              <TableCell className="font-medium">
                {format(new Date(goal.month), 'MMMM yyyy')}
              </TableCell>
              
              <TableCell>
                {editingId === goal.id ? (
                  <Input 
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(goal.id)}
                    autoFocus
                    className="h-8"
                  />
                ) : (
                  <span 
                    className="cursor-pointer hover:underline underline-offset-4 decoration-gray-300 decoration-dashed"
                    onClick={() => {
                      setEditingId(goal.id);
                      setEditDesc(goal.description);
                    }}
                  >
                    {goal.description}
                  </span>
                )}
              </TableCell>
              
              <TableCell>
                <Badge variant={goal.status === 'done' ? 'default' : 'secondary'} className={goal.status === 'done' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                  {goal.status}
                </Badge>
              </TableCell>
              
              <TableCell className="text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {editingId === goal.id ? (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => handleSaveEdit(goal.id)} disabled={isPending}>
                      <Save size={16} />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(goal.id)} disabled={isPending}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          
          {/* Add New Row */}
          <TableRow className="bg-emerald-50/30 hover:bg-emerald-50/50">
            <TableCell>
              <Select value={newMonth} onValueChange={(v) => v && setNewMonth(v)}>
                <SelectTrigger className="h-8 border-emerald-200">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Input 
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Type new goal description..."
                className="h-8 border-emerald-200"
              />
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-gray-400 border-gray-200">New</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button 
                size="sm" 
                className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white w-full"
                onClick={handleAdd}
                disabled={isPending || !newMonth || !newDesc.trim()}
              >
                {isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus size={16} />}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
