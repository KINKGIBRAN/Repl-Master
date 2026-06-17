import React from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
}

/**
 * Mini progress bar for inventory visualization
 * Shows proportion of items in a category
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  label, 
  value, 
  max, 
  color = 'bg-primary' 
}) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="status-number text-sm">{value}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full progress-bar-denim transition-all duration-300 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground text-right">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
};

interface MiniDonutProps {
  value: number;
  max: number;
  label: string;
}

/**
 * Mini donut chart for quick inventory overview
 */
export const MiniDonut: React.FC<MiniDonutProps> = ({ value, max, label }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const circumference = 2 * Math.PI * 45; // radius 45
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg width="100" height="100" viewBox="0 0 100 100" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="6"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="status-number">{value}</div>
            <div className="text-[10px] text-muted-foreground">dari {max}</div>
          </div>
        </div>
      </div>
      <p className="text-xs font-medium text-center text-card-foreground">{label}</p>
      <p className="text-xs text-primary font-semibold">{percentage.toFixed(0)}%</p>
    </div>
  );
};

interface StatusGridProps {
  items: Array<{
    label: string;
    value: number;
    status: 'in-stock' | 'in-use' | 'need-repair' | 'broken' | 'service';
  }>;
}

/**
 * Status grid showing all inventory states with color coding
 */
export const StatusGrid: React.FC<StatusGridProps> = ({ items }) => {
  const statusStyles = {
    'in-stock': 'status-in-stock',
    'in-use': 'status-in-use',
    'need-repair': 'status-need-repair',
    'broken': 'status-broken',
    'service': 'status-service',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={`p-3 rounded-lg border denim-texture flex flex-col items-center justify-center gap-1 ${
            statusStyles[item.status]
          }`}
        >
          <div className="status-number text-base">{item.value}</div>
          <div className="text-xs font-medium text-center">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

export default {
  ProgressBar,
  MiniDonut,
  StatusGrid,
};
