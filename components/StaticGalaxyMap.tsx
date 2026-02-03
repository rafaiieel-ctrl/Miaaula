

import React, { useMemo } from 'react';
import { Question, AppSettings } from '../types';
import * as srs from '../services/srsService';

interface StaticGalaxyMapProps {
  questions: Question[];
  settings: AppSettings;
  width: number;
  height: number;
}

const StaticGalaxyMap: React.FC<StaticGalaxyMapProps> = ({ questions, settings, width, height }) => {
  const padding = { top: 20, right: 20, bottom: 60, left: 40 };

  const { subjectLanes, points, yLabels } = useMemo(() => {
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const subjects = [...new Set(questions.map(q => q.subject || 'Outros'))].sort();
    const laneWidth = subjects.length > 0 ? innerWidth / subjects.length : innerWidth;

    const lanes = subjects.map((name, i) => ({
      name,
      xStart: padding.left + i * laneWidth,
      xEnd: padding.left + (i + 1) * laneWidth,
      xCenter: padding.left + i * laneWidth + laneWidth / 2,
    }));

    const pts = questions.map(q => {
      const mastery = srs.calculateCurrentDomain(q, settings);
      const lane = lanes.find(l => l.name === (q.subject || 'Outros'));
      
      const jitter = (Math.random() - 0.5) * laneWidth * 0.8;
      const x = lane ? lane.xCenter + jitter : padding.left + Math.random() * innerWidth;
      const y = padding.top + innerHeight - (mastery / 100) * innerHeight;
      
      let radius = 2.5;
      if (q.hotTopic) radius = 4;
      if (q.isCritical) radius = 4;

      let color = 'rgb(16, 185, 129)'; // emerald-500
      if (mastery < 40) color = 'rgb(239, 68, 68)'; // red-500
      else if (mastery < 80) color = 'rgb(245, 158, 11)'; // amber-500

      return {
        id: q.id,
        x,
        y,
        radius,
        color,
        isCritical: q.isCritical,
      };
    });
    
    const yLbls = [0, 25, 50, 75, 100].map(val => ({
        value: val,
        y: padding.top + innerHeight - (val / 100) * innerHeight
    }));

    return { subjectLanes: lanes, points: pts, yLabels: yLbls };
  }, [questions, settings, width, height]);

  if (questions.length === 0) {
    return (
        <div style={{ width, height }} className="flex items-center justify-center text-sm text-slate-500">
            Nenhuma questão para exibir no mapa.
        </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white">
      {/* Y-Axis Labels and Grid Lines */}
      {yLabels.map(label => (
        <g key={label.value}>
          <line
            x1={padding.left} y1={label.y}
            x2={width - padding.right} y2={label.y}
            stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2,2" />
          <text x={padding.left - 8} y={label.y + 4} textAnchor="end" fontSize="10" fill="#64748b">
            {label.value}%
          </text>
        </g>
      ))}
      <text transform={`translate(12, ${height/2}) rotate(-90)`} textAnchor="middle" fontSize="11" fontWeight="600" fill="#475569">
            Domínio
      </text>

      {/* Subject Lanes and Labels */}
      {subjectLanes.map((lane, i) => (
        <g key={lane.name}>
          {i > 0 && <line x1={lane.xStart} y1={padding.top} x2={lane.xStart} y2={height - padding.bottom} stroke="#f1f5f9" strokeWidth="1" />}
          <text x={lane.xCenter} y={height - padding.bottom + 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
            {lane.name}
          </text>
        </g>
      ))}
      
      {/* Data Points */}
      {points.map(p => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.radius}
          fill={p.color}
          stroke={p.isCritical ? '#f59e0b' : 'none'}
          strokeWidth="1.5"
          opacity="0.7"
        />
      ))}
    </svg>
  );
};

export default StaticGalaxyMap;