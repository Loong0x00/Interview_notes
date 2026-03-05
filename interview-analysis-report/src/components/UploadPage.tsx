import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileAudio, FileText, CheckCircle, AlertCircle, Loader, Sun, Moon, ArrowLeft } from "lucide-react";
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface UploadPageProps {
  onComplete: (reportName: string) => void;
  onBack: () => void;
}

interface JobState {
  id: string;
  status: string;
  progress: string;
  progressPercent?: number;
  error?: string;
  result?: string;
}

type UploadMode = "audio" | "transcript";

const AUDIO_ACCEPT_FORMATS = ".m4a,.mp3,.wav,.flac,.mp4,.aac,.ogg,.wma";
const TRANSCRIPT_ACCEPT_FORMATS = ".txt,.json,.srt,.vtt,.docx";

const AUDIO_STEPS = [
  { key: "transcribing", label: "语音转写", num: 1 },
  { key: "analyzing", label: "AI 分析", num: 2 },
];

const TRANSCRIPT_STEPS = [
  { key: "analyzing", label: "AI 分析", num: 1 },
];

function getAudioStepIndex(status: string): number {
  if (status === "uploading") return -1;
  if (status === "transcribing") return 0;
  if (status === "analyzing") return 1;
  if (status === "done") return 2;
  return -1;
}

function getTranscriptStepIndex(status: string): number {
  if (status === "uploading") return -1;
  if (status === "analyzing") return 0;
  if (status === "done") return 1;
  return -1;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadPage({ onComplete, onBack }: UploadPageProps) {
  const { authFetch, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mode, setMode] = useState<UploadMode>("audio");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [resumedFileName, setResumedFileName] = useState<string | null>(null);
  const [jdText, setJdText] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [interviewType, setInterviewType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const steps = mode === "audio" ? AUDIO_STEPS : TRANSCRIPT_STEPS;
  const totalSteps = steps.length;
  const getStepIndex = mode === "audio" ? getAudioStepIndex : getTranscriptStepIndex;
  const acceptFormats = mode === "audio" ? AUDIO_ACCEPT_FORMATS : TRANSCRIPT_ACCEPT_FORMATS;

  // Resume in-progress job on mount
  useEffect(() => {
    authFetch('/api/pipeline/jobs')
      .then(res => res.json())
      .then((jobs: Array<{ id: string; fileName: string; status: string; progress: string; result?: string; error?: string }>) => {
        const active = jobs.find(j => !['done', 'error'].includes(j.status));
        if (active) {
          setResumedFileName(active.fileName);
          setJob({ id: active.id, status: active.status, progress: active.progress });
          setUploading(true);
          connectSSE(active.id);
        }
      })
      .catch(() => {});
  }, []);

  const connectSSE = async (jobId: string) => {
    // Get a one-time nonce for SSE auth (avoids exposing JWT in URL)
    let nonce = "";
    try {
      const nonceRes = await authFetch("/api/pipeline/nonce", { method: "POST" });
      if (nonceRes.ok) {
        const nonceData = await nonceRes.json();
        nonce = nonceData.nonce;
      }
    } catch {
      // Fall through — SSE will fail with 401
    }

    const evtSource = new EventSource(`/api/pipeline/events/${jobId}?nonce=${encodeURIComponent(nonce)}`);

    evtSource.onmessage = (event) => {
      const data: JobState = JSON.parse(event.data);
      setJob(data);

      if (data.status === "done") {
        evtSource.close();
        setUploading(false);
        if (data.result) {
          // Set interview type if selected
          if (interviewType) {
            authFetch(`/api/reports/${encodeURIComponent(data.result)}/type`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ interviewType }),
            }).catch(() => {});
          }
          setTimeout(() => onComplete(data.result!), 1500);
        }
      } else if (data.status === "error") {
        evtSource.close();
        setUploading(false);
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      setUploading(false);
    };
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setJob(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const switchMode = useCallback((newMode: UploadMode) => {
    setMode(newMode);
    setFile(null);
    setJob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const startUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      if (mode === "audio") {
        formData.append("audio", file);
      } else {
        formData.append("transcript", file);
      }
      if (jdText.trim()) {
        formData.append("jdText", jdText.trim());
      }
      if (cvFile) {
        formData.append("cv", cvFile);
      }

      const endpoint = mode === "audio"
        ? "/api/pipeline/start"
        : "/api/pipeline/start-transcript";

      const res = await authFetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "上传失败");
      }

      const { jobId } = await res.json();
      setJob({ id: jobId, status: "uploading", progress: "已提交..." });
      connectSSE(jobId);
    } catch (err: any) {
      setJob({
        id: "",
        status: "error",
        progress: "上传失败",
        error: err.message,
      });
      setUploading(false);
    }
  }, [file, mode, onComplete, authFetch]);

  const stepIndex = job ? getStepIndex(job.status) : -2;

  const FileIcon = mode === "audio" ? FileAudio : FileText;

  return (
    <div className="min-h-screen bg-bg-base font-sans text-text-primary transition-colors duration-200">
      {/* Header — consistent with App.tsx list page */}
      <header className="bg-transparent">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-text-secondary bg-bg-surface bento-shadow border border-border-main rounded-full hover:text-emerald-600 transition-all"
            >
              <ArrowLeft size={18} />
              返回
            </button>
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">R</div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">上传面试</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full text-text-secondary hover:bg-bg-surface hover:text-emerald-600 transition-all bento-shadow border border-transparent hover:border-border-main"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button onClick={logout} className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium">退出登录</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ===== Left Column (4/12): JD + CV ===== */}
          <div className="lg:col-span-4 space-y-8">
            {/* JD Textarea */}
            <div className="bg-bg-surface rounded-3xl bento-shadow border border-border-main p-8 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">岗位 JD</h2>
                <p className="text-sm text-text-secondary mt-1">提供后将生成岗位画像与契合度</p>
              </div>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="粘贴岗位描述..."
                className="w-full h-48 p-5 bg-bg-base border border-border-main rounded-2xl text-base text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none"
              />
            </div>

            {/* CV Upload */}
            <div className="bg-bg-surface rounded-3xl bento-shadow border border-border-main p-8 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">求职者简历</h2>
                <p className="text-sm text-text-secondary mt-1">支持 PDF、Word 格式</p>
              </div>
              <div
                onClick={() => cvInputRef.current?.click()}
                className="relative group border-2 border-dashed border-border-main rounded-2xl p-8 transition-all hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 cursor-pointer bg-bg-base flex flex-col items-center justify-center space-y-3"
              >
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="w-12 h-12 bg-bg-surface rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-text-secondary group-hover:text-emerald-600" />
                </div>
                <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary">
                  {cvFile ? cvFile.name : '点击选择简历'}
                </span>
              </div>
            </div>
          </div>

          {/* ===== Right Column (8/12): Toggle + Upload + Progress ===== */}
          <div className="lg:col-span-8 space-y-8">

            {/* Upload Type Toggle — pill style */}
            {!job && (
              <div className="flex bg-bg-surface bento-shadow border border-border-main p-1.5 rounded-full w-fit">
                <button
                  onClick={() => switchMode("audio")}
                  className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                    mode === "audio"
                      ? "bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  面试录音
                </button>
                <button
                  onClick={() => switchMode("transcript")}
                  className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                    mode === "transcript"
                      ? "bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  面试逐字稿
                </button>
              </div>
            )}

            {/* Sub-grid: Upload zone + Progress tracker */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Drop Zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`
                  group relative min-h-[320px] border-2 border-dashed rounded-3xl p-10
                  transition-all duration-300 flex flex-col items-center justify-center text-center
                  ${uploading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  ${
                    dragging
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : file
                      ? "border-emerald-300 dark:border-emerald-700 bg-bg-surface bento-shadow"
                      : "border-border-main bg-bg-surface bento-shadow hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/5"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptFormats}
                  onChange={onFileSelect}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
                      <FileIcon className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-text-primary">
                        {file.name}
                      </p>
                      <p className="text-sm text-text-secondary mt-1">
                        {formatSize(file.size)}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-emerald-600 pt-2 uppercase tracking-wider">
                      点击更换文件
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-bg-base rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-text-secondary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-text-primary">
                        {mode === "audio" ? "上传面试录音" : "上传逐字稿文件"}
                      </p>
                      <p className="text-sm text-text-secondary max-w-[200px] mx-auto">
                        拖拽文件到此处或点击选择开始 AI 分析
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Tracker Panel */}
              <div className="bg-bg-surface rounded-3xl p-8 flex flex-col justify-center space-y-6 bento-shadow border border-border-main">
                <h3 className="text-base font-bold text-text-primary">
                  处理进度
                </h3>
                <div className="space-y-6">
                  {steps.map((step, i) => {
                    const isActive = job ? stepIndex === i : false;
                    const isDone = job ? (stepIndex > i || job.status === "done") : false;

                    return (
                      <div key={step.key} className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-xs font-bold uppercase tracking-widest ${
                              isActive
                                ? "text-emerald-600"
                                : isDone
                                ? "text-emerald-600"
                                : "text-text-secondary"
                            }`}
                          >
                            {step.label}
                          </span>
                          <div className="flex items-center gap-2">
                            {isDone && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {isActive && <Loader className="w-4 h-4 text-emerald-600 animate-spin" />}
                          </div>
                        </div>
                        {/* Horizontal progress bar */}
                        <div className="h-2.5 w-full bg-bg-base rounded-full overflow-hidden border border-border-main">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              isDone || isActive
                                ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                : "bg-text-secondary/20"
                            }`}
                            style={{
                              width: isDone
                                ? "100%"
                                : isActive && job?.progressPercent
                                ? `${job.progressPercent}%`
                                : isActive
                                ? "15%"
                                : "0%",
                            }}
                          />
                        </div>
                        {/* Show progress text */}
                        {isActive && job && (
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-medium text-text-secondary">
                              {job.progress}
                            </p>
                            {job.progressPercent !== undefined && (
                              <span className="text-xs font-bold text-emerald-600">
                                {job.progressPercent}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* File info when job is active */}
                {job && job.status !== "error" && job.status !== "done" && (
                  <p className="text-xs font-medium text-text-secondary pt-4 border-t border-border-main truncate">
                    正在处理：{file?.name || resumedFileName || ''}
                  </p>
                )}

                {/* Done State */}
                {job && job.status === "done" && (
                  <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl text-center shadow-sm">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                    <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                      分析完成！正在进入报告...
                    </p>
                  </div>
                )}

                {/* Error State */}
                {job && job.status === "error" && (
                  <div className="p-5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-700 dark:text-red-300 font-bold text-sm">处理失败</p>
                        <p className="text-red-600 dark:text-red-400 text-xs mt-1 font-medium leading-relaxed">
                          {job.error || "发生了未知错误"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setJob(null);
                        setFile(null);
                        setJdText("");
                        setCvFile(null);
                        setShowContext(false);
                      }}
                      className="mt-4 w-full py-2.5 text-xs font-bold bg-white dark:bg-bg-surface border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl hover:bg-red-50 transition-all"
                    >
                      重新尝试
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Interview Type */}
            {!job && (
              <div className="flex items-center justify-center gap-3">
                <span className="text-sm font-bold text-text-secondary">面试轮次</span>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="px-4 py-2 bg-bg-base border border-border-main rounded-full text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">未指定</option>
                  <option value="一面">一面</option>
                  <option value="二面">二面</option>
                  <option value="三面">三面</option>
                  <option value="HR面">HR面</option>
                  <option value="终面">终面</option>
                </select>
              </div>
            )}

            {/* Upload Button */}
            {file && !job && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={startUpload}
                  disabled={uploading}
                  className="px-12 py-4 bg-emerald-600 text-white text-lg font-bold rounded-full
                    hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all shadow-lg shadow-emerald-500/25 group flex items-center gap-3"
                >
                  {uploading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      正在上传
                    </>
                  ) : (
                    <>
                      开始分析
                      <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="text-xs text-text-secondary text-center py-6">&copy; 2026 Loong0x00 &amp; AmandaWWW</footer>
    </div>
  );
}
