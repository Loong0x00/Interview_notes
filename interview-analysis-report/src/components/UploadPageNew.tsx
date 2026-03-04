import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Upload, CheckCircle2, MessageSquare, Filter, BarChart3 } from 'lucide-react';

// --- 核心状态与逻辑 (需放在组件内部) ---
/*
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'audio' | 'transcript'>('audio');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating'>('idle');
  const [jdText, setJdText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const stages = [
    { id: 'uploading', label: '上传 (Uploading)' },
    { id: 'transcribing', label: '转文字 (Transcribing)' },
    { id: 'analyzing', label: 'AI 分析 (AI Analyzing)' },
    { id: 'generating', label: '报告生成 (Generating Report)' }
  ];
*/

// --- 上传页面组件代码块 ---
const UploadScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full space-y-8"
      >
        {/* 标题区域 */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-tight text-gray-900">面试洞察 AI</h1>
          <p className="text-gray-500 font-light">上传面试录音或逐字稿，结合简历及岗位 JD，开始 AI 深度分析。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 左侧：上下文输入 (JD & 简历) */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">岗位 JD (选填)</label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="粘贴岗位描述..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-black/5 transition-all resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">求职者简历 (选填)</label>
              <div className="relative group border-2 border-dashed border-gray-100 rounded-2xl p-6 transition-all hover:border-gray-300 cursor-pointer bg-gray-50/50 flex flex-col items-center justify-center space-y-2">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <Upload className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {resumeFile ? resumeFile.name : '上传 PDF 或 Word 简历'}
                </span>
              </div>
            </div>
          </div>

          {/* 右侧两栏：主上传区与进度追踪 */}
          <div className="md:col-span-2 space-y-6">
            {/* 类型切换按钮 */}
            <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
              <button
                onClick={() => setUploadType('audio')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${uploadType === 'audio' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
              >
                面试录音
              </button>
              <button
                onClick={() => setUploadType('transcript')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${uploadType === 'transcript' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
              >
                面试逐字稿
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 点击上传区域 */}
              <div
                onClick={!isUploading ? handleUpload : undefined}
                className={`group relative h-[280px] border-2 border-dashed border-gray-200 rounded-3xl p-8 transition-all hover:border-gray-400 cursor-pointer bg-gray-50/50 flex flex-col items-center justify-center text-center ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold">点击上传{uploadType === 'audio' ? '录音' : '逐字稿'}</p>
                  <p className="text-xs text-gray-400">
                    {uploadType === 'audio' ? '支持 MP3, WAV, M4A' : '支持 Word, TXT, PDF'}
                  </p>
                </div>
              </div>

              {/* 进度追踪面板 */}
              <div className="bg-gray-50/50 rounded-3xl p-8 flex flex-col justify-center space-y-6 border border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">处理进度</h3>
                <div className="space-y-6">
                  {stages.map((stage, idx) => {
                    const isCurrent = currentStage === stage.id;
                    const isDone = stages.findIndex(s => s.id === currentStage) > idx;

                    return (
                      <div key={stage.id} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-black' : isDone ? 'text-emerald-500' : 'text-gray-400'}`}>
                            {stage.label}
                          </span>
                          {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: isDone ? '100%' : isCurrent ? `${uploadProgress}%` : '0%'
                            }}
                            className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-black'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadScreen;
