interface Recording {
  id?: string;
  title?: string;
  date: string;
  time: string;
  duration: string;
  instructor: string;
  isViewed: boolean;
}

interface TranscriptEntry {
  timestamp: string;  // in format "00:00:00"
  text: string;
}

interface LectureContent {
  recording: Recording;
  transcript: TranscriptEntry[];
} 