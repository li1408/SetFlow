import { useRef, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import {
  exercisePreviewMediaById,
  type ExercisePreviewMedia,
} from "../../domain/exercises/exercise-preview-media";

interface WorkoutExercisePreviewProps {
  exerciseId: string;
  exerciseName: string;
}

export function WorkoutExercisePreview({
  exerciseId,
  exerciseName,
}: WorkoutExercisePreviewProps) {
  const media = exercisePreviewMediaById[exerciseId];
  if (!media) return null;

  return <PreviewContent exerciseName={exerciseName} media={media} />;
}

function PreviewContent({
  exerciseName,
  media,
}: {
  exerciseName: string;
  media: ExercisePreviewMedia;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canAnimate = media.kind !== "sequence" || media.frames.length > 1;

  const togglePlayback = () => {
    if (media.kind === "video") {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        void video.play().catch(() => setIsPlaying(false));
      } else {
        video.pause();
      }
      return;
    }
    if (canAnimate) setIsPlaying((playing) => !playing);
  };

  if (media.kind === "video") {
    return (
      <button
        className="workout-demo workout-demo--video"
        type="button"
        aria-label={`${isPlaying ? "暂停" : "播放"}${exerciseName}动作演示`}
        onClick={togglePlayback}
      >
        <video
          ref={videoRef}
          aria-hidden="true"
          loop
          muted
          playsInline
          poster={media.poster}
          preload="metadata"
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        >
          <source src={media.src} type={media.type} />
        </video>
        <PlaybackLabel isPlaying={isPlaying} />
      </button>
    );
  }

  if (media.kind === "animated-image") {
    return (
      <button
        className="workout-demo workout-demo--animated"
        type="button"
        aria-label={`${isPlaying ? "暂停" : "播放"}${exerciseName}动作演示`}
        onClick={togglePlayback}
      >
        {isPlaying ? (
          <img src={media.src} alt="" aria-hidden="true" />
        ) : (
          <span className="workout-demo__cover" aria-hidden="true">
            <strong>{exerciseName}</strong>
            <small>离线动作演示</small>
          </span>
        )}
        <PlaybackLabel isPlaying={isPlaying} />
      </button>
    );
  }

  const hasMultipleFrames = media.frames.length > 1;
  const style = {
    "--workout-demo-frame-interval": `${media.intervalMs ?? 1400}ms`,
  } as CSSProperties;
  const frameContent = (
    <div
      className={`workout-demo__frames${
        hasMultipleFrames ? " workout-demo__frames--sequence" : ""
      }${isPlaying ? " workout-demo__frames--playing" : ""}`}
      style={style}
    >
      {media.frames.map((frame, index) => (
        <img
          className="workout-demo__frame"
          src={frame.src}
          alt={hasMultipleFrames ? "" : `${exerciseName} · ${frame.label}`}
          aria-hidden={hasMultipleFrames ? "true" : undefined}
          key={frame.src}
          style={{ "--workout-demo-frame-index": index } as CSSProperties}
        />
      ))}
    </div>
  );

  if (!hasMultipleFrames) {
    return <div className="workout-demo workout-demo--still">{frameContent}</div>;
  }

  return (
    <button
      className="workout-demo"
      type="button"
      aria-label={`${isPlaying ? "暂停" : "播放"}${exerciseName}动作演示`}
      onClick={togglePlayback}
    >
      {frameContent}
      <PlaybackLabel isPlaying={isPlaying} />
    </button>
  );
}

function PlaybackLabel({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span className="workout-demo__control" aria-hidden="true">
      {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
      {isPlaying ? "暂停演示" : "播放演示"}
    </span>
  );
}
