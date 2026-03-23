interface InterimTranscriptProps {
  interimText: string;
  finalText: string;
}

export function InterimTranscript({
  interimText,
  finalText,
}: InterimTranscriptProps) {
  return (
    <div className="px-1 py-1 text-sm">
      {finalText && <span>{finalText} </span>}
      {interimText && (
        <span className="italic text-muted-foreground">{interimText}</span>
      )}
    </div>
  );
}
