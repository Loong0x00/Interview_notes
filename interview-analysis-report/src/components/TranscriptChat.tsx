import React from 'react';
import type { TranscriptSegment } from '../types';

interface TranscriptChatProps {
  segments: TranscriptSegment[];
  interviewerSpeaker: string;
  activeSegmentIndex: number | null;
  loading: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export default function TranscriptChat({ segments, interviewerSpeaker, activeSegmentIndex, loading, containerRef }: TranscriptChatProps) {
  const mergedSegments = React.useMemo(() => {
    if (segments.length === 0) return [];
    const merged: (TranscriptSegment & { originalIndices: number[] })[] = [];
    
    segments.forEach((seg, idx) => {
      const last = merged[merged.length - 1];
      if (last && last.speaker === seg.speaker) {
        last.text += '\n' + seg.text;
        last.originalIndices.push(idx);
      } else {
        merged.push({ ...seg, originalIndices: [idx] });
      }
    });
    return merged;
  }, [segments]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-text-secondary text-sm font-bold uppercase tracking-widest">加载转写中...</div>;
  }
  if (segments.length === 0) {
    return <div className="flex items-center justify-center h-96 text-text-secondary text-sm font-bold uppercase tracking-widest">暂无转写数据</div>;
  }

  return (
    <div ref={containerRef} className="overflow-y-auto px-6 py-6 space-y-6 scroll-smooth bg-bg-base flex-1 min-h-0">
      {mergedSegments.map((seg, idx) => {
        const isInterviewer = seg.speaker === interviewerSpeaker;
        const isActive = activeSegmentIndex !== null && seg.originalIndices.includes(activeSegmentIndex);
        const label = isInterviewer ? '面试官' : '候选人';

        return (
          <div
            key={idx}
            id={`transcript-seg-${seg.originalIndices[0]}`}
            className={`flex items-start gap-3 ${isInterviewer ? 'flex-row' : 'flex-row-reverse'}`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm ${isInterviewer ? 'bg-text-secondary' : 'bg-emerald-500'}`}>
              {isInterviewer ? '官' : '候'}
            </div>

            {/* Bubble container */}
            <div className={`flex flex-col gap-1.5 max-w-[85%] ${isInterviewer ? 'items-start' : 'items-end'}`}>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-1">
                {label} · {formatTime(seg.start_ms)}
              </span>
              <div className={`
                relative px-5 py-3.5 text-sm leading-relaxed transition-all duration-300 bento-shadow whitespace-pre-wrap
                ${isInterviewer
                  ? 'bg-bg-surface border border-border-main text-text-primary rounded-2xl rounded-tl-sm'
                  : 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm shadow-emerald-500/20'
                }
                ${isActive
                  ? 'ring-4 ring-emerald-500/30 scale-[1.02] z-10 shadow-xl'
                  : ''
                }
              `}>
                <p className="font-medium">{seg.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
