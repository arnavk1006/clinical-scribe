import { useState, useRef } from "react"

function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setUploadStatus("idle")

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          console.warn("No audio chunks collected.")
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        const file = new File([audioBlob], "recording.webm", { type: "audio/wav" })
        const formData = new FormData()
        formData.append("file", file)

        try {
          setUploadStatus("uploading")
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          })

          if (response.ok) {
            const result = await response.json()
            console.log("Upload success:", result)
            setUploadStatus("success")
          } else {
            console.error("Upload failed:", response.statusText)
            setUploadStatus("error")
          }
        } catch (error) {
          console.error("Error uploading audio:", error)
          setUploadStatus("error")
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Error accessing microphone:", err)
      setUploadStatus("error")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    setIsRecording(false)
  }

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xl shadow-slate-100/50">
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">
        Clinical Scribe
      </h1>
      
      <p className="text-sm text-slate-500 font-medium h-10 flex items-center justify-center">
        {isRecording 
          ? "Recording audio... Click to save & upload." 
          : uploadStatus === "uploading"
          ? "Uploading audio note..."
          : uploadStatus === "success"
          ? "Success! Note uploaded."
          : "Click to start recording clinical notes."}
      </p>

      <div className="relative flex items-center justify-center">
        {isRecording && (
          <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-rose-500/20 opacity-75"></span>
        )}
        <button
          onClick={handleToggleRecording}
          disabled={uploadStatus === "uploading"}
          className="group relative flex items-center justify-center p-0 border-0 bg-transparent cursor-pointer outline-none rounded-full transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-sky-500/50"
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          <img
            src={isRecording ? "/stop-recording.svg" : "/start-recording.svg"}
            alt={isRecording ? "Stop Recording" : "Start Recording"}
            className={`size-20 transition-all duration-300 ${
              isRecording 
                ? 'brightness-110 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]' 
                : 'hover:brightness-105 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)]'
            }`}
          />
        </button>
      </div>

      <div className="h-6 flex items-center justify-center">
        {isRecording ? (
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-rose-500 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            Recording Live
          </div>
        ) : uploadStatus === "success" ? (
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            ✓ Upload complete
          </span>
        ) : uploadStatus === "error" ? (
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
            ⚠ Connection Error
          </span>
        ) : null}
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-tr from-slate-50 to-slate-100 text-slate-800 font-sans p-6">
      <AudioRecorder />
    </div>
  )
}

export default App
