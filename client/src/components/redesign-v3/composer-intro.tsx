function formatComposerDate(now = new Date()) {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function ComposerIntro({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="v3-composer-date">{formatComposerDate()}</p>
      <h1 className="v3-composer-prompt mt-2">
        What&apos;s occupying
        <br />
        your mind?
      </h1>
    </div>
  );
}
