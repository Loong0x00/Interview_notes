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
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function TranscriptChat({ segments, interviewerSpeaker, activeSegmentIndex, loading, containerRef }: TranscriptChatProps) {
  if (loading) {
    return <div className="flex items-center justify-center h-96 text-zinc-400 text-sm">加载转写中...</div>;
  }
  if (segments.length === 0) {
    return <div className="flex items-center justify-center h-96 text-zinc-400 text-sm">暂无转写数据</div>;
  }

  return (
    <div ref={containerRef} className="overflow-y-auto px-4 py-4 space-y-3 scroll-smooth bg-zinc-50/30" style={{ height: '600px' }}>
      {segments.map((seg, idx) => {
        const isInterviewer = seg.speaker === interviewerSpeaker;
        const isActive = idx === activeSegmentIndex;
        const label = isInterviewer ? '面试官' : '候选人';

        return (
          <div
            key={idx}
            id={`transcript-seg-${idx}`}
            className={`flex items-end gap-2 ${isInterviewer ? 'flex-row' : 'flex-row-reverse'}`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isInterviewer ? 'bg-zinc-400' : 'bg-indigo-500'}`}>
              {isInterviewer ? '官' : '候'}
            </div>

            {/* Bubble container */}
            <div className={`flex flex-col gap-0.5 max-w-[78%] ${isInterviewer ? 'items-start' : 'items-end'}`}>
              <span className="text-[10px] text-zinc-400 px-1">
                {label} · {formatTime(seg.start_ms)}
              </span>
              <div className={`
                relative px-3 py-2 text-sm leading-relaxed transition-all duration-300
                ${isInterviewer
                  ? 'bg-white border border-zinc-200 text-zinc-800 rounded-2xl rounded-tl-sm shadow-sm'
                  : 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-sm'
                }
                ${isActive
                  ? 'ring-2 ring-amber-400 shadow-md'
                  : ''
                }
              `}>
                {seg.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
