import React, { useState, useRef, useCallback } from "react";
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader } from "lucide-react";
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

const ACCEPT_FORMATS = ".m4a,.mp3,.wav,.flac,.mp4,.aac,.ogg,.wma";
const STEPS = [
  { key: "transcribing", label: "语音转写", num: 1 },
  { key: "analyzing", label: "AI 分析", num: 2 },
  { key: "converting", label: "结构化转换", num: 3 },
];

function getStepIndex(status: string): number {
  if (status === "uploading") return -1;
  if (status === "transcribing") return 0;
  if (status === "analyzing") return 1;
  if (status === "converting") return 2;
  if (status === "done") return 3;
  return -1;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadPage({ onComplete, onBack }: UploadPageProps) {
  const { authFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const startUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await authFetch("/api/pipeline/start", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "上传失败");
      }

      const { jobId } = await res.json();
      setJob({ id: jobId, status: "uploading", progress: "已提交..." });

      // Start SSE connection (EventSource doesn't support custom headers, pass token as query param)
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
    } catch (err: any) {
      setJob({
        id: "",
        status: "error",
        progress: "上传失败",
        error: err.message,
      });
      setUploading(false);
    }
  }, [file, onComplete, authFetch]);

  const stepIndex = job ? getStepIndex(job.status) : -2;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              R
            </div>
            <h1 className="text-lg font-bold text-zinc-900">
              Upload Interview Audio
            </h1>
          </div>
          <button
            onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Back to Reports
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
                  ? "border-indigo-500 bg-indigo-50"
                  : file
                  ? "border-indigo-300 bg-white"
                  : "border-zinc-300 bg-white hover:border-indigo-300 hover:bg-zinc-50"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_FORMATS}
              onChange={onFileSelect}
              className="hidden"
            />

            {file ? (
              <div className="space-y-3">
                <FileAudio className="w-12 h-12 text-indigo-500 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-zinc-900">
                    {file.name}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {formatSize(file.size)}
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  Click or drag to replace
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-zinc-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium text-zinc-700">
                    Drag audio file here or click to browse
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Supported: M4A, MP3, WAV, FLAC, MP4, AAC, OGG, WMA
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
          <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-8 mt-0">
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">
              Processing: {file?.name}
            </h2>

            {/* Step Tracker */}
            <div className="space-y-4">
              {STEPS.map((step, i) => {
                const isActive = stepIndex === i;
                const isDone = stepIndex > i || job.status === "done";
                const isPending = stepIndex < i && job.status !== "done";

                return (
                  <div key={step.key} className="flex items-center gap-4">
                    <div
                      className={`
                        w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                        ${isDone ? "bg-green-100 text-green-600" : ""}
                        ${isActive ? "bg-indigo-100 text-indigo-600" : ""}
                        ${isPending ? "bg-zinc-100 text-zinc-400" : ""}
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
                            ? "text-green-700"
                            : isActive
                            ? "text-indigo-700"
                            : "text-zinc-400"
                        }`}
                      >
                        [{step.num}/3] {step.label}
                      </p>
                      {isActive && (
                        <p className="text-sm text-zinc-500 mt-0.5">
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
              <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-green-800 font-medium">
                  Analysis complete! Redirecting to report...
                </p>
              </div>
            )}

            {/* Error State */}
            {job.status === "error" && (
              <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Processing Failed</p>
                    <p className="text-red-600 text-sm mt-1">
                      {job.error || "Unknown error"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setJob(null);
                    setFile(null);
                  }}
                  className="mt-4 px-4 py-2 text-sm bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
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
