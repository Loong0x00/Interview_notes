import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileAudio, FileText, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { useAuth } from '../contexts/AuthContext';

interface UploadPageProps {
  onComplete: (reportName: string) => void;
  onBack: () => void;
}

interface JobState {
  id: string;
  status: string;
  progress: string;
  error?: string;
  result?: string;
}

type UploadMode = "audio" | "transcript";

const AUDIO_ACCEPT_FORMATS = ".m4a,.mp3,.wav,.flac,.mp4,.aac,.ogg,.wma";
const TRANSCRIPT_ACCEPT_FORMATS = ".txt,.json,.srt,.vtt,.docx";

const AUDIO_STEPS = [
  { key: "transcribing", label: "语音转写", num: 1 },
  { key: "analyzing", label: "AI 分析", num: 2 },
  { key: "converting", label: "结构化转换", num: 3 },
];

const TRANSCRIPT_STEPS = [
  { key: "analyzing", label: "AI 分析", num: 1 },
  { key: "converting", label: "结构化转换", num: 2 },
];

function getAudioStepIndex(status: string): number {
  if (status === "uploading") return -1;
  if (status === "transcribing") return 0;
  if (status === "analyzing") return 1;
  if (status === "converting") return 2;
  if (status === "done") return 3;
  return -1;
}

function getTranscriptStepIndex(status: string): number {
  if (status === "uploading") return -1;
  if (status === "analyzing") return 0;
  if (status === "converting") return 1;
  if (status === "done") return 2;
  return -1;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadPage({ onComplete, onBack }: UploadPageProps) {
  const { authFetch } = useAuth();
  const [mode, setMode] = useState<UploadMode>("audio");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [resumedFileName, setResumedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const connectSSE = (jobId: string) => {
    const token = localStorage.getItem('interview_auth_token') || '';
    const evtSource = new EventSource(`/api/pipeline/events/${jobId}?token=${encodeURIComponent(token)}`);

    evtSource.onmessage = (event) => {
      const data: JobState = JSON.parse(event.data);
      setJob(data);

      if (data.status === "done") {
        evtSource.close();
        setUploading(false);
        if (data.result) {
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              R
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {mode === "audio" ? "Upload Interview Audio" : "Upload Transcript"}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Back to Reports
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Mode Toggle */}
        {!job && (
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1">
              <button
                onClick={() => switchMode("audio")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "audio"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                音频文件
              </button>
              <button
                onClick={() => switchMode("transcript")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "transcript"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                转录文件
              </button>
            </div>
          </div>
        )}

        {/* Drop Zone */}
        {!job && (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-all duration-200
              ${
                dragging
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                  : file
                  ? "border-indigo-300 bg-white dark:bg-zinc-900"
                  : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:border-indigo-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
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
              <div className="space-y-3">
                <FileIcon className="w-12 h-12 text-indigo-500 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    {file.name}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {formatSize(file.size)}
                  </p>
                </div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Click or drag to replace
                </p>
              </div>
            ) : mode === "audio" ? (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-zinc-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                    Drag audio file here or click to browse
                  </p>
                  <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                    Supported: M4A, MP3, WAV, FLAC, MP4, AAC, OGG, WMA
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-zinc-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                    拖拽转录文件到此处或点击选择
                  </p>
                  <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                    支持：TXT, JSON, SRT, VTT, DOCX（飞书、钉钉、腾讯会议、通义听悟导出）
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Button */}
        {file && !job && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={startUpload}
              disabled={uploading}
              className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg
                hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors shadow-sm"
            >
              {uploading ? "Uploading..." : "Start Analysis"}
            </button>
          </div>
        )}

        {/* Progress Section */}
        {job && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:shadow-zinc-900/50 border border-zinc-200 dark:border-zinc-700 p-8 mt-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              处理中：{file?.name || resumedFileName || ''}
            </h2>

            {/* Step Tracker */}
            <div className="space-y-4">
              {steps.map((step, i) => {
                const isActive = stepIndex === i;
                const isDone = stepIndex > i || job.status === "done";
                const isPending = stepIndex < i && job.status !== "done";

                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div
                      className={`
                        w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                        ${isDone ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400" : ""}
                        ${isActive ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : ""}
                        ${isPending ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500" : ""}
                      `}
                    >
                      {isDone ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isActive ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <span className="text-sm font-medium">{step.num}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          isDone
                            ? "text-green-700 dark:text-green-300"
                            : isActive
                            ? "text-indigo-700 dark:text-indigo-300"
                            : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        [{step.num}/{totalSteps}] {step.label}
                      </p>
                      {isActive && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {job.progress}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Done State */}
            {job.status === "done" && (
              <div className="mt-8 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-500 dark:text-green-400 mx-auto mb-2" />
                <p className="text-green-800 dark:text-green-300 font-medium">
                  Analysis complete! Redirecting to report...
                </p>
              </div>
            )}

            {/* Error State */}
            {job.status === "error" && (
              <div className="mt-8 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 dark:text-red-300 font-medium">Processing Failed</p>
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {job.error || "Unknown error"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setJob(null);
                    setFile(null);
                  }}
                  className="mt-4 px-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
